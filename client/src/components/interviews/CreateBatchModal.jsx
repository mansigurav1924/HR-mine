import React, { useState } from 'react';
import { createGroupBatch } from '../../services/groupInterviewApi';

export default function CreateBatchModal({ isOpen, onClose, candidateIds, departmentHint, positionHint, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    department: departmentHint || '',
    position: positionHint || '',
    interviewer_id: '',
    interview_date: '',
    start_time: '11:00',
    duration_minutes: 60,
    round_number: 1,
    mode: 'online',
    calendar_provider: 'google'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await createGroupBatch({
        ...formData,
        candidate_application_ids: candidateIds
      });
      onSuccess();
    } catch (err) {
      alert('Failed to create batch: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-gray-900">Create Group Interview</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-indigo-50 text-indigo-700 text-sm px-3 py-2 rounded-lg font-medium">
            Scheduling for {candidateIds.length} candidate(s).
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-md" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Position</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-md" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
              <input required type="date" className="w-full px-3 py-2 border rounded-md" value={formData.interview_date} onChange={e => setFormData({...formData, interview_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Time</label>
              <input required type="time" className="w-full px-3 py-2 border rounded-md" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Duration (minutes)</label>
            <input required type="number" className="w-full px-3 py-2 border rounded-md" value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: parseInt(e.target.value)})} />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Interviewer ID (Optional)</label>
            <input type="text" placeholder="UUID of interviewer" className="w-full px-3 py-2 border rounded-md" value={formData.interviewer_id} onChange={e => setFormData({...formData, interviewer_id: e.target.value})} />
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
