import React, { useState, useEffect } from 'react';
import { createPosition, updatePosition } from '../../services/positionApi';
import { getDepartments } from '../../services/departmentApi';

const PositionFormModal = ({ position, onClose, onSuccess }) => {
  const [departments, setDepartments] = useState([]);
  
  // Format date for datetime-local input
  const formatDatetimeLocal = (isoStr) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  };

  const [formData, setFormData] = useState({
    position_title: position?.position_title || '',
    department_id: position?.department_id || '',
    job_code: position?.job_code || '',
    description: position?.description || '',
    number_of_openings: position?.number_of_openings || 1,
    employment_type: position?.employment_type || 'Internship',
    work_mode: position?.work_mode || 'Remote',
    location: position?.location || '',
    application_open_at: formatDatetimeLocal(position?.application_open_at),
    application_close_at: formatDatetimeLocal(position?.application_close_at),
    publication_status: position?.publication_status || 'DRAFT',
    required_skills: position?.required_skills?.join(', ') || '',
    preferred_skills: position?.preferred_skills?.join(', ') || ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDepartments().then(data => setDepartments(data.filter(d => d.is_active))).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (formData.application_open_at && formData.application_close_at) {
      if (new Date(formData.application_close_at) <= new Date(formData.application_open_at)) {
        setError("Closing date must be later than opening date.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        required_skills: formData.required_skills.split(',').map(s => s.trim()).filter(Boolean),
        preferred_skills: formData.preferred_skills.split(',').map(s => s.trim()).filter(Boolean),
        application_open_at: formData.application_open_at ? new Date(formData.application_open_at).toISOString() : null,
        application_close_at: formData.application_close_at ? new Date(formData.application_close_at).toISOString() : null,
      };

      if (position) {
        await updatePosition(position.position_id, payload);
      } else {
        await createPosition(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while saving the position.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">
            {position ? 'Edit Position' : 'Create Job Opening'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <form id="position-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Position Name <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.position_title} onChange={(e) => setFormData({ ...formData, position_title: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department <span className="text-red-500">*</span></label>
                <select required value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Code</label>
                <input type="text" value={formData.job_code} onChange={(e) => setFormData({ ...formData, job_code: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
                <select value={formData.employment_type} onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="Internship">Internship</option>
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Work Mode</label>
                <select value={formData.work_mode} onChange={(e) => setFormData({ ...formData, work_mode: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Application Open At</label>
                <input type="datetime-local" value={formData.application_open_at} onChange={(e) => setFormData({ ...formData, application_open_at: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Application Close At</label>
                <input type="datetime-local" value={formData.application_close_at} onChange={(e) => setFormData({ ...formData, application_close_at: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="3" className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Required Skills (Comma separated)</label>
              <input type="text" value={formData.required_skills} onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="e.g. React.js, Python, SQL" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Publication Status</label>
              <select value={formData.publication_status} onChange={(e) => setFormData({ ...formData, publication_status: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="DRAFT">Save as Draft (Not Public)</option>
                <option value="PUBLISHED">Published (Visible & Active)</option>
              </select>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" form="position-form" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PositionFormModal;
