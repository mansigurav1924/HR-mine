import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getCandidateState, confirmProfile, getCurrentQuestion, submitAnswer, submitInterview } from '../../services/aiInterviewApi';

export default function CandidateInterview() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [state, setState] = useState(null); // 'pending_profile', 'ready', 'completed'
  const [candidateData, setCandidateData] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  
  const [answerText, setAnswerText] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  useEffect(() => {
    loadState();
  }, [token]);

  const loadState = async () => {
    try {
      setLoading(true);
      const data = await getCandidateState(token);
      setCandidateData(data);
      
      if (!data.profile_confirmed) {
        setState('pending_profile');
      } else {
        await loadNextQuestion();
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired interview link.');
    } finally {
      setLoading(false);
    }
  };

  const loadNextQuestion = async () => {
    try {
      const q = await getCurrentQuestion(token);
      if (q.ready_to_submit) {
        await handleFinalSubmit();
      } else {
        setCurrentQuestion(q);
        setAnswerText('');
        setState('ready');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConfirmProfile = async () => {
    try {
      setLoading(true);
      await confirmProfile(token);
      await loadNextQuestion();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!answerText.trim()) return;
    try {
      setSubmittingAnswer(true);
      await submitAnswer(token, {
        question_index: currentQuestion.question_number,
        answer: answerText
      });
      await loadNextQuestion();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      await submitInterview(token);
      setState('completed');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !candidateData && state !== 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
             <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Technical Interview</h1>
          {candidateData && (
            <p className="mt-2 text-lg text-gray-600">
              {candidateData.position} • {candidateData.department}
            </p>
          )}
        </div>

        {/* State: Pending Profile */}
        {state === 'pending_profile' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome, {candidateData.first_name}</h2>
              <p className="text-gray-600 mb-6">
                You have been invited to a text-based interview for the <strong>{candidateData.position}</strong> role. 
                You will be presented with {candidateData.question_count} technical questions to answer sequentially.
              </p>
              
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 text-sm text-indigo-800">
                <strong>Important Instructions:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>You must complete the interview in one sitting.</li>
                  <li>Answers cannot be edited once submitted.</li>
                  <li>Take your time to write thoughtful, detailed responses.</li>
                </ul>
              </div>

              {/* FUTURE ONLY: Optional AI voice/video input may later be added with Skip/Continue. */}

              <button
                onClick={handleConfirmProfile}
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Starting...' : 'I understand, begin interview'}
              </button>
            </div>
          </div>
        )}

        {/* State: Ready (Questions) */}
        {state === 'ready' && currentQuestion && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                Question {currentQuestion.question_number} of {currentQuestion.total_questions}
              </span>
              <div className="w-1/2 bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(currentQuestion.question_number / currentQuestion.total_questions) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-xl font-medium text-gray-900 mb-6 leading-relaxed">
                {currentQuestion.question}
              </h2>

              <div className="mb-6">
                <textarea
                  rows="8"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your answer here... Be as detailed as possible."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-4 text-gray-800 border"
                />
                <p className="text-xs text-gray-500 mt-2 text-right">
                  {answerText.length} characters (Max 5000)
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleAnswerSubmit}
                  disabled={!answerText.trim() || answerText.length > 5000 || submittingAnswer}
                  className="inline-flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                  {submittingAnswer ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* State: Completed */}
        {state === 'completed' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-green-100 text-center">
            <div className="text-green-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Completed</h2>
            <p className="text-gray-600 text-lg mb-4">Thank you for completing the interview. Your responses have been submitted successfully.</p>
            <p className="text-gray-500">Our HR team will review your responses and contact you regarding the next stage.</p>
          </div>
        )}

      </div>
    </div>
  );
}
