import api from './api';

export const getIntegrationsStatus = async () => {
  const response = await api.get('/api/integrations/status');
  return response.data;
};

export const getGoogleConnectUrl = async () => {
  const response = await api.get('/api/integrations/google/connect');
  return response.data;
};

export const disconnectGoogle = async () => {
  const response = await api.post('/api/integrations/google/disconnect');
  return response.data;
};

export const getMicrosoftConnectUrl = async () => {
  const response = await api.get('/api/integrations/microsoft/connect');
  return response.data;
};

export const disconnectMicrosoft = async () => {
  const response = await api.post('/api/integrations/microsoft/disconnect');
  return response.data;
};
