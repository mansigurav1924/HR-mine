import api from './api';

export const getPendingCandidates = async () => {
  const response = await api.get('/api/shortlisting/pending');
  return response.data;
};

export const getShortlistedCandidates = async () => {
  const response = await api.get('/api/shortlisting/shortlisted');
  return response.data;
};

export const getNonShortlistedCandidates = async () => {
  const response = await api.get('/api/shortlisting/non-shortlisted');
  return response.data;
};

export const submitShortlistDecision = async (applicationId, payload) => {
  const response = await api.post(`/api/applications/${applicationId}/shortlist-decision`, payload);
  return response.data;
};

export const createDecision = async (applicationId, decision, reason, options = {}) => {
  return submitShortlistDecision(applicationId, {
    decision,
    reason,
    send_assessment_email: true,
    ...options
  });
};

export const sendBulkShortlistEmails = async (payload) => {
  const response = await api.post('/api/shortlisting/send-email', payload);
  return response.data;
};

export const getShortlistHistory = async (applicationId) => {
  const response = await api.get(`/api/applications/${applicationId}/shortlist-history`);
  return response.data;
};
