import { supabase } from '../lib/supabase';

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`
  };
};

export const generateInterview = async (applicationId, config) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`https://hr-portal-dqoi.onrender.com/api/ai-interviews/${applicationId}/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(config)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Failed to generate interview');
  }
  return response.json();
};

export const generateInterviewToken = async (interviewId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`https://hr-portal-dqoi.onrender.com/api/ai-interviews/${interviewId}/token`, {
    method: 'POST',
    headers
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Failed to generate token');
  }
  return response.json();
};

export const fetchInterviewsDashboard = async () => {
  const headers = await getAuthHeaders();
  const response = await fetch(`https://hr-portal-dqoi.onrender.com/api/ai-interviews/`, { headers });
  if (!response.ok) throw new Error('Failed to fetch interviews');
  return response.json();
};

export const fetchInterviewDetail = async (interviewId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`https://hr-portal-dqoi.onrender.com/api/ai-interviews/${interviewId}/detail`, { headers });
  if (!response.ok) throw new Error('Failed to fetch interview detail');
  return response.json();
};

export const manualComplete = async (interviewId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`https://hr-portal-dqoi.onrender.com/api/ai-interviews/${interviewId}/manual-complete`, {
    method: 'POST',
    headers
  });
  if (!response.ok) throw new Error('Failed to complete AI interview');
  return response.json();
};

export const proceedToHuman = async (interviewId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`https://hr-portal-dqoi.onrender.com/api/ai-interviews/${interviewId}/proceed-human-interview`, {
    method: 'POST',
    headers
  });
  if (!response.ok) throw new Error('Failed to proceed to human interview');
  return response.json();
};

// Candidate Endpoints
export const getCandidateState = async (token) => {
  const response = await fetch(`https://hr-portal-dqoi.onrender.com/api/ai-interviews/access/${token}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Invalid link');
  }
  return response.json();
};

