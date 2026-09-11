import React, { useState } from 'react';
import { sendOfferEmail } from '../../services/offerApi';

export default function SendOfferModal({ isOpen, onClose, offer, isResend, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !offer) return null;

  const handleSend = async () => {
    try {
      setLoading(true);
      setError('');
      await sendOfferEmail(offer.offer_id, isResend);
      setSuccess(true);
      onUpdate(); // Refresh history
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send offer email.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <h2 className="text-xl font-bold mb-4">{isResend ? 'Resend Offer Letter' : 'Send Offer Letter'}</h2>
        
        {success ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 p-4 rounded text-green-800 border border-green-200">
              <p className="font-bold mb-2">Offer Sent Successfully</p>
              <p className="text-sm">Recipient: {offer.email}</p>
              <p className="text-sm">Status: Sent</p>
              <p className="text-sm">Sent At: {new Date().toLocaleString()}</p>
            </div>
            <button onClick={handleClose} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full">
              Close
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-4 text-gray-700">
              {isResend 
                ? "This offer has already been sent. Send it again?" 
                : "Send this offer letter to the candidate's registered email address?"}
            </p>
            
            <div className="bg-gray-50 p-3 rounded border mb-4 text-sm">
              <p><strong>Candidate:</strong> {offer.applications?.candidate_name}</p>
              <p><strong>Recipient:</strong> {offer.email}</p>
              <p><strong>Designation:</strong> {offer.designation}</p>
            </div>

            {error && (
              <div className="mb-4 bg-rose-50 text-rose-700 p-3 rounded text-sm border border-rose-200">
                <p className="font-bold">Offer Email Could Not Be Sent</p>
                <p className="text-xs">{error}</p>
                <p className="text-xs mt-2">The generated offer has been preserved.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={handleClose} disabled={loading} className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50">
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSend}
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Sending...' : error ? 'Retry Send' : isResend ? 'Resend Offer' : 'Send Offer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
