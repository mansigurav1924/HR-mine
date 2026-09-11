import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { submitShortlistDecision, getShortlistHistory } from '../../services/shortlistingApi';

export default function HRReviewModal({ isOpen, onClose, candidate, onDecisionSubmitted }) {
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeUrl, setResumeUrl] = useState(null);
  
  const [decisionType, setDecisionType] = useState(null); // 'shortlisted' | 'non_shortlisted' | null
  const [reason, setReason] = useState('');
  const [sendRejectionEmail, setSendRejectionEmail] = useState(true);
  const [sendAssessmentEmail, setSendAssessmentEmail] = useState(true);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isOpen && candidate) {
      setDecisionType(null);
      setReason('');
      setSendRejectionEmail(true);
      setSendAssessmentEmail(true);
      setErrorMsg('');
      setResumeUrl(null);
      loadHistory();
    }
  }, [isOpen, candidate]);

  const loadHistory = async () => {
    if (!candidate?.application_id) return;
    setHistoryLoading(true);
    try {
      const data = await getShortlistHistory(candidate.application_id);
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewResume = async () => {
    if (!candidate?.application_id) return;
    setResumeLoading(true);
    try {
      const res = await api.get(`/api/applications/${candidate.application_id}/resume-url`);
      if (res.data?.resume_url) {
        window.open(res.data.resume_url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Resume URL could not be generated.');
      }
    } catch (err) {
      console.error('Failed to get signed resume URL', err);
      alert('Failed to load resume: ' + (err.response?.data?.detail || err.message));
    } finally {
      setResumeLoading(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!decisionType) return;
    if (!reason.trim()) {
      setErrorMsg('Please enter an HR decision reason/notes.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await submitShortlistDecision(candidate.application_id, {
        decision: decisionType,
        reason: reason.trim(),
        send_rejection_email: decisionType === 'non_shortlisted' ? sendRejectionEmail : false,
        send_assessment_email: decisionType === 'shortlisted' ? sendAssessmentEmail : false
      });

      if (onDecisionSubmitted) {
        onDecisionSubmitted();
      }
      onClose();
    } catch (err) {
      console.error('Failed to submit decision', err);
      const detail = err.response?.data?.detail;
      let msg = 'Failed to submit decision. Please try again.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !candidate) return null;

  const isGoodIntern = candidate.predicted_class === 'good_intern';
  const isBadIntern = candidate.predicted_class === 'bad_intern';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto animate-fade-in font-sans">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {candidate.candidate_name}
              </h2>
              {candidate.predicted_class && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isGoodIntern
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {isGoodIntern ? '⭐ ML Recommended (Good Intern)' : '⚠️ ML Review (Bad Intern)'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Applying for <span className="font-semibold text-gray-800">{candidate.position || 'Position'}</span> • <span className="text-gray-600">{candidate.department || 'Department'}</span> • {candidate.email || 'No email provided'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleViewResume}
              disabled={resumeLoading}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {resumeLoading ? 'Opening...' : '📄 View Resume'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none p-1 rounded-lg hover:bg-gray-100"
            >
              ×
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <span>⚠️</span>
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* ML Advisory Notice */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span>
              <strong>Advisory Notice:</strong> ML result is an algorithmic recommendation. Final shortlisting or rejection is exclusively determined by HR.
            </span>
          </div>
          {candidate.match_score !== null && candidate.match_score !== undefined && (
            <span className="px-2 py-0.5 bg-blue-200/70 text-blue-900 rounded font-bold">
              Match Score: {typeof candidate.match_score === 'number' ? `${(candidate.match_score * 100).toFixed(0)}%` : candidate.match_score}
            </span>
          )}
        </div>

        {/* Evaluation & Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: Skills Matching */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 space-y-4 text-xs">
            <h4 className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎯</span> Skill Breakdown
            </h4>

            {/* Matching Skills */}
            <div>
              <p className="font-semibold text-emerald-800 mb-1.5">Matching Skills ({candidate.matching_skills?.length || 0}):</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.matching_skills && candidate.matching_skills.length > 0 ? (
                  candidate.matching_skills.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium border border-emerald-200">
                      ✓ {s}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 italic">None identified</span>
                )}
              </div>
            </div>

            {/* Missing Skills */}
            <div>
              <p className="font-semibold text-rose-800 mb-1.5">Missing Required / Preferred Skills ({candidate.missing_skills?.length || 0}):</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.missing_skills && candidate.missing_skills.length > 0 ? (
                  candidate.missing_skills.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-medium border border-rose-200">
                      ✗ {s}
                    </span>
                  ))
                ) : (
                  <span className="text-emerald-600 font-medium">All key skills present</span>
                )}
              </div>
            </div>

            {/* Candidate Reported / Verified Skills */}
            <div>
              <p className="font-semibold text-gray-700 mb-1.5">Candidate Profile Skills:</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.isArray(candidate.skills) && candidate.skills.length > 0 ? (
                  candidate.skills.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white text-gray-700 rounded border border-gray-200">
                      {typeof s === 'string' ? s : s.skill}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 italic">No explicit skills list</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Experience & Projects */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 space-y-4 text-xs">
            <h4 className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>💼</span> Experience & Projects Summary
            </h4>

            <div>
              <p className="font-semibold text-gray-700 mb-1">Relevant Experience:</p>
              {candidate.relevant_experience && Array.isArray(candidate.relevant_experience) && candidate.relevant_experience.length > 0 ? (
                <div className="space-y-1 text-gray-600">
                  {candidate.relevant_experience.map((exp, i) => (
                    <p key={i} className="bg-white p-2 rounded border border-gray-200">
                      {typeof exp === 'string' ? exp : exp.description || JSON.stringify(exp)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic bg-white p-2 rounded border border-gray-200">
                  {typeof candidate.relevant_experience === 'string' ? candidate.relevant_experience : 'No prior work experience listed.'}
                </p>
              )}
            </div>

            <div>
              <p className="font-semibold text-gray-700 mb-1">Key Projects:</p>
              {candidate.relevant_projects && Array.isArray(candidate.relevant_projects) && candidate.relevant_projects.length > 0 ? (
                <div className="space-y-1 text-gray-600">
                  {candidate.relevant_projects.map((proj, i) => (
                    <p key={i} className="bg-white p-2 rounded border border-gray-200">
                      {typeof proj === 'string' ? proj : proj.description || proj.name || JSON.stringify(proj)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic bg-white p-2 rounded border border-gray-200">
                  {typeof candidate.relevant_projects === 'string' ? candidate.relevant_projects : 'No key projects detailed.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Decision Section */}
        <div className="bg-white p-5 rounded-2xl border-2 border-indigo-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Record HR Shortlisting Decision
            </h3>
            {candidate.decision && (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                candidate.decision === 'shortlisted' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                Current: {candidate.decision}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setDecisionType('shortlisted');
                if (!reason) setReason(isBadIntern ? 'HR Override: Candidate demonstrated strong portfolio/practical skill.' : 'Meets all core requirements and passes initial evaluation.');
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all border ${
                decisionType === 'shortlisted'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              ✓ {candidate.decision === 'non_shortlisted' ? 'Reconsider & Shortlist' : 'Shortlist Candidate'}
            </button>

            <button
              type="button"
              onClick={() => {
                setDecisionType('non_shortlisted');
                if (!reason) setReason(isGoodIntern ? 'HR Override: Qualifications do not match current project requirements.' : 'Candidate does not meet required criteria for this position.');
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all border ${
                decisionType === 'non_shortlisted'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
              }`}
            >
              ✗ Reject / Non-Shortlist
            </button>
          </div>

          {decisionType && (
            <div className="space-y-3 pt-2 animate-fade-in text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  HR Reason / Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain your decision (required for audit trail and compliance)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                />
              </div>

              {decisionType === 'shortlisted' && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200">
                  <input
                    type="checkbox"
                    id="send_ass_email"
                    checked={sendAssessmentEmail}
                    onChange={(e) => setSendAssessmentEmail(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="send_ass_email" className="text-emerald-950 font-medium cursor-pointer">
                    Automatically generate assessment & email invitation link to candidate
                  </label>
                </div>
              )}

              {decisionType === 'non_shortlisted' && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-50/60 rounded-lg border border-rose-200">
                  <input
                    type="checkbox"
                    id="send_rej_email"
                    checked={sendRejectionEmail}
                    onChange={(e) => setSendRejectionEmail(e.target.checked)}
                    className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500 cursor-pointer"
                  />
                  <label htmlFor="send_rej_email" className="text-gray-700 cursor-pointer">
                    Send candidate polite rejection email (confidential, never mentions ML or internal notes)
                  </label>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSubmitDecision}
                  disabled={submitting}
                  className={`px-6 py-2.5 text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 ${
                    decisionType === 'shortlisted' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submitting ? 'Submitting...' : `Confirm ${decisionType === 'shortlisted' ? 'Shortlist' : 'Reject'}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit / Decision History */}
        {history.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
            <h4 className="font-bold text-gray-700 uppercase tracking-wider">Decision History</h4>
            <div className="space-y-1.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-gray-600">
                  <div>
                    <span className={`font-bold uppercase ${h.decision === 'shortlisted' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {h.decision}:
                    </span>{' '}
                    <span>{h.reason}</span>
                  </div>
                  <span className="text-gray-400">{new Date(h.decided_at || h.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
