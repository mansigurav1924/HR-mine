import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { previewOffer, generateOffer, sendOffer } from '../../services/offerApi';

export default function OfferLetterFormModal({ isOpen, onClose, application }) {
  const [formData, setFormData] = useState({
    candidate_name: '',
    candidate_email: '',
    designation: '',
    department: '',
    joining_date: '',
    end_date: '',
    duration: '',
    work_mode: 'Remote',
    location: '',
    stipend: '',
    expiry_at: '',
    application_id: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generatedOfferId, setGeneratedOfferId] = useState(null);

  useEffect(() => {
    if (isOpen && application) {
      // Auto-fill from application
      setFormData({
        candidate_name: application.candidate_name || '',
        candidate_email: application.email || '',
        designation: application.position || '',
        department: application.department || '',
        joining_date: '',
        end_date: '',
        duration: '',
        work_mode: 'Remote',
        location: '',
        stipend: '',
        expiry_at: '',
        application_id: application.application_id
      });
      setGeneratedOfferId(null);
    }
  }, [isOpen, application]);

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
        unit = 'month'; // Default to months if only a number is typed
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

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreview = async () => {
    try {
      setIsPreviewing(true);
      const payload = {
        ...formData
      };
      const blob = await previewOffer(payload);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
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
      Swal.fire('Preview Failed', errorMsg, 'error');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    // Basic validation
    if (!formData.joining_date || !formData.end_date || !formData.expiry_at || !formData.stipend) {
      Swal.fire('Missing Fields', 'Please fill all required fields (Dates, Stipend).', 'warning');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // Ensure expiry_at is passed as full datetime string to match python datetime schema if needed
      const payload = {
        ...formData,
        expiry_at: new Date(formData.expiry_at).toISOString(),
        offer_expiry_date: formData.expiry_at
      };
      
      const res = await generateOffer(payload);
      setGeneratedOfferId(res.offer_id);
      Swal.fire('Success', 'Offer Letter Generated and Saved.', 'success');
    } catch (err) {
      let errorMsg = err.message;
      if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      }
      Swal.fire('Generation Failed', errorMsg, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!generatedOfferId) return;
    try {
      setIsSending(true);
      await sendOffer(generatedOfferId);
      Swal.fire('Sent', 'Offer letter sent successfully to the candidate.', 'success');
      onClose(); // Close modal after sending
    } catch (err) {
      Swal.fire('Send Failed', err.response?.data?.detail || err.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-6 flex flex-col" style={{ maxHeight: '90vh' }}>
        
        {/* Header */}
        <div className="flex justify-between items-center border-b px-7 py-5 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Generate Offer Letter</h2>
            <p className="text-xs text-gray-500 mt-0.5">Fill in the details to generate and send an official offer letter.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-2xl leading-none">&times;</button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-7 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Auto-filled Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Candidate Information</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Candidate Name</label>
                <input type="text" name="candidate_name" value={formData.candidate_name} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" readOnly />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" name="candidate_email" value={formData.candidate_email} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" readOnly />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <input type="text" name="department" value={formData.department} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Position / Designation</label>
                <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Offer Details Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Offer Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Joining Date *</label>
                  <input type="date" name="joining_date" value={formData.joining_date} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date *</label>
                  <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Duration (e.g. 6 Months)</label>
                  <input type="text" name="duration" value={formData.duration} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stipend *</label>
                  <input type="text" name="stipend" value={formData.stipend} onChange={handleChange} placeholder="e.g. ₹20,000 / month" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Work Mode</label>
                  <select name="work_mode" value={formData.work_mode} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Offer Expiry Date *</label>
                <input type="date" name="expiry_at" value={formData.expiry_at} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" required />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 rounded-b-2xl px-7 py-4 flex justify-between shrink-0">
          <div>
             {!generatedOfferId && (
               <button 
                type="button" 
                onClick={handlePreview} 
                disabled={isPreviewing}
                className="px-5 py-2.5 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors text-sm disabled:opacity-50">
                 {isPreviewing ? 'Generating Preview...' : 'Preview Offer'}
               </button>
             )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors">
              Cancel
            </button>
            {!generatedOfferId ? (
              <button 
                type="button" 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50">
                {isGenerating ? 'Generating PDF...' : 'Generate PDF'}
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleSend} 
                disabled={isSending}
                className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50">
                {isSending ? 'Sending...' : 'Send Offer Email'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
