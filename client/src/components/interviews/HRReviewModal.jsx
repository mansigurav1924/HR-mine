import React, { useState, useEffect } from 'react';
import { fetchInterviewDetail, reviewInterview } from '../../services/aiInterviewApi';

export default function HRReviewModal({ interviewId, onClose, onUpdate }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [scores, setScores] = useState({
    technical_score: 3,
    problem_solving_score: 3,
    communication_score: 3,
    project_knowledge_score: 3,
    notes: ''
  });

  useEffect(() => {
    loadDetail();
  }, [interviewId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await fetchInterviewDetail(interviewId);
      setDetail(data);
      if (data.hr_review_status === 'reviewed') {
        setScores({
          technical_score: data.scores.technical || 3,
          problem_solving_score: data.scores.problem_solving || 3,
          communication_score: data.scores.communication || 3,
          project_knowledge_score: data.scores.project_knowledge || 3,
          notes: data.hr_notes || ''
        });
      }
    } catch (err) {
      setError('Failed to load interview details.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await reviewInterview(interviewId, scores);
      await loadDetail();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const renderScoreSelect = (name, label, value) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => setScores({ ...scores, [name]: parseInt(e.target.value) })}
        disabled={detail?.hr_review_status === 'reviewed'}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm rounded-md border"
      >
        <option value={1}>1 - Poor</option>
        <option value={2}>2 - Fair</option>
        <option value={3}>3 - Average</option>
        <option value={4}>4 - Good</option>
        <option value={5}>5 - Excellent</option>
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            
            <div className="flex justify-between items-center mb-5 border-b pb-4">
              <h3 className="text-xl leading-6 font-medium text-gray-900" id="modal-title">
                AI Interview Review
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loading || !detail ? (
              <div className="py-12 text-center text-gray-500">Loading details...</div>
            ) : error ? (
              <div className="bg-rose-50 text-rose-700 p-4 rounded">{error}</div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6 max-h-[75vh] overflow-y-auto">
                
                {/* Left side: Transcript */}
                <div className="flex-1 md:w-2/3 border-r md:pr-6 space-y-6">
                  <div className="flex justify-between items-start bg-gray-50 p-4 rounded-lg">
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">{detail.candidate_name}</h4>
                      <p className="text-gray-600">{detail.position}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>Started: {new Date(detail.started_at).toLocaleString()}</p>
                      <p>Completed: {new Date(detail.completed_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Interview Transcript</h4>
                    <div className="space-y-6">
                      {detail.transcript.map((q, idx) => (
                        <div key={idx} className="bg-white border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b">
                            <h5 className="font-medium text-gray-900">Q{q.question_number}: {q.question}</h5>
                          </div>
                          <div className="p-4">
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {q.candidate_answer || <span className="italic text-gray-400">No answer provided</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right side: HR Review Form */}
                <div className="md:w-1/3">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Manual Evaluation</h4>
                  
                  {detail.hr_review_status === 'reviewed' ? (
                    <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg mb-4 text-teal-800 text-sm">
                      This interview was reviewed on {new Date(detail.reviewed_at).toLocaleDateString()}.
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 text-blue-800 text-sm">
                      Please review the transcript and submit your evaluation below.
                    </div>
                  )}

                  <form onSubmit={handleReviewSubmit} className="space-y-4">
                    {renderScoreSelect("technical_score", "Technical Score", scores.technical_score)}
                    {renderScoreSelect("problem_solving_score", "Problem Solving", scores.problem_solving_score)}
                    {renderScoreSelect("communication_score", "Communication", scores.communication_score)}
                    {renderScoreSelect("project_knowledge_score", "Project Knowledge", scores.project_knowledge_score)}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">HR Notes (Optional)</label>
                      <textarea
                        rows="4"
                        value={scores.notes}
                        onChange={(e) => setScores({ ...scores, notes: e.target.value })}
                        disabled={detail.hr_review_status === 'reviewed'}
                        className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                        placeholder="Add your evaluation notes here..."
                      />
                    </div>

                    {detail.hr_review_status !== 'reviewed' && (
                      <div className="pt-4 border-t">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
                        >
                          {submitting ? 'Submitting...' : 'Submit Final Evaluation'}
                        </button>
                      </div>
                    )}
                  </form>
                </div>

              </div>
            )}
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
