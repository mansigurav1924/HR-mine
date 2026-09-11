import React, { useState, useEffect } from 'react';
import { getGroupBatches } from '../../services/groupInterviewApi';
import BatchDetailModal from './BatchDetailModal';

export default function GroupBatchesList() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const data = await getGroupBatches();
      setBatches(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading batches...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role / Dept</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {batches.map(b => (
                <tr key={b.batch_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-gray-500">{b.batch_id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{b.position}</div>
                    <div className="text-xs text-gray-500">{b.department}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>{new Date(b.scheduled_start).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-400">{new Date(b.scheduled_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="font-semibold text-indigo-600">{b.candidate_count}</span> Candidates
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="capitalize px-2 py-0.5 bg-gray-100 border rounded-full text-xs font-semibold">{b.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedBatchId(b.batch_id)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold"
                    >
                      View Batch
                    </button>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">No group interview batches found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedBatchId && (
        <BatchDetailModal 
          isOpen={!!selectedBatchId}
          onClose={() => setSelectedBatchId(null)}
          batchId={selectedBatchId}
          onUpdate={loadBatches}
        />
      )}
    </div>
  );
}
