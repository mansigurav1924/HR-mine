import React, { useState, useEffect } from 'react';
import { getOnboardingList } from '../../services/onboardingApi';
import OnboardingDetailModal from './OnboardingDetailModal';

export default function OnboardingListTab({ statusFilter }) {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHandoff, setSelectedHandoff] = useState(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getOnboardingList();
      
      // Filter manually based on completed_at since the API doesn't have a direct status enum filter yet
      let filtered = data;
      if (statusFilter === 'completed') {
        filtered = data.filter(h => h.completed_at !== null);
      } else if (statusFilter === 'pending') {
        filtered = data.filter(h => h.completed_at === null);
      }
      
      setHandoffs(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = (checklist) => {
    if (!checklist) return { completed: 0, required: 0 };
    const requiredItems = checklist.filter(i => i.required);
    const completedItems = requiredItems.filter(i => i.status === 'verified' || i.status === 'not_required');
    return { completed: completedItems.length, required: requiredItems.length };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documents</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IT / HRIS</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {handoffs.map(h => {
            const prog = getProgress(h.document_checklist);
            const app = h.offers?.applications;
            
            return (
              <tr key={h.handoff_id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{app?.candidate_name}</div>
                  <div className="text-sm text-gray-500">{app?.candidate_email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">{h.offers?.designation}</div>
                  <div className="text-xs text-gray-500">{h.offers?.department}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block">
                    {prog.completed} / {prog.required} Verified
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm space-x-2">
                    <span className={`px-2 py-1 text-xs rounded border ${h.it_provisioning_requested ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                      IT: {h.it_provisioning_requested ? 'Yes' : 'No'}
                    </span>
                    <span className="px-2 py-1 text-xs rounded border border-gray-200 bg-gray-50 text-gray-700 uppercase">
                      HRIS: {h.hris_handoff_status}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <button onClick={() => setSelectedHandoff(h)} className="text-indigo-600 font-bold hover:underline">
                    View Details
                  </button>
                </td>
              </tr>
            );
          })}
          {handoffs.length === 0 && !loading && (
            <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No onboarding records found.</td></tr>
          )}
        </tbody>
      </table>

      <OnboardingDetailModal 
        isOpen={!!selectedHandoff}
        data={selectedHandoff}
        onClose={() => setSelectedHandoff(null)}
        onUpdate={() => {
          // Instead of closing, refresh the data to stay in modal
          loadData().then(async () => {
            if (selectedHandoff) {
              const freshData = await getOnboardingList();
              const freshRecord = freshData.find(x => x.handoff_id === selectedHandoff.handoff_id);
              if (freshRecord) setSelectedHandoff(freshRecord);
            }
          });
        }}
      />
    </div>
  );
}
