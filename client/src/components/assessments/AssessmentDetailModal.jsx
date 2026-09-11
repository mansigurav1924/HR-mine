import React, { useState, useEffect } from 'react';
import { fetchAssessmentDetail, overrideAssessmentResult, sendInterviewInvitation, fetchAssessmentIntegrity, retryResultEmail } from '../../services/assessmentApi';

export default function AssessmentDetailModal({ assessmentId, onClose, onUpdate }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overrideForm, setOverrideForm] = useState({ result: 'pass', reason: '' });
  const [overriding, setOverriding] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');

  // Integrity state
  const [integrity, setIntegrity] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [assessmentId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setActionSuccessMsg('');
      setActionErrorMsg('');
      const data = await fetchAssessmentDetail(assessmentId);
      setDetail(data);
      setOverrideForm({
        result: data.result === 'pass' ? 'fail' : 'pass',
        reason: ''
      });
      // Load integrity summary (silently, doesn't block modal if it fails)
      try {
        const integrityData = await fetchAssessmentIntegrity(assessmentId);
        setIntegrity(integrityData);
      } catch {
        setIntegrity(null);
      }
    } catch (err) {
      console.error('Failed to load detail:', err);
      setActionErrorMsg(err.response?.data?.detail || err.message || 'Failed to load assessment details.');
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    if (!overrideForm.reason.trim()) return;
    try {
      setOverriding(true);
      setActionSuccessMsg('');
      setActionErrorMsg('');
      await overrideAssessmentResult(assessmentId, {
        result: overrideForm.result,
        reason: overrideForm.reason.trim()
      });
      setActionSuccessMsg(`Assessment result overridden to '${overrideForm.result.toUpperCase()}' successfully.`);
      await loadDetail();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      setActionErrorMsg(err.response?.data?.detail || err.message || 'Failed to apply override.');
    } finally {
      setOverriding(false);
    }
  };

  const handleSendInterviewInvite = async () => {
    if (!detail?.application_id) return;
    try {
      setSendingInvite(true);
      setActionSuccessMsg('');
      setActionErrorMsg('');
      await sendInterviewInvitation(detail.application_id);
      setActionSuccessMsg('Text Interview invitation email sent via Gmail API successfully.');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to send interview invite:', err);
      setActionErrorMsg(err.response?.data?.detail || err.message || 'Failed to send interview invitation.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRetryEmail = async () => {
    try {
      setRetryingEmail(true);
      setActionSuccessMsg('');
      setActionErrorMsg('');
      const res = await retryResultEmail(assessmentId);
      if (res.success) {
        setActionSuccessMsg('Result email sent successfully.');
        await loadDetail();
        if (onUpdate) onUpdate();
      } else {
        setActionErrorMsg('Failed to send result email. Please check logs.');
      }
    } catch (err) {
      console.error('Failed to retry email:', err);
      setActionErrorMsg(err.response?.data?.detail || err.message || 'Failed to retry result email.');
    } finally {
      setRetryingEmail(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto animate-fade-in text-gray-900">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              Assessment Evaluation
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">
              {detail?.candidate_name || 'Candidate Assessment'}
            </h3>
            {detail && (
              <p className="text-xs text-gray-500 mt-0.5">
                {detail.position} • {detail.department || 'General'} • {detail.email}
              </p>
            )}
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Notifications */}
        {actionSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span>✓</span> {actionSuccessMsg}
          </div>
        )}
        {actionErrorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span> {actionErrorMsg}
          </div>
        )}

        {loading || !detail ? (
          <div className="py-12 text-center text-gray-500 text-xs font-medium space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
            <p>Loading assessment details...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Top Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Score (Adjusted)</p>
                <p className="text-xl font-extrabold text-indigo-950 mt-1 flex items-baseline gap-1">
                  {detail.adjusted_score !== null ? `${Number(detail.adjusted_score).toFixed(1)}%` : 'Pending'}
                  {detail.integrity_penalty > 0 && (
                    <span className="text-[10px] text-amber-600 font-bold" title={`Raw: ${detail.raw_score}%, Penalty: -${detail.integrity_penalty}%`}>
                      (-{detail.integrity_penalty}%)
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Threshold: {detail.threshold}%</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Outcome & Email</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                    detail.result === 'pass' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {detail.result === 'pass' ? 'PASSED' : 'FAILED'}
                  </span>
                  
                  {detail.completed_at && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      detail.email_status === 'sent' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      Email: {detail.email_status === 'sent' ? 'Sent ✓' : 'Failed ✗'}
                    </span>
                  )}
                </div>
                
                {detail.completed_at && detail.email_status !== 'sent' && (
                  <button 
                    type="button"
                    onClick={handleRetryEmail}
                    disabled={retryingEmail}
                    className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {retryingEmail ? 'Retrying...' : 'Retry Email'}
                  </button>
                )}
                
                <p className="text-[11px] text-gray-400 mt-1">
                  {detail.correct_count}/{detail.question_count} Correct
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Time Taken</p>
                <p className="text-xl font-extrabold text-gray-900 mt-1">
                  {formatDuration(detail.time_taken_seconds)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {detail.completed_at ? 'Completed' : 'In Progress'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Questions</p>
                <p className="text-xl font-extrabold text-gray-900 mt-1">
                  {detail.question_count} MCQs
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {detail.incorrect_count} Incorrect • {detail.timed_out_count || 0} Timeout
                </p>
              </div>
            </div>

            {/* Candidate Verified Skills & ML Separation Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Verified Skills */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✓</span> Candidate Verified Skills ({detail.verified_skills?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {detail.verified_skills && detail.verified_skills.length > 0 ? (
                    detail.verified_skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-800 text-[11px] font-semibold rounded-lg shadow-2xs">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">No verified skills recorded</span>
                  )}
                </div>
              </div>

              {/* ML Recommendation (Distinct & Separated) */}
              <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🤖</span> ML Classifier Recommendation (Separate)
                </h4>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    detail.predicted_class === 'good_intern'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {detail.predicted_class === 'good_intern' ? 'Good Intern' : detail.predicted_class || 'Not Evaluated'}
                  </span>
                  {detail.match_score !== null && detail.match_score !== undefined && (
                    <span className="text-xs text-blue-800 font-semibold">
                      Match Score: {typeof detail.match_score === 'number' ? `${(detail.match_score * 100).toFixed(0)}%` : detail.match_score}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-blue-900/80 leading-relaxed">
                  Advisory only. Candidate assessment outcome was calculated strictly from MCQ responses.
                </p>
              </div>

            </div>

            {/* Question Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>📝</span> Question Breakdown & Performance
              </h4>
              
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {detail.question_breakdown?.map((q, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3.5 rounded-2xl border transition-colors ${
                      q.is_correct 
                        ? 'border-emerald-200 bg-emerald-50/40' 
                        : 'border-rose-200 bg-rose-50/40'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">Q{q.question_number}</span>
                        {q.skill && (
                          <span className="px-2 py-0.5 bg-white border border-gray-200 text-gray-700 text-[10px] font-bold rounded-md">
                            {q.skill}
                          </span>
                        )}
                        {q.difficulty && (
                          <span className="text-[10px] text-gray-400 capitalize">
                            ({q.difficulty})
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        q.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {q.is_correct ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-gray-800 mt-2 leading-relaxed">
                      {q.question}
                    </p>

                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className={`p-2 rounded-xl border ${q.response_status === 'timed_out' ? 'bg-amber-50/50 border-amber-100' : 'bg-white/80 border-gray-100'}`}>
                        <span className="text-[10px] font-bold text-gray-400 block uppercase">Candidate Answer:</span>
                        <span className={`font-semibold ${
                          q.response_status === 'timed_out' ? 'text-amber-700' :
                          q.is_correct ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {q.response_status === 'timed_out' ? '⏰ Timed Out' : (q.candidate_answer || 'No answer submitted')}
                        </span>
                      </div>
                      <div className="p-2 bg-white/80 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 block uppercase">Correct Answer:</span>
                        <span className="text-emerald-800 font-semibold">{q.correct_answer}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Stage: Interview Invitation (For Passed candidates) */}
            {detail.result === 'pass' && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🚀</span> Next Recruitment Stage: Automated AI Interview
                  </h4>
                  <p className="text-xs text-emerald-900 mt-0.5">
                    Candidate has met the technical threshold. Send AI interview invitation via Gmail API.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSendInterviewInvite}
                  disabled={sendingInvite}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {sendingInvite ? 'Sending...' : '📨 Send Interview Invitation'}
                </button>
              </div>
            )}

            {/* ── Assessment Integrity ─────────────────────────────────────── */}
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔍</span> Assessment Integrity
                </h4>
                {integrity && (
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider border ${
                    integrity.integrity_status === 'review_recommended'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}>
                    {integrity.integrity_status === 'review_recommended' ? '⚠ Review' : '✓ Clear'}
                  </span>
                )}
              </div>

              {!integrity ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-gray-400 italic text-center">
                  Integrity data not available (assessment may still be in progress, or the integrity table is not yet migrated).
                </div>
              ) : (
                <>
                  {/* Event Counts Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Tab Switches',    value: integrity.tab_switches,    warn: integrity.tab_switches >= (integrity.review_threshold || 3) },
                      { label: 'FS Exits',        value: integrity.fullscreen_exits, warn: integrity.fullscreen_exits >= 2 },
                      { label: 'Copy/Paste/Cut',  value: integrity.copy_attempts + integrity.paste_attempts + integrity.cut_attempts, warn: integrity.copy_attempts >= 3 },
                      { label: 'Violations Issued', value: integrity.penalties_applied || 0, warn: (integrity.penalties_applied || 0) > 0 },
                    ].map(({ label, value, warn }) => (
                      <div key={label} className={`p-3 rounded-xl border text-center ${
                        warn && value > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <p className={`text-lg font-extrabold ${ warn && value > 0 ? 'text-amber-700' : 'text-gray-900' }`}>{value}</p>
                        <p className="text-[10px] font-semibold text-gray-500 mt-0.5 leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Fullscreen support */}
                  {!integrity.fullscreen_supported && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="text-amber-500">⚠</span> Fullscreen API was not supported on this candidate's browser/device.
                    </p>
                  )}

                  {/* Privacy disclaimer */}
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                    <span className="font-bold">ℹ️ Note: </span>{integrity.disclaimer}
                  </div>

                  {/* Violation Episodes */}
                  {integrity.violation_episodes?.length > 0 && (
                    <div className="mt-4 border border-rose-100 rounded-2xl overflow-hidden">
                      <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-900 uppercase">Violation Episodes ({integrity.violation_episodes.length})</span>
                        <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full">Total Penalty: -{integrity.total_penalty}%</span>
                      </div>
                      <div className="divide-y divide-gray-100 bg-white">
                        {integrity.violation_episodes.map((ep, i) => (
                          <div key={i} className="p-3 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-bold text-gray-900">
                                {ep.is_warning ? '⚠️ Warning' : '⛔ Penalty'} {ep.primary_event_type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-gray-500 ml-2">
                                ({ep.event_count} events deduplicated) • Q{ep.question_index + 1}
                              </span>
                            </div>
                            <span className={`text-xs font-bold ${ep.penalty_applied > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                              -{ep.penalty_applied}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Event Timeline */}
                  {integrity.event_timeline?.length > 0 && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setShowTimeline(t => !t)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                      >
                        <span>{showTimeline ? '▲' : '▼'}</span>
                        {showTimeline ? 'Hide' : 'View'} Raw Event Log ({integrity.event_timeline.length} events)
                      </button>

                      {showTimeline && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-100 text-left">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Event</th>
                                <th className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Question</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {integrity.event_timeline.map((ev) => (
                                <tr key={ev.event_id} className="hover:bg-slate-50/70">
                                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                                    {new Date(ev.occurred_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </td>
                                  <td className="px-4 py-2 text-xs font-semibold text-gray-800">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      ev.event_type === 'TAB_SWITCH' ? 'bg-amber-100 text-amber-800'
                                      : ev.event_type.includes('COPY') || ev.event_type.includes('PASTE') || ev.event_type.includes('CUT') ? 'bg-rose-100 text-rose-800'
                                      : ev.event_type.includes('FULLSCREEN') ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {ev.event_type.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-500">
                                    {ev.question_index != null ? `Q${ev.question_index + 1}` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* HR Result Override Form */}
            <div className="border-t border-gray-100 pt-5 space-y-3">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚖️</span> HR Result Override
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                You may override the pass/fail outcome based on comprehensive review. The original calculated score is preserved and this action is logged in audit trails.
              </p>

              <form onSubmit={handleOverride} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                    <input 
                      type="radio" 
                      name="override_result_option" 
                      value="pass" 
                      checked={overrideForm.result === 'pass'} 
                      onChange={(e) => setOverrideForm({...overrideForm, result: e.target.value})}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4" 
                    />
                    <span>Pass Candidate</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                    <input 
                      type="radio" 
                      name="override_result_option" 
                      value="fail" 
                      checked={overrideForm.result === 'fail'}
                      onChange={(e) => setOverrideForm({...overrideForm, result: e.target.value})}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4" 
                    />
                    <span>Fail Candidate</span>
                  </label>
                </div>

                <div>
                  <textarea
                    required
                    rows="2"
                    placeholder="Enter HR override rationale (required)..."
                    value={overrideForm.reason}
                    onChange={(e) => setOverrideForm({...overrideForm, reason: e.target.value})}
                    className="w-full text-xs border border-gray-300 rounded-xl p-3 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={overriding || !overrideForm.reason.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {overriding ? 'Applying Override...' : 'Confirm Override'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
