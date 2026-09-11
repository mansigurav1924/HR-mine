import React, { useState, useEffect } from 'react';
import { getInterviews } from '../services/interviewApi';
import InterviewDetailModal from '../components/interviews/InterviewDetailModal';

export default function MyInterviews() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);

  const tabs = ['Upcoming', 'Completed'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getInterviews();
      setInterviews(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterInterviews = () => {
    return interviews.filter(i => {
      if (activeTab === 'Upcoming') return i.status === 'scheduled';
      if (activeTab === 'Completed') return i.status === 'completed' || i.status === 'cancelled';
      return false;
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Interviews</h1>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interview Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filterInterviews().map((intv) => (
                <tr key={intv.interview_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {intv.applications.first_name} {intv.applications.last_name || ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {intv.type} Interview
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {intv.date} {intv.time}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">
                    {intv.mode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {intv.status === 'scheduled' && intv.reschedule_requested ? (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Reschedule Req</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs uppercase">{intv.status}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => setSelectedInterviewId(intv.interview_id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      {intv.status === 'scheduled' ? 'Review & Evaluate' : 'View Detail'}
                    </button>
                  </td>
                </tr>
              ))}
              {filterInterviews().length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No interviews found for this tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedInterviewId && (
        <InterviewDetailModal 
          isOpen={!!selectedInterviewId}
          onClose={() => setSelectedInterviewId(null)}
          interviewId={selectedInterviewId}
          onUpdate={loadData}
          isHR={false} // Indicates restricted interviewer mode
        />
      )}
    </div>
  );
}
