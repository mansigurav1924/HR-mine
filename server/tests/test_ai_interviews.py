from app.schemas.ai_interview import GenerateInterviewRequest, AnswerRequest

def test_schemas():
    req = GenerateInterviewRequest(question_count=4)
    assert req.question_count == 4
    
    ans = AnswerRequest(question_index=2, answer="Test answer")
    assert ans.question_index == 2
    assert ans.answer == "Test answer"
