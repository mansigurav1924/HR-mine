from typing import Optional, Dict, Any, List
from app.services.supabase_client import supabase
from datetime import datetime

# Pipeline stage priority order for funnel calculations
STAGE_ORDER = {
    'new': 1,
    'application_received': 1,
    'under_review': 1,
    'non_shortlisted': 2,
    'ml_recommended': 2,
    'ml_evaluated': 2,
    'human_shortlisted': 3,
    'shortlisted': 3,
    'assessment_invited': 4,
    'assessment_failed': 4,
    'assessment_completed': 5,
    'assessment_passed': 5,
    'ai_interview_invited': 5,
    'ai_interview_opened': 5,
    'ai_interview_completed': 6,
    'human_interview_ready': 6,
    'interview_scheduled': 6,
    'interview_completed': 6,
    'interview_rejected': 6,
    'interview_selected': 7,
    'final_selected': 8,
    'offer_generated': 9,
    'offer_extended': 10,
    'offer_sent': 10,
    'offer_declined': 10,
    'offer_negotiating': 10,
    'offer_expired': 10,
    'offer_accepted': 11,
    'background_check_pending': 11,
    'background_check_cleared': 11,
    'onboarding_handoff_ready': 12,
    'onboarding': 12,
    'hired': 12,
    'withdrawn': 0,
    'rejected': 0
}

class DashboardService:
    def get_dashboard_metrics(
        self,
        department: Optional[str] = None,
        position_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Dict[str, Any]:
        # Validate date range
        if date_from and date_to:
            try:
                df = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                if df > dt:
                    raise ValueError("date_from must be before or equal to date_to")
            except ValueError as ve:
                if "date_from must be" in str(ve):
                    raise
                pass

        # Build application query
        query = supabase.table("applications").select("application_id, department, position_id, position, current_status, source, application_date")
        
        if department and department.strip() and department.lower() != 'all':
            query = query.eq("department", department.strip())
        if position_id and position_id.strip() and position_id.lower() != 'all':
            query = query.eq("position_id", position_id.strip())
        if date_from:
            query = query.gte("application_date", date_from)
        if date_to:
            query = query.lte("application_date", date_to)

        resp = query.execute()
        apps = resp.data or []

        # Count statuses
        status_counts = {
            'total_applications': len(apps),
            'under_review': 0,
            'ml_evaluated': 0,
            'shortlisted': 0,
            'non_shortlisted': 0,
            'assessment_invited': 0,
            'assessment_passed': 0,
            'assessment_failed': 0,
            'ai_interview_completed': 0,
            'interview_scheduled': 0,
            'interview_selected': 0,
            'interview_rejected': 0,
            'final_selected': 0,
            'offers_generated': 0,
            'offers_sent': 0,
            'offers_accepted': 0,
            'offers_declined': 0,
            'offers_negotiating': 0,
            'offers_expired': 0,
            'onboarding_handoff_ready': 0,
            'withdrawn': 0
        }

        dept_counts: Dict[str, int] = {}
        source_counts: Dict[str, int] = {'website': 0, 'email': 0}

        # Funnel stage buckets
        funnel_reach = {
            'Application Received': len(apps),
            'ML Evaluated': 0,
            'Shortlisted': 0,
            'Assessment Passed': 0,
            'AI Interview Completed': 0,
            'Human Interview Selected': 0,
            'Final Selected': 0,
            'Offer Sent': 0,
            'Offer Accepted': 0,
            'Onboarding Handoff Ready': 0
        }

        for app in apps:
            status = app.get('current_status') or 'application_received'
            dept = app.get('department') or 'Unassigned'
            src = app.get('source') or 'website'

            dept_counts[dept] = dept_counts.get(dept, 0) + 1
            if src in source_counts:
                source_counts[src] += 1
            else:
                source_counts[src] = 1

            if status in ('new', 'application_received', 'under_review'):
                status_counts['under_review'] += 1
            elif status in ('ml_recommended', 'ml_evaluated'):
                status_counts['ml_evaluated'] += 1
            elif status in ('human_shortlisted', 'shortlisted'):
                status_counts['shortlisted'] += 1
            elif status in ('non_shortlisted', 'rejected'):
                status_counts['non_shortlisted'] += 1
            elif status in ('assessment_invited', 'assessment_completed', 'assessment_passed'):
                status_counts['assessment_passed'] += 1
            elif status == 'assessment_failed':
                status_counts['assessment_failed'] += 1
            elif status in ('ai_interview_invited', 'ai_interview_opened', 'ai_interview_completed', 'human_interview_ready', 'interview_scheduled', 'interview_completed'):
                status_counts['ai_interview_completed'] += 1
            elif status == 'interview_rejected':
                status_counts['interview_rejected'] += 1
            elif status == 'interview_selected':
                status_counts['interview_selected'] += 1
            elif status == 'final_selected':
                status_counts['final_selected'] += 1
            elif status == 'offer_generated':
                status_counts['offers_generated'] += 1
            elif status in ('offer_extended', 'offer_sent'):
                status_counts['offers_sent'] += 1
            elif status == 'offer_accepted':
                status_counts['offers_accepted'] += 1
            elif status == 'offer_declined':
                status_counts['offers_declined'] += 1
            elif status == 'offer_negotiating':
                status_counts['offers_negotiating'] += 1
            elif status == 'offer_expired':
                status_counts['offers_expired'] += 1
            elif status in ('onboarding', 'onboarding_handoff_ready', 'hired', 'background_check_pending', 'background_check_cleared'):
                status_counts['onboarding_handoff_ready'] += 1
            elif status == 'withdrawn':
                status_counts['withdrawn'] += 1

            # Funnel calculations
            rank = STAGE_ORDER.get(status, 1)
            if rank >= 2:
                funnel_reach['ML Evaluated'] += 1
            if rank >= 3:
                funnel_reach['Shortlisted'] += 1
            if rank >= 5:
                funnel_reach['Assessment Passed'] += 1
            if rank >= 6:
                funnel_reach['AI Interview Completed'] += 1
            if rank >= 7:
                funnel_reach['Human Interview Selected'] += 1
            if rank >= 8:
                funnel_reach['Final Selected'] += 1
            if rank >= 10:
                funnel_reach['Offer Sent'] += 1
            if rank >= 11:
                funnel_reach['Offer Accepted'] += 1
            if rank >= 12:
                funnel_reach['Onboarding Handoff Ready'] += 1

        # Format funnel
        funnel_data = [
            {"stage": "Application Received", "count": funnel_reach['Application Received'], "conversion": 100.0},
            {"stage": "ML Evaluated", "count": funnel_reach['ML Evaluated'], "conversion": round((funnel_reach['ML Evaluated'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "Shortlisted", "count": funnel_reach['Shortlisted'], "conversion": round((funnel_reach['Shortlisted'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "Assessment Passed", "count": funnel_reach['Assessment Passed'], "conversion": round((funnel_reach['Assessment Passed'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "AI Interview Completed", "count": funnel_reach['AI Interview Completed'], "conversion": round((funnel_reach['AI Interview Completed'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "Human Interview Selected", "count": funnel_reach['Human Interview Selected'], "conversion": round((funnel_reach['Human Interview Selected'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "Final Selected", "count": funnel_reach['Final Selected'], "conversion": round((funnel_reach['Final Selected'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "Offer Sent", "count": funnel_reach['Offer Sent'], "conversion": round((funnel_reach['Offer Sent'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "Offer Accepted", "count": funnel_reach['Offer Accepted'], "conversion": round((funnel_reach['Offer Accepted'] / len(apps) * 100), 1) if apps else 0.0},
            {"stage": "Onboarding Handoff Ready", "count": funnel_reach['Onboarding Handoff Ready'], "conversion": round((funnel_reach['Onboarding Handoff Ready'] / len(apps) * 100), 1) if apps else 0.0},
        ]

        # Department data list
        departments_data = [{"department": k, "count": v} for k, v in sorted(dept_counts.items(), key=lambda x: x[1], reverse=True)]

        # Source data list
        sources_data = [{"source": k.capitalize(), "count": v} for k, v in source_counts.items()]

        # Offer outcomes
        offer_outcomes = {
            'generated': status_counts['offers_generated'],
            'sent': status_counts['offers_sent'],
            'accepted': status_counts['offers_accepted'],
            'declined': status_counts['offers_declined'],
            'negotiating': status_counts['offers_negotiating'],
            'expired': status_counts['offers_expired'],
        }

        # Available departments and positions for filter dropdowns
        pos_resp = supabase.table("job_requirements").select("position_id, position_title, department").eq("is_active", True).execute()
        available_positions = pos_resp.data or []

        dept_resp = supabase.table("applications").select("department").execute()
        raw_depts = {d['department'] for d in (dept_resp.data or []) if d.get('department')}
        # Combine with positions depts
        raw_depts.update({p['department'] for p in available_positions if p.get('department')})
        available_departments = sorted(list(raw_depts))

        # Override core pipeline stage counts with cumulative funnel data for top metrics cards
        status_counts['ml_evaluated'] = funnel_reach['ML Evaluated']
        status_counts['shortlisted'] = funnel_reach['Shortlisted']
        status_counts['assessment_passed'] = funnel_reach['Assessment Passed']
        status_counts['ai_interview_completed'] = funnel_reach['AI Interview Completed']
        status_counts['interview_selected'] = funnel_reach['Human Interview Selected']
        status_counts['final_selected'] = funnel_reach['Final Selected']
        status_counts['offers_sent'] = funnel_reach['Offer Sent']
        status_counts['offers_accepted'] = funnel_reach['Offer Accepted']
        status_counts['onboarding_handoff_ready'] = funnel_reach['Onboarding Handoff Ready']

        return {
            "metrics": status_counts,
            "funnel": funnel_data,
            "departments": departments_data,
            "sources": sources_data,
            "offer_outcomes": offer_outcomes,
            "filters": {
                "departments": available_departments,
                "positions": available_positions
            }
        }

    def get_department_dashboard(self, department: str) -> Dict[str, Any]:
        return self.get_dashboard_metrics(department=department)
