import React, { useState, useEffect } from 'react';
import { getReadyForHandoff, createHandoff } from '../../services/onboardingApi';

export default function ReadyForHandoffTab() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  const [itProvisioning, setItProvisioning] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getReadyForHandoff();
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (c) => {
    setSelectedCandidate(c);
    setItProvisioning(false);
    setNotes('');
    setShowModal(true);
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      await createHandoff(selectedCandidate.application_id, {
        it_provisioning_requested: itProvisioning,
        notes: notes
      });
      setShowModal(false);
      loadData();
    } catch (err) {
      alert("Failed to create handoff. " + (err.response?.data?.detail || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joining Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {candidates.map(c => (
            <tr key={c.application_id}>
              <td className="px-6 py-4 font-medium">{c.candidate_name}</td>
              <td className="px-6 py-4">
                <div className="text-sm">{c.offers?.[0]?.designation || c.position}</div>
              </td>
              <td className="px-6 py-4 text-sm">{c.offers?.[0]?.joining_date || 'N/A'}</td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">
                  OFFER ACCEPTED
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <button onClick={() => handleOpen(c)} className="px-3 py-1 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700">
                  Start Handoff
                </button>
              </td>
            </tr>
          ))}
          {candidates.length === 0 && !loading && (
            <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No candidates ready for handoff.</td></tr>
          )}
        </tbody>
      </table>

      {showModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">Start Onboarding Handoff</h2>
            
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="bg-gray-50 p-3 border rounded text-sm space-y-1">
                <p><strong>Candidate:</strong> {selectedCandidate.candidate_name}</p>
                <p><strong>Position:</strong> {selectedCandidate.offers?.[0]?.designation}</p>
                <p><strong>Joining Date:</strong> {selectedCandidate.offers?.[0]?.joining_date}</p>
              </div>

              <div>
                <h3 className="font-bold text-sm mb-2">Default Document Checklist</h3>
                <div className="bg-gray-50 p-3 border rounded text-sm space-y-2">
                  <p className="flex items-center gap-2"><span className="text-gray-400">☐</span> Government ID</p>
                  <p className="flex items-center gap-2"><span className="text-gray-400">☐</span> Educational Documents</p>
                  <p className="flex items-center gap-2"><span className="text-gray-400">☐</span> Bank Details</p>
                  <p className="flex items-center gap-2"><span className="text-gray-400">☐</span> Signed Offer Letter</p>
                  <p className="flex items-center gap-2"><span className="text-gray-400">☐</span> Passport Photo</p>
                  <p className="flex items-center gap-2"><span className="text-gray-400">☐</span> NDA / Agreement</p>
                  <p className="flex items-center gap-2"><span className="text-gray-400">☐</span> Emergency Contact</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">Checklist progress is tracked after creation.</p>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="it_prov" checked={itProvisioning} onChange={e => setItProvisioning(e.target.checked)} />
                <label htmlFor="it_prov" className="font-bold text-sm">IT Provisioning Required?</label>
              </div>
              
              <div>
                <label className="font-bold text-sm block mb-1">Notes (Optional)</label>
                <textarea className="w-full border rounded p-2 text-sm" rows="3" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setShowModal(false)} disabled={saving} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">
                {saving ? 'Creating...' : 'Create Onboarding Handoff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
