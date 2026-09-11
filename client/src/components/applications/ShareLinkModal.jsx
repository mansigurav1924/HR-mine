import React, { useState, useEffect } from 'react';
import { fetchPublicJobs } from '../../services/publicApi';

export default function ShareLinkModal({ isOpen, onClose }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState('');

  const baseUrl = window.location.origin;

  useEffect(() => {
    if (isOpen) {
      loadJobs();
    }
  }, [isOpen]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await fetchPublicJobs();
      setJobs(data);
      if (data.length > 0) {
        setSelectedJobId(data[0].position_id);
      }
    } catch (err) {
      console.error('Failed to load jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (url, type) => {
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setTimeout(() => setCopiedType(''), 3000);
  };

  if (!isOpen) return null;

  const generalUrl = `${baseUrl}/apply`;
  const positionUrl = selectedJobId ? `${baseUrl}/apply/${selectedJobId}` : '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
              🔗
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Candidate Application Links</h2>
              <p className="text-xs text-gray-500">Share public links with candidates or on job boards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-semibold leading-none p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading active positions...</div>
        ) : (
          <div className="space-y-5">
            {/* General Application Link */}
            <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  General Application Portal
                </span>
                <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded-md font-medium">
                  All Positions
                </span>
              </div>
              <p className="text-xs text-gray-500">Allows candidates to select from all available open positions.</p>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generalUrl}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(generalUrl, 'general')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                    copiedType === 'general'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                  }`}
                >
                  {copiedType === 'general' ? '✓ Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Position-Specific Application Link */}
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  Position-Specific Direct Link
                </span>
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-medium">
                  Targeted
                </span>
              </div>
              <p className="text-xs text-indigo-700">Pre-selects the position for candidates applying from job boards.</p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Position:</label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {jobs.map(j => (
                    <option key={j.position_id} value={j.position_id}>
                      {j.position || j.position_title} ({j.department})
                    </option>
                  ))}
                </select>
              </div>

              {positionUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={positionUrl}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 font-mono select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(positionUrl, 'position')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                      copiedType === 'position'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    }`}
                  >
                    {copiedType === 'position' ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
