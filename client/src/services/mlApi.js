import api from './api';

export const mlApi = {
  getModelInfo: async () => {
    const response = await api.get('/api/ml/model-info');
    return response.data;
  },

  evaluateApplication: async (applicationId) => {
    const response = await api.post(`/api/ml/evaluate/${applicationId}`);
    return response.data;
  },

  getEvaluations: async (applicationId) => {
    const response = await api.get(`/api/ml/evaluations/${applicationId}`);
    return response.data;
  },

  getPositionEvaluations: async (positionId) => {
    const response = await api.get(`/api/ml/evaluations/position/${positionId}`);
    return response.data;
  },

  evaluatePosition: async (positionId, rescore = false) => {
    const response = await api.post(`/api/ml/evaluate-position/${positionId}?rescore=${rescore}`);
    return response.data;
  }
};
