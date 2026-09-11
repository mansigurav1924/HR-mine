import React, { useState } from 'react';
import { sendBulkShortlistEmails } from '../../services/shortlistingApi';

export default function BulkEmailModal({ isOpen, onClose, selectedCandidateIds = [], allShortlisted = false, totalCount = 0, onEmailsSent }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const count = allShortlisted ? totalCount : selectedCandidateIds.length;

  const handleSend = async () => {
    setSending(true);
    setErrorMsg('');
    setResult(null);

    try {
      const payload = allShortlisted
        ? { all_shortlisted: true, email_type: 'shortlisted' }
        : { application_ids: selectedCandidateIds, email_type: 'shortlisted' };

      const res = await sendBulkShortlistEmails(payload);
      setResult(res);
      if (onEmailsSent) {
        onEmailsSent();
      }
    } catch (err) {
      console.error('Bulk send error', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to dispatch shortlist emails.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 animate-fade-in font-sans">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-xs">
              📧
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Send Shortlist Invitations</h2>
              <p className="text-xs text-gray-500">Dispatch assessment links to shortlisted candidates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none p-1 rounded-lg hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <span>⚠️</span>
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Status / Confirmation */}
        {!result ? (
          <div className="space-y-4 text-xs text-gray-600">
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2">
              <p className="font-semibold text-indigo-950 text-sm">
                Target: {count} Shortlisted Candidate{count === 1 ? '' : 's'}
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-indigo-800 leading-relaxed">
                <li>Each candidate receives a <strong>separate, confidential email</strong>.</li>
                <li>Email addresses and candidate details are never shared or CC'd.</li>
                <li>Generates a secure, <strong>single-use assessment token</strong> per candidate.</li>
                <li>Does not disclose internal ML scores or HR deliberation notes.</li>
              </ul>
            </div>

            <p className="text-gray-500">
              Are you sure you want to proceed with sending emails to {allShortlisted ? 'all' : 'the selected'} {count} candidates?
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <span className="text-emerald-600 text-base">✓</span> Batch Dispatch Complete
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                  <p className="text-gray-400 text-[10px] uppercase font-bold">Total</p>
                  <p className="text-base font-bold text-gray-800">{result.requested}</p>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <p className="text-emerald-600 text-[10px] uppercase font-bold">Sent</p>
                  <p className="text-base font-bold text-emerald-800">{result.sent}</p>
                </div>
                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  <p className="text-rose-600 text-[10px] uppercase font-bold">Failed</p>
                  <p className="text-base font-bold text-rose-800">{result.failed}</p>
                </div>
              </div>

              {result.failures && result.failures.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <p className="font-bold text-rose-700">Delivery Failures:</p>
                  {result.failures.map((f, i) => (
                    <div key={i} className="p-2 bg-rose-50 rounded border border-rose-200 text-rose-800 flex justify-between">
                      <span>{f.candidate_name || f.email || f.application_id}</span>
                      <span className="text-rose-600">{f.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          {!result ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || count === 0}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Dispatching emails...</span>
                  </>
                ) : (
                  <span>Send Emails to {count} Candidates</span>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
