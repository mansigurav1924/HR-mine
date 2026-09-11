import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
});

export const fetchPublicJobs = async () => {
  const response = await api.get('/api/public/jobs');
  return response.data;
};

export const fetchPublicJob = async (positionId) => {
  const response = await api.get(`/api/public/jobs/${positionId}`);
  return response.data;
};

export const parsePublicResume = async (file) => {
  const formData = new FormData();
  formData.append('resume', file);
  const response = await api.post('/api/public/resume/parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const submitPublicApplication = async (formData) => {
  const response = await api.post('/api/public/applications', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
