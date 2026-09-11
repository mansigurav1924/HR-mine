import React, { useState, useEffect } from 'react';
import { getReadyCandidates } from '../../services/groupInterviewApi';
import CreateBatchModal from './CreateBatchModal';
import ScheduleInterviewModal from './ScheduleInterviewModal';

export default function ReadyCandidatesList({ onBatchCreated }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [scheduleModalAppId, setScheduleModalAppId] = useState(null);

  useEffect(() => {
    loadCandidates();
  }, [departmentFilter, positionFilter]);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const data = await getReadyCandidates(departmentFilter, positionFilter);
      setCandidates(data || []);
      // clear selection when filters change to avoid accidental cross-filter batches
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === candidates.length && candidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.application_id)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
          <input 
            type="text" 
            placeholder="e.g. Full Stack"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
          <input 
            type="text" 
            placeholder="e.g. Intern"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Selected: <span className="font-bold">{selectedIds.size}</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleSelectAll}
            className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
          >
            {selectedIds.size === candidates.length && candidates.length > 0 ? 'Clear Selection' : 'Select All Visible'}
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            disabled={selectedIds.size === 0}
            className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            Create Group Interview
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading candidates...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={selectedIds.size === candidates.length && candidates.length > 0} onChange={handleSelectAll} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {candidates.map(c => {
                const name = c.candidate_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate';
                return (
                  <tr key={c.application_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(c.application_id)}
                        onChange={() => toggleSelect(c.application_id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{name}</div>
                      <div className="text-xs text-gray-500">{c.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>{c.position}</div>
                      <div className="text-xs text-gray-400">{c.department}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold uppercase">
                        Ready
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button
                        onClick={() => setScheduleModalAppId(c.application_id)}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-xs font-semibold shadow-sm transition"
                      >
                        Schedule 1:1
                      </button>
                    </td>
                  </tr>
                );
              })}
              {candidates.length === 0 && (
                <tr><td colSpan="4" className="text-center py-8 text-gray-400">No candidates available for group interview matching filters.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateBatchModal 
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          candidateIds={Array.from(selectedIds)}
          departmentHint={departmentFilter || candidates[0]?.department}
          positionHint={positionFilter || candidates[0]?.position}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setSelectedIds(new Set());
            loadCandidates();
            onBatchCreated();
          }}
        />
      )}

      {scheduleModalAppId && (
        <ScheduleInterviewModal 
          isOpen={!!scheduleModalAppId}
          onClose={() => setScheduleModalAppId(null)}
          applicationId={scheduleModalAppId}
          onSuccess={() => {
            setScheduleModalAppId(null);
            loadCandidates();
            onBatchCreated(); // Just to refresh the parent container if needed
          }}
        />
      )}
    </div>
  );
}
