import api from './api';

// ------------------------------------------------------------------ //
// LIST ENDPOINTS
// ------------------------------------------------------------------ //

export const getPendingCandidates = async (params = {}) => {
  const response = await api.get('/api/final-selection/pending', { params });
  return response.data;
};

export const getFinalSelectedCandidates = async (params = {}) => {
  const response = await api.get('/api/final-selection/selected', { params });
  return response.data;
};

export const getRejectedCandidates = async (params = {}) => {
  const response = await api.get('/api/final-selection/rejected', { params });
  return response.data;
};

export const getHoldCandidates = async (params = {}) => {
  const response = await api.get('/api/final-selection/hold', { params });
  return response.data;
};

// Backward compat
export const getEligibleCandidates = getPendingCandidates;

// ------------------------------------------------------------------ //
// RECRUITMENT SUMMARY
// ------------------------------------------------------------------ //

export const getRecruitmentSummary = async (applicationId) => {
  const response = await api.get(`/api/final-selection/${applicationId}/summary`);
  return response.data;
};

// ------------------------------------------------------------------ //
// DECISION ENDPOINTS
// ------------------------------------------------------------------ //

export const selectCandidate = async (applicationId, notes = '') => {
  const response = await api.post(`/api/final-selection/${applicationId}/select`, { notes });
  return response.data;
};

export const rejectCandidate = async (applicationId, reason, sendEmail = false) => {
  const response = await api.post(`/api/final-selection/${applicationId}/reject`, {
    reason,
    send_email: sendEmail,
  });
  return response.data;
};

export const holdCandidate = async (applicationId, reason, reviewDate = null) => {
  const response = await api.post(`/api/final-selection/${applicationId}/hold`, {
    reason,
    review_date: reviewDate,
  });
  return response.data;
};

// Backward compat
export const confirmFinalSelection = async (applicationId, notes) => {
  return selectCandidate(applicationId, notes);
};
