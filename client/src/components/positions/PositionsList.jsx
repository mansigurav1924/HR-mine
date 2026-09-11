import React, { useState, useEffect } from 'react';
import { getPositions, closePosition, reopenPosition } from '../../services/positionApi';
import PositionFormModal from './PositionFormModal';

const PositionsList = () => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState(null);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const data = await getPositions();
      setPositions(data);
    } catch (error) {
      console.error('Failed to fetch positions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleCopyLink = (pos) => {
    const url = `${window.location.origin}/apply/${pos.position_id}`;
    navigator.clipboard.writeText(url);
    alert('Public application link copied to clipboard!');
  };

  const handleToggleClose = async (pos) => {
    if (pos.effective_status === 'CLOSED') {
      if (!window.confirm(`Are you sure you want to reopen applications for ${pos.position_title}?`)) return;
      try {
        await reopenPosition(pos.position_id);
        fetchPositions();
      } catch (e) {
        alert('Failed to reopen');
      }
    } else {
      if (!window.confirm(`Are you sure you want to manually close applications for ${pos.position_title}?`)) return;
      try {
        await closePosition(pos.position_id);
        fetchPositions();
      } catch (e) {
        alert('Failed to close');
      }
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      OPEN: 'bg-green-100 text-green-800',
      SCHEDULED: 'bg-blue-100 text-blue-800',
      CLOSED: 'bg-red-100 text-red-800',
      PAUSED: 'bg-orange-100 text-orange-800',
      DRAFT: 'bg-slate-100 text-slate-800',
      ARCHIVED: 'bg-slate-200 text-slate-500'
    };
    return `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-slate-100'}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Job Openings</h2>
        <button
          onClick={() => { setEditingPos(null); setIsModalOpen(true); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm"
        >
          + Create Position
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading positions...</div>
      ) : positions.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
          No positions found. Create one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Position</th>
                <th className="p-4 font-semibold">Department</th>
                <th className="p-4 font-semibold text-center">Apps</th>
                <th className="p-4 font-semibold">Open Date</th>
                <th className="p-4 font-semibold">Close Date</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {positions.map(pos => (
                <tr key={pos.position_id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-900">{pos.position_title}</td>
                  <td className="p-4 text-slate-500">{pos.departments?.name || pos.department || '-'}</td>
                  <td className="p-4 text-center text-indigo-600 font-medium">{pos.application_count || 0}</td>
                  <td className="p-4 text-slate-500">{formatDate(pos.application_open_at)}</td>
                  <td className="p-4 text-slate-500">{formatDate(pos.application_close_at)}</td>
                  <td className="p-4">
                    <span className={getStatusBadge(pos.effective_status)}>
                      {pos.effective_status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-3">
                    {pos.effective_status !== 'DRAFT' && pos.effective_status !== 'ARCHIVED' && (
                      <button onClick={() => handleCopyLink(pos)} className="text-slate-600 hover:text-slate-900 font-medium">Link</button>
                    )}
                    <button onClick={() => { setEditingPos(pos); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                    {(pos.effective_status === 'OPEN' || pos.effective_status === 'CLOSED') && (
                      <button 
                        onClick={() => handleToggleClose(pos)} 
                        className={`${pos.effective_status === 'CLOSED' ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'} font-medium`}
                      >
                        {pos.effective_status === 'CLOSED' ? 'Reopen' : 'Close'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <PositionFormModal
          position={editingPos}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); fetchPositions(); }}
        />
      )}
    </div>
  );
};

export default PositionsList;
