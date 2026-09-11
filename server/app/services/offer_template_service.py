from fastapi import HTTPException
from app.services.supabase_client import supabase
from app.schemas.offer_template import OfferTemplateCreateRequest, OfferTemplateVersionRequest, OfferTemplateActiveRequest

class OfferTemplateService:
    
    def get_templates(self):
        resp = supabase.table("offer_templates").select("*").order("updated_at", desc=True).execute()
        return resp.data

    def get_template(self, template_id: str):
        resp = supabase.table("offer_templates").select("*").eq("template_id", template_id).single().execute()
        if not resp.data:
            raise ValueError("Template not found.")
        return resp.data

    def create_template(self, req: OfferTemplateCreateRequest, hr_id: str):
        # Initial version is always 1
        insert_data = {
            "name": req.name,
            "department": req.department,
            "region": req.region,
            "version": 1,
            "html_body": req.html_body,
            "is_active": True,
            "created_by": hr_id
        }
        
        resp = supabase.table("offer_templates").insert(insert_data).execute()
        
        supabase.table("audit_logs").insert({
            "action": "OFFER_TEMPLATE_CREATED",
            "metadata": {"template_name": req.name, "created_by": hr_id, "version": 1}
        }).execute()
        
        return resp.data[0]

    def create_new_version(self, template_id: str, req: OfferTemplateVersionRequest, hr_id: str):
        # We don't mutate the existing template body, we create a new row with incremented version
        old_template = self.get_template(template_id)
        
        new_version = old_template["version"] + 1
        
        insert_data = {
            "name": old_template["name"],
            "department": old_template["department"],
            "region": old_template["region"],
            "version": new_version,
            "html_body": req.html_body,
            "is_active": True,
            "created_by": hr_id
        }
        
        # Deactivate old version automatically? Or leave it active? 
        # Usually, when making a new version, we deactivate the old one.
        supabase.table("offer_templates").update({"is_active": False}).eq("template_id", template_id).execute()
        
        resp = supabase.table("offer_templates").insert(insert_data).execute()
        
        supabase.table("audit_logs").insert({
            "action": "OFFER_TEMPLATE_VERSION_CREATED",
            "metadata": {"template_name": old_template["name"], "created_by": hr_id, "old_version": old_template["version"], "new_version": new_version}
        }).execute()
        
        return resp.data[0]

    def update_active_status(self, template_id: str, req: OfferTemplateActiveRequest, hr_id: str):
        resp = supabase.table("offer_templates").update({"is_active": req.is_active}).eq("template_id", template_id).execute()
        if not resp.data:
            raise ValueError("Template not found.")
            
        supabase.table("audit_logs").insert({
            "action": "OFFER_TEMPLATE_STATUS_CHANGED",
            "metadata": {"template_id": template_id, "is_active": req.is_active, "hr_user": hr_id}
        }).execute()
        
        return resp.data[0]
