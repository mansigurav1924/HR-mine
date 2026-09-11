import React, { useState, useEffect } from 'react';
import { getRecruitmentSummary, selectCandidate, rejectCandidate, holdCandidate } from '../../services/finalSelectionApi';
import Swal from 'sweetalert2';

const BADGE = {
  selected:   'bg-green-100 text-green-800',
  rejected:   'bg-red-100 text-red-700',
  hold:       'bg-yellow-100 text-yellow-800',
  completed:  'bg-blue-100 text-blue-800',
  pass:       'bg-green-100 text-green-800',
  fail:       'bg-red-100 text-red-700',
};

const Badge = ({ value, className }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${className || 'bg-gray-100 text-gray-700'}`}>
    {value}
  </span>
);

const Section = ({ title, color = 'gray', children }) => {
  const colors = {
    gray:   'bg-gray-50 border-gray-200 text-gray-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    blue:   'bg-blue-50  border-blue-200  text-blue-900',
    teal:   'bg-teal-50  border-teal-200  text-teal-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    rose:   'bg-rose-50  border-rose-200  text-rose-900',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <h3 className="font-bold text-base mb-4 border-b border-current border-opacity-20 pb-2">{title}</h3>
      {children}
    </div>
  );
};

const KV = ({ label, value, mono }) => (
  <div>
    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
    <p className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
  </div>
);

const RatingBar = ({ label, value, max = 5 }) => {
  const pct = value ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold">{value ? `${value} / ${max}` : '—'}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default function FinalSelectionReviewModal({ isOpen, onClose, applicationId, onUpdate }) {
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Decision panel state
  const [decision, setDecision]     = useState('select'); // 'select' | 'reject' | 'hold'
  const [notes, setNotes]           = useState('');
  const [reason, setReason]         = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [sendEmail, setSendEmail]   = useState(false);

  useEffect(() => {
    if (isOpen && applicationId) {
      setSummary(null);
      setLoading(true);
      setError('');
      setDecision('select');
      setNotes(''); setReason(''); setReviewDate(''); setSendEmail(false);
      getRecruitmentSummary(applicationId)
        .then(setSummary)
        .catch(e => setError('Failed to load candidate history. ' + (e.response?.data?.detail || '')))
        .finally(() => setLoading(false));
    }
  }, [isOpen, applicationId]);

  if (!isOpen) return null;

  const cand = summary?.candidate || {};

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (decision === 'reject' && !reason.trim()) {
      Swal.fire({ title: 'Rejection Reason Required', text: 'Please provide a reason for rejection.', icon: 'warning', confirmButtonColor: '#4F46E5' });
      return;
    }
    if (decision === 'hold' && !reason.trim()) {
      Swal.fire({ title: 'Hold Reason Required', text: 'Please provide a reason for placing on hold.', icon: 'warning', confirmButtonColor: '#4F46E5' });
      return;
    }

    const decisionLabels = { select: 'Final Select', reject: 'Reject', hold: 'Hold / Waiting List' };
    const confirmColors  = { select: '#16a34a', reject: '#dc2626', hold: '#d97706' };

    const confirmed = await Swal.fire({
      title: `Confirm: ${decisionLabels[decision]}`,
      html: `
        <div class="text-left text-sm space-y-1">
          <p><strong>Candidate:</strong> ${cand.candidate_name || '—'}</p>
          <p><strong>Position:</strong> ${cand.position || '—'}</p>
          ${decision === 'select' ? '<p class="text-green-700 mt-2">This candidate will be added to the Final Selected list and become eligible for Offer Letter generation.</p>' : ''}
          ${decision === 'reject' ? `<p class="text-red-700 mt-2"><strong>Reason:</strong> ${reason}</p>` : ''}
          ${decision === 'hold'   ? `<p class="text-yellow-700 mt-2"><strong>Hold Reason:</strong> ${reason}</p>` : ''}
        </div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: confirmColors[decision],
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${decisionLabels[decision]}`,
      cancelButtonText: 'Cancel',
    });
    if (!confirmed.isConfirmed) return;

    try {
      setIsSubmitting(true);
      if (decision === 'select')
        await selectCandidate(applicationId, notes);
      else if (decision === 'reject')
        await rejectCandidate(applicationId, reason, sendEmail);
      else if (decision === 'hold')
        await holdCandidate(applicationId, reason, reviewDate || null);

      onUpdate();
      onClose();
      Swal.fire({
        title: `${decisionLabels[decision]} Confirmed`,
        icon: 'success',
        confirmButtonColor: '#4F46E5',
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.detail || 'Action failed', icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if candidate is already decided
  const alreadyDecided = ['final_selected', 'final_rejected', 'final_hold'].includes(cand.current_status);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-6 flex flex-col" style={{ maxHeight: '95vh' }}>

        {/* Header */}
        <div className="flex justify-between items-center border-b px-7 py-5 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">HR Final Selection Review</h2>
            <p className="text-xs text-gray-500 mt-0.5">Complete candidate recruitment history</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-2xl leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-gray-500">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto" />
              <p>Loading candidate history...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 p-7">
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg">{error}</div>
          </div>
        ) : summary && (
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

            {/* Already Decided Banner */}
            {alreadyDecided && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                <span>This candidate has already received a decision: <strong className="capitalize">{cand.current_status?.replace('final_', '').replace('_', ' ')}</strong>. You may change the decision below.</span>
              </div>
            )}

            {/* ── SECTION 1: Candidate Information ── */}
            <Section title="① Candidate Information" color="gray">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KV label="Name"       value={cand.candidate_name} />
                <KV label="Email"      value={cand.email} />
                <KV label="Phone"      value={cand.phone} />
                <KV label="Department" value={cand.department} />
                <KV label="Position"   value={cand.position} />
                <KV label="Applied"    value={cand.application_date ? new Date(cand.application_date).toLocaleDateString() : null} />
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                {cand.resume_url && (
                  <a href={cand.resume_url} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                    View Resume
                  </a>
                )}
                {cand.github && (
                  <a href={cand.github} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium">
                    GitHub
                  </a>
                )}
                {cand.linkedin && (
                  <a href={cand.linkedin} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    LinkedIn
                  </a>
                )}
                {cand.portfolio && (
                  <a href={cand.portfolio} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium">
                    Portfolio
                  </a>
                )}
              </div>
            </Section>

            {/* ── SECTION 2: ML Summary ── */}
            <Section title="② ML Recommendation (Advisory Only)" color="purple">
              <p className="text-xs text-purple-700 bg-purple-100 rounded px-3 py-2 mb-4 font-medium">
                ML recommendation is advisory. Final hiring decision is made by HR.
              </p>
              {summary.ml ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <KV label="Predicted Class" value={summary.ml.predicted_class} />
                    <KV label="Match Score"     value={summary.ml.match_score != null ? `${(summary.ml.match_score * 100).toFixed(1)}%` : null} />
                    <KV label="Recommendation" value={summary.ml.recommendation} />
                  </div>
                  {summary.ml.matching_skills?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Matching Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.ml.matching_skills.map(s => (
                          <span key={s} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.ml.missing_skills?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Missing Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.ml.missing_skills.map(s => (
                          <span key={s} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">ML evaluation not yet run for this candidate.</p>
              )}
            </Section>

            {/* ── SECTION 3: Assessment ── */}
            <Section title="③ Assessment Result" color="blue">
              {summary.assessment ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <KV label="Result"        value={summary.assessment.result?.toUpperCase()} />
                    <KV label="Raw Score"     value={summary.assessment.raw_score ?? summary.assessment.score} />
                    <KV label="Pass Threshold" value={summary.assessment.pass_threshold} />
                    <KV label="Adjusted Score" value={summary.assessment.adjusted_score} />
                    <KV label="Integrity"      value={summary.assessment.integrity_status} />
                    <KV label="Tab Switches"   value={summary.assessment.tab_switches ?? '—'} />
                    <KV label="Fullscreen Exits" value={summary.assessment.fullscreen_exits ?? '—'} />
                    <KV label="Copy/Paste Attempts" value={summary.assessment.copy_paste_attempts ?? '—'} />
                  </div>
                  {summary.assessment.integrity_penalty > 0 && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                      Integrity penalty applied: -{summary.assessment.integrity_penalty} points
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">No assessment record found.</p>
              )}
            </Section>

            {/* ── SECTION 4: AI Interview ── */}
            <Section title="④ AI / Text Interview" color="teal">
              {summary.ai_interview ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <KV label="Status"          value={summary.ai_interview.status || summary.ai_interview.hr_review_status} />
                  <KV label="Completion Mode" value="Placeholder" />
                  <KV label="Completed At"    value={summary.ai_interview.completed_at ? new Date(summary.ai_interview.completed_at).toLocaleString() : '—'} />
                  <KV label="AI Score"        value="Not Available" />
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No AI interview record found.</p>
              )}
            </Section>

            {/* ── SECTION 5: Human Interview History ── */}
            <Section title="⑤ Human Interview History" color="indigo">
              {summary.human_interviews.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No human interview records found.</p>
              ) : (
                <div className="space-y-4">
                  {summary.human_interviews.map(hi => (
                    <div key={hi.interview_id} className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-gray-900">{hi.type || 'Technical'} Interview</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {hi.date} {hi.time && `at ${hi.time}`} ·{' '}
                            Interviewer: {hi.interviewer_name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge value={hi.status} className={BADGE[hi.status] || 'bg-gray-100 text-gray-700'} />
                          {hi.evaluation && (
                            <div className="block">
                              <Badge
                                value={hi.evaluation.decision}
                                className={hi.evaluation.decision === 'selected' ? BADGE.selected : BADGE.rejected}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {hi.evaluation ? (
                        <>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <RatingBar label="Technical Knowledge" value={hi.evaluation.technical_knowledge_score} />
                            <RatingBar label="Problem Solving"     value={hi.evaluation.problem_solving_score} />
                            <RatingBar label="Communication"       value={hi.evaluation.communication_score} />
                            <RatingBar label="Relevant Skills"     value={hi.evaluation.relevant_skills_score} />
                          </div>
                          <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                            <div>
                              <span className="text-xs text-gray-500">Overall: </span>
                              <span className="font-bold text-indigo-700 text-lg">{hi.evaluation.overall_score ?? '—'}</span>
                              <span className="text-xs text-gray-400"> / 5</span>
                            </div>
                            {hi.evaluation.notes && (
                              <div className="flex-1 text-xs text-gray-600 italic">"{hi.evaluation.notes}"</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 italic mt-2">No evaluation submitted yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── SECTION 6: Decision History ── */}
            {summary.decision_history?.length > 0 && (
              <Section title="⑥ Previous HR Decisions" color="rose">
                <div className="space-y-2">
                  {summary.decision_history.map(d => (
                    <div key={d.decision_id} className="flex items-start gap-3 text-sm">
                      <Badge value={d.decision} className={BADGE[d.decision] || 'bg-gray-100 text-gray-700'} />
                      <div>
                        <p className="text-gray-700">{d.reason || d.hr_notes || '—'}</p>
                        <p className="text-xs text-gray-400">{new Date(d.decided_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

          </div>
        )}

        {/* ── DECISION FOOTER ── */}
        {!loading && !error && summary && (
          <form onSubmit={handleSubmit} className="shrink-0 border-t bg-gray-50 rounded-b-2xl px-7 py-5 space-y-4">
            <h3 className="font-bold text-gray-800 text-base">HR Final Decision</h3>

            {/* Decision Radio */}
            <div className="flex gap-6">
              {[
                { value: 'select', label: 'Final Select', cls: 'text-green-700' },
                { value: 'reject', label: 'Reject',        cls: 'text-red-700'   },
                { value: 'hold',   label: 'Hold / Waiting', cls: 'text-yellow-700' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-2 cursor-pointer font-medium text-sm ${opt.cls}`}>
                  <input
                    type="radio"
                    name="decision"
                    value={opt.value}
                    checked={decision === opt.value}
                    onChange={() => setDecision(opt.value)}
                    className="accent-indigo-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Context-sensitive fields */}
            {decision === 'select' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Selection Notes (Optional)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
                  rows={2}
                  placeholder="e.g., Excellent technical skills, cleared all rounds."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}

            {(decision === 'reject' || decision === 'hold') && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {decision === 'reject' ? 'Rejection Reason *' : 'Hold Reason *'}
                </label>
                <textarea
                  required
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
                  rows={2}
                  placeholder={decision === 'reject'
                    ? 'e.g., Does not meet technical requirements for the role.'
                    : 'e.g., Limited openings currently, strong candidate for next batch.'}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
            )}

            {decision === 'reject' && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-indigo-600"
                  checked={sendEmail}
                  onChange={e => setSendEmail(e.target.checked)}
                />
                Send professional rejection email to candidate
              </label>
            )}

            {decision === 'hold' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Review Date (Optional)</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  value={reviewDate}
                  onChange={e => setReviewDate(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2.5 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50 ${
                  decision === 'select' ? 'bg-green-600 hover:bg-green-700' :
                  decision === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-yellow-500 hover:bg-yellow-600'
                }`}>
                {isSubmitting ? 'Processing...' : (
                  decision === 'select' ? 'Confirm Final Selection' :
                  decision === 'reject' ? 'Confirm Rejection' :
                  'Place on Hold'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
