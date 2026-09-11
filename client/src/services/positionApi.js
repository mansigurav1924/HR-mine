import api from './api';

export const getPositions = async () => {
  const response = await api.get('/api/positions');
  return response.data;
};

export const getPositionById = async (id) => {
  const response = await api.get(`/api/positions/${id}`);
  return response.data;
};

export const createPosition = async (data) => {
  const response = await api.post('/api/positions', data);
  return response.data;
};

export const updatePosition = async (id, data) => {
  const response = await api.patch(`/api/positions/${id}`, data);
  return response.data;
};

export const publishPosition = async (id) => {
  const response = await api.post(`/api/positions/${id}/publish`);
  return response.data;
};

export const pausePosition = async (id) => {
  const response = await api.post(`/api/positions/${id}/pause`);
  return response.data;
};

export const closePosition = async (id) => {
  const response = await api.post(`/api/positions/${id}/close`);
  return response.data;
};

export const reopenPosition = async (id, data = null) => {
  const response = await api.post(`/api/positions/${id}/reopen`, data || {});
  return response.data;
};

export const extendPositionDeadline = async (id, data) => {
  const response = await api.post(`/api/positions/${id}/extend-deadline`, data);
  return response.data;
};

export const archivePosition = async (id) => {
  const response = await api.post(`/api/positions/${id}/archive`);
  return response.data;
};

export const getPositionStats = async (id) => {
  const response = await api.get(`/api/positions/${id}/stats`);
  return response.data;
};
