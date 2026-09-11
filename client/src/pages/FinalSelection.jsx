import React, { useState, useEffect, useCallback } from 'react';
import {
  getPendingCandidates,
  getFinalSelectedCandidates,
  getRejectedCandidates,
  getHoldCandidates,
} from '../services/finalSelectionApi';
import FinalSelectionReviewModal from '../components/final_selection/FinalSelectionReviewModal';
import OfferLetterFormModal from '../components/offers/OfferLetterFormModal';

const STATUS_BADGE = {
  select:           'bg-green-100 text-green-800',
  selected:         'bg-green-100 text-green-800',
  reject:           'bg-red-100 text-red-700',
  rejected:         'bg-red-100 text-red-700',
  hold:             'bg-yellow-100 text-yellow-800',
  another_round:    'bg-blue-100 text-blue-800',
  'another round':  'bg-blue-100 text-blue-800',
};

const Badge = ({ value }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[value?.toLowerCase()] || 'bg-gray-100 text-gray-700'}`}>
    {value?.replace(/_/g, ' ') || '—'}
  </span>
);

const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TABS = [
  { key: 'pending',  label: 'Pending Review' },
  { key: 'selected', label: 'Final Selected' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'hold',     label: 'On Hold' },
];

export default function FinalSelection() {
  const [activeTab, setActiveTab]         = useState('pending');
  const [candidates, setCandidates]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [selectedOfferCandidate, setSelectedOfferCandidate] = useState(null);
  const [counts, setCounts]               = useState({ pending: 0, selected: 0, rejected: 0, hold: 0 });

  // Filters
  const [search, setSearch]         = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [posFilter, setPosFilter]   = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [pending, selected, rejected, hold] = await Promise.all([
        getPendingCandidates(),
        getFinalSelectedCandidates(),
        getRejectedCandidates(),
        getHoldCandidates(),
      ]);
      setCounts({
        pending:  pending.length,
        selected: selected.length,
        rejected: rejected.length,
        hold:     hold.length,
      });
    } catch (e) {
      // non-critical
    }
  }, []);

  const loadTab = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { search: search || undefined, department: deptFilter || undefined, position: posFilter || undefined };

      let data = [];
      if (activeTab === 'pending')  data = await getPendingCandidates(params);
      if (activeTab === 'selected') data = await getFinalSelectedCandidates(params);
      if (activeTab === 'rejected') data = await getRejectedCandidates(params);
      if (activeTab === 'hold')     data = await getHoldCandidates(params);
      setCandidates(data);
    } catch (e) {
      setError('Failed to load candidates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, deptFilter, posFilter]);

  // Load current tab data whenever the tab changes or filters change
  useEffect(() => { loadTab(); }, [loadTab]);

  // Refresh all counts whenever the tab changes
  useEffect(() => { fetchAll(); }, [activeTab, fetchAll]);


  const handleReviewClose = () => {
    setSelectedAppId(null);
    loadTab();
    fetchAll();
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Final Selection</h1>
        <p className="text-sm text-gray-500 mt-1">
          HR final decisions after Human Interview completion. Interviewer recommendations are advisory only.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'pending',  label: 'Pending Review',  color: 'indigo' },
          { key: 'selected', label: 'Final Selected',  color: 'green' },
          { key: 'rejected', label: 'Rejected',         color: 'red' },
          { key: 'hold',     label: 'On Hold',          color: 'yellow' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              activeTab === s.key
                ? `border-${s.color}-500 bg-${s.color}-50`
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {s.icon && <div className="text-xl mb-1">{s.icon}</div>}
            <div className={`text-2xl font-bold ${activeTab === s.key ? `text-${s.color}-700` : 'text-gray-900'}`}>
              {counts[s.key]}
            </div>
            <div className="text-xs text-gray-500 font-medium">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap py-3.5 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>} {tab.label}
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
              }`}>{counts[tab.key]}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search candidate..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-56 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Department..."
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-44 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Position..."
          value={posFilter}
          onChange={e => setPosFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-44 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
        {(search || deptFilter || posFilter) && (
          <button onClick={() => { setSearch(''); setDeptFilter(''); setPosFilter(''); }}
            className="text-xs text-gray-500 hover:text-red-600 px-3 py-2 border border-gray-200 rounded-lg">
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="p-10 text-center text-gray-400">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-400 mx-auto mb-3" />
            Loading...
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3 text-gray-300">
              {/* Empty state icon removed */}
            </div>
            <p className="font-medium text-gray-500">No candidates in {TABS.find(t => t.key === activeTab)?.label}</p>
            {activeTab === 'pending' && (
              <p className="text-xs text-gray-400 mt-1">Candidates will appear here after their human interview is completed.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {activeTab === 'pending' && <>
                    <Th>Candidate</Th><Th>Position</Th><Th>Dept</Th>
                    <Th>Interview Date</Th><Th>Interviewer</Th>
                    <Th>Rating</Th><Th>Recommendation</Th><Th>Action</Th>
                  </>}
                  {activeTab === 'selected' && <>
                    <Th>Candidate</Th><Th>Position</Th><Th>Dept</Th>
                    <Th>Selected On</Th><Th>Offer Status</Th><Th>Action</Th>
                  </>}
                  {activeTab === 'rejected' && <>
                    <Th>Candidate</Th><Th>Position</Th><Th>Dept</Th>
                    <Th>Rejected On</Th><Th>Reason</Th><Th>Action</Th>
                  </>}
                  {activeTab === 'hold' && <>
                    <Th>Candidate</Th><Th>Position</Th><Th>Dept</Th>
                    <Th>Hold Date</Th><Th>Hold Reason</Th><Th>Review Date</Th><Th>Action</Th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map(c => (
                  <tr key={c.application_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 text-sm">{c.candidate_name}</div>
                      <div className="text-xs text-gray-400">{c.email}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600">{c.position || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{c.department || '—'}</td>

                    {activeTab === 'pending' && <>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{fmt(c.latest_interview_date)}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{c.interviewer_name || '—'}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-indigo-700">
                        {c.overall_rating != null ? `${Number(c.overall_rating).toFixed(1)} / 5` : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge value={c.interviewer_recommendation} />
                      </td>
                    </>}

                    {activeTab === 'selected' && <>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{fmt(c.final_decision_at)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOfferCandidate(c)}
                            className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded font-medium transition-colors">
                            Generate Offer
                          </button>
                        </div>
                      </td>
                    </>}

                    {activeTab === 'rejected' && <>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{fmt(c.final_decision_at)}</td>
                      <td className="px-5 py-4 max-w-xs">
                        <p className="text-xs text-gray-500 truncate">{c.final_rejection_reason || '—'}</p>
                      </td>
                    </>}

                    {activeTab === 'hold' && <>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{fmt(c.final_decision_at)}</td>
                      <td className="px-5 py-4 max-w-xs">
                        <p className="text-xs text-gray-500 truncate">{c.hold_reason || c.final_decision_notes || '—'}</p>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{c.hold_review_date ? fmt(c.hold_review_date) : '—'}</td>
                    </>}

                    <td className="px-5 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedAppId(c.application_id)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        {activeTab === 'pending' ? 'Review' : 'View / Change'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedAppId && (
        <FinalSelectionReviewModal
          isOpen={!!selectedAppId}
          onClose={handleReviewClose}
          applicationId={selectedAppId}
          onUpdate={handleReviewClose}
        />
      )}

      {/* Offer Letter Form Modal */}
      <OfferLetterFormModal
        isOpen={!!selectedOfferCandidate}
        onClose={() => setSelectedOfferCandidate(null)}
        application={selectedOfferCandidate}
      />
    </div>
  );
}

const Th = ({ children }) => (
  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{children}</th>
);
