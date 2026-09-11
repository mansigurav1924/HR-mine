import api from './api';

export const getReadyForHandoff = async () => {
  const response = await api.get('/api/onboarding/ready');
  return response.data;
};

export const getOnboardingList = async (status = '', page = 1) => {
  const params = { page, page_size: 20 };
  if (status) params.status = status;
  const response = await api.get('/api/onboarding', { params });
  return response.data;
};

export const createHandoff = async (applicationId, data) => {
  const response = await api.post(`/api/onboarding/${applicationId}`, data);
  return response.data;
};

export const getHandoffDetail = async (handoffId) => {
  const response = await api.get(`/api/onboarding/${handoffId}`);
  return response.data;
};

export const updateChecklist = async (handoffId, key, status) => {
  const response = await api.patch(`/api/onboarding/${handoffId}/checklist`, { key, status });
  return response.data;
};

export const updateITProvisioning = async (handoffId, requested) => {
  const response = await api.patch(`/api/onboarding/${handoffId}/it-provisioning`, { requested });
  return response.data;
};

export const updateHRISStatus = async (handoffId, status) => {
  const response = await api.patch(`/api/onboarding/${handoffId}/hris-status`, { status });
  return response.data;
};

export const completeHandoff = async (handoffId) => {
  const response = await api.post(`/api/onboarding/${handoffId}/complete`);
  return response.data;
};
