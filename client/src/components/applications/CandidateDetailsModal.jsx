import { useState, useEffect } from 'react';
import api from '../../services/api';
import { mlApi } from '../../services/mlApi';
import { getCandidateState } from '../../services/assessmentApi';
import { generateInterview } from '../../services/aiInterviewApi';
import ScheduleInterviewModal from '../interviews/ScheduleInterviewModal';
import { generateAssessment, generateAssessmentToken } from '../../services/assessmentApi';

const CandidateDetailsModal = ({ isOpen, onClose, applicationId, onUpdate }) => {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editMode, setEditMode] = useState(false);
  const [updateData, setUpdateData] = useState({});

  // Parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [parseError, setParseError] = useState('');
  const [showConfirmApply, setShowConfirmApply] = useState(false);

  // Shortlisting Decision State
  const [shortlistHistory, setShortlistHistory] = useState([]);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [decisionForm, setDecisionForm] = useState({ decision: 'shortlisted', reason: '' });



  // Interview State
  const [isGeneratingInterview, setIsGeneratingInterview] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [interviewLink, setInterviewLink] = useState('');
  const [interviewError, setInterviewError] = useState('');
  const [createdInterviewId, setCreatedInterviewId] = useState(null);

  // Assessment State
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);
  const [assessmentLink, setAssessmentLink] = useState('');
  const [assessmentError, setAssessmentError] = useState('');
  const [createdAssessmentId, setCreatedAssessmentId] = useState(null);

  // ML Evaluation State
  const [mlEvaluations, setMlEvaluations] = useState([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [mlError, setMlError] = useState('');
  const [showPreviousEvals, setShowPreviousEvals] = useState(false);

  useEffect(() => {
    if (isOpen && applicationId) {
      setEditMode(false);
      setParsedResult(null);
      setParseError('');
      setShowConfirmApply(false);
      setMlError('');
      setAssessmentLink('');
      setCreatedAssessmentId(null);
      setInterviewLink('');
      setCreatedInterviewId(null);
      setInterviewError('');
      setAssessmentError('');
      setShowPreviousEvals(false);
      setDecisionError('');
      setDecisionForm({ decision: 'shortlisted', reason: '' });
      fetchCandidateDetails();
      fetchMlEvaluations();
      fetchShortlistHistory();
    }
  }, [isOpen, applicationId]);



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

  const fetchShortlistHistory = async () => {
    try {
      const res = await shortlistingApi.getHistory(applicationId);
      setShortlistHistory(res || []);
    } catch (err) {
      console.error('Failed to fetch shortlist history:', err);
    }
  };

  const handleSubmitDecision = async () => {
    if (!decisionForm.reason.trim()) {
      setDecisionError("Reason is required.");
      return;
    }
    
    setIsSubmittingDecision(true);
    setDecisionError('');
    try {
      await shortlistingApi.createDecision(applicationId, decisionForm.decision, decisionForm.reason);
      await fetchShortlistHistory();
      onUpdate();
      fetchCandidateDetails(); // Refresh status badge
    } catch (err) {
      setDecisionError(err.response?.data?.detail || "Failed to submit decision.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const fetchMlEvaluations = async () => {
    try {
      const res = await mlApi.getEvaluations(applicationId);
      setMlEvaluations(res || []);
    } catch (err) {
      console.error('Failed to fetch ML evaluations:', err);
    }
  };

  const handleRunMlEvaluation = async () => {
    setIsEvaluating(true);
    setMlError('');
      setAssessmentLink('');
      setCreatedAssessmentId(null);
      setInterviewLink('');
      setCreatedInterviewId(null);
      setInterviewError('');
      setAssessmentError('');
    try {
      await mlApi.evaluateApplication(applicationId);
      await fetchMlEvaluations();
      onUpdate();
      fetchCandidateDetails(); // Refresh status badge
    } catch (err) {
      setMlError(err.response?.data?.detail || "ML evaluation failed.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const fetchCandidateDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/applications/${applicationId}`);
      setCandidate(res.data);
      setUpdateData({
        current_status: res.data.current_status,
        department: res.data.department || '',
        position: res.data.position || '',
        phone: res.data.phone || ''
      });
    } catch (err) {
      setError('Failed to fetch candidate details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/api/applications/${applicationId}`, updateData);
      setEditMode(false);
      onUpdate();
      fetchCandidateDetails();
    } catch (err) {
      setError('Failed to update candidate');
    }
  };

  const handleParseResume = async () => {
    setIsParsing(true);
    setParseError('');
    setParsedResult(null);
    try {
      const res = await api.post(`/api/applications/${applicationId}/parse-resume`);
      setParsedResult(res.data);
    } catch (err) {
      setParseError(err.response?.data?.detail || "Resume could not be parsed.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplyParsedData = async () => {
    if (!parsedResult) return;
    try {
      await api.put(`/api/applications/${applicationId}`, {
        skills: parsedResult.parsed_profile.skills,
        education: parsedResult.parsed_profile.education,
        experience: parsedResult.parsed_profile.experience,
        projects: parsedResult.parsed_profile.projects,
        is_parsed_data_applied: true
      });
      setShowConfirmApply(false);
      setParsedResult(null);
      onUpdate();
      fetchCandidateDetails();
    } catch (err) {
      setParseError('Failed to apply parsed data');
    }
  };

  if (!isOpen) return null;

  const isAiInterviewDone = [
    'human_interview_ready', 'interview_scheduled', 'interview_selected', 'interview_rejected',
    'final_selected', 'offer_generated', 'offer_sent', 'offer_accepted', 'onboarding_handoff_ready',
    'ai_interview_completed'
  ].includes(candidate?.current_status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 font-sans p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl p-6 max-h-[95vh] overflow-y-auto animate-fade-in relative flex flex-col md:flex-row gap-6">
        
        {/* Left Column: Existing Information */}
        <div className="flex-1">
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors z-10 md:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>

          {loading ? (
            <div className="flex justify-center items-center py-20">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="bg-rose-50 text-rose-700 p-4 rounded-lg mt-4 border border-rose-200">{error}</div>
          ) : candidate ? (
            <div>
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{candidate.candidate_name}</h2>
                  <p className="text-gray-500">{candidate.email}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 capitalize shadow-sm">
                  {candidate.current_status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                <h3 className="font-semibold text-gray-700 border-b border-gray-200 pb-2">Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Department</p>
                    {editMode ? (
                       <input type="text" className="w-full text-sm mt-1 p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" value={updateData.department} onChange={e => setUpdateData({...updateData, department: e.target.value})} />
                    ) : (
                       <p className="text-sm text-gray-800 font-medium">{candidate.department || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Position</p>
                    {editMode ? (
                       <input type="text" className="w-full text-sm mt-1 p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" value={updateData.position} onChange={e => setUpdateData({...updateData, position: e.target.value})} />
                    ) : (
                       <p className="text-sm text-gray-800 font-medium">{candidate.position || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Phone</p>
                    {editMode ? (
                       <input type="text" className="w-full text-sm mt-1 p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" value={updateData.phone} onChange={e => setUpdateData({...updateData, phone: e.target.value})} />
                    ) : (
                       <p className="text-sm text-gray-800 font-medium">{candidate.phone || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Applied At</p>
                    <p className="text-sm text-gray-800 font-medium">{new Date(candidate.application_date).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Display existing structured data if available */}
              {(candidate.skills || candidate.education || candidate.experience || candidate.projects) && (
                <div className="space-y-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-6">
                  <h3 className="font-semibold text-indigo-900 border-b border-indigo-200 pb-2">Saved Candidate Profile</h3>
                  
                  {candidate.skills && candidate.skills.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1">Skills</h4>
                      <div className="flex flex-wrap gap-1">
                        {candidate.skills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-700 text-xs rounded-md shadow-sm">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {candidate.education && candidate.education.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1">Education</h4>
                      <ul className="list-disc list-inside text-sm text-indigo-900">
                        {candidate.education.map((e, i) => (
                          <li key={i}>{e.degree}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {candidate.experience && candidate.experience.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1">Experience</h4>
                      <ul className="list-disc list-inside text-sm text-indigo-900">
                        {candidate.experience.map((e, i) => (
                          <li key={i}>{e.title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="text-xs text-indigo-600 mt-2 italic">To edit this profile manually, an Edit Profile module will be available soon.</div>
                </div>
              )}


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


              {/* Interview Panel */}
              {(candidate.current_status === 'assessment_passed' || candidate.current_status.startsWith('ai_interview') || isAiInterviewDone) && (
                <div className="space-y-4 bg-teal-50 p-4 rounded-lg border border-teal-100 mb-6">
                  <h3 className="font-semibold text-teal-900 border-b border-teal-200 pb-2">AI Interview</h3>
                  
                  {interviewError && <div className="bg-rose-50 text-rose-700 p-2 rounded text-sm">{interviewError}</div>}
                  
                  {candidate.current_status === 'assessment_passed' && !createdInterviewId && !isAiInterviewDone && (
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

                  {isAiInterviewDone ? (
                    <div>
                      <p className="text-sm font-bold text-teal-800">✓ Completed</p>
                      <p className="text-xs text-teal-700 mt-1">Completion Mode: Placeholder</p>
                      <p className="text-xs text-teal-700 mt-1">AI Score: N/A (Temporary Placeholder Stage)</p>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}

                {/* Human Interviews Panel */}
                {(isAiInterviewDone) && (
                  <div className="space-y-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-6">
                    <h3 className="font-semibold text-indigo-900 border-b border-indigo-200 pb-2">Human Interviews</h3>
                    <p className="text-sm text-indigo-800 mb-3">Manage multi-round human interviews for this candidate.</p>
                    
                    <button 
                      onClick={() => setShowScheduleModal(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                    >
                      Schedule Human Interview
                    </button>
                    
                    <p className="mt-2 text-xs text-gray-500">Check the Human Interviews Dashboard for full details and evaluations.</p>
                  </div>
                )}

                {/* Final Selection Panel */}
                {(candidate.current_status === 'final_selected' || candidate.current_status === 'interview_selected' || candidate.current_status === 'offer_generated') && (
                  <div className="space-y-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
                    <h3 className="font-semibold text-yellow-900 border-b border-yellow-300 pb-2">Final Selection</h3>
                    
                    {(candidate.current_status === 'final_selected' || candidate.current_status === 'offer_generated') ? (
                      <div>
                        <p className="text-sm font-bold text-yellow-800">✓ Candidate is Final Selected</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Awaiting HR confirmation.</p>
                        <p className="text-xs text-yellow-700 mt-1">Check the Final Selection Dashboard to review history and confirm.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Offer Panel */}
                {(candidate.current_status === 'final_selected' || candidate.current_status === 'offer_generated' || candidate.current_status === 'offer_sent' || candidate.current_status === 'offer_accepted' || candidate.current_status === 'onboarding_handoff_ready') && (
                  <div className="space-y-4 bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
                    <h3 className="font-semibold text-green-900 border-b border-green-300 pb-2">Offer</h3>
                    
                    {(candidate.current_status === 'offer_accepted' || candidate.current_status === 'onboarding_handoff_ready') ? (
                      <div>
                        <p className="text-sm font-bold text-green-800">✓ Offer Accepted</p>
                      </div>
                    ) : candidate.current_status === 'offer_sent' ? (
                      <div>
                        <p className="text-sm font-bold text-green-800">✓ Offer Sent</p>
                        <p className="text-xs text-green-700 mt-1">Check Offers Dashboard for history.</p>
                      </div>
                    ) : candidate.current_status === 'offer_generated' ? (
                      <div>
                        <p className="text-sm font-bold text-green-800">✓ Offer Generated — Not Sent</p>
                        <p className="text-xs text-green-700 mt-1">Check Offers Dashboard to view PDF and Send.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-green-800">Offer Not Generated</p>
                        <p className="text-xs text-green-700 mt-1">Ready for Offer Generation.</p>
                      </div>
                    )}
                  </div>
                )}

              {/* ML Evaluation Panel */}
              <div className="space-y-4 bg-purple-50 p-4 rounded-lg border border-purple-100 mb-6">
                <div className="flex justify-between items-center border-b border-purple-200 pb-2">
                  <h3 className="font-semibold text-purple-900">ML Evaluation</h3>
                  {mlEvaluations.length > 0 && (
                    <button 
                      onClick={() => setShowPreviousEvals(!showPreviousEvals)}
                      className="text-xs text-purple-700 hover:text-purple-900 underline"
                    >
                      {showPreviousEvals ? "Hide History" : "View History"}
                    </button>
                  )}
                </div>
                
                {mlError && (
                  <div className="bg-rose-50 text-rose-700 p-2 rounded text-sm border border-rose-200">{mlError}</div>
                )}

                {mlEvaluations.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-purple-700 mb-3">Not evaluated yet</p>
                    <button 
                      onClick={handleRunMlEvaluation}
                      disabled={isEvaluating}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      {isEvaluating ? "Evaluating resume..." : "Run ML Evaluation"}
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Latest Evaluation */}
                    <div className="mb-4">
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-xs text-purple-600 font-medium uppercase">Model</p>
                          <p className="text-purple-900 font-semibold">{mlEvaluations[0].model_version}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 font-medium uppercase">Model Confidence</p>
                          <p className="text-purple-900 font-semibold">
                            {mlEvaluations[0].match_score !== null 
                              ? `${(mlEvaluations[0].match_score * 100).toFixed(1)}%` 
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 font-medium uppercase">Prediction</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            mlEvaluations[0].predicted_class === 'good_intern' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {mlEvaluations[0].predicted_class}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 font-medium uppercase">Evaluated At</p>
                          <p className="text-purple-900">{new Date(mlEvaluations[0].evaluated_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        {mlEvaluations[0].matching_skills?.length > 0 && (
                          <div>
                            <p className="text-xs text-purple-600 font-medium uppercase">Matching Skills</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {mlEvaluations[0].matching_skills.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded shadow-sm">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {mlEvaluations[0].missing_skills?.length > 0 && (
                          <div>
                            <p className="text-xs text-purple-600 font-medium uppercase">Missing Required Skills</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {mlEvaluations[0].missing_skills.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded shadow-sm">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-purple-100 p-3 rounded border border-purple-200">
                        <p className="text-xs text-purple-700 font-medium uppercase mb-1">Recommendation</p>
                        <p className="text-sm text-purple-900 font-medium">{mlEvaluations[0].recommendation}</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-2">
                       <button 
                         onClick={handleRunMlEvaluation}
                         disabled={isEvaluating}
                         className="px-3 py-1.5 bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 text-xs font-medium rounded shadow-sm disabled:opacity-50"
                       >
                         {isEvaluating ? "Evaluating..." : "Re-Run Evaluation"}
                       </button>
                    </div>

                    {showPreviousEvals && mlEvaluations.length > 1 && (
                      <div className="mt-4 pt-4 border-t border-purple-200">
                        <h4 className="text-xs font-semibold text-purple-800 mb-2 uppercase">Previous Evaluations</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {mlEvaluations.slice(1).map((ev) => (
                            <div key={ev.evaluation_id} className="text-xs bg-white p-2 rounded border border-purple-100 flex justify-between items-center">
                              <div>
                                <span className="font-semibold">{ev.model_version}</span> - {new Date(ev.evaluated_at).toLocaleDateString()}
                              </div>
                              <span className={ev.predicted_class === 'good_intern' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {ev.predicted_class} ({ev.match_score !== null ? `${(ev.match_score * 100).toFixed(0)}%` : 'N/A'})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* HR Shortlisting Decision Panel */}
              <div className="space-y-4 bg-white p-4 rounded-lg border border-gray-200 mb-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">HR Shortlisting Decision</h3>
                
                {shortlistHistory.length > 0 ? (
                  <div className="space-y-3">
                    {shortlistHistory.map((sh, idx) => (
                      <div key={sh.decision_id} className={`p-3 rounded-lg border ${idx === 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
                        {idx === 0 && <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 mb-1 block">Current Decision</span>}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sh.decision === 'shortlisted' ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'}`}>
                              {sh.decision === 'shortlisted' ? 'Shortlisted' : 'Non-Shortlisted'}
                            </span>
                            
                            {/* HR Override Indicator */}
                            {mlEvaluations.length > 0 && idx === 0 && (
                              (sh.decision === 'shortlisted' && mlEvaluations[0].predicted_class === 'bad_intern') || 
                              (sh.decision === 'non_shortlisted' && mlEvaluations[0].predicted_class === 'good_intern')
                            ) && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                HR Override
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{new Date(sh.decided_at).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-700 bg-white p-2 rounded border border-gray-100">
                          <span className="font-medium text-xs text-gray-500 block mb-1">Reason:</span>
                          {sh.reason}
                        </div>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => setEditMode(true)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 mt-2 inline-block"
                    >
                      Change Decision
                    </button>
                  </div>
                ) : (
                  <div>
                    {candidate.current_status !== 'ml_evaluated' ? (
                      <div className="text-sm text-gray-500 italic py-2">
                        Candidate must be ML Evaluated before a shortlisting decision can be made.
                      </div>
                    ) : (
                      <div className="text-sm text-amber-600 font-medium py-2 bg-amber-50 px-3 rounded-lg border border-amber-100 mb-3">
                        Awaiting HR Decision
                      </div>
                    )}
                  </div>
                )}

                {/* Decision Form (Visible if no decision yet and ml_evaluated, or if editMode is active to change decision) */}
                {((shortlistHistory.length === 0 && candidate.current_status === 'ml_evaluated') || editMode) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">
                      {shortlistHistory.length > 0 ? "Change Shortlisting Decision" : "Make Decision"}
                    </h4>
                    
                    {decisionError && (
                      <div className="bg-rose-50 text-rose-700 p-2 rounded text-sm border border-rose-200 mb-3">{decisionError}</div>
                    )}
                    
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer flex-1 transition-colors ${decisionForm.decision === 'shortlisted' ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                          <input 
                            type="radio" 
                            name="decision" 
                            value="shortlisted" 
                            checked={decisionForm.decision === 'shortlisted'}
                            onChange={(e) => setDecisionForm({...decisionForm, decision: e.target.value})}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                          />
                          <span className="ml-3 font-medium text-gray-900 text-sm">Shortlist</span>
                        </label>
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer flex-1 transition-colors ${decisionForm.decision === 'non_shortlisted' ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-500' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                          <input 
                            type="radio" 
                            name="decision" 
                            value="non_shortlisted" 
                            checked={decisionForm.decision === 'non_shortlisted'}
                            onChange={(e) => setDecisionForm({...decisionForm, decision: e.target.value})}
                            className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300"
                          />
                          <span className="ml-3 font-medium text-gray-900 text-sm">Non-Shortlist</span>
                        </label>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
                        <textarea 
                          className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 bg-white"
                          rows="3"
                          placeholder="Provide a mandatory reason for this decision..."
                          value={decisionForm.reason}
                          onChange={(e) => setDecisionForm({...decisionForm, reason: e.target.value})}
                        ></textarea>
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-2">
                        {editMode && (
                          <button 
                            onClick={() => {
                              setEditMode(false);
                              setDecisionError('');
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        )}
                        <button 
                          onClick={handleSubmitDecision}
                          disabled={isSubmittingDecision || !decisionForm.reason.trim()}
                          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {isSubmittingDecision ? "Submitting..." : "Confirm Decision"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {editMode && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Update Status</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 bg-white"
                    value={updateData.current_status}
                    onChange={(e) => setUpdateData({...updateData, current_status: e.target.value})}
                  >
                    <option value="application_received">Application Received</option>
                    <option value="under_review">Under Review</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="non_shortlisted">Non Shortlisted</option>
                  </select>
                </div>
              )}

              <div className="flex justify-start gap-3">
                {editMode ? (
                  <>
                    <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      Cancel
                    </button>
                    <button onClick={handleUpdate} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      Save Status
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditMode(true)} className="px-4 py-2 text-sm font-medium text-white bg-gray-800 border border-transparent rounded-lg hover:bg-gray-900 focus:outline-none flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    Edit Status
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Resume & Parsing */}
        <div className="flex-1 border-l md:border-t-0 border-t border-gray-200 md:pl-6 pt-6 md:pt-0 relative">
          <button onClick={onClose} className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 transition-colors hidden md:block">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>

          <h3 className="text-lg font-semibold text-gray-800 mb-4">Resume Parsing</h3>
          
          {candidate?.resume_signed_url ? (
            <div className="mb-6 flex gap-3 items-center">
              <a 
                href={candidate.resume_signed_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-blue-700 border border-blue-200 rounded-lg shadow-sm hover:bg-blue-50 transition-colors font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                View PDF
              </a>
              <button 
                onClick={handleParseResume}
                disabled={isParsing || loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-colors font-medium text-sm disabled:bg-emerald-400"
              >
                {isParsing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Parsing resume...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                    Parse Resume
                  </>
                )}
              </button>
            </div>
          ) : (
             <p className="text-sm text-rose-600 mb-6">{candidate?.resume_error || "No resume found"}</p>
          )}

          {parseError && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm border border-rose-200 mb-4">{parseError}</div>
          )}

          {parsedResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
              {parsedResult.warnings && parsedResult.warnings.length > 0 && (
                <div className="mb-4 bg-amber-50 text-amber-800 p-3 rounded border border-amber-200 text-sm">
                  <p className="font-semibold mb-1">Warnings:</p>
                  <ul className="list-disc list-inside">
                    {parsedResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-800 border-b border-gray-300 pb-1 mb-2">Detected Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {parsedResult.parsed_profile.skills.length > 0 ? (
                      parsedResult.parsed_profile.skills.map((skill, i) => (
                        <span key={i} className="px-2 py-1 bg-white border border-gray-300 text-gray-700 text-xs rounded-md shadow-sm">{skill}</span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">None detected</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-800 border-b border-gray-300 pb-1 mb-2">Education</h4>
                  {parsedResult.parsed_profile.education.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {parsedResult.parsed_profile.education.map((edu, i) => <li key={i}>{edu.degree}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">None detected</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 border-b border-gray-300 pb-1 mb-2">Experience</h4>
                  {parsedResult.parsed_profile.experience.length > 0 ? (
                    <ul className="space-y-2">
                      {parsedResult.parsed_profile.experience.map((exp, i) => (
                        <li key={i} className="text-sm">
                          <div className="font-medium text-gray-900">{exp.title}</div>
                          {exp.description && <div className="text-gray-500 text-xs mt-1 line-clamp-2">{exp.description}</div>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">None detected</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 border-b border-gray-300 pb-1 mb-2">Projects</h4>
                  {parsedResult.parsed_profile.projects.length > 0 ? (
                    <ul className="space-y-2">
                      {parsedResult.parsed_profile.projects.map((proj, i) => (
                        <li key={i} className="text-sm">
                          <div className="font-medium text-gray-900">{proj.name}</div>
                          {proj.technologies && proj.technologies.length > 0 && (
                            <div className="text-xs text-indigo-600 mt-0.5">Tech: {proj.technologies.join(', ')}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">None detected</p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                {!showConfirmApply ? (
                  <button 
                    onClick={() => setShowConfirmApply(true)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    Apply Parsed Data
                  </button>
                ) : (
                  <div className="bg-white p-4 border border-indigo-200 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-800 mb-3 font-medium">Apply parsed resume data to this application?</p>
                    <p className="text-xs text-gray-500 mb-4">Existing structured candidate information may be replaced.</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowConfirmApply(false)}
                        className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded transition-colors text-sm"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleApplyParsedData}
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition-colors text-sm"
                      >
                        Confirm Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {showScheduleModal && (
        <ScheduleInterviewModal 
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          applicationId={applicationId}
          onSuccess={() => { setShowScheduleModal(false); onUpdate(); fetchCandidateDetails(); }}
        />
      )}
    </div>
  );
};

export default CandidateDetailsModal;
