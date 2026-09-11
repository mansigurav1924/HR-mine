import React, { useState, useEffect, useTransition } from 'react';
import StatCard from '../components/common/StatCard';
import { getDashboardMetrics, downloadExport } from '../../src/services/analyticsApi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899', '#14B8A6'];
const OFFER_COLORS = {
  accepted: '#10B981',
  sent: '#6366F1',
  generated: '#8B5CF6',
  negotiating: '#F59E0B',
  declined: '#EF4444',
  expired: '#6B7280'
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  // Filters
  const [department, setDepartment] = useState('all');
  const [positionId, setPositionId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Export loading
  const [exporting, setExporting] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (department && department !== 'all') params.department = department;
      if (positionId && positionId !== 'all') params.position_id = positionId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await getDashboardMetrics(params);
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load recruitment metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [department, positionId, dateFrom, dateTo]);

  const handleResetFilters = () => {
    startTransition(() => {
      setDepartment('all');
      setPositionId('all');
      setDateFrom('');
      setDateTo('');
    });
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const filters = {};
      if (department && department !== 'all') filters.department = department;
      if (positionId && positionId !== 'all') filters.position_id = positionId;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      await downloadExport('applications', format, filters);
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExporting(false);
    }
  };

  const metrics = data?.metrics || {};
  const funnel = data?.funnel || [];
  const departments = data?.departments || [];
  const sources = data?.sources || [];
  const offerOutcomes = data?.offer_outcomes || {};

  // Formatted offer outcome chart data
  const offerChartData = Object.entries(offerOutcomes)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      key: status
    }));

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Recruitment Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">Real-time pipeline performance and recruitment metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            {exporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {data?.filters?.departments?.map((dept) => (
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
            {data?.filters?.positions?.map((p) => (
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
            onClick={fetchMetrics}
            disabled={loading}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Refreshing...' : 'Apply'}
          </button>
          <button
            onClick={handleResetFilters}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            title="Reset Filters"
          >
            ↺
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Primary Funnel Metric Cards (9 Core Stages) */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Pipeline Stages</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          <StatCard title="Total Applications" value={metrics.total_applications} color="slate" />
          <StatCard title="ML Evaluated" value={metrics.ml_evaluated} color="purple" />
          <StatCard title="Shortlisted" value={metrics.shortlisted} color="indigo" />
          <StatCard title="Assessment Passed" value={metrics.assessment_passed} color="blue" />
          <StatCard title="AI Interview Done" value={metrics.ai_interview_completed} color="indigo" />
          <StatCard title="Interview Selected" value={metrics.interview_selected} color="purple" />
          <StatCard title="Final Selected" value={metrics.final_selected} color="amber" />
          <StatCard title="Offers Sent" value={metrics.offers_sent} color="blue" />
          <StatCard title="Offers Accepted" value={metrics.offers_accepted} color="emerald" />
        </div>
      </div>

      {/* Secondary Metric Breakdown */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Status Breakdown & Exceptions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-500 block">Under Review</span>
            <span className="text-lg font-bold text-gray-800">{metrics.under_review || 0}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-500 block">Non-Shortlisted</span>
            <span className="text-lg font-bold text-gray-800">{metrics.non_shortlisted || 0}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-500 block">Assessment Failed</span>
            <span className="text-lg font-bold text-rose-600">{metrics.assessment_failed || 0}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-500 block">Interview Rejected</span>
            <span className="text-lg font-bold text-rose-600">{metrics.interview_rejected || 0}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-500 block">Offers Declined</span>
            <span className="text-lg font-bold text-amber-600">{metrics.offers_declined || 0}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-500 block">Negotiating</span>
            <span className="text-lg font-bold text-blue-600">{metrics.offers_negotiating || 0}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs font-medium text-gray-500 block">Withdrawn</span>
            <span className="text-lg font-bold text-gray-600">{metrics.withdrawn || 0}</span>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recruitment Funnel Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Recruitment Pipeline Funnel</h2>
          <p className="text-xs text-gray-500 mb-4">Total candidate conversion progression through each hiring stage</p>
          <div className="h-80 w-full">
            {funnel.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnel}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${val} candidates (${item.payload.conversion}% of total)`,
                      'Candidates'
                    ]}
                  />
                  <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No funnel data available
              </div>
            )}
          </div>
        </div>

        {/* Applications by Department */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Applications by Department</h2>
          <p className="text-xs text-gray-500 mb-4">Candidate volume distribution across organization departments</p>
          <div className="h-80 w-full">
            {departments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <XAxis dataKey="department" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No department data available
              </div>
            )}
          </div>
        </div>

        {/* Application Sources (Donut/Pie) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Application Sources</h2>
          <p className="text-xs text-gray-500 mb-4">Inflow channel split between website and email</p>
          <div className="h-72 w-full flex items-center justify-center">
            {sources.some(s => s.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="source"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {sources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} applications`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 text-sm">No source data recorded</div>
            )}
          </div>
        </div>

        {/* Offer Outcomes (Pie/Donut) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Offer Outcomes</h2>
          <p className="text-xs text-gray-500 mb-4">Distribution of candidate decisions on generated offers</p>
          <div className="h-72 w-full flex items-center justify-center">
            {offerChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={offerChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {offerChartData.map((entry) => (
                      <Cell key={entry.key} fill={OFFER_COLORS[entry.key] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} offers`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 text-sm">No offers recorded yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
