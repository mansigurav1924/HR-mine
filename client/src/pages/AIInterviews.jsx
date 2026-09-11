import React, { useState, useEffect } from 'react';
import { fetchInterviewsDashboard, manualComplete, proceedToHuman } from '../services/aiInterviewApi';
import { downloadExport } from '../services/analyticsApi';
import Swal from 'sweetalert2';

export default function AIInterviews() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  const handleExport = async (format) => {
    try {
      setExporting(true);
      await downloadExport('ai-interviews', format);
    } catch (err) {
      Swal.fire({ title: 'Export Failed', text: err.response?.data?.detail || err.message, icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchInterviewsDashboard();
      setInterviews(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualComplete = async (id) => {
    const result = await Swal.fire({
      title: 'Mark as Completed?',
      text: 'AI interview automation is currently disabled. Mark this stage as manually completed and allow this candidate to continue?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Mark Completed',
      cancelButtonText: 'Cancel',
      borderRadius: '16px',
    });
    if (!result.isConfirmed) return;

    try {
      setActioningId(id);
      await manualComplete(id);
      await loadData();
      Swal.fire({
        title: 'Marked Completed!',
        text: 'The AI Interview stage has been marked as completed.',
        icon: 'success',
        confirmButtonColor: '#4F46E5',
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setActioningId(null);
    }
  };

  const handleProceedToHuman = async (id) => {
    const result = await Swal.fire({
      title: 'Schedule Human Interview?',
      html: 'This will mark the candidate as <strong>Human Interview Ready</strong>.<br/>You can then schedule the interview from the Human Interviews section.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Proceed',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;

    try {
      setActioningId(id);
      await proceedToHuman(id);
      await loadData();
      Swal.fire({
        title: 'Ready for Human Interview!',
        text: 'The candidate has been moved to the Human Interview stage.',
        icon: 'success',
        confirmButtonColor: '#4F46E5',
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="animate-fade-in space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AI Interviews (Placeholder)</h1>
          <p className="text-gray-500 mt-1">All AI Interview stage candidates — invited, opened, and completed.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mb-2"></div>
            Loading candidates...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Invitation</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Link Opened</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Opened At</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Completed At</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {interviews.map((intv) => (
                  <tr key={intv.ai_interview_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">
                        {intv.applications?.candidate_name || '—'}
                      </div>
                      <div className="text-xs text-gray-400">{intv.applications?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                      {intv.job_requirements?.position_title || intv.applications?.position || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Sent
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs font-bold rounded-full border ${
                        intv.started_at 
                          ? 'bg-blue-100 text-blue-800 border-blue-200' 
                          : 'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {intv.started_at ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm font-medium">
                      {formatDate(intv.started_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs font-bold rounded-full border ${
                        intv.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                        intv.status === 'opened' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {intv.status === 'completed' ? '✓ Done' : 
                         intv.status === 'opened' ? 'Opened' : 
                         'Invited'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {intv.status === 'completed' || intv.applications?.current_status === 'human_interview_ready' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-green-600 font-bold text-xs">✓ AI Interview Done</span>
                          <span className="text-gray-400 text-xs">{formatDate(intv.completed_at)}</span>
                          {intv.applications?.current_status !== 'human_interview_ready' && (
                            <button
                              onClick={() => handleProceedToHuman(intv.ai_interview_id)}
                              disabled={actioningId === intv.ai_interview_id}
                              className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50 font-bold text-xs mt-1"
                            >
                              Schedule Human Interview
                            </button>
                          )}
                        </div>
                      ) : intv.status === 'opened' ? (
                        <button 
                          onClick={() => handleManualComplete(intv.ai_interview_id)}
                          disabled={actioningId === intv.ai_interview_id}
                          className="text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50 font-bold"
                        >
                          Mark Completed
                        </button>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Waiting for candidate</span>
                      )}
                    </td>
                  </tr>
                ))}
                {interviews.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500 font-medium">
                      No candidates currently in the AI Interview stage.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
