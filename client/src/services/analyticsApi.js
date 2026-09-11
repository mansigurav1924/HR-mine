import api from './api';

export const getDashboardMetrics = async (params = {}) => {
  const response = await api.get('/api/dashboard', { params });
  return response.data;
};

export const getDepartmentDashboard = async (department) => {
  const response = await api.get(`/api/dashboard/department/${encodeURIComponent(department)}`);
  return response.data;
};

export const getFunnelReport = async (params = {}) => {
  const response = await api.get('/api/reports/funnel', { params });
  return response.data;
};

export const getDepartmentsReport = async (params = {}) => {
  const response = await api.get('/api/reports/departments', { params });
  return response.data;
};

export const getPositionsReport = async (params = {}) => {
  const response = await api.get('/api/reports/positions', { params });
  return response.data;
};

export const getApplicationSourcesReport = async (params = {}) => {
  const response = await api.get('/api/reports/application-sources', { params });
  return response.data;
};

export const getAssessmentsReport = async (params = {}) => {
  const response = await api.get('/api/reports/assessments', { params });
  return response.data;
};

export const getInterviewsReport = async (params = {}) => {
  const response = await api.get('/api/reports/interviews', { params });
  return response.data;
};

export const getOffersReport = async (params = {}) => {
  const response = await api.get('/api/reports/offers', { params });
  return response.data;
};

export const getOnboardingReport = async (params = {}) => {
  const response = await api.get('/api/reports/onboarding', { params });
  return response.data;
};

export const globalSearch = async (q) => {
  if (!q || q.trim().length < 2) {
    return { applications: [], interviews: [], offers: [] };
  }
  const response = await api.get('/api/search', { params: { q: q.trim() } });
  return response.data;
};

export const getAuditLogs = async (params = {}) => {
  const response = await api.get('/api/audit-logs', { params });
  return response.data;
};

export const downloadExport = async (resource, format = 'csv', filters = {}) => {
  const cleanFilters = { ...filters, format };
  // Remove null/undefined/empty
  Object.keys(cleanFilters).forEach((k) => {
    if (cleanFilters[k] === null || cleanFilters[k] === undefined || cleanFilters[k] === '' || cleanFilters[k] === 'all') {
      delete cleanFilters[k];
    }
  });

  const response = await api.get(`/api/export/${resource}`, {
    params: cleanFilters,
    responseType: 'blob'
  });

  // Extract filename from header if available
  let filename = `${resource}_${new Date().toISOString().split('T')[0]}.${format}`;
  const disposition = response.headers['content-disposition'];
  if (disposition && disposition.includes('filename=')) {
    const matches = disposition.match(/filename="?([^"]+)"?/);
    if (matches && matches[1]) {
      filename = matches[1];
    }
  }

  // Trigger download in browser
  const blob = new Blob([response.data], {
    type: format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv;charset=utf-8;'
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};
