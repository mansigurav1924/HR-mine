import api from './api';

export const getReadyCandidates = async (department = '', position = '') => {
  const params = new URLSearchParams();
  if (department) params.append('department', department);
  if (position) params.append('position', position);
  
  const response = await api.get(`/api/group-interviews/ready-candidates?${params.toString()}`);
  return response.data;
};

export const createGroupBatch = async (batchData) => {
  const response = await api.post('/api/group-interviews/batches', batchData);
  return response.data;
};

export const getGroupBatches = async () => {
  const response = await api.get('/api/group-interviews/batches');
  return response.data;
};

export const getGroupBatch = async (batchId) => {
  const response = await api.get(`/api/group-interviews/batches/${batchId}`);
  return response.data;
};

export const sendBatchInvitations = async (batchId) => {
  const response = await api.post(`/api/group-interviews/batches/${batchId}/send-invites`);
  return response.data;
};

export const updateCandidateAttendance = async (batchId, applicationId, status) => {
  const response = await api.put(`/api/group-interviews/batches/${batchId}/candidates/${applicationId}/attendance`, { status });
  return response.data;
};

export const evaluateCandidate = async (batchId, applicationId, evaluationData) => {
  const response = await api.post(`/api/group-interviews/batches/${batchId}/candidates/${applicationId}/evaluate`, evaluationData);
  return response.data;
};
