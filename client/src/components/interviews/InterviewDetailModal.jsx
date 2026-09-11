import React, { useState, useEffect, useCallback } from 'react';
import { getInterviewDetail, evaluateInterview, markAttendance, flagReschedule, cancelInterview, retryCalendarSync } from '../../services/interviewApi';
import ScheduleInterviewModal from './ScheduleInterviewModal';

export default function InterviewDetailModal({ isOpen, onClose, interviewId, onUpdate, isHR }) {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  
  const [activeTab, setActiveTab] = useState('Details');
  
  // Eval State
  const [evalData, setEvalData] = useState({
    technical: 3, communication: 3, problem_solving: 3, project_knowledge: 3, confidence: 3,
    notes: '', decision: 'selected'
  });
  const [evalLoading, setEvalLoading] = useState(false);

  // Reschedule Modals
  const [showHRReschedule, setShowHRReschedule] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  const loadDetail = useCallback(async () => {
    if (!interviewId) return;
    try {
      setLoading(true);
      const data = await getInterviewDetail(interviewId);
      setInterview(data);
    } catch (err) {
      setError("Failed to load interview details");
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    if (isOpen && interviewId) {
      loadDetail();
    }
  }, [isOpen, interviewId, loadDetail]);

  const handleAttendance = async (status) => {
    try {
      await markAttendance(interviewId, status);
      await loadDetail();
      onUpdate();
    } catch (err) {
      alert("Failed to update attendance");
    }
  };

  const handleRetryCalendarSync = async () => {
    setSyncing(true);
    try {
      await retryCalendarSync(interviewId);
      await loadDetail();
      onUpdate();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to synchronize with calendar");
    } finally {
      setSyncing(false);
    }
  };

  const submitEval = async (e) => {
    e.preventDefault();
    setEvalLoading(true);
    try {
      await evaluateInterview(interviewId, evalData);
      await loadDetail();
      onUpdate();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to submit evaluation");
    } finally {
      setEvalLoading(false);
    }
  };

  const handleFlagReschedule = async () => {
    if (!flagReason) return alert("Reason required");
    try {
      await flagReschedule(interviewId, flagReason);
      await loadDetail();
      onUpdate();
    } catch (err) {
      alert("Failed to flag");
    }
  };

  const handleCancel = async () => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      await cancelInterview(interviewId, reason);
      await loadDetail();
      onUpdate();
    } catch (err) {
      alert("Failed to cancel");
    }
  };

  if (!isOpen) return null;

  const candidateName = interview?.applications ? (interview.applications.candidate_name || `${interview.applications.first_name || ''} ${interview.applications.last_name || ''}`.strip()) : 'Candidate';

  const overallAvg = ((parseInt(evalData.technical) + parseInt(evalData.communication) + parseInt(evalData.problem_solving) + parseInt(evalData.project_knowledge) + parseInt(evalData.confidence)) / 5).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 font-sans">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl p-6 relative h-[90vh] flex flex-col">
        
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">Interview Details</h2>
            {interview && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                interview.status === 'completed' ? 'bg-green-100 text-green-800' :
                interview.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {interview.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading interview details...</div>
        ) : error ? (
          <div className="bg-rose-50 text-rose-700 p-4 rounded-lg border border-rose-200">{error}</div>
        ) : interview ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex space-x-4 border-b mb-4 shrink-0">
              {['Details', 'Evaluation', 'History'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 px-3 text-sm font-semibold transition ${activeTab === tab ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {activeTab === 'Details' && (
                <div className="space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Candidate & Position */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Candidate & Role</h3>
                      <p className="text-base font-bold text-gray-900">{candidateName}</p>
                      <p className="text-sm text-gray-600 mt-1"><strong>Email:</strong> {interview.applications?.email || 'N/A'}</p>
                      <p className="text-sm text-gray-600"><strong>Position:</strong> {interview.position_title}</p>
                      <p className="text-sm text-gray-600"><strong>Department:</strong> {interview.department}</p>
                    </div>

                    {/* Schedule & Calendar Details */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Schedule & Calendar</h3>
                      <p className="text-sm text-gray-800"><strong>Type:</strong> {interview.type} Interview</p>
                      <p className="text-sm text-gray-800"><strong>Date:</strong> {interview.date} at {interview.time ? interview.time.substring(0, 5) : ''}</p>
                      <p className="text-sm text-gray-800"><strong>Mode:</strong> <span className="capitalize">{interview.mode}</span> ({interview.duration_minutes || 45} mins)</p>
                      
                      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-gray-500">Provider: </span>
                          <span className="font-semibold text-gray-900 capitalize">{interview.calendar_provider === 'outlook' ? 'Outlook Calendar' : 'Google Calendar'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Sync:</span>
                          {interview.calendar_sync_status === 'synced' ? (
                            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Synced</span>
                          ) : interview.calendar_sync_status === 'failed' ? (
                            <span className="text-[11px] font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">Sync Failed</span>
                          ) : (
                            <span className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Pending</span>
                          )}
                        </div>
                      </div>

                      {interview.calendar_sync_status === 'failed' && isHR && (
                        <div className="mt-2 text-xs flex items-center justify-between bg-rose-50 text-rose-700 p-2 rounded border border-rose-100">
                          <span>External calendar sync failed.</span>
                          <button
                            onClick={handleRetryCalendarSync}
                            disabled={syncing}
                            className="font-bold underline hover:text-rose-900"
                          >
                            {syncing ? 'Retrying...' : 'Retry Calendar Sync'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meeting Link / Location Banner */}
                  <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        {interview.mode === 'online' ? 'Video Conference Meeting' : 'In-Person Interview Location'}
                      </h4>
                      <p className="text-sm text-indigo-900 mt-0.5 font-medium">
                        {interview.mode === 'online' ? (interview.meeting_link || 'Online link pending') : (interview.location || 'Location specified by HR')}
                      </p>
                    </div>
                    {interview.mode === 'online' && interview.meeting_link && (
                      <a
                        href={interview.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Join Meeting
                      </a>
                    )}
                  </div>

                  {/* Attendance Section */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Candidate Attendance</h3>
                      <p className="capitalize font-bold text-gray-900 mt-0.5">{interview.attendance}</p>
                    </div>
                    
                    {interview.status === 'scheduled' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleAttendance('present')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${interview.attendance === 'present' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}>Present</button>
                        <button onClick={() => handleAttendance('absent')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${interview.attendance === 'absent' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'}`}>Absent</button>
                        <button onClick={() => handleAttendance('no_show')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${interview.attendance === 'no_show' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}>No Show</button>
                      </div>
                    )}
                  </div>

                  {/* Rescheduling & Actions Section */}
                  {interview.status === 'scheduled' && (
                    <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
                      <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">Rescheduling & Cancellation</h3>
                      
                      {interview.reschedule_requested && (
                        <div className="mb-3 bg-white p-3 rounded-lg border border-amber-200">
                          <p className="text-xs font-bold text-rose-600">Reschedule Requested by Interviewer</p>
                          <p className="text-xs text-gray-700 mt-1 italic">Reason: {interview.reschedule_request_reason}</p>
                        </div>
                      )}

                      {isHR ? (
                        <div className="flex gap-2">
                          <button onClick={() => setShowHRReschedule(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 shadow-sm transition">Reschedule (HR)</button>
                          <button onClick={handleCancel} className="px-4 py-2 border border-rose-300 text-rose-700 bg-white rounded-lg text-xs font-semibold hover:bg-rose-50 transition">Cancel Interview</button>
                        </div>
                      ) : (
                        !interview.reschedule_requested && (
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <input type="text" placeholder="Reason for reschedule..." value={flagReason} onChange={e => setFlagReason(e.target.value)} className="w-full border border-gray-300 p-2 rounded-lg text-xs" />
                            </div>
                            <button onClick={handleFlagReschedule} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 shadow-sm transition">Request Reschedule</button>
                          </div>
                        )
                      )}
                    </div>
                  )}

                </div>
              )}

              {activeTab === 'Evaluation' && (
                <div>
                  {interview.status === 'completed' ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl text-center text-emerald-900">
                      <h3 className="text-lg font-bold mb-1">Evaluation Completed</h3>
                      <p className="text-sm">This interview round has been submitted and evaluated.</p>
                    </div>
                  ) : interview.status === 'cancelled' ? (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-sm">Interview was cancelled. Evaluation unavailable.</div>
                  ) : interview.attendance !== 'present' ? (
                    <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl text-center text-gray-600 text-sm">
                      Please mark attendance as 'Present' from the Details tab before submitting an evaluation.
                    </div>
                  ) : (
                    <form onSubmit={submitEval} className="space-y-4 max-w-xl">
                      <div className="grid grid-cols-2 gap-4">
                        {['technical', 'communication', 'problem_solving', 'project_knowledge', 'confidence'].map(metric => (
                          <div key={metric}>
                            <label className="block text-xs font-semibold text-gray-700 capitalize mb-1">{metric.replace('_', ' ')} (1-5)</label>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              required
                              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                              value={evalData[metric]}
                              onChange={e => setEvalData({...evalData, [metric]: parseInt(e.target.value) || 1})}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-900 font-semibold">
                        Overall Score: {overallAvg} / 5.0
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Interviewer Notes</label>
                        <textarea
                          rows="3"
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          placeholder="Detailed feedback regarding technical depth and fit..."
                          value={evalData.notes}
                          onChange={e => setEvalData({...evalData, notes: e.target.value})}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Decision</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                          value={evalData.decision}
                          onChange={e => setEvalData({...evalData, decision: e.target.value})}
                        >
                          <option value="selected">Selected (Advance to next stage / final selection)</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>

                      <div className="pt-3">
                        <button
                          type="submit"
                          disabled={evalLoading}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                        >
                          {evalLoading ? 'Submitting...' : 'Submit Evaluation'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {activeTab === 'History' && (
                <div className="space-y-3">
                  {(interview.history || []).length === 0 ? (
                    <div className="text-gray-400 text-sm py-8 text-center">No round history found.</div>
                  ) : (
                    (interview.history || []).map((h, i) => (
                      <div key={h.interview_id || i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-gray-900">{h.type} Interview</span>
                          <span className="text-xs capitalize font-semibold text-indigo-600">{h.status}</span>
                        </div>
                        <p className="text-xs text-gray-500">Date: {h.date} at {h.time ? h.time.substring(0, 5) : ''} | Interviewer: {h.users?.first_name} {h.users?.last_name}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {showHRReschedule && (
          <ScheduleInterviewModal
            isOpen={showHRReschedule}
            onClose={() => setShowHRReschedule(false)}
            applicationId={interview?.application_id}
            isReschedule={true}
            existingInterview={interview}
            onSuccess={() => {
              setShowHRReschedule(false);
              loadDetail();
              onUpdate();
            }}
          />
        )}
      </div>
    </div>
  );
}
