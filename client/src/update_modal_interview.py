import sys

def modify_modal():
    with open(r'c:\Users\mgura\OneDrive\Desktop\internship\HR_Portal\HR-Recruitment-System\client\src\components\applications\CandidateDetailsModal.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Import statements
    import_block = "import { generateInterview, generateInterviewToken } from '../../services/aiInterviewApi';"
    if import_block not in content:
        content = content.replace("import { generateAssessment, generateAssessmentToken }", import_block + "\nimport { generateAssessment, generateAssessmentToken }")

    # State variables
    state_block = """
  // Interview State
  const [isGeneratingInterview, setIsGeneratingInterview] = useState(false);
  const [interviewLink, setInterviewLink] = useState('');
  const [interviewError, setInterviewError] = useState('');
  const [createdInterviewId, setCreatedInterviewId] = useState(null);
"""
    if "const [isGeneratingInterview" not in content:
        content = content.replace("  // Assessment State", state_block + "\n  // Assessment State")

    # Functions
    func_block = """
  const handleGenerateInterview = async () => {
    setIsGeneratingInterview(true);
    setInterviewError('');
    try {
      const res = await generateInterview(applicationId, { question_count: 5 });
      setCreatedInterviewId(res.ai_interview_id);
    } catch (err) {
      setInterviewError(err.message || "Failed to create interview");
    } finally {
      setIsGeneratingInterview(false);
    }
  };

  const handleGenerateInterviewLink = async () => {
    if (!createdInterviewId) return;
    setIsGeneratingInterview(true);
    try {
      const res = await generateInterviewToken(createdInterviewId);
      setInterviewLink(res.candidate_url);
      onUpdate();
      fetchCandidateDetails();
    } catch (err) {
      setInterviewError(err.message || "Failed to generate link");
    } finally {
      setIsGeneratingInterview(false);
    }
  };
"""
    if "const handleGenerateInterview =" not in content:
        content = content.replace("  const handleGenerateAssessment = async () => {", func_block + "\n  const handleGenerateAssessment = async () => {")
        
    # Reset state on open
    if "setCreatedInterviewId(null);" not in content:
        content = content.replace("setCreatedAssessmentId(null);", "setCreatedAssessmentId(null);\n      setInterviewLink('');\n      setCreatedInterviewId(null);\n      setInterviewError('');")

    # Interview UI block
    ui_block = """
              {/* Interview Panel */}
              {(candidate.current_status === 'assessment_passed' || candidate.current_status.startsWith('ai_interview')) && (
                <div className="space-y-4 bg-teal-50 p-4 rounded-lg border border-teal-100 mb-6">
                  <h3 className="font-semibold text-teal-900 border-b border-teal-200 pb-2">AI Interview</h3>
                  
                  {interviewError && <div className="bg-rose-50 text-rose-700 p-2 rounded text-sm">{interviewError}</div>}
                  
                  {candidate.current_status === 'assessment_passed' && !createdInterviewId && (
                    <div>
                      <p className="text-sm text-teal-800 mb-3">Candidate has passed the assessment. Generate a text-based AI Interview.</p>
                      <button 
                        onClick={handleGenerateInterview}
                        disabled={isGeneratingInterview}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        {isGeneratingInterview ? "Creating..." : "Create Interview"}
                      </button>
                    </div>
                  )}

                  {createdInterviewId && !interviewLink && (
                    <div>
                      <p className="text-sm text-green-700 mb-3 font-medium">Interview Created Successfully!</p>
                      <button 
                        onClick={handleGenerateInterviewLink}
                        disabled={isGeneratingInterview}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        {isGeneratingInterview ? "Generating..." : "Generate Access Link"}
                      </button>
                    </div>
                  )}
                  
                  {interviewLink && (
                    <div className="bg-white p-3 rounded border border-teal-200">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Candidate Interview Link</p>
                      <div className="flex items-center gap-2 mb-2">
                        <input type="text" readOnly value={interviewLink} className="text-sm w-full bg-gray-50 border border-gray-200 rounded p-1.5 text-gray-600 outline-none" />
                        <button onClick={() => navigator.clipboard.writeText(interviewLink)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-medium rounded">Copy</button>
                      </div>
                    </div>
                  )}
                  
                  {candidate.current_status.startsWith('ai_interview') && !interviewLink && (
                    <div className="text-sm text-teal-800">
                      Interview stage: <strong>{candidate.current_status.replace('_', ' ')}</strong>
                      <p className="mt-1 text-xs text-gray-500">Check the AI Interviews Dashboard for details.</p>
                    </div>
                  )}
                </div>
              )}
"""
    if "AI Interview" not in content:
        content = content.replace("              {/* ML Evaluation Panel */}", ui_block + "\n              {/* ML Evaluation Panel */}")

    with open(r'c:\Users\mgura\OneDrive\Desktop\internship\HR_Portal\HR-Recruitment-System\client\src\components\applications\CandidateDetailsModal.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("CandidateDetailsModal updated for interview flow!")

if __name__ == '__main__':
    modify_modal()
