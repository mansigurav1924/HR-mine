import React, { useState, useEffect } from 'react';
import { getOffersHistory, getSignedPdfUrl } from '../../services/offerApi';
import SendOfferModal from './SendOfferModal';

export default function OfferHistoryTab() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedOffer, setSelectedOffer] = useState(null);
  const [isResend, setIsResend] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getOffersHistory(1);
      setOffers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPdf = async (offer_id) => {
    try {
      const { url } = await getSignedPdfUrl(offer_id);
      window.open(url, '_blank');
    } catch (err) {
      alert("Failed to load PDF. " + (err.response?.data?.detail || ""));
    }
  };

  const handleOpenSend = (offer, resend = false) => {
    setSelectedOffer(offer);
    setIsResend(resend);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offer Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {offers.map(o => (
            <tr key={o.offer_id}>
              <td className="px-6 py-4">
                <div className="font-medium">{o.applications?.candidate_name || 'Unknown'}</div>
                <div className="text-sm text-gray-500">{o.email}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm">{o.designation}</div>
                <div className="text-xs text-gray-500">{o.department}</div>
              </td>
              <td className="px-6 py-4 text-sm">{o.offer_issue_date}</td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 uppercase">{o.offer_status}</span>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-bold rounded-full uppercase ${
                  o.email_status === 'sent' ? 'bg-green-100 text-green-800' :
                  o.email_status === 'failed' ? 'bg-rose-100 text-rose-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {o.email_status}
                </span>
              </td>
              <td className="px-6 py-4 flex items-center gap-3">
                <button onClick={() => handleViewPdf(o.offer_id)} className="text-indigo-600 font-medium hover:underline text-sm">
                  View PDF
                </button>
                
                {o.offer_status === 'generated' && o.email_status !== 'failed' && (
                  <button onClick={() => handleOpenSend(o, false)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
                    Send Offer
                  </button>
                )}
                
                {o.email_status === 'failed' && (
                  <button onClick={() => handleOpenSend(o, false)} className="px-3 py-1 bg-rose-600 text-white rounded text-sm hover:bg-rose-700">
                    Retry Send
                  </button>
                )}
                
                {o.offer_status === 'sent' && (
                  <button onClick={() => handleOpenSend(o, true)} className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300">
                    Resend
                  </button>
                )}
              </td>
            </tr>
          ))}
          {offers.length === 0 && !loading && (
            <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">No offers generated yet.</td></tr>
          )}
        </tbody>
      </table>

      <SendOfferModal 
        isOpen={!!selectedOffer}
        offer={selectedOffer}
        isResend={isResend}
        onClose={() => setSelectedOffer(null)}
        onUpdate={() => {
          setSelectedOffer(null);
          loadHistory();
        }}
      />
    </div>
  );
}
