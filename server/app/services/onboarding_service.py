from fastapi import HTTPException
from app.services.supabase_client import supabase
from app.schemas.onboarding import OnboardingCreate, ChecklistUpdate, ITProvisioningUpdate, HRISStatusUpdate
from datetime import datetime

DEFAULT_CHECKLIST = [
    {"key": "government_id", "label": "Government ID", "required": True, "status": "pending", "completed_at": None},
    {"key": "education_documents", "label": "Educational Documents", "required": True, "status": "pending", "completed_at": None},
    {"key": "bank_details", "label": "Bank Details", "required": True, "status": "pending", "completed_at": None},
    {"key": "signed_offer", "label": "Signed Offer Letter", "required": True, "status": "pending", "completed_at": None},
    {"key": "passport_photo", "label": "Passport Photo", "required": False, "status": "pending", "completed_at": None},
    {"key": "nda", "label": "NDA / Agreement", "required": True, "status": "pending", "completed_at": None},
    {"key": "emergency_contact", "label": "Emergency Contact", "required": True, "status": "pending", "completed_at": None},
]

class OnboardingService:
    def create_handoff(self, application_id: str, req: OnboardingCreate, hr_id: str):
        # 1. Validate application
        app_resp = supabase.table("applications").select("current_status").eq("application_id", application_id).single().execute()
        if not app_resp.data:
            raise HTTPException(status_code=404, detail="Application not found.")
        
        if app_resp.data["current_status"] != "offer_accepted":
            raise HTTPException(status_code=400, detail="Candidate has not accepted the offer yet.")
            
        # 2. Validate offer
        offer_resp = supabase.table("offers").select("offer_id, offer_status, reporting_manager_id").eq("application_id", application_id).execute()
        if not offer_resp.data:
            raise HTTPException(status_code=404, detail="Offer not found for this application.")
            
        accepted_offers = [o for o in offer_resp.data if o["offer_status"] == "accepted"]
        if not accepted_offers:
            raise HTTPException(status_code=400, detail="Offer is not in 'accepted' status.")
            
        offer_id = accepted_offers[0]["offer_id"]
        reporting_manager_id = accepted_offers[0].get("reporting_manager_id")

        # 3. Prevent duplicate handoffs
        existing_handoff = supabase.table("onboarding_handoffs").select("handoff_id").eq("offer_id", offer_id).execute()
        if existing_handoff.data:
            raise HTTPException(status_code=409, detail="An onboarding handoff already exists for this offer.")

        # 4. Prepare checklist
        checklist = [item.dict() for item in req.document_checklist] if req.document_checklist else DEFAULT_CHECKLIST

        # 5. Create record
        handoff_data = {
            "offer_id": offer_id,
            "reporting_manager_id": reporting_manager_id,
            "document_checklist": checklist,
            "it_provisioning_requested": req.it_provisioning_requested,
            "hris_handoff_status": req.hris_handoff_status,
            "created_by": hr_id,
            "handoff_notes": req.notes
        }
        
        resp = supabase.table("onboarding_handoffs").insert(handoff_data).execute()
        handoff_id = resp.data[0]["handoff_id"]
        
        # 6. Update application status
        supabase.table("applications").update({"current_status": "onboarding_handoff_ready"}).eq("application_id", application_id).execute()
        
        # 7. Audit log
        supabase.table("audit_logs").insert({
            "action": "ONBOARDING_HANDOFF_CREATED",
            "application_id": application_id,
            "metadata": {"handoff_id": handoff_id, "hr_user": hr_id}
        }).execute()
        
        return {"success": True, "handoff_id": handoff_id}

    def get_onboarding_list(self, status: str = None, page: int = 1, page_size: int = 20):
        query = supabase.table("onboarding_handoffs").select(
            "*, offers(offer_id, designation, department, applications(application_id, candidate_name, candidate_email, current_status))"
        ).order("created_at", desc=True)
        
        query = query.range((page - 1) * page_size, page * page_size - 1)
        resp = query.execute()
        
        # Filter manually if necessary, or let frontend handle simple mapping
        return resp.data
        
    def get_ready_for_handoff(self):
        # Fetch applications with offer_accepted but no handoff
        apps_resp = supabase.table("applications").select(
            "application_id, candidate_name, position, current_status, offers(offer_id, offer_status, designation, joining_date)"
        ).eq("current_status", "offer_accepted").execute()
        return apps_resp.data

    def get_handoff_detail(self, handoff_id: str):
        resp = supabase.table("onboarding_handoffs").select(
            "*, offers(offer_id, designation, department, joining_date, duration, reporting_manager, applications(application_id, candidate_name, candidate_email, current_status))"
        ).eq("handoff_id", handoff_id).single().execute()
        
        if not resp.data:
            raise HTTPException(status_code=404, detail="Handoff not found.")
        return resp.data

    def update_checklist(self, handoff_id: str, req: ChecklistUpdate, hr_id: str):
        handoff = self.get_handoff_detail(handoff_id)
        checklist = handoff.get("document_checklist", [])
        
        found = False
        for item in checklist:
            if item.get("key") == req.key:
                item["status"] = req.status
                if req.status in ["received", "verified"]:
                    item["completed_at"] = datetime.utcnow().isoformat()
                found = True
                break
                
        if not found:
            raise HTTPException(status_code=400, detail="Checklist item not found.")
            
        supabase.table("onboarding_handoffs").update({"document_checklist": checklist}).eq("handoff_id", handoff_id).execute()
        
        application_id = handoff["offers"]["applications"]["application_id"]
        supabase.table("audit_logs").insert({
            "action": "ONBOARDING_CHECKLIST_UPDATED",
            "application_id": application_id,
            "metadata": {"handoff_id": handoff_id, "checklist_item_key": req.key, "new_status": req.status, "hr_user": hr_id}
        }).execute()
        
        return {"success": True}

    def update_it_provisioning(self, handoff_id: str, req: ITProvisioningUpdate, hr_id: str):
        supabase.table("onboarding_handoffs").update({"it_provisioning_requested": req.requested}).eq("handoff_id", handoff_id).execute()
        handoff = self.get_handoff_detail(handoff_id)
        application_id = handoff["offers"]["applications"]["application_id"]
        
        supabase.table("audit_logs").insert({
            "action": "ONBOARDING_IT_PROVISIONING_UPDATED",
            "application_id": application_id,
            "metadata": {"handoff_id": handoff_id, "requested": req.requested, "hr_user": hr_id}
        }).execute()
        
        return {"success": True}

    def update_hris_status(self, handoff_id: str, req: HRISStatusUpdate, hr_id: str):
        supabase.table("onboarding_handoffs").update({"hris_handoff_status": req.status}).eq("handoff_id", handoff_id).execute()
        handoff = self.get_handoff_detail(handoff_id)
        application_id = handoff["offers"]["applications"]["application_id"]
        
        supabase.table("audit_logs").insert({
            "action": "ONBOARDING_HRIS_STATUS_UPDATED",
            "application_id": application_id,
            "metadata": {"handoff_id": handoff_id, "new_status": req.status, "hr_user": hr_id}
        }).execute()
        
        return {"success": True}

    def complete_handoff(self, handoff_id: str, hr_id: str):
        handoff = self.get_handoff_detail(handoff_id)
        
        # Verify required checklist items are verified or not_required
        checklist = handoff.get("document_checklist", [])
        for item in checklist:
            if item.get("required") and item.get("status") not in ["verified", "not_required"]:
                raise HTTPException(status_code=400, detail=f"Cannot complete handoff. Required document '{item.get('label')}' is not verified.")
                
        # Optional: check HRIS status
        if handoff.get("hris_handoff_status") not in ["submitted", "completed"]:
            # Depending on business logic, we might enforce HRIS submission. Let's enforce for now.
            pass # Or just allow it

        supabase.table("onboarding_handoffs").update({"completed_at": "now()"}).eq("handoff_id", handoff_id).execute()
        
        application_id = handoff["offers"]["applications"]["application_id"]
        supabase.table("audit_logs").insert({
            "action": "ONBOARDING_HANDOFF_COMPLETED",
            "application_id": application_id,
            "metadata": {"handoff_id": handoff_id, "hr_user": hr_id}
        }).execute()
        
        return {"success": True}
