import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  getPendingCandidates,
  getShortlistedCandidates,
  getNonShortlistedCandidates
} from '../services/shortlistingApi';
import HRReviewModal from '../components/shortlisting/HRReviewModal';
import BulkEmailModal from '../components/shortlisting/BulkEmailModal';

export default function Shortlisting() {
  const [activeTab, setActiveTab] = useState('ml_recommended'); // 'ml_recommended' | 'needs_review' | 'shortlisted' | 'non_shortlisted'
  
  const [pendingCandidates, setPendingCandidates] = useState([]);
  const [shortlistedCandidates, setShortlistedCandidates] = useState([]);
  const [nonShortlistedCandidates, setNonShortlistedCandidates] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  // Selection state for Shortlisted tab
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modals state
  const [reviewCandidate, setReviewCandidate] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isBulkEmailOpen, setIsBulkEmailOpen] = useState(false);
  const [emailAllShortlisted, setEmailAllShortlisted] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [pending, shortlisted, nonShortlisted] = await Promise.all([
        getPendingCandidates(),
        getShortlistedCandidates(),
        getNonShortlistedCandidates()
      ]);
      setPendingCandidates(pending || []);
      setShortlistedCandidates(shortlisted || []);
      setNonShortlistedCandidates(nonShortlisted || []);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to load shortlisting data', err);
      setError('Failed to load candidate shortlisting data.');
    } finally {
      setLoading(false);
    }
  };

  // Split pending into ML Recommended vs Needs Review
  const mlRecommended = pendingCandidates.filter(c => c.predicted_class === 'good_intern');
  const needsReview = pendingCandidates.filter(c => c.predicted_class !== 'good_intern');

  // Filter candidates based on active tab and search
  const getCurrentCandidates = () => {
    let list = [];
    if (activeTab === 'ml_recommended') list = mlRecommended;
    else if (activeTab === 'needs_review') list = needsReview;
    else if (activeTab === 'shortlisted') list = shortlistedCandidates;
    else if (activeTab === 'non_shortlisted') list = nonShortlistedCandidates;

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      (c.candidate_name && c.candidate_name.toLowerCase().includes(q)) ||
      (c.position && c.position.toLowerCase().includes(q)) ||
      (c.department && c.department.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  };

  const currentList = getCurrentCandidates();

  // Multi-selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(currentList.map(c => c.application_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenReview = (candidate) => {
    setReviewCandidate(candidate);
    setIsReviewOpen(true);
  };

  const handleViewResume = async (appId) => {
    try {
      const res = await api.get(`/api/applications/${appId}/resume-url`);
      if (res.data?.resume_url) {
        window.open(res.data.resume_url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Resume URL could not be generated.');
      }
    } catch (err) {
      console.error('Failed to open resume', err);
      alert('Failed to load resume: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="animate-fade-in font-sans space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">HR Shortlisting & Evaluation</h1>
          <p className="text-xs text-gray-500 mt-1">
            Review algorithmic recommendations, decide applicant shortlisting, and dispatch assessment invitations.
          </p>
        </div>

        {activeTab === 'shortlisted' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedIds.length === 0) {
                  alert('Please select at least one candidate using the checkboxes.');
                  return;
                }
                setEmailAllShortlisted(false);
                setIsBulkEmailOpen(true);
              }}
              disabled={selectedIds.length === 0}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>📧</span> Send Email to Selected ({selectedIds.length})
            </button>

            <button
              onClick={() => {
                if (shortlistedCandidates.length === 0) {
                  alert('No shortlisted candidates to email.');
                  return;
                }
                setEmailAllShortlisted(true);
                setIsBulkEmailOpen(true);
              }}
              disabled={shortlistedCandidates.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <span>📨</span> Send to All Shortlisted ({shortlistedCandidates.length})
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-1.5 flex flex-wrap gap-1">
        <button
          onClick={() => { setActiveTab('ml_recommended'); setSelectedIds([]); }}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'ml_recommended'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <span>⭐ ML Recommended</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'ml_recommended' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {mlRecommended.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('needs_review'); setSelectedIds([]); }}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'needs_review'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <span>⚠️ Needs Review</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'needs_review' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            {needsReview.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('shortlisted'); setSelectedIds([]); }}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'shortlisted'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <span>✓ Shortlisted</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'shortlisted' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'
          }`}>
            {shortlistedCandidates.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('non_shortlisted'); setSelectedIds([]); }}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'non_shortlisted'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <span>✗ Non-Shortlisted</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'non_shortlisted' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
          }`}>
            {nonShortlistedCandidates.length}
          </span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              type="text"
              placeholder="Search candidate, position, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
            />
          </div>

          <span className="text-xs text-gray-500 font-medium">
            Showing {currentList.length} candidate{currentList.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">{error}</div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-xs space-y-1">
            <p className="text-2xl">📭</p>
            <p className="font-semibold text-gray-600">No candidates in this stage.</p>
            <p>Candidates will appear here after skill verification and ML evaluation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-slate-50 text-gray-600 font-semibold uppercase tracking-wider">
                <tr>
                  {activeTab === 'shortlisted' && (
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={currentList.length > 0 && selectedIds.length === currentList.length}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left">Candidate</th>
                  <th className="px-4 py-3 text-left">Position</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">ML Result</th>
                  <th className="px-4 py-3 text-left">Match Score</th>

                  {activeTab === 'shortlisted' && (
                    <>
                      <th className="px-4 py-3 text-left">Shortlisted By</th>
                      <th className="px-4 py-3 text-left">Email Status</th>
                    </>
                  )}

                  {activeTab === 'non_shortlisted' && (
                    <>
                      <th className="px-4 py-3 text-left">HR Reason</th>
                      <th className="px-4 py-3 text-left">Decision Date</th>
                    </>
                  )}

                  <th className="px-4 py-3 text-left">Resume</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-gray-700">
                {currentList.map(cand => (
                  <tr key={cand.application_id} className="hover:bg-slate-50/70 transition-colors">
                    {activeTab === 'shortlisted' && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(cand.application_id)}
                          onChange={() => handleToggleSelect(cand.application_id)}
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    )}

                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <div>{cand.candidate_name}</div>
                      {cand.email && <div className="text-[11px] text-gray-400 font-normal">{cand.email}</div>}
                    </td>

                    <td className="px-4 py-3">{cand.position || '-'}</td>
                    <td className="px-4 py-3">{cand.department || '-'}</td>

                    <td className="px-4 py-3">
                      {cand.predicted_class === 'good_intern' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          GOOD INTERN
                        </span>
                      ) : cand.predicted_class === 'bad_intern' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          BAD INTERN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                          Un-evaluated
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {cand.match_score !== null && cand.match_score !== undefined
                        ? typeof cand.match_score === 'number'
                          ? `${(cand.match_score * 100).toFixed(0)}%`
                          : cand.match_score
                        : '-'}
                    </td>

                    {activeTab === 'shortlisted' && (
                      <>
                        <td className="px-4 py-3 text-gray-600">{cand.shortlisted_by || 'HR Admin'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                            cand.email_status === 'sent'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : cand.email_status === 'failed'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {cand.email_status || 'Pending'}
                          </span>
                        </td>
                      </>
                    )}

                    {activeTab === 'non_shortlisted' && (
                      <>
                        <td className="px-4 py-3 max-w-xs truncate text-gray-600" title={cand.reason}>
                          {cand.reason || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {cand.decided_at ? new Date(cand.decided_at).toLocaleDateString() : '-'}
                        </td>
                      </>
                    )}

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleViewResume(cand.application_id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline flex items-center gap-1"
                      >
                        <span>📄</span> View
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(cand)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                      >
                        {activeTab === 'non_shortlisted' ? 'Reconsider / View' : 'Review & Decide'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HR Review Modal */}
      <HRReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        candidate={reviewCandidate}
        onDecisionSubmitted={loadAllData}
      />

      {/* Bulk Email Modal */}
      <BulkEmailModal
        isOpen={isBulkEmailOpen}
        onClose={() => setIsBulkEmailOpen(false)}
        selectedCandidateIds={selectedIds}
        allShortlisted={emailAllShortlisted}
        totalCount={shortlistedCandidates.length}
        onEmailsSent={loadAllData}
      />
    </div>
  );
}
