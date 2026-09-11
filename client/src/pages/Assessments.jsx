import React, { useState, useEffect } from 'react';
import { fetchAssessmentsDashboard } from '../services/assessmentApi';
import AssessmentDetailModal from '../components/assessments/AssessmentDetailModal';
import { downloadExport } from '../services/analyticsApi';

export default function Assessments() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('Invited');
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  const tabs = ['Invited', 'In Progress', 'Passed', 'Failed'];

  const handleExport = async (format) => {
    try {
      setExporting(true);
      await downloadExport('assessments', format);
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
      const data = await fetchAssessmentsDashboard();
      setAssessments(data || []);
    } catch (err) {
      console.error('Failed to load assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAssessments = () => {
    return assessments.filter(a => {
      const appStatus = a.applications?.current_status || '';
      const isCompleted = Boolean(a.completed_at);
      const isStarted = Boolean(a.started_at);
      const result = a.result || '';

      if (activeTab === 'Invited') {
        return (appStatus === 'assessment_invited' || appStatus === 'shortlisted') && !isStarted && !isCompleted;
      }
      if (activeTab === 'In Progress') {
        return isStarted && !isCompleted;
      }
      if (activeTab === 'Passed') {
        return result === 'pass' || appStatus === 'assessment_passed';
      }
      if (activeTab === 'Failed') {
        return result === 'fail' || appStatus === 'assessment_failed';
      }
      return false;
    });
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  const filtered = filterAssessments();

  return (
    <div className="animate-fade-in space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Technical Assessments
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Track MCQ assessment invitations, candidate real-time progress, and scores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {exporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
          <button 
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => {
            const count = assessments.filter(a => {
              const appStatus = a.applications?.current_status || '';
              const isCompleted = Boolean(a.completed_at);
              const isStarted = Boolean(a.started_at);
              const result = a.result || '';
              if (tab === 'Invited') return (appStatus === 'assessment_invited' || appStatus === 'shortlisted') && !isStarted && !isCompleted;
              if (tab === 'In Progress') return isStarted && !isCompleted;
              if (tab === 'Passed') return result === 'pass' || appStatus === 'assessment_passed';
              if (tab === 'Failed') return result === 'fail' || appStatus === 'assessment_failed';
              return false;
            }).length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  whitespace-nowrap py-3.5 px-1 border-b-2 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer
                  ${activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span>{tab}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-xs font-medium space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
            <p>Loading assessment records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Questions</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Threshold</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Result</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-xs">
                {filtered.map((ass) => {
                  const candName = ass.applications?.candidate_name || 'Candidate';
                  const candEmail = ass.applications?.email || '';
                  const posTitle = ass.applications?.position || ass.job_requirements?.title || 'Position';
                  const qCount = Array.isArray(ass.questions_json) ? ass.questions_json.length : 20;
                  const threshold = Number(ass.pass_threshold || 60);
                  const isPass = ass.result === 'pass' || ass.applications?.current_status === 'assessment_passed';
                  const isFail = ass.result === 'fail' || ass.applications?.current_status === 'assessment_failed';

                  return (
                    <tr key={ass.assessment_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{candName}</div>
                        {candEmail && <div className="text-[11px] text-gray-400">{candEmail}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">
                        {posTitle}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-semibold">
                        {qCount} MCQs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {formatTimestamp(ass.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {formatTimestamp(ass.completed_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold">
                        {(ass.adjusted_score !== null && ass.adjusted_score !== undefined) || (ass.score !== null && ass.score !== undefined) ? (
                          <span className={isPass ? 'text-emerald-700 font-extrabold' : isFail ? 'text-rose-700 font-extrabold' : 'text-gray-800'}>
                            {Number(ass.adjusted_score ?? ass.score).toFixed(1)}%
                            {ass.integrity_penalty > 0 && (
                              <span className="text-[10px] text-amber-600 ml-1 font-bold">(-{ass.integrity_penalty}%)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {threshold.toFixed(0)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-[11px] font-bold rounded-full uppercase tracking-wider ${
                          isPass
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isFail
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : ass.started_at
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {isPass ? 'Passed' : isFail ? 'Failed' : ass.started_at ? 'In Progress' : 'Invited'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                        <button 
                          type="button"
                          onClick={() => setSelectedAssessment(ass.assessment_id)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors shadow-xs cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-gray-400 text-xs italic">
                      No assessment records found in the "{activeTab}" tab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assessment Detail Modal */}
      {selectedAssessment && (
        <AssessmentDetailModal 
          assessmentId={selectedAssessment} 
          onClose={() => setSelectedAssessment(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
