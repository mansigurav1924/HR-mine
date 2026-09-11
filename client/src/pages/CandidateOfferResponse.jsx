import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { validateOfferToken, submitOfferResponse, downloadOfferPdf } from '../services/offerApi';

export default function CandidateOfferResponse() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpiredLocally, setIsExpiredLocally] = useState(false);

  useEffect(() => {
    loadOffer();
  }, [token]);

  useEffect(() => {
    if (!offer || !offer.expiry) return;

    // Timer logic
    const calculateTimeLeft = () => {
      const expiryDate = new Date(offer.expiry);
      const now = new Date();
      const difference = expiryDate - now;

      if (difference <= 0) {
        setIsExpiredLocally(true);
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);

      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000); // update every minute

    return () => clearInterval(timer);
  }, [offer]);

  const loadOffer = async () => {
    try {
      setLoading(true);
      const data = await validateOfferToken(token);
      setOffer(data);
      if (data.status === 'expired') {
        setIsExpiredLocally(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired offer link.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await downloadOfferPdf(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Offer_Letter_${offer.candidate_name.replace(' ', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      Swal.fire('Download Failed', 'Could not download the PDF.', 'error');
    }
  };

  const handleResponse = async (decision) => {
    let reason = '';
    let discussionMessage = '';
    
    if (decision === 'decline') {
      const { value: text, isConfirmed } = await Swal.fire({
        title: 'Decline Offer',
        text: 'Please provide a reason for declining (optional):',
        input: 'textarea',
        showCancelButton: true,
        confirmButtonText: 'Submit',
        confirmButtonColor: '#d33',
      });
      if (!isConfirmed) return;
      reason = text;
    } else if (decision === 'discussion') {
       const { value: text, isConfirmed } = await Swal.fire({
        title: 'Request Discussion',
        text: 'What would you like to discuss? (e.g., Joining date, compensation, etc.)',
        input: 'textarea',
        inputValidator: (val) => (!val ? 'You need to write something!' : null),
        showCancelButton: true,
        confirmButtonText: 'Send Request',
        confirmButtonColor: '#3b82f6',
      });
      if (!isConfirmed) return;
      discussionMessage = text;
    } else {
      const { isConfirmed } = await Swal.fire({
        title: 'Accept Offer',
        text: 'Are you sure you want to accept this offer?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Accept',
        confirmButtonColor: '#10b981',
      });
      if (!isConfirmed) return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitOfferResponse(token, decision, reason, discussionMessage);
      setOffer(prev => ({ ...prev, status: res.status }));
      Swal.fire('Success', 'Your response has been recorded.', 'success');
    } catch (err) {
      Swal.fire('Error', err.response?.data?.detail || 'Failed to submit response.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  if (error) return (
    <div className="flex justify-center items-center h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full border border-gray-200">
        <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Invalid or Expired</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  const isResponded = ['accepted', 'declined', 'discussion_requested', 'cancelled', 'withdrawn'].includes(offer.status);
  const isExpired = isExpiredLocally || offer.status === 'expired';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden ring-1 ring-gray-900/5">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="relative z-10">
            <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">Internship Offer</h1>
            <p className="text-indigo-100 text-lg font-medium">We are excited to have you join our team!</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-10">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Hello {offer.candidate_name},</h2>
            <p className="text-gray-600 mt-3 text-lg leading-relaxed max-w-2xl mx-auto">
              Congratulations on being selected for the position of <strong className="text-gray-900">{offer.position}</strong> in the <strong className="text-gray-900">{offer.department}</strong> department. 
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-10 flex flex-col sm:flex-row justify-between items-center gap-4 transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Official Document</p>
                <p className="text-gray-900 font-bold text-lg">Offer_Letter.pdf</p>
              </div>
            </div>
            <button 
              onClick={handleDownload}
              className="w-full sm:w-auto text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 font-medium rounded-xl text-sm px-6 py-3 text-center inline-flex justify-center items-center gap-2 transition-all shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              View / Download PDF
            </button>
          </div>

          {/* Action Area */}
          <div className="border-t border-gray-100 pt-10">
            
            {/* Countdown Timer */}
            {!isResponded && !isExpired && (
                <div className="text-center mb-8">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-2">Offer Expires In</p>
                    <div className="inline-flex items-center justify-center bg-rose-50 text-rose-700 px-6 py-2 rounded-full font-bold text-xl border border-rose-100 shadow-inner">
                        <svg className="w-5 h-5 mr-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {timeLeft || 'Calculating...'}
                    </div>
                </div>
            )}

            {isExpired && !isResponded && (
              <div className="text-center p-8 bg-gray-50 rounded-2xl border border-gray-200 shadow-inner">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h3 className="text-2xl font-bold text-gray-800">Offer Expired</h3>
                <p className="text-gray-600 mt-2">The deadline to respond to this offer has passed. Please contact HR if you believe this is an error or require an extension.</p>
              </div>
            )}

            {!isResponded && !isExpired && (
              <>
                <p className="text-center text-gray-600 mb-6 font-medium text-lg">Please indicate your decision below:</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={() => handleResponse('accept')}
                    disabled={isSubmitting}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-green-500/30 transition-all transform hover:-translate-y-1 hover:shadow-green-500/50 disabled:opacity-50 disabled:hover:transform-none flex justify-center items-center gap-2 text-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    Accept Offer
                  </button>
                  <button 
                    onClick={() => handleResponse('discussion')}
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1 hover:shadow-blue-500/50 disabled:opacity-50 disabled:hover:transform-none flex justify-center items-center gap-2 text-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    Request Discussion
                  </button>
                  <button 
                    onClick={() => handleResponse('decline')}
                    disabled={isSubmitting}
                    className="flex-1 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 text-lg shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    Decline
                  </button>
                </div>
              </>
            )}

            {offer.status === 'accepted' && (
              <div className="text-center p-8 bg-green-50 rounded-2xl border border-green-200 shadow-inner animate-fade-in">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-2xl font-extrabold text-green-900">Offer Accepted!</h3>
                <p className="text-green-700 mt-2 font-medium">Thank you for accepting the offer. Our HR team will reach out to you with the next steps regarding your onboarding.</p>
              </div>
            )}

            {offer.status === 'discussion_requested' && (
              <div className="text-center p-8 bg-blue-50 rounded-2xl border border-blue-200 shadow-inner animate-fade-in">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h3 className="text-2xl font-extrabold text-blue-900">Discussion Requested</h3>
                <p className="text-blue-700 mt-2 font-medium">Your request for discussion has been sent to the HR team. They will contact you shortly.</p>
              </div>
            )}

            {offer.status === 'declined' && (
              <div className="text-center p-8 bg-red-50 rounded-2xl border border-red-200 shadow-inner animate-fade-in">
                 <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </div>
                <h3 className="text-2xl font-extrabold text-red-900">Offer Declined</h3>
                <p className="text-red-700 mt-2 font-medium">We're sorry to see you go, but we appreciate your time and wish you the best in your future endeavors!</p>
              </div>
            )}
            
            {(offer.status === 'cancelled' || offer.status === 'withdrawn') && (
              <div className="text-center p-8 bg-gray-50 rounded-2xl border border-gray-200 shadow-inner animate-fade-in">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                <h3 className="text-2xl font-extrabold text-gray-800">Offer Withdrawn</h3>
                <p className="text-gray-600 mt-2 font-medium">This offer is no longer valid or has been withdrawn.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
