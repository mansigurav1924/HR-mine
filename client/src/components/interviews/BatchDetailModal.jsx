import React, { useState, useEffect } from 'react';
import { getGroupBatch, sendBatchInvitations, updateCandidateAttendance } from '../../services/groupInterviewApi';
import BatchCandidateEvaluationModal from './BatchCandidateEvaluationModal';

export default function BatchDetailModal({ isOpen, onClose, batchId, onUpdate }) {
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [evaluatingCandidate, setEvaluatingCandidate] = useState(null);

  useEffect(() => {
    if (isOpen && batchId) loadBatch();
  }, [isOpen, batchId]);

  const loadBatch = async () => {
    try {
      setLoading(true);
      const data = await getGroupBatch(batchId);
      setBatch(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvites = async () => {
    try {
      setSending(true);
      const res = await sendBatchInvitations(batchId);
      alert(`Invitations sent! Requested: ${res.requested}, Sent: ${res.sent}, Failed: ${res.failed}`);
      loadBatch();
      onUpdate();
    } catch (err) {
      alert('Failed to send invites: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleAttendance = async (appId, status) => {
    try {
      await updateCandidateAttendance(batchId, appId, status);
      loadBatch();
    } catch (err) {
      alert('Failed to update attendance.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Group Human Interview Batch</h2>
            {batch && <p className="text-xs text-gray-500">ID: {batch.batch_id}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading || !batch ? (
            <div className="text-center py-10 text-gray-500">Loading batch details...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Department</div>
                  <div className="font-medium text-gray-900">{batch.department}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Position</div>
                  <div className="font-medium text-gray-900">{batch.position}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Schedule</div>
                  <div className="font-medium text-gray-900">{new Date(batch.scheduled_start).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Meeting</div>
                  <a href={batch.meeting_link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 hover:underline">
                    Open Google Meet
                  </a>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-900">Candidates ({batch.candidates?.length || 0})</h3>
                  <button 
                    onClick={handleSendInvites}
                    disabled={sending}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send / Retry Invitations'}
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invitation</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {(batch.candidates || []).map(c => {
                        const app = c.applications;
                        const name = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Candidate';
                        return (
                          <tr key={c.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 text-sm">{name}</div>
                              <div className="text-xs text-gray-500">{app.email}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`capitalize px-2 py-0.5 rounded text-xs font-semibold ${
                                c.invitation_status === 'sent' ? 'bg-emerald-50 text-emerald-700' :
                                c.invitation_status === 'email_failed' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {c.invitation_status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <select 
                                value={c.attendance_status} 
                                onChange={(e) => handleAttendance(c.application_id, e.target.value)}
                                className="text-xs border rounded p-1"
                              >
                                <option value="pending">Pending</option>
                                <option value="attended">Attended</option>
                                <option value="no_show">No Show</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {c.evaluation_status === 'evaluated' ? (
                                <span className="text-emerald-600 font-semibold text-xs">Evaluated</span>
                              ) : (
                                <button 
                                  onClick={() => setEvaluatingCandidate(c)}
                                  className="text-xs px-2 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded font-medium"
                                >
                                  Evaluate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {evaluatingCandidate && (
        <BatchCandidateEvaluationModal
          isOpen={true}
          onClose={() => setEvaluatingCandidate(null)}
          batchId={batchId}
          candidate={evaluatingCandidate}
          onSuccess={() => {
            setEvaluatingCandidate(null);
            loadBatch();
          }}
        />
      )}
    </div>
  );
}
