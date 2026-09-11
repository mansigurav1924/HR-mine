import React, { useState, useEffect } from 'react';
import { getAuditLogs, downloadExport } from '../services/analyticsApi';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [action, setAction] = useState('all');
  const [role, setRole] = useState('all');
  const [applicationId, setApplicationId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [availableActions, setAvailableActions] = useState([]);
  const [availableRoles, setAvailableRoles] = useState(['hr_admin', 'interviewer', 'system']);

  const [exporting, setExporting] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page, page_size: pageSize };
      if (action && action !== 'all') params.action = action;
      if (role && role !== 'all') params.role = role;
      if (applicationId.trim()) params.application_id = applicationId.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await getAuditLogs(params);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
      if (res.available_actions) setAvailableActions(res.available_actions);
      if (res.available_roles) setAvailableRoles(res.available_roles);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, action, role, dateFrom, dateTo]);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setAction('all');
    setRole('all');
    setApplicationId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const filters = {};
      if (action && action !== 'all') filters.action = action;
      if (role && role !== 'all') filters.role = role;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      await downloadExport('audit-logs', format, filters);
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const getActionBadgeColor = (actionName) => {
    if (!actionName) return 'bg-gray-100 text-gray-800';
    if (actionName.includes('CREATE') || actionName.includes('PASSED') || actionName.includes('ACCEPTED') || actionName.includes('SELECTED')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (actionName.includes('REJECTED') || actionName.includes('FAILED') || actionName.includes('CANCEL')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (actionName.includes('OFFER') || actionName.includes('SEND')) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>🛡️</span> System Audit Logs
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Immutable record of all recruitment workflow and access activities</p>
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
      <form onSubmit={handleApplyFilter} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Action Type</label>
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Actions</option>
            {availableActions.map((act) => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Application ID</label>
          <input
            type="text"
            placeholder="UUID / ID"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            title="Reset Filters"
          >
            ↺
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User / Actor</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Candidate / App</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status Transition</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => {
                const userEmail = log.users?.email || log.hr_user || 'System';
                const candidateName = log.applications?.candidate_name;

                return (
                  <tr key={log.log_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {userEmail}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="capitalize">{log.role || 'hr_admin'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {candidateName ? (
                        <span className="font-semibold text-gray-900">{candidateName}</span>
                      ) : log.application_id ? (
                        <span className="font-mono text-xs text-gray-500">{log.application_id.substring(0, 8)}...</span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {log.previous_status || log.new_status ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-500">{log.previous_status || 'initial'}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-bold text-gray-800">{log.new_status || 'current'}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                    No audit records matching the specified criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold">{logs.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="font-semibold">{total}</span> audit records
          </div>

          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
