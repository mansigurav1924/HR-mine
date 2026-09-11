import logging
from uuid import UUID
from datetime import datetime
from fastapi import HTTPException
from pydantic import ValidationError

from app.services.supabase_client import supabase
from app.services.ml_model_service import MLModelService
from app.services.skill_matching_service import SkillMatchingService
from app.services.pdf_parser import extract_text_from_pdf
from app.services.docx_parser import extract_text_from_docx
from app.schemas.ml import MLEvaluationResponse, MLBatchEvaluationResponse

logger = logging.getLogger(__name__)

class MLEvaluationService:
    def __init__(self):
        self.ml_service = MLModelService()
        
    def _fetch_resume_text(self, resume_url: str) -> str:
        if not resume_url:
            raise ValueError("Application has no resume attached.")
            
        file_ext = resume_url.split('.')[-1].lower() if '.' in resume_url else ''
        try:
            storage_res = supabase.storage.from_("resumes").download(resume_url)
        except Exception as e:
            logger.error(f"Failed to download resume: {e}")
            raise ValueError("Failed to download resume from storage.")
            
        if file_ext == 'pdf':
            return extract_text_from_pdf(storage_res)
        elif file_ext in ['doc', 'docx']:
            return extract_text_from_docx(storage_res)
        else:
            raise ValueError("Unsupported resume format for ML evaluation.")

    def evaluate_application(self, application_id: str) -> MLEvaluationResponse:
        if not self.ml_service.available:
            raise HTTPException(status_code=503, detail="ML model is currently unavailable.")
            
        # 1. Fetch application and verify status
        app_res = supabase.table("applications").select("*").eq("application_id", application_id).single().execute()
        app_data = app_res.data
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found.")
            
        if app_data.get("current_status") == "withdrawn":
            raise HTTPException(status_code=400, detail="Cannot evaluate withdrawn applications.")
            
        position_id = app_data.get("position_id")
        if not position_id:
            raise HTTPException(status_code=400, detail="Application is not attached to a valid position.")
            
        # 2. Fetch Job Requirement
        job_res = supabase.table("job_requirements").select("*").eq("position_id", position_id).single().execute()
        job_data = job_res.data
        if not job_data:
            raise HTTPException(status_code=404, detail="Job Requirement not found.")
            
        if job_data.get("is_active") is False or job_data.get("status") == "inactive":
            raise HTTPException(status_code=400, detail="Associated position is not active.")
            
        # 3. Get Resume Text
        try:
            text = self._fetch_resume_text(app_data.get("resume_url"))
            if not text.strip():
                raise ValueError("Extracted resume text is empty.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
            
        # 4. Predict
        # Preprocessing masking is handled internally by the trained sklearn Pipeline
        prediction = self.ml_service.predict(text)
        predicted_class = prediction["predicted_class"]
        match_score = prediction["match_score"]
        
        # 5. Skill Matching
        cand_skills = app_data.get("skills", [])
        req_skills = job_data.get("required_skills", [])
        pref_skills = job_data.get("preferred_skills", [])
        
        matching, missing = SkillMatchingService.match_skills(cand_skills, req_skills, pref_skills)
        
        # 6. Build recommendation string
        if predicted_class == "good_intern":
            recommendation = "Model indicates higher suitability. HR review required."
        else:
            recommendation = "Model indicates lower suitability. HR review required."
            
        # 7. Persist to DB
        eval_record = {
            "application_id": application_id,
            "position_id": position_id,
            "model_version": self.ml_service.version,
            "predicted_class": predicted_class,
            "match_score": match_score,
            "matching_skills": matching,
            "missing_skills": missing,
            "relevant_experience": app_data.get("experience"),
            "relevant_projects": app_data.get("projects"),
            "recommendation": recommendation,
            "evaluated_at": datetime.utcnow().isoformat()
        }
        
        insert_res = supabase.table("ml_evaluations").insert(eval_record).execute()
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to save evaluation to database.")
            
        saved_eval = insert_res.data[0]
        
        # 8. Update application status if eligible
        eligible_statuses = ["application_received", "under_review"]
        current_status = app_data.get("current_status")
        
        if current_status in eligible_statuses:
            supabase.table("applications").update({"current_status": "ml_evaluated"}).eq("application_id", application_id).execute()
            
            # Audit log for status transition
            audit_log = {
                "action": "APPLICATION_STATUS_CHANGED",
                "entity_type": "application",
                "entity_id": application_id,
                "metadata": {
                    "previous_status": current_status,
                    "new_status": "ml_evaluated",
                    "reason": "ML Evaluation completed"
                }
            }
            supabase.table("audit_logs").insert(audit_log).execute()
            
        # General audit log for evaluation
        supabase.table("audit_logs").insert({
            "action": "ML_EVALUATION_COMPLETED",
            "entity_type": "ml_evaluation",
            "entity_id": saved_eval["evaluation_id"],
            "metadata": {
                "application_id": application_id,
                "model_version": self.ml_service.version,
                "predicted_class": predicted_class
            }
        }).execute()
        
        return MLEvaluationResponse(**saved_eval)
        
    def get_evaluations(self, application_id: str) -> list[MLEvaluationResponse]:
        res = supabase.table("ml_evaluations").select("*").eq("application_id", application_id).order("evaluated_at", desc=True).execute()
        return [MLEvaluationResponse(**e) for e in res.data]

    def get_evaluations_for_position(self, position_id: str) -> list[MLEvaluationResponse]:
        # Returns the latest evaluation for each application under this position
        res = supabase.table("ml_evaluations").select("*").eq("position_id", position_id).order("evaluated_at", desc=True).execute()
        
        # Deduplicate by application_id to only return the latest
        seen = set()
        latest_evals = []
        for e in res.data:
            if e["application_id"] not in seen:
                seen.add(e["application_id"])
                latest_evals.append(MLEvaluationResponse(**e))
        return latest_evals
        
    def evaluate_position(self, position_id: str, rescore: bool = False) -> MLBatchEvaluationResponse:
        if not self.ml_service.available:
            raise HTTPException(status_code=503, detail="ML model is currently unavailable.")
            
        # Fetch eligible applications
        eligible_statuses = ["application_received", "under_review"]
        if rescore:
            eligible_statuses.append("ml_evaluated")
            
        # Build query
        apps_res = supabase.table("applications").select("application_id").eq("position_id", position_id).in_("current_status", eligible_statuses).execute()
        
        total_eligible = len(apps_res.data)
        evaluated = 0
        failed = 0
        results = []
        
        for app in apps_res.data:
            try:
                result = self.evaluate_application(app["application_id"])
                results.append(result)
                evaluated += 1
            except Exception as e:
                logger.error(f"Batch evaluation failed for app {app['application_id']}: {e}")
                failed += 1
                
        return MLBatchEvaluationResponse(
            position_id=UUID(position_id),
            total_eligible=total_eligible,
            evaluated=evaluated,
            failed=failed,
            results=results
        )
