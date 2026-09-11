import api from './api';

export const getInterviewers = async () => {
  const response = await api.get('/api/interviews/interviewers');
  return response.data;
};

export const scheduleInterview = async (data) => {
  const response = await api.post('/api/interviews/', data);
  return response.data;
};

export const getInterviews = async (status, page = 1) => {
  const response = await api.get('/api/interviews/', { params: { status, page, page_size: 20 } });
  return response.data;
};

export const getInterviewDetail = async (id) => {
  const response = await api.get(`/api/interviews/${id}`);
  return response.data;
};

export const markAttendance = async (id, attendance) => {
  const response = await api.patch(`/api/interviews/${id}/attendance`, { attendance });
  return response.data;
};

export const evaluateInterview = async (id, evaluationData) => {
  const response = await api.post(`/api/interviews/${id}/evaluation`, evaluationData);
  return response.data;
};

export const rescheduleInterview = async (id, data) => {
  const response = await api.post(`/api/interviews/${id}/reschedule`, data);
  return response.data;
};

export const flagReschedule = async (id, reason) => {
  const response = await api.post(`/api/interviews/${id}/flag-reschedule`, { reason });
  return response.data;
};

export const cancelInterview = async (id, reason) => {
  const response = await api.post(`/api/interviews/${id}/cancel`, { reason });
  return response.data;
};

export const retryCalendarSync = async (id) => {
  const response = await api.post(`/api/interviews/${id}/calendar-sync`);
  return response.data;
};
