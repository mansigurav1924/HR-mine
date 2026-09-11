import pytest
from app.services.dashboard_service import STAGE_ORDER

def test_full_pipeline_stage_ordering():
    # Verify linear priority hierarchy
    assert STAGE_ORDER['application_received'] == 1
    assert STAGE_ORDER['under_review'] == 1
    assert STAGE_ORDER['ml_evaluated'] == 2
    assert STAGE_ORDER['shortlisted'] == 3
    assert STAGE_ORDER['assessment_invited'] == 4
    assert STAGE_ORDER['assessment_passed'] == 5
    assert STAGE_ORDER['ai_interview_invited'] == 5
    assert STAGE_ORDER['ai_interview_completed'] == 6
    assert STAGE_ORDER['interview_scheduled'] == 6
    assert STAGE_ORDER['interview_selected'] == 7
    assert STAGE_ORDER['final_selected'] == 8
    assert STAGE_ORDER['offer_generated'] == 9
    assert STAGE_ORDER['offer_sent'] == 10
    assert STAGE_ORDER['offer_accepted'] == 11
    assert STAGE_ORDER['onboarding_handoff_ready'] == 12

    # Negative / Terminal statuses
    assert STAGE_ORDER['non_shortlisted'] == 2
    assert STAGE_ORDER['assessment_failed'] == 4
    assert STAGE_ORDER['interview_rejected'] == 6
    assert STAGE_ORDER['offer_declined'] == 10
    assert STAGE_ORDER['withdrawn'] == 0

    print("[PASS] Full recruitment pipeline stage ordering verified.")

def test_workflow_state_transitions():
    # Test positive transition chain
    statuses = [
        'application_received', 'ml_evaluated', 'shortlisted',
        'assessment_passed', 'ai_interview_completed',
        'interview_selected', 'final_selected',
        'offer_generated', 'offer_sent', 'offer_accepted',
        'onboarding_handoff_ready'
    ]

    for i in range(len(statuses) - 1):
        current = statuses[i]
        next_st = statuses[i + 1]
        assert STAGE_ORDER[next_st] >= STAGE_ORDER[current]

    print("[PASS] End-to-end recruitment state transitions validated.")

if __name__ == "__main__":
    test_full_pipeline_stage_ordering()
    test_workflow_state_transitions()
