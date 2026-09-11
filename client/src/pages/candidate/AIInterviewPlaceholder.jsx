import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AIInterviewPlaceholder = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [candidateState, setCandidateState] = useState(null);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ai-interviews/access/${token}`);
        if (!res.ok) {
          if (res.status === 403 || res.status === 404 || res.status === 400) {
            throw new Error('This interview link is invalid or has expired. Please contact the HR team for assistance.');
          }
          throw new Error('We are unable to load the AI Interview page at the moment. Please try again shortly.');
        }
        
        const data = await res.json();
        setCandidateState(data);

        // Only record opened if it's not already completed
        if (data.status !== 'completed') {
          await fetch(`${API_URL}/api/ai-interviews/access/${token}/opened`, {
            method: 'POST'
          }).catch(console.error); // Ignore errors for tracking
        }
      } catch (err) {
        if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
          // Do not block UI for network errors
          setCandidateState({ status: 'pending' });
        } else if (err.message.includes('invalid')) {
          setError(err.message);
        } else {
          // For other errors, still show the placeholder
          setCandidateState({ status: 'pending' });
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchState();
  }, [token]);

  const handleComplete = async () => {
    setSubmitting(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/ai-interviews/access/${token}/complete`, {
        method: 'POST'
      });
      
      if (!res.ok) {
        throw new Error('Failed to record completion. Please try again.');
      }
      
      const data = await res.json();
      setCandidateState(prev => ({
        ...prev,
        status: 'completed'
      }));
      setJustCompleted(true);
      
    } catch (err) {
      if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
        setError("We couldn't record your completion at the moment. Please try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Handle true Access Denied vs Network Errors
  if (error && !candidateState) {
    const isInvalid = error.includes('invalid');
    if (isInvalid) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-gray-100">
            <div className="text-red-500 mb-4 flex justify-center">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              AI Interview Link Invalid
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
          </div>
        </div>
      );
    }
  }

  const isCompleted = candidateState?.status === 'completed';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-indigo-600 p-8 text-white text-center">
          <h1 className="text-3xl font-bold mb-2">AI Interview</h1>
          {candidateState && candidateState.first_name && (
            <p className="text-indigo-100 text-lg font-medium">
              Candidate: {candidateState.first_name} <br/>
              Position: {candidateState.position}
            </p>
          )}
        </div>
        
        {/* Body */}
        <div className="p-10 text-center flex flex-col items-center">
          
          {isCompleted ? (
            <>
              <div className="bg-green-50 p-4 rounded-full mb-6">
                <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-4">✓ AI Interview Done</h2>
              <p className="text-gray-600 text-lg mb-4 max-w-lg">
                {justCompleted 
                  ? "Your AI Interview stage has been completed successfully." 
                  : "Your AI Interview stage has already been completed successfully."}
              </p>
              <p className="text-gray-600 text-lg mb-8 max-w-lg">
                Further updates regarding your application will be sent to your registered email.
              </p>
              {justCompleted && (
                <p className="text-gray-600 text-lg mb-8 max-w-lg">
                  Thank you.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="bg-indigo-50 p-4 rounded-full mb-6">
                <svg className="w-12 h-12 text-indigo-600 animate-[spin_3s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Interview Module</h2>
              
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-5 flex flex-col items-center gap-3 text-center w-full max-w-lg mb-8">
                <p className="font-medium">
                  The automated AI Interview module is currently under development.
                </p>
                <p className="text-sm">
                  For the current version of the recruitment process, please click Done to complete this stage. 
                </p>
                <p className="text-sm font-semibold">
                  No AI score will be generated for this stage.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm max-w-md w-full border border-red-200">
                  {error}
                </div>
              )}
              
              <button 
                onClick={handleComplete}
                disabled={submitting}
                className="px-10 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors focus:ring-4 focus:ring-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 text-lg"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Completing...
                  </>
                ) : (
                  'Done'
                )}
              </button>
            </>
          )}
          
        </div>
        
      </div>
    </div>
  );
};

export default AIInterviewPlaceholder;
