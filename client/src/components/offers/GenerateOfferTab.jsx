import React, { useState, useEffect } from 'react';
import { getFinalSelectedCandidates } from '../../services/finalSelectionApi';
import { getTemplates } from '../../services/offerTemplateApi';
import { previewOffer, generateOffer } from '../../services/offerApi';
import Swal from 'sweetalert2';

export default function GenerateOfferTab() {
  const [candidates, setCandidates] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [selectedAppId, setSelectedAppId] = useState('');
  
  const [formData, setFormData] = useState({
    template_id: '',
    designation: '',
    joining_date: '',
    end_date: '',
    duration: '',
    stipend: '',
    reporting_manager: '',
    offer_issue_date: new Date().toISOString().split('T')[0],
    offer_expiry_date: ''
  });

  const [previewHtml, setPreviewHtml] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Auto-calculate end_date based on joining_date and duration
  useEffect(() => {
    if (formData.joining_date && formData.duration) {
      const trimmed = formData.duration.trim();
      let value = null;
      let unit = 'month';
      
      const match = trimmed.match(/^(\d+)\s*(month|week|day|year)s?$/i);
      if (match) {
        value = parseInt(match[1], 10);
        unit = match[2].toLowerCase();
      } else if (/^\d+$/.test(trimmed)) {
        value = parseInt(trimmed, 10);
        unit = 'month';
      }
      
      if (value !== null && !isNaN(value) && value > 0) {
        const [year, month, day] = formData.joining_date.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        
        if (unit === 'month') date.setMonth(date.getMonth() + value);
        else if (unit === 'week') date.setDate(date.getDate() + value * 7);
        else if (unit === 'day') date.setDate(date.getDate() + value);
        else if (unit === 'year') date.setFullYear(date.getFullYear() + value);
        
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const newEndDate = `${yyyy}-${mm}-${dd}`;
        
        if (formData.end_date !== newEndDate) {
          setFormData(prev => ({ ...prev, end_date: newEndDate }));
        }
      }
    }
  }, [formData.joining_date, formData.duration]);

  const loadInitialData = async () => {
    try {
      const cands = await getFinalSelectedCandidates();
      const list = Array.isArray(cands) ? cands : (cands?.data || []);
      const eligible = list.filter(c => c.current_status === 'final_selected');
      setCandidates(eligible);
    } catch (err) {
      console.error('Failed to load final selected candidates:', err);
    }

    try {
      const tpls = await getTemplates();
      const tplList = Array.isArray(tpls) ? tpls : (tpls?.data || []);
      setTemplates(tplList.filter(t => t.is_active));
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const cand = candidates.find(c => c.application_id === selectedAppId);
      const payload = { 
        ...formData, 
        application_id: selectedAppId, 
        stipend: formData.stipend,
        candidate_name: cand?.candidate_name || '',
        candidate_email: cand?.email || ''
      };
      if (!payload.end_date) delete payload.end_date;

      const res = await previewOffer(payload);
      if (res instanceof Blob) {
        const url = window.URL.createObjectURL(res);
        window.open(url, '_blank');
      } else if (res?.html) {
        setPreviewHtml(res.html);
      }
    } catch (err) {
      let errorMsg = err.message;
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errorMsg = json.detail || json.error?.message || errorMsg;
        } catch (e) {}
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }
      setError(errorMsg || "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const result = await Swal.fire({
      title: 'Generate Offer Letter?',
      text: 'Generate official PDF offer? This will be saved permanently.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Generate',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    setError('');
    try {
      const payload = { ...formData, application_id: selectedAppId, stipend: parseFloat(formData.stipend) };
      if (!payload.end_date) delete payload.end_date;

      await generateOffer(payload);
      setSuccess(true);
      setPreviewHtml(null);
      // Remove from list
      setCandidates(candidates.filter(c => c.application_id !== selectedAppId));
      setSelectedAppId('');
    } catch (err) {
      setError(err.response?.data?.detail || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 p-8 rounded-lg border border-green-200 text-center space-y-4">
        <h2 className="text-2xl font-bold text-green-800">Offer Generated Successfully!</h2>
        <p className="text-green-700">The PDF has been generated and securely stored.</p>
        <p className="text-sm font-bold text-gray-700">Email Status: Not Sent</p>
        <p className="text-xs italic text-gray-500">Email sending will be implemented in Step 16.</p>
        <button onClick={() => setSuccess(false)} className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Return to Offers
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex gap-8 h-[80vh]">
      {/* Left side: Form */}
      <div className={`w-1/2 overflow-y-auto pr-4 ${previewHtml ? 'hidden md:block' : 'w-full max-w-2xl mx-auto'}`}>
        <h2 className="text-xl font-bold mb-6">Generate New Offer</h2>
        
        {error && <div className="mb-4 bg-rose-50 text-rose-700 p-3 rounded text-sm">{error}</div>}

        <form onSubmit={handlePreview} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Select Candidate (Final Selected)</label>
            <select required className="w-full border rounded p-2" value={selectedAppId} onChange={e => setSelectedAppId(e.target.value)}>
              <option value="">-- Select Candidate --</option>
              {candidates.map(c => (
                <option key={c.application_id} value={c.application_id}>{c.candidate_name} ({c.position})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Select Active Template</label>
            <select required className="w-full border rounded p-2" value={formData.template_id} onChange={e => setFormData({...formData, template_id: e.target.value})}>
              <option value="">-- Select Template --</option>
              {templates.map(t => (
                <option key={t.template_id} value={t.template_id}>{t.name} (v{t.version}) - {t.department || 'General'}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Designation</label>
              <input type="text" required className="w-full border rounded p-2" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reporting Manager</label>
              <input type="text" className="w-full border rounded p-2" value={formData.reporting_manager} onChange={e => setFormData({...formData, reporting_manager: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Joining Date</label>
              <input type="date" required className="w-full border rounded p-2" value={formData.joining_date} onChange={e => setFormData({...formData, joining_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
              <input type="date" className="w-full border rounded p-2" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Duration (e.g., 6 Months)</label>
              <input type="text" className="w-full border rounded p-2" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stipend (Numeric)</label>
              <input type="number" step="0.01" min="0" required className="w-full border rounded p-2" value={formData.stipend} onChange={e => setFormData({...formData, stipend: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Offer Issue Date</label>
              <input type="date" required className="w-full border rounded p-2" value={formData.offer_issue_date} onChange={e => setFormData({...formData, offer_issue_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Offer Expiry Date</label>
              <input type="date" required className="w-full border rounded p-2" value={formData.offer_expiry_date} onChange={e => setFormData({...formData, offer_expiry_date: e.target.value})} />
            </div>
          </div>

          <button type="submit" disabled={loading || !selectedAppId || !formData.template_id} className="w-full py-3 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 disabled:opacity-50 mt-4">
            {loading ? 'Processing...' : 'Preview Offer'}
          </button>
        </form>
      </div>

      {/* Right side: Preview */}
      {previewHtml && (
        <div className="w-1/2 flex flex-col bg-gray-50 border border-gray-300 rounded-lg overflow-hidden relative">
          <div className="bg-gray-200 p-3 border-b flex justify-between items-center shrink-0">
            <h3 className="font-bold text-gray-700">Preview</h3>
            <button onClick={() => setPreviewHtml(null)} className="text-xs px-2 py-1 bg-white border rounded">Back & Edit</button>
          </div>
          <div className="flex-1 p-8 bg-white overflow-y-auto" dangerouslySetInnerHTML={{ __html: previewHtml }}></div>
          <div className="p-4 bg-gray-100 border-t shrink-0">
            <button onClick={handleGenerate} disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg">
              {loading ? 'Generating...' : 'Confirm & Generate PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
