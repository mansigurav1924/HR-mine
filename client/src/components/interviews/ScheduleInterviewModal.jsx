import React, { useState, useEffect } from 'react';
import { getInterviewers, scheduleInterview, getInterviews, rescheduleInterview } from '../../services/interviewApi';

export default function ScheduleInterviewModal({ isOpen, onClose, applicationId, onSuccess, isReschedule = false, existingInterview = null }) {
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    type: 'Technical',
    date: '',
    time: '',
    interviewer_id: '',
    mode: 'online',
    calendar_provider: 'google',
    location: '',
    meeting_link: '',
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadInterviewers();
      if (isReschedule && existingInterview) {
        setFormData({
          ...formData,
          date: existingInterview.date,
          time: existingInterview.time ? existingInterview.time.substring(0, 5) : '',
          interviewer_id: existingInterview.interviewer_id,
          mode: existingInterview.mode || 'online',
          calendar_provider: existingInterview.calendar_provider || 'google',
          duration_minutes: existingInterview.duration_minutes || 45,
          location: existingInterview.location || '',
          meeting_link: existingInterview.meeting_link || '',
          reason: existingInterview.reschedule_request_reason || ''
        });
      }
    }
  }, [isOpen, applicationId, isReschedule, existingInterview]);

  const loadInterviewers = async () => {
    try {
      const data = await getInterviewers();
      setInterviewers(data || []);
    } catch (err) {
      console.error(err);
    }
  };



  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isReschedule) {
        await rescheduleInterview(existingInterview.interview_id, {
          date: formData.date,
          time: formData.time + ":00",
          interviewer_id: formData.interviewer_id,
          mode: formData.mode,
          calendar_provider: formData.calendar_provider,
          duration_minutes: parseInt(formData.duration_minutes),
          location: formData.location,
          meeting_link: formData.meeting_link,
          reason: formData.reason
        });
      } else {
        await scheduleInterview({
          application_id: applicationId,
          round_number: parseInt(formData.round_number),
          depends_on_round: formData.depends_on_round || null,
          date: formData.date,
          time: formData.time + ":00",
          interviewer_id: formData.interviewer_id,
          type: formData.type,
          mode: formData.mode,
          calendar_provider: formData.calendar_provider,
          duration_minutes: parseInt(formData.duration_minutes),
          location: formData.location,
          meeting_link: formData.meeting_link || null
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to schedule interview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 relative">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{isReschedule ? 'Reschedule Interview' : 'Schedule Human Interview'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>
        
        {error && <div className="mb-4 bg-rose-50 text-rose-700 p-3 rounded-lg text-sm border border-rose-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1 pr-2">
          
          {!isReschedule && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Interview Type</label>
              <input type="text" required className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} />
            </div>
          )}

          {/* Calendar Provider */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Calendar & Video Provider</label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              value={formData.calendar_provider}
              onChange={e => setFormData({...formData, calendar_provider: e.target.value})}
            >
              <option value="google">Google Calendar (Google Meet)</option>
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
              <input type="date" required className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
              <input type="time" required className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Interviewer</label>
            <select required className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.interviewer_id} onChange={e => setFormData({...formData, interviewer_id: e.target.value})}>
              <option value="">Select Interviewer</option>
              {interviewers.map(i => (
                <option key={i.user_id} value={i.user_id}>{i.first_name} {i.last_name} ({i.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Mode</label>
            <select required className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.mode} onChange={e => setFormData({...formData, mode: e.target.value})}>
              <option value="online">Online (Auto-create Video Conference)</option>
              <option value="offline">Offline (In-Person)</option>
            </select>
          </div>

          {formData.mode === 'online' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">Online Meeting Link</label>
                <span className="text-[11px] text-gray-400">Optional: Leave blank for auto-generate</span>
              </div>
              <input
                type="url"
                placeholder={formData.calendar_provider === 'outlook' ? "Auto-generates Microsoft Teams meeting link" : "Auto-generates Google Meet link"}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={formData.meeting_link}
                onChange={e => setFormData({...formData, meeting_link: e.target.value})}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">In-Person Location</label>
              <input
                type="text"
                required
                placeholder="e.g. Conference Room 4B, HQ Building"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
              />
            </div>
          )}

          {isReschedule && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reschedule Reason</label>
              <textarea required className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500" rows="2" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition">
              {loading ? 'Saving...' : (isReschedule ? 'Reschedule Interview' : 'Schedule Interview')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
