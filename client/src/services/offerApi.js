import api from './api';

export const previewOffer = async (offerData) => {
  const response = await api.post('/api/offers/preview', offerData, {
    responseType: 'blob'
  });
  return response.data;
};

export const generateOffer = async (offerData) => {
  const response = await api.post('/api/offers/generate', offerData);
  return response.data;
};

export const sendOffer = async (offerId) => {
  const response = await api.post(`/api/offers/${offerId}/send`);
  return response.data;
};

export const getOffers = async () => {
  const response = await api.get('/api/offers/');
  return response.data;
};

export const getOfferTimeline = async (offerId) => {
  const response = await api.get(`/api/offers/${offerId}/timeline`);
  return response.data;
};

export const extendOfferDeadline = async (offerId, newExpiry) => {
  const response = await api.post(`/api/offers/${offerId}/extend`, { new_expiry: newExpiry });
  return response.data;
};

export const sendOfferReminder = async (offerId) => {
  const response = await api.post(`/api/offers/${offerId}/remind`);
  return response.data;
};

export const cancelOffer = async (offerId) => {
  const response = await api.post(`/api/offers/${offerId}/cancel`);
  return response.data;
};

export const pollGmailReplies = async () => {
  const response = await api.post('/api/offers/reply/poll');
  return response.data;
};

// Candidate facing APIs
export const validateOfferToken = async (token) => {
  const response = await api.get(`/api/offers/response/validate/${token}`);
  return response.data;
};

export const submitOfferResponse = async (token, decision, reason = '', discussionMessage = '') => {
  const response = await api.post(`/api/offers/response/submit/${token}`, {
    decision,
    reason,
    discussion_message: discussionMessage
  });
  return response.data;
};

export const downloadOfferPdf = async (token) => {
  const response = await api.get(`/api/offers/response/download/${token}`, {
    responseType: 'blob'
  });
  return response.data;
};
