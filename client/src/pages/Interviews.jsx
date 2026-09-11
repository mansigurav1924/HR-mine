import React, { useState, useEffect } from 'react';
import { getInterviews } from '../services/interviewApi';
import InterviewDetailModal from '../components/interviews/InterviewDetailModal';
import ReadyCandidatesList from '../components/interviews/ReadyCandidatesList';
import GroupBatchesList from '../components/interviews/GroupBatchesList';
import { downloadExport } from '../services/analyticsApi';

export default function Interviews() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('Ready for Interview');
  const [legacyTab, setLegacyTab] = useState('Scheduled');
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);

  const tabs = ['Ready for Interview', 'Group Batches', 'Individual Interviews (Legacy)'];
  const legacyTabs = ['Scheduled', 'Completed', 'Selected', 'Rejected', 'Reschedule Requests'];

  const handleExport = async (format) => {
    try {
      setExporting(true);
      await downloadExport('interviews', format);
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.detail || err.message));
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
      const data = await getInterviews();
      setInterviews(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterInterviews = () => {
    return (interviews || []).filter(i => {
      const appStatus = i.applications?.current_status;
      if (legacyTab === 'Scheduled') return i.status === 'scheduled' && !i.reschedule_requested;
      if (legacyTab === 'Completed') return i.status === 'completed';
      if (legacyTab === 'Selected') return appStatus === 'interview_selected' && i.status === 'completed';
      if (legacyTab === 'Rejected') return appStatus === 'interview_rejected' && i.status === 'completed';
      if (legacyTab === 'Reschedule Requests') return i.reschedule_requested === true;
      return false;
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Human Interviews Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and synchronize human interview rounds with Google Calendar and Microsoft Outlook.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
          <button 
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'Ready for Interview' && (
          <ReadyCandidatesList onBatchCreated={() => setActiveTab('Group Batches')} />
        )}
        
        {activeTab === 'Group Batches' && (
          <GroupBatchesList />
        )}

        {activeTab === 'Individual Interviews (Legacy)' && (
          <div className="space-y-4">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {legacyTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLegacyTab(tab)}
                    className={`
                      whitespace-nowrap py-2 px-1 border-b-2 font-medium text-xs transition-colors
                      ${legacyTab === tab
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading interviews...</div>
              ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interview Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calendar & Meeting</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interviewer</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filterInterviews().map((intv) => {
                  const candidateName = intv.applications?.candidate_name || `${intv.applications?.first_name || ''} ${intv.applications?.last_name || ''}`.trim() || 'Candidate';
                  const interviewerName = intv.users ? `${intv.users.first_name || ''} ${intv.users.last_name || ''}`.trim() || intv.users.email : 'Unassigned';

                  return (
                    <tr key={intv.interview_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{candidateName}</div>
                        <div className="text-xs text-gray-500">{intv.applications?.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">{intv.type} Interview</span>
                        <div className="text-xs text-gray-400 capitalize">{intv.mode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{intv.date}</div>
                        <div className="text-xs text-gray-400">{intv.time ? intv.time.substring(0, 5) : ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            intv.calendar_provider === 'outlook' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {intv.calendar_provider === 'outlook' ? 'Outlook' : 'Google'}
                          </span>
                          {intv.calendar_sync_status === 'synced' ? (
                            <span className="text-emerald-600 text-xs font-semibold">✓ Synced</span>
                          ) : intv.calendar_sync_status === 'failed' ? (
                            <span className="text-rose-600 text-xs font-semibold">⚠️ Sync Failed</span>
                          ) : null}
                        </div>
                        {intv.mode === 'online' && intv.meeting_link && (
                          <a
                            href={intv.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                          >
                            Join Video Call →
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {interviewerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => setSelectedInterviewId(intv.interview_id)}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filterInterviews().length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                      No interviews found for this tab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
            </div>
          </div>
        )}
      </div>

      {selectedInterviewId && (
        <InterviewDetailModal 
          isOpen={!!selectedInterviewId}
          onClose={() => setSelectedInterviewId(null)}
          interviewId={selectedInterviewId}
          onUpdate={loadData}
          isHR={true}
        />
      )}
    </div>
  );
}
