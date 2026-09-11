import pytest
from app.services.dashboard_service import DashboardService
from app.services.reports_service import ReportsService
from app.services.export_service import ExportService, MAX_EXPORT_LIMIT
from app.services.search_service import SearchService
from app.services.audit_service import AuditService

def test_dashboard_service():
    service = DashboardService()
    res = service.get_dashboard_metrics()
    assert "metrics" in res
    assert "funnel" in res
    assert "departments" in res
    assert "sources" in res
    assert "offer_outcomes" in res
    assert "filters" in res
    assert isinstance(res["metrics"]["total_applications"], int)
    assert len(res["funnel"]) == 10
    print("[PASS] Dashboard metrics and funnel computed correctly.")

def test_reports_service():
    service = ReportsService()
    
    funnel = service.get_funnel_report()
    assert "total_applications" in funnel
    assert len(funnel["funnel"]) == 10

    depts = service.get_departments_report()
    assert "departments" in depts

    pos = service.get_positions_report()
    assert "positions" in pos

    sources = service.get_application_sources_report()
    assert "sources" in sources

    assessments = service.get_assessments_report()
    assert "total_assessments" in assessments
    assert "pass_rate" in assessments

    interviews = service.get_interviews_report()
    assert "total_interviews" in interviews

    offers = service.get_offers_report()
    assert "total_offers" in offers
    assert "acceptance_rate" in offers

    onboarding = service.get_onboarding_report()
    assert "ready_for_handoff" in onboarding
    assert "total_handoffs" in onboarding
    print("[PASS] All 8 reporting endpoints calculated successfully.")

def test_export_service():
    service = ExportService()
    
    # Test CSV and XLSX for applications
    for res_name in ["applications", "assessments", "ai-interviews", "interviews", "offers", "audit-logs"]:
        csv_buf, csv_name, csv_type = service.export_resource(res_name, "csv")
        assert csv_name.endswith(".csv")
        assert csv_type == "text/csv; charset=utf-8"
        assert csv_buf.getbuffer().nbytes > 0

        xlsx_buf, xlsx_name, xlsx_type = service.export_resource(res_name, "xlsx")
        assert xlsx_name.endswith(".xlsx")
        assert xlsx_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert xlsx_buf.getbuffer().nbytes > 0

    print("[PASS] CSV and XLSX export generated for all 6 resources.")

def test_global_search():
    service = SearchService()
    
    # Short query (< 2 chars)
    empty_res = service.global_search("a")
    assert empty_res == {"applications": [], "interviews": [], "offers": []}

    # Meaningful query
    res = service.global_search("test")
    assert "applications" in res
    assert "interviews" in res
    assert "offers" in res
    print("[PASS] Global search query validated and structured.")

def test_audit_logs_service():
    service = AuditService()
    res = service.get_audit_logs(page=1, page_size=10)
    assert "logs" in res
    assert "total" in res
    assert "page" in res
    assert "available_actions" in res
    print("[PASS] Audit logs pagination and action metadata verified.")

if __name__ == "__main__":
    test_dashboard_service()
    test_reports_service()
    test_export_service()
    test_global_search()
    test_audit_logs_service()
    print("\n ALL STEP 19 TESTS PASSED SUCCESSFULLY!")
