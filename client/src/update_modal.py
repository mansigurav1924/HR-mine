import sys

def modify_modal():
    with open(r'c:\Users\mgura\OneDrive\Desktop\internship\HR_Portal\HR-Recruitment-System\client\src\components\applications\CandidateDetailsModal.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Import statements
    import_block = "import { generateAssessment, generateAssessmentToken } from '../../services/assessmentApi';"
    if import_block not in content:
        content = content.replace("import { mlApi } from '../../services/mlApi';", "import { mlApi } from '../../services/mlApi';\n" + import_block)

    # State variables
    state_block = """
  // Assessment State
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [assessmentLink, setAssessmentLink] = useState('');
  const [assessmentError, setAssessmentError] = useState('');
  const [createdAssessmentId, setCreatedAssessmentId] = useState(null);
"""
    if "const [isGeneratingAssessment" not in content:
        content = content.replace("  // ML Evaluation State", state_block + "\n  // ML Evaluation State")

    # Functions
    func_block = """
  const handleGenerateAssessment = async () => {
    setIsGeneratingAssessment(true);
    setAssessmentError('');
    try {
      const res = await generateAssessment(applicationId, { question_count: 20, pass_threshold: 60 });
      setCreatedAssessmentId(res.assessment_id);
    } catch (err) {
      setAssessmentError(err.message || "Failed to create assessment");
    } finally {
      setIsGeneratingAssessment(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!createdAssessmentId) return;
    setIsGeneratingAssessment(true);
    try {
      const res = await generateAssessmentToken(createdAssessmentId);
      setAssessmentLink(res.candidate_url);
      onUpdate(); // refresh status to assessment_invited
      fetchCandidateDetails();
    } catch (err) {
      setAssessmentError(err.message || "Failed to generate link");
    } finally {
      setIsGeneratingAssessment(false);
    }
  };
"""
    if "const handleGenerateAssessment" not in content:
        content = content.replace("  const fetchShortlistHistory", func_block + "\n  const fetchShortlistHistory")
        
    # Reset state on open
    if "setCreatedAssessmentId(null);" not in content:
        content = content.replace("setMlError('');", "setMlError('');\n      setAssessmentLink('');\n      setCreatedAssessmentId(null);\n      setAssessmentError('');")

    # Assessment UI block
    ui_block = """
              {/* Assessment Panel */}
              {(candidate.current_status === 'shortlisted' || candidate.current_status.startsWith('assessment')) && (
                <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                  <h3 className="font-semibold text-blue-900 border-b border-blue-200 pb-2">Technical Assessment</h3>
                  
                  {assessmentError && <div className="bg-rose-50 text-rose-700 p-2 rounded text-sm">{assessmentError}</div>}
                  
                  {candidate.current_status === 'shortlisted' && !createdAssessmentId && (
                    <div>
                      <p className="text-sm text-blue-800 mb-3">Candidate is shortlisted. You can now create a technical MCQ assessment.</p>
                      <button 
                        onClick={handleGenerateAssessment}
                        disabled={isGeneratingAssessment}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        {isGeneratingAssessment ? "Creating..." : "Create Assessment"}
                      </button>
                    </div>
                  )}

                  {createdAssessmentId && !assessmentLink && (
                    <div>
                      <p className="text-sm text-green-700 mb-3 font-medium">Assessment Created Successfully!</p>
                      <button 
                        onClick={handleGenerateLink}
                        disabled={isGeneratingAssessment}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        {isGeneratingAssessment ? "Generating..." : "Generate Access Link"}
                      </button>
                    </div>
                  )}
                  
                  {assessmentLink && (
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Candidate Access Link</p>
                      <div className="flex items-center gap-2 mb-2">
                        <input type="text" readOnly value={assessmentLink} className="text-sm w-full bg-gray-50 border border-gray-200 rounded p-1.5 text-gray-600 outline-none" />
                        <button onClick={() => navigator.clipboard.writeText(assessmentLink)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-medium rounded">Copy</button>
                      </div>
                      <p className="text-xs text-amber-600 italic">Email delivery will be added in a later phase. Please copy the link manually.</p>
                    </div>
                  )}
                  
                  {candidate.current_status.startsWith('assessment') && !assessmentLink && (
                    <div className="text-sm text-blue-800">
                      Assessment stage: <strong>{candidate.current_status.replace('_', ' ')}</strong>
                      <p className="mt-1 text-xs text-gray-500">Check the Assessments Dashboard for details.</p>
                    </div>
                  )}
                </div>
              )}
"""
    if "Technical Assessment" not in content:
        content = content.replace("              {/* ML Evaluation Panel */}", ui_block + "\n              {/* ML Evaluation Panel */}")

    with open(r'c:\Users\mgura\OneDrive\Desktop\internship\HR_Portal\HR-Recruitment-System\client\src\components\applications\CandidateDetailsModal.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("CandidateDetailsModal updated!")

if __name__ == '__main__':
    modify_modal()
