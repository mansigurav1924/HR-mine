import React, { useState } from 'react';
import { evaluateCandidate } from '../../services/groupInterviewApi';

export default function BatchCandidateEvaluationModal({ isOpen, onClose, batchId, candidate, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    technical_score: 3,
    problem_solving_score: 3,
    communication_score: 3,
    relevant_skills_score: 3,
    overall_rating: 3,
    feedback: '',
    decision: 'select'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await evaluateCandidate(batchId, candidate.application_id, formData);
      onSuccess();
    } catch (err) {
      alert('Evaluation failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const name = `${candidate.applications?.first_name || ''} ${candidate.applications?.last_name || ''}`.trim() || 'Candidate';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="font-bold text-gray-900">Evaluate Candidate</h2>
            <p className="text-xs text-gray-500">{name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'technical_score', label: 'Technical Knowledge' },
              { id: 'problem_solving_score', label: 'Problem Solving' },
              { id: 'communication_score', label: 'Communication' },
              { id: 'relevant_skills_score', label: 'Relevant Skills' },
              { id: 'overall_rating', label: 'Overall Rating' }
            ].map(field => (
              <div key={field.id}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label} (1-5)</label>
                <input 
                  type="number" 
                  min="1" max="5" required
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData[field.id]}
                  onChange={e => setFormData({...formData, [field.id]: parseInt(e.target.value)})}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Feedback Notes</label>
            <textarea 
              required
              rows={4}
              className="w-full px-3 py-2 border rounded-md"
              value={formData.feedback}
              onChange={e => setFormData({...formData, feedback: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Recommendation</label>
            <select 
              className="w-full px-3 py-2 border rounded-md bg-gray-50"
              value={formData.decision}
              onChange={e => setFormData({...formData, decision: e.target.value})}
            >
              <option value="select">Select (Advance to Final Review)</option>
              <option value="another_round">Another Round</option>
              <option value="reject">Reject</option>
            </select>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Submit Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
