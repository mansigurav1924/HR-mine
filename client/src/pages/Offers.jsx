import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
  getOffers, 
  getOfferTimeline, 
  extendOfferDeadline, 
  sendOfferReminder, 
  cancelOffer, 
  pollGmailReplies 
} from '../services/offerApi';

const STATUS_COLORS = {
  generated: 'bg-gray-100 text-gray-800 border-gray-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  viewed: 'bg-purple-100 text-purple-800 border-purple-200',
  discussion_requested: 'bg-orange-100 text-orange-800 border-orange-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-rose-100 text-rose-800 border-rose-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  withdrawn: 'bg-gray-100 text-gray-800 border-gray-200'
};

const TABS = [
  { id: 'all', label: 'All Offers' },
  { id: 'sent', label: 'Pending' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'discussion_requested', label: 'Discussion' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
  { id: 'expired', label: 'Expired' }
];

const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (dt) => dt ? new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Modals
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [newExpiry, setNewExpiry] = useState('');
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const data = await getOffers();
      setOffers(data || []);
    } catch (err) {
      setError('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const handlePoll = async () => {
    try {
      setIsPolling(true);
      const res = await pollGmailReplies();
      if (res.error) {
        Swal.fire('Notice', res.error, 'warning');
      } else {
        Swal.fire('Success', `Polled ${res.offers_checked} offers. Processed ${res.replies_processed} new replies.`, 'success');
        loadOffers();
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to poll Gmail replies', 'error');
    } finally {
      setIsPolling(false);
    }
  };

  const openTimeline = async (offer) => {
    try {
      setSelectedOffer(offer);
      const data = await getOfferTimeline(offer.offer_id);
      setTimeline(data);
      setShowTimeline(true);
    } catch (err) {
      Swal.fire('Error', 'Failed to load timeline', 'error');
    }
  };

  const handleExtend = async () => {
    if (!newExpiry) return;
    try {
      await extendOfferDeadline(selectedOffer.offer_id, new Date(newExpiry).toISOString());
      Swal.fire('Success', 'Deadline extended successfully', 'success');
      setShowExtend(false);
      setNewExpiry('');
      loadOffers();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.detail || 'Failed to extend deadline', 'error');
    }
  };

  const handleRemind = async (offerId) => {
    try {
      await sendOfferReminder(offerId);
      Swal.fire('Success', 'Reminder sent successfully', 'success');
      loadOffers();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.detail || 'Failed to send reminder. Note: Only 1 reminder can be sent per 24 hours.', 'error');
    }
  };

  const handleCancel = async (offerId) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Cancel Offer?',
      text: "This will invalidate the candidate's link and withdraw the offer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, Cancel it'
    });
    if (!isConfirmed) return;
    
    try {
      await cancelOffer(offerId);
      Swal.fire('Cancelled', 'The offer has been cancelled.', 'success');
      loadOffers();
    } catch (err) {
      Swal.fire('Error', 'Failed to cancel offer', 'error');
    }
  };

  const filteredOffers = activeTab === 'all' 
    ? offers 
    : offers.filter(o => (o.offer_status || o.status) === activeTab);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Offer Letters</h1>
          <p className="text-sm text-gray-500 mt-1">Manage, track, and monitor candidate offer letters and replies.</p>
        </div>
        <button 
          onClick={handlePoll}
          disabled={isPolling}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center gap-2 shadow-sm transition-all disabled:opacity-50">
          <svg className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          {isPolling ? 'Polling Replies...' : 'Sync Gmail Replies'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px px-2" aria-label="Tabs">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const count = tab.id === 'all' ? offers.length : offers.filter(o => (o.offer_status || o.status) === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {error && <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm">{error}</div>}
        
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-gray-400">
            <svg className="w-8 h-8 animate-spin text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Loading Offers...
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            </div>
            <p className="text-gray-500">No offers found in this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <bg className="bg-gray-50"/>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Candidate & Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tracking</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates & Expiry</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredOffers.map(o => {
                  const status = o.offer_status || o.status;
                  const isExpiringSoon = status !== 'accepted' && status !== 'declined' && status !== 'expired' && 
                                         new Date(o.expiry_at || o.offer_expiry_date) - new Date() < 172800000 && 
                                         new Date(o.expiry_at || o.offer_expiry_date) - new Date() > 0;
                  return (
                  <tr key={o.offer_id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{o.applications?.candidate_name}</div>
                      <div className="text-sm text-gray-500">{o.designation}</div>
                      <div className="text-xs text-gray-400 mt-1">{o.applications?.position}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
                        {status.replace('_', ' ').toUpperCase()}
                      </span>
                      {o.discussion_message && status === 'discussion_requested' && (
                        <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-1.5 rounded truncate max-w-[200px]" title={o.discussion_message}>
                          Msg: {o.discussion_message}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2" title="Times the offer page was viewed">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                {o.view_count || 0} views {o.first_viewed_at && <span className="text-xs text-gray-400">({fmt(o.first_viewed_at)})</span>}
                            </div>
                            <div className="flex items-center gap-2" title="Times the PDF was downloaded">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                {o.pdf_access_count || 0} dl
                            </div>
                            {o.reminder_count > 0 && (
                                <div className="flex items-center gap-2 text-orange-500 text-xs mt-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                    Reminded {o.reminder_count}x
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div><span className="text-gray-400">Sent:</span> {fmt(o.sent_at || o.created_at)}</div>
                      <div className={`mt-1 font-medium ${isExpiringSoon ? 'text-rose-600 flex items-center gap-1' : 'text-gray-700'}`}>
                        {isExpiringSoon && <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                        Exp: {fmt(o.expiry_at || o.offer_expiry_date)}
                      </div>
                      {o.expiry_extended_at && <div className="text-xs text-blue-500 mt-0.5">Extended</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openTimeline(o)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors" title="View Timeline">
                          Timeline
                        </button>
                        
                        <div className="relative group">
                          <button className="text-gray-600 hover:text-gray-900 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                            Manage
                          </button>
                          {/* Dropdown menu */}
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 overflow-hidden origin-top-right">
                            {status !== 'accepted' && status !== 'declined' && status !== 'cancelled' && status !== 'withdrawn' && (
                                <>
                                    <button onClick={() => { setSelectedOffer(o); setShowExtend(true); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                                        Extend Deadline
                                    </button>
                                    <button onClick={() => handleRemind(o.offer_id)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 border-t border-gray-50">
                                        Send Reminder
                                    </button>
                                </>
                            )}
                            {status !== 'cancelled' && status !== 'withdrawn' && (
                                <button onClick={() => handleCancel(o.offer_id)} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-gray-50">
                                    Cancel Offer
                                </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline Modal */}
      {showTimeline && selectedOffer && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" onClick={() => setShowTimeline(false)}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-center mb-5 border-b pb-4">
                            <div>
                                <h3 className="text-xl leading-6 font-bold text-gray-900" id="modal-title">Offer Timeline</h3>
                                <p className="text-sm text-gray-500 mt-1">{selectedOffer.applications?.candidate_name}</p>
                            </div>
                            <button onClick={() => setShowTimeline(false)} className="text-gray-400 hover:text-gray-500">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="mt-2">
                            {timeline.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No events found.</p>
                            ) : (
                                <div className="flow-root">
                                    <ul className="-mb-8">
                                        {timeline.map((event, eventIdx) => (
                                            <li key={event.event_id || eventIdx}>
                                                <div className="relative pb-8">
                                                    {eventIdx !== timeline.length - 1 ? (
                                                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                                                    ) : null}
                                                    <div className="relative flex space-x-3">
                                                        <div>
                                                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white 
                                                                ${event.event_type.includes('ACCEPTED') ? 'bg-green-500' : 
                                                                  event.event_type.includes('DECLINED') ? 'bg-red-500' : 
                                                                  event.event_type.includes('SENT') || event.event_type.includes('GENERATED') ? 'bg-blue-500' : 
                                                                  event.event_type.includes('REPLY') ? 'bg-purple-500' :
                                                                  'bg-gray-400'}`}>
                                                                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                            <div>
                                                                <p className="text-sm text-gray-900 font-semibold">{event.event_type.replace(/_/g, ' ')}</p>
                                                                {event.actor_type && <p className="text-xs text-gray-500">By {event.actor_type}</p>}
                                                                {event.metadata && Object.keys(event.metadata).length > 0 && (
                                                                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                                                        {JSON.stringify(event.metadata)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-right text-xs whitespace-nowrap text-gray-500">
                                                                {fmtTime(event.occurred_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Extend Deadline Modal */}
      {showExtend && selectedOffer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" onClick={() => setShowExtend(false)}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4">Extend Offer Deadline</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Current Expiry</label>
                            <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">{fmtTime(selectedOffer.expiry_at || selectedOffer.offer_expiry_date)}</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date & Time</label>
                            <input 
                                type="datetime-local" 
                                value={newExpiry} 
                                onChange={(e) => setNewExpiry(e.target.value)}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-4 py-2 border" 
                            />
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100">
                        <button onClick={handleExtend} disabled={!newExpiry} className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                            Confirm Extension
                        </button>
                        <button onClick={() => setShowExtend(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
