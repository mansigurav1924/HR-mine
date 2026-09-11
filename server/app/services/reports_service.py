from typing import Optional, Dict, Any, List
from app.services.supabase_client import supabase
from app.services.dashboard_service import STAGE_ORDER

class ReportsService:
    def _get_filtered_applications(
        self,
        department: Optional[str] = None,
        position_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = supabase.table("applications").select("application_id, candidate_name, department, position_id, position, current_status, source, application_date")
        
        if department and department.strip() and department.lower() != 'all':
            query = query.eq("department", department.strip())
        if position_id and position_id.strip() and position_id.lower() != 'all':
            query = query.eq("position_id", position_id.strip())
        if date_from:
            query = query.gte("application_date", date_from)
        if date_to:
            query = query.lte("application_date", date_to)

        resp = query.execute()
        return resp.data or []

    def get_funnel_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        apps = self._get_filtered_applications(department, position_id, date_from, date_to)
        total = len(apps)

        stages = [
            ("Application Received", 1),
            ("ML Evaluated", 2),
            ("Shortlisted", 3),
            ("Assessment Passed", 5),
            ("AI Interview Completed", 6),
            ("Human Interview Selected", 7),
            ("Final Selected", 8),
            ("Offer Sent", 10),
            ("Offer Accepted", 11),
            ("Onboarding Handoff Ready", 12)
        ]

        counts = {}
        for name, rank in stages:
            counts[name] = sum(1 for a in apps if STAGE_ORDER.get(a.get("current_status") or "application_received", 1) >= rank)

        funnel_list = []
        prev_count = total
        for name, rank in stages:
            c = counts[name]
            overall_conv = round((c / total * 100), 1) if total > 0 else 0.0
            step_conv = round((c / prev_count * 100), 1) if prev_count > 0 else 0.0
            dropoff = round(100.0 - step_conv, 1) if prev_count > 0 else 0.0
            funnel_list.append({
                "stage": name,
                "count": c,
                "overall_conversion_rate": overall_conv,
                "step_conversion_rate": step_conv,
                "dropoff_rate": dropoff
            })
            prev_count = c

        return {"total_applications": total, "funnel": funnel_list}

    def get_departments_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        apps = self._get_filtered_applications(department, position_id, date_from, date_to)
        
        dept_data: Dict[str, Dict[str, Any]] = {}
        for app in apps:
            dept = app.get("department") or "Unassigned"
            if dept not in dept_data:
                dept_data[dept] = {
                    "department": dept,
                    "applications": 0,
                    "ml_evaluated": 0,
                    "shortlisted": 0,
                    "assessment_passed": 0,
                    "interview_selected": 0,
                    "final_selected": 0,
                    "offers_sent": 0,
                    "offers_accepted": 0,
                }
            d = dept_data[dept]
            d["applications"] += 1
            rank = STAGE_ORDER.get(app.get("current_status") or "application_received", 1)
            if rank >= 2: d["ml_evaluated"] += 1
            if rank >= 3: d["shortlisted"] += 1
            if rank >= 5: d["assessment_passed"] += 1
            if rank >= 7: d["interview_selected"] += 1
            if rank >= 8: d["final_selected"] += 1
            if rank >= 10: d["offers_sent"] += 1
            if rank >= 11: d["offers_accepted"] += 1

        result = []
        for dept, d in dept_data.items():
            total = d["applications"]
            d["shortlist_rate"] = round((d["shortlisted"] / total * 100), 1) if total > 0 else 0.0
            d["offer_rate"] = round((d["offers_sent"] / total * 100), 1) if total > 0 else 0.0
            d["hire_rate"] = round((d["offers_accepted"] / total * 100), 1) if total > 0 else 0.0
            result.append(d)

        result.sort(key=lambda x: x["applications"], reverse=True)
        return {"departments": result}

    def get_positions_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        apps = self._get_filtered_applications(department, position_id, date_from, date_to)
        
        # Load positions
        pos_resp = supabase.table("job_requirements").select("position_id, position_title, department").execute()
        pos_map = {p["position_id"]: p for p in (pos_resp.data or [])}

        pos_data: Dict[str, Dict[str, Any]] = {}
        for app in apps:
            pid = app.get("position_id") or "unassigned"
            title = app.get("position") or (pos_map.get(pid, {}).get("position_title") if pid != "unassigned" else "General")
            dept = app.get("department") or (pos_map.get(pid, {}).get("department") if pid != "unassigned" else "Unassigned")
            
            key = f"{pid}_{title}"
            if key not in pos_data:
                pos_data[key] = {
                    "position_id": pid,
                    "position_title": title,
                    "department": dept,
                    "applications": 0,
                    "shortlisted": 0,
                    "assessment_passed": 0,
                    "interview_selected": 0,
                    "final_selected": 0,
                    "offers_accepted": 0,
                }
            p = pos_data[key]
            p["applications"] += 1
            rank = STAGE_ORDER.get(app.get("current_status") or "application_received", 1)
            if rank >= 3: p["shortlisted"] += 1
            if rank >= 5: p["assessment_passed"] += 1
            if rank >= 7: p["interview_selected"] += 1
            if rank >= 8: p["final_selected"] += 1
            if rank >= 11: p["offers_accepted"] += 1

        result = []
        for key, p in pos_data.items():
            total = p["applications"]
            p["shortlist_rate"] = round((p["shortlisted"] / total * 100), 1) if total > 0 else 0.0
            p["hire_rate"] = round((p["offers_accepted"] / total * 100), 1) if total > 0 else 0.0
            result.append(p)

        result.sort(key=lambda x: x["applications"], reverse=True)
        return {"positions": result}

    def get_application_sources_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        apps = self._get_filtered_applications(department, position_id, date_from, date_to)
        total = len(apps)
        
        sources: Dict[str, Dict[str, Any]] = {
            "website": {"source": "Website", "applications": 0, "shortlisted": 0, "offers_accepted": 0},
            "email": {"source": "Email", "applications": 0, "shortlisted": 0, "offers_accepted": 0}
        }

        for app in apps:
            src = app.get("source") or "website"
            if src not in sources:
                sources[src] = {"source": src.capitalize(), "applications": 0, "shortlisted": 0, "offers_accepted": 0}
            sources[src]["applications"] += 1
            rank = STAGE_ORDER.get(app.get("current_status") or "application_received", 1)
            if rank >= 3: sources[src]["shortlisted"] += 1
            if rank >= 11: sources[src]["offers_accepted"] += 1

        result = []
        for key, s in sources.items():
            cnt = s["applications"]
            s["share_percentage"] = round((cnt / total * 100), 1) if total > 0 else 0.0
            s["hire_rate"] = round((s["offers_accepted"] / cnt * 100), 1) if cnt > 0 else 0.0
            result.append(s)

        return {"total_applications": total, "sources": result}

    def get_assessments_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        # Fetch assessments
        query = supabase.table("assessments").select("assessment_id, score, result, started_at, completed_at, applications(department, position_id)")
        if date_from:
            query = query.gte("created_at", date_from)
        if date_to:
            query = query.lte("created_at", date_to)

        resp = query.execute()
        rows = resp.data or []

        # Filter by department / position
        filtered = []
        for r in rows:
            app = r.get("applications") or {}
            if department and department.lower() != 'all' and app.get("department") != department:
                continue
            if position_id and position_id.lower() != 'all' and app.get("position_id") != position_id:
                continue
            filtered.append(r)

        total = len(filtered)
        completed = [r for r in filtered if r.get("completed_at")]
        passed = [r for r in completed if r.get("result") == "pass"]
        failed = [r for r in completed if r.get("result") == "fail"]
        
        scores = [float(r["score"]) for r in completed if r.get("score") is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        return {
            "total_assessments": total,
            "invited": total,
            "completed": len(completed),
            "passed": len(passed),
            "failed": len(failed),
            "pass_rate": round((len(passed) / len(completed) * 100), 1) if completed else 0.0,
            "completion_rate": round((len(completed) / total * 100), 1) if total > 0 else 0.0,
            "average_score": avg_score
        }

    def get_interviews_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        query = supabase.table("interviews").select("interview_id, status, attendance, applications(department, position_id), interview_evaluations(overall_score, decision)")
        if date_from:
            query = query.gte("created_at", date_from)
        if date_to:
            query = query.lte("created_at", date_to)

        resp = query.execute()
        rows = resp.data or []

        filtered = []
        for r in rows:
            app = r.get("applications") or {}
            if department and department.lower() != 'all' and app.get("department") != department:
                continue
            if position_id and position_id.lower() != 'all' and app.get("position_id") != position_id:
                continue
            filtered.append(r)

        total = len(filtered)
        scheduled = sum(1 for r in filtered if r.get("status") == "scheduled")
        completed = sum(1 for r in filtered if r.get("status") == "completed")
        no_show = sum(1 for r in filtered if r.get("attendance") in ("absent", "no_show"))

        scores = []
        selected = 0
        rejected = 0
        for r in filtered:
            eval_data = r.get("interview_evaluations")
            if isinstance(eval_data, list) and eval_data:
                ev = eval_data[0]
            elif isinstance(eval_data, dict):
                ev = eval_data
            else:
                ev = None

            if ev:
                if ev.get("overall_score") is not None:
                    scores.append(float(ev["overall_score"]))
                if ev.get("decision") == "selected":
                    selected += 1
                elif ev.get("decision") == "rejected":
                    rejected += 1

        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        return {
            "total_interviews": total,
            "scheduled": scheduled,
            "completed": completed,
            "selected": selected,
            "rejected": rejected,
            "no_show": no_show,
            "selection_rate": round((selected / completed * 100), 1) if completed > 0 else 0.0,
            "average_overall_score": avg_score
        }

    def get_offers_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        query = supabase.table("offers").select("offer_id, offer_status, email_status, department, applications(position_id)")
        if date_from:
            query = query.gte("created_at", date_from)
        if date_to:
            query = query.lte("created_at", date_to)

        resp = query.execute()
        rows = resp.data or []

        filtered = []
        for r in rows:
            if department and department.lower() != 'all' and r.get("department") != department:
                continue
            app = r.get("applications") or {}
            if position_id and position_id.lower() != 'all' and app.get("position_id") != position_id:
                continue
            filtered.append(r)

        total = len(filtered)
        generated = sum(1 for r in filtered if r.get("offer_status") == "generated")
        sent = sum(1 for r in filtered if r.get("offer_status") == "sent" or r.get("email_status") == "sent")
        accepted = sum(1 for r in filtered if r.get("offer_status") == "accepted")
        declined = sum(1 for r in filtered if r.get("offer_status") == "declined")
        negotiating = sum(1 for r in filtered if r.get("offer_status") == "negotiating")
        expired = sum(1 for r in filtered if r.get("offer_status") == "expired")

        # Acceptance rate calculation
        resolved = accepted + declined + expired
        acc_rate = round((accepted / resolved * 100), 1) if resolved > 0 else (round((accepted / sent * 100), 1) if sent > 0 else 0.0)

        return {
            "total_offers": total,
            "generated": generated,
            "sent": sent,
            "accepted": accepted,
            "declined": declined,
            "negotiating": negotiating,
            "expired": expired,
            "acceptance_rate": acc_rate
        }

    def get_onboarding_report(self, department: Optional[str] = None, position_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
        # 1. Accepted offers without handoffs = ready_for_handoff
        apps = self._get_filtered_applications(department, position_id, date_from, date_to)
        ready_for_handoff = sum(1 for a in apps if a.get("current_status") == "offer_accepted")

        # 2. Onboarding handoffs
        query = supabase.table("onboarding_handoffs").select("handoff_id, it_provisioning_requested, hris_handoff_status, completed_at, offers(department, applications(position_id))")
        if date_from:
            query = query.gte("created_at", date_from)
        if date_to:
            query = query.lte("created_at", date_to)

        resp = query.execute()
        rows = resp.data or []

        filtered = []
        for r in rows:
            off = r.get("offers") or {}
            if department and department.lower() != 'all' and off.get("department") != department:
                continue
            app = off.get("applications") or {}
            if position_id and position_id.lower() != 'all' and app.get("position_id") != position_id:
                continue
            filtered.append(r)

        total_handoffs = len(filtered)
        completed = sum(1 for r in filtered if r.get("completed_at"))
        in_progress = total_handoffs - completed
        it_requested = sum(1 for r in filtered if r.get("it_provisioning_requested"))

        hris_counts = {"pending": 0, "ready": 0, "submitted": 0, "completed": 0}
        for r in filtered:
            st = r.get("hris_handoff_status") or "pending"
            if st in hris_counts:
                hris_counts[st] += 1

        return {
            "ready_for_handoff": ready_for_handoff,
            "total_handoffs": total_handoffs,
            "in_progress": in_progress,
            "completed": completed,
            "it_provisioning_requested": it_requested,
            "hris_status_breakdown": hris_counts
        }
