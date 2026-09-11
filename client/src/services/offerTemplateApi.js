import api from './api';

export const getTemplates = async () => {
  const response = await api.get('/api/offer-templates/');
  return response.data;
};

export const getTemplate = async (id) => {
  const response = await api.get(`/api/offer-templates/${id}`);
  return response.data;
};

export const createTemplate = async (data) => {
  const response = await api.post('/api/offer-templates/', data);
  return response.data;
};

export const createNewVersion = async (id, data) => {
  const response = await api.post(`/api/offer-templates/${id}/new-version`, data);
  return response.data;
};

export const updateTemplateStatus = async (id, is_active) => {
  const response = await api.patch(`/api/offer-templates/${id}/active`, { is_active });
  return response.data;
};
