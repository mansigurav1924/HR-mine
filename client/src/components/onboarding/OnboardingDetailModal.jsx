import React, { useState } from 'react';
import { updateChecklist, updateITProvisioning, updateHRISStatus, completeHandoff } from '../../services/onboardingApi';
import Swal from 'sweetalert2';

export default function OnboardingDetailModal({ isOpen, onClose, data, onUpdate }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !data) return null;

  const handleChecklistUpdate = async (key, status) => {
    try {
      setLoading(true);
      await updateChecklist(data.handoff_id, key, status);
      onUpdate();
    } catch (err) {
      Swal.fire({ title: 'Update Failed', text: err.response?.data?.detail || err.message, icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setLoading(false);
    }
  };

  const handleITUpdate = async (requested) => {
    try {
      setLoading(true);
      await updateITProvisioning(data.handoff_id, requested);
      onUpdate();
    } catch (err) {
      Swal.fire({ title: 'Update Failed', text: err.message, icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setLoading(false);
    }
  };

  const handleHRISUpdate = async (status) => {
    try {
      setLoading(true);
      await updateHRISStatus(data.handoff_id, status);
      onUpdate();
    } catch (err) {
      Swal.fire({ title: 'Update Failed', text: err.message, icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    const result = await Swal.fire({
      title: 'Complete Onboarding Handoff?',
      text: 'This will finalize the onboarding handoff process.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Complete',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    try {
      setLoading(true);
      await completeHandoff(data.handoff_id);
      onUpdate();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.detail || err.message, icon: 'error', confirmButtonColor: '#4F46E5' });
    } finally {
      setLoading(false);
    }
  };

  const offer = data.offers;
  const app = offer?.applications;
  const checklist = data.document_checklist || [];
  
  const requiredItems = checklist.filter(i => i.required);
  const completedItems = requiredItems.filter(i => i.status === 'verified' || i.status === 'not_required');
  const canComplete = completedItems.length === requiredItems.length && !data.completed_at;

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    received: 'bg-blue-100 text-blue-800',
    verified: 'bg-green-100 text-green-800',
    not_required: 'bg-gray-200 text-gray-500'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-2xl font-bold">Onboarding Handoff</h2>
          <button onClick={onClose} className="text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-4 grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-bold text-lg mb-2">Candidate Profile</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Name:</strong> {app?.candidate_name}</p>
                <p><strong>Email:</strong> {app?.candidate_email}</p>
                <p><strong>Position:</strong> {offer?.designation}</p>
                <p><strong>Department:</strong> {offer?.department}</p>
                <p><strong>Joining Date:</strong> {offer?.joining_date}</p>
                <p><strong>Duration:</strong> {offer?.duration}</p>
                <p><strong>Manager:</strong> {offer?.reporting_manager}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-bold text-lg mb-2">IT Provisioning</h3>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 text-sm font-bold rounded-full ${data.it_provisioning_requested ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                  {data.it_provisioning_requested ? 'Requested' : 'Not Requested'}
                </span>
                {!data.completed_at && (
                  <button onClick={() => handleITUpdate(!data.it_provisioning_requested)} disabled={loading} className="text-sm text-indigo-600 hover:underline">
                    Toggle
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-bold text-lg mb-2">HRIS / Manual Handoff</h3>
              <select 
                value={data.hris_handoff_status}
                onChange={e => handleHRISUpdate(e.target.value)}
                disabled={loading || data.completed_at}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="ready">Ready</option>
                <option value="submitted">Submitted</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            {data.handoff_notes && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h3 className="font-bold text-sm text-yellow-900 mb-1">Notes</h3>
                <p className="text-sm text-yellow-800 whitespace-pre-wrap">{data.handoff_notes}</p>
              </div>
            )}
          </div>

          {/* Right Column: Checklist */}
          <div className="bg-white p-4 rounded-lg border flex flex-col">
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-bold text-lg">Document Checklist</h3>
              <div className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                Progress: {completedItems.length} / {requiredItems.length} Complete
              </div>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto">
              {checklist.map(item => (
                <div key={item.key} className="border p-3 rounded flex justify-between items-center bg-gray-50">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {item.label}
                      {item.required && <span className="text-red-500 text-xs">*</span>}
                    </div>
                    {item.completed_at && <div className="text-xs text-gray-500 mt-1">Updated: {new Date(item.completed_at).toLocaleString()}</div>}
                  </div>
                  <div>
                    <select
                      value={item.status}
                      onChange={(e) => handleChecklistUpdate(item.key, e.target.value)}
                      disabled={loading || data.completed_at}
                      className={`text-xs font-bold px-2 py-1 border rounded ${statusColors[item.status]}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="received">Received</option>
                      <option value="verified">Verified</option>
                      <option value="not_required">Not Required</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t shrink-0">
          <div>
            {data.completed_at ? (
              <span className="text-green-600 font-bold bg-green-50 px-3 py-1 rounded border border-green-200">
                ✓ Completed at {new Date(data.completed_at).toLocaleString()}
              </span>
            ) : (
              <span className="text-gray-500 text-sm">Ensure all required documents are verified to complete.</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">Close</button>
            {!data.completed_at && (
              <button 
                onClick={handleComplete} 
                disabled={loading || !canComplete} 
                className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Complete Handoff'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
