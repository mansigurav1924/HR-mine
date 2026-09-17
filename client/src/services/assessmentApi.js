import api from './api';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// HR Endpoints (Authenticated)
export const generateAssessment = async (applicationId, config = { question_count: 20, pass_threshold: 60.0 }) => {
  const response = await api.post(`/api/assessments/${applicationId}/generate`, config);
  return response.data;
};

export const generateAssessmentToken = async (assessmentId) => {
  const response = await api.post(`/api/assessments/${assessmentId}/token`);
  return response.data;
};

export const fetchAssessmentsDashboard = async () => {
  const response = await api.get('/api/assessments/');
  return response.data;
};

export const fetchAssessmentDetail = async (assessmentId) => {
  const response = await api.get(`/api/assessments/${assessmentId}/detail`);
  return response.data;
};

export const overrideAssessmentResult = async (assessmentId, payload) => {
  const response = await api.post(`/api/assessments/${assessmentId}/override`, payload);
  return response.data;
};

export const sendInterviewInvitation = async (applicationId) => {
  const response = await api.post(`/api/assessments/${applicationId}/invite-interview`);
  return response.data;
};

export const retryResultEmail = async (assessmentId) => {
  const response = await api.post(`/api/assessments/${assessmentId}/retry-result-email`);
  return response.data;
};

// Candidate Endpoints (Token-based, No HR auth)
export const getCandidateState = async (token) => {
  const response = await axios.get(`${BASE_URL}/api/assessments/access/${token}`);
  return response.data;
};

export const startSession = async (token) => {
  const response = await axios.post(`${BASE_URL}/api/assessments/access/${token}/start_session`);
  return response.data;
};

export const sendHeartbeat = async (token) => {
  const response = await axios.post(`${BASE_URL}/api/assessments/access/${token}/heartbeat`);
  return response.data;
};

export const getCurrentQuestion = async (token) => {
  const response = await axios.get(`${BASE_URL}/api/assessments/access/${token}/question`);
  return response.data;
};

export const submitAnswer = async (token, payload) => {
  const response = await axios.post(`${BASE_URL}/api/assessments/access/${token}/answer`, payload);
  return response.data;
};

export const submitAssessment = async (token) => {
  const response = await axios.post(`${BASE_URL}/api/assessments/access/${token}/submit`);
  return response.data;
};

export const reportQuestionTimeout = async (token) => {
  const response = await axios.post(`${BASE_URL}/api/assessments/access/${token}/timeout`);
  return response.data;
};

/**
 * Candidate: log a single browser integrity signal.
 * Returns the server response (may contain { terminated: true } for tab-switch limit).
 * Errors are silently swallowed so the assessment is never interrupted.
 * Clipboard content, screenshots, and browser history are NEVER captured or sent.
 */
export const logIntegrityEvent = async (token, eventType, questionIndex = null, durationSeconds = null) => {
  try {
    const payload = { event_type: eventType, question_index: questionIndex };
    if (durationSeconds !== null) payload.duration_seconds = durationSeconds;
    const response = await axios.post(`${BASE_URL}/api/assessments/access/${token}/integrity-event`, payload);
    return response.data; // { logged, terminated, termination_reason, message }
  } catch {
    // Silent fail — integrity logging must never crash the candidate's assessment
    return { logged: false, terminated: false };
  }
};


/**
 * HR Admin: fetch integrity summary (counts, status, event timeline) for a completed assessment.
 */
export const fetchAssessmentIntegrity = async (assessmentId) => {
  const response = await api.get(`/api/assessments/${assessmentId}/integrity`);
  return response.data;
};
