import api from './api';

export const getDepartments = async () => {
  const response = await api.get('/api/departments');
  return response.data;
};

export const getDepartmentById = async (id) => {
  const response = await api.get(`/api/departments/${id}`);
  return response.data;
};

export const createDepartment = async (data) => {
  const response = await api.post('/api/departments', data);
  return response.data;
};

export const updateDepartment = async (id, data) => {
  const response = await api.patch(`/api/departments/${id}`, data);
  return response.data;
};

export const disableDepartment = async (id) => {
  const response = await api.post(`/api/departments/${id}/disable`);
  return response.data;
};

export const enableDepartment = async (id) => {
  const response = await api.post(`/api/departments/${id}/enable`);
  return response.data;
};
