import React, { useState, useEffect } from 'react';
import {
  getFunnelReport,
  getDepartmentsReport,
  getPositionsReport,
  getApplicationSourcesReport,
  getAssessmentsReport,
  getInterviewsReport,
  getOffersReport,
  getDashboardMetrics,
  downloadExport
} from '../services/analyticsApi';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [department, setDepartment] = useState('all');
  const [positionId, setPositionId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filter options
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [availablePositions, setAvailablePositions] = useState([]);

  // Data per tab
  const [funnelData, setFunnelData] = useState(null);
  const [deptData, setDeptData] = useState([]);
  const [posData, setPosData] = useState([]);
  const [sourceData, setSourceData] = useState([]);
  const [assessmentData, setAssessmentData] = useState(null);
  const [interviewData, setInterviewData] = useState(null);
  const [offerData, setOfferData] = useState(null);

  const [exporting, setExporting] = useState(false);

  const tabs = [
    'Overview',
    'Departments',
    'Positions',
    'Sources',
    'Assessments',
    'Interviews',
    'Offers'
  ];

  // Initial filter options loading
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const res = await getDashboardMetrics();
        if (res?.filters) {
          setAvailableDepartments(res.filters.departments || []);
          setAvailablePositions(res.filters.positions || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadFilterOptions();
  }, []);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (department && department !== 'all') params.department = department;
      if (positionId && positionId !== 'all') params.position_id = positionId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      if (activeTab === 'Overview') {
        const res = await getFunnelReport(params);
        setFunnelData(res);
      } else if (activeTab === 'Departments') {
        const res = await getDepartmentsReport(params);
        setDeptData(res.departments || []);
      } else if (activeTab === 'Positions') {
        const res = await getPositionsReport(params);
        setPosData(res.positions || []);
      } else if (activeTab === 'Sources') {
        const res = await getApplicationSourcesReport(params);
        setSourceData(res.sources || []);
      } else if (activeTab === 'Assessments') {
        const res = await getAssessmentsReport(params);
        setAssessmentData(res);
      } else if (activeTab === 'Interviews') {
        const res = await getInterviewsReport(params);
        setInterviewData(res);
      } else if (activeTab === 'Offers') {
        const res = await getOffersReport(params);
        setOfferData(res);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [activeTab, department, positionId, dateFrom, dateTo]);

  const handleExportResource = async (format) => {
    try {
      setExporting(true);
      let resource = 'applications';
      if (activeTab === 'Assessments') resource = 'assessments';
      else if (activeTab === 'Interviews') resource = 'interviews';
      else if (activeTab === 'Offers') resource = 'offers';

      const filters = {};
      if (department && department !== 'all') filters.department = department;
      if (positionId && positionId !== 'all') filters.position_id = positionId;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      await downloadExport(resource, format, filters);
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Recruitment Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">Deep-dive pipeline analytics, department conversion, and audit metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportResource('csv')}
            disabled={exporting || loading}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            {exporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
          <button
            onClick={() => handleExportResource('xlsx')}
            disabled={exporting || loading}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Position</label>
          <select
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Positions</option>
            {availablePositions.map((p) => (
              <option key={p.position_id} value={p.position_id}>
                {p.position_title} ({p.department})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadReportData}
            disabled={loading}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Refreshing...' : 'Filter'}
          </button>
          <button
            onClick={() => {
              setDepartment('all');
              setPositionId('all');
              setDateFrom('');
              setDateTo('');
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            title="Reset Filters"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 1. OVERVIEW / FUNNEL */}
        {activeTab === 'Overview' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Pipeline Conversion Overview</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Candidates</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Overall Conversion</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Step Conversion</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dropoff Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {funnelData?.funnel?.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.stage}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-bold">{row.count}</td>
                      <td className="px-6 py-4 text-sm text-indigo-600 font-semibold">{row.overall_conversion_rate}%</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-medium">{row.step_conversion_rate}%</td>
                      <td className="px-6 py-4 text-sm text-rose-500 font-medium">{row.dropoff_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. DEPARTMENTS */}
        {activeTab === 'Departments' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Department-wise Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Applications</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shortlisted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shortlist %</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Interviews Selected</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Offers Sent</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Offers Accepted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hire %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deptData.map((d, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{d.department}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-bold">{d.applications}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{d.shortlisted}</td>
                      <td className="px-6 py-4 text-sm text-indigo-600 font-medium">{d.shortlist_rate}%</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{d.interview_selected}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{d.offers_sent}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{d.offers_accepted}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-semibold">{d.hire_rate}%</td>
                    </tr>
                  ))}
                  {deptData.length === 0 && !loading && (
                    <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-400">No departmental data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. POSITIONS */}
        {activeTab === 'Positions' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Position-level Performance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Position Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Applications</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shortlisted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shortlist %</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Assessment Passed</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hired</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hire %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {posData.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{p.position_title}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.department}</td>
                      <td className="px-6 py-4 text-sm text-gray-800 font-bold">{p.applications}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.shortlisted}</td>
                      <td className="px-6 py-4 text-sm text-indigo-600 font-medium">{p.shortlist_rate}%</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.assessment_passed}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{p.offers_accepted}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-semibold">{p.hire_rate}%</td>
                    </tr>
                  ))}
                  {posData.length === 0 && !loading && (
                    <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-400">No position data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. APPLICATION SOURCES */}
        {activeTab === 'Sources' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Application Source Performance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Applications</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Share of Total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shortlisted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Offers Accepted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Conversion / Hire %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sourceData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{s.source}</td>
                      <td className="px-6 py-4 text-sm text-gray-800 font-bold">{s.applications}</td>
                      <td className="px-6 py-4 text-sm text-indigo-600 font-medium">{s.share_percentage}%</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{s.shortlisted}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{s.offers_accepted}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-semibold">{s.hire_rate}%</td>
                    </tr>
                  ))}
                  {sourceData.length === 0 && !loading && (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400">No source data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. ASSESSMENTS */}
        {activeTab === 'Assessments' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">MCQ Assessment Analytics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Total Invited</span>
                <span className="text-2xl font-bold text-gray-900">{assessmentData?.invited ?? 0}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Completed</span>
                <span className="text-2xl font-bold text-indigo-600">{assessmentData?.completed ?? 0}</span>
                <span className="text-xs text-gray-500 block mt-1">({assessmentData?.completion_rate ?? 0}% completed)</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Passed</span>
                <span className="text-2xl font-bold text-emerald-600">{assessmentData?.passed ?? 0}</span>
                <span className="text-xs text-gray-500 block mt-1">({assessmentData?.pass_rate ?? 0}% pass rate)</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Average Score</span>
                <span className="text-2xl font-bold text-purple-600">{assessmentData?.average_score ?? 0}</span>
                <span className="text-xs text-gray-500 block mt-1">out of total</span>
              </div>
            </div>
          </div>
        )}

        {/* 6. INTERVIEWS */}
        {activeTab === 'Interviews' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Human Interview Analytics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Total Scheduled</span>
                <span className="text-2xl font-bold text-gray-900">{interviewData?.total_interviews ?? 0}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Completed</span>
                <span className="text-2xl font-bold text-indigo-600">{interviewData?.completed ?? 0}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Selected</span>
                <span className="text-2xl font-bold text-emerald-600">{interviewData?.selected ?? 0}</span>
                <span className="text-xs text-gray-500 block mt-1">({interviewData?.selection_rate ?? 0}% selection)</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Avg Overall Score</span>
                <span className="text-2xl font-bold text-purple-600">{interviewData?.average_overall_score ?? 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* 7. OFFERS */}
        {activeTab === 'Offers' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Offer Letter & Response Analytics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Offers Generated</span>
                <span className="text-2xl font-bold text-gray-900">{offerData?.total_offers ?? 0}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Offers Sent</span>
                <span className="text-2xl font-bold text-indigo-600">{offerData?.sent ?? 0}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Offers Accepted</span>
                <span className="text-2xl font-bold text-emerald-600">{offerData?.accepted ?? 0}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-medium text-gray-500 block">Acceptance Rate</span>
                <span className="text-2xl font-bold text-emerald-600">{offerData?.acceptance_rate ?? 0}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
