import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCandidateState,
  getCurrentQuestion,
  submitAnswer,
  submitAssessment,
  logIntegrityEvent,
  reportQuestionTimeout
} from '../../services/assessmentApi';

// ─── Debounce helper ──────────────────────────────────────────────────────────
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function CandidateAssessment() {
  const { token } = useParams();

  // ─── Core assessment state ─────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [state, setState]                   = useState('welcome');   // 'welcome' | 'in_progress' | 'completed'
  const [candidateData, setCandidateData]   = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [result, setResult]                 = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [timeLeft, setTimeLeft]             = useState(null);
  const [isTimingOut, setIsTimingOut]       = useState(false);

  // ─── Integrity state ───────────────────────────────────────────────────────
  const [showIntegrityWarning, setShowIntegrityWarning] = useState(false);   // Tab-switch warning
  const [fullscreenExited, setFullscreenExited]         = useState(false);   // Fullscreen overlay
  const [fsSupported, setFsSupported]                   = useState(true);

  // ─── Integrity refs (do not re-render on every event) ─────────────────────
  const assessmentActive    = useRef(false);   // true when in_progress
  const assessmentCompleted = useRef(false);   // true after submit (prevents false FULLSCREEN_EXIT)
  const tabSwitchSent       = useRef(false);   // dedup: don't send two TAB_SWITCH from one action
  const blurSent            = useRef(false);   // dedup WINDOW_BLUR within same tab-switch event
  const questionIndexRef    = useRef(null);    // current question index for event metadata

  // ─── Sync question index ref ────────────────────────────────────────────────
  useEffect(() => {
    if (currentQuestion?.question_number) {
      questionIndexRef.current = currentQuestion.question_number;
    }
  }, [currentQuestion]);

  // ─── Sync assessmentActive ─────────────────────────────────────────────────
  useEffect(() => {
    assessmentActive.current = (state === 'in_progress');
  }, [state]);

  // ─── Load initial state ────────────────────────────────────────────────────
  useEffect(() => {
    loadState();
  }, [token]);

  const loadState = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCandidateState(token);
      setCandidateData(data);
      if (data.completed) {
        setResult({
          result: data.result,
          message: data.result === 'pass'
            ? 'Thank you for completing the assessment. Our recruitment team will contact you regarding the next stage.'
            : 'Thank you for completing the assessment. Our recruitment team will contact you regarding your application.'
        });
        setState('completed');
        assessmentCompleted.current = true;
      } else {
        setState('welcome');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid or expired assessment link.');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FULLSCREEN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const requestFs = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
    return Promise.reject(new Error('Fullscreen API not supported'));
  }, []);

  const exitFs = useCallback(() => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    return Promise.resolve();
  }, []);

  const isFsSupported = useCallback(() => {
    return !!(
      document.documentElement.requestFullscreen ||
      document.documentElement.webkitRequestFullscreen ||
      document.documentElement.mozRequestFullScreen ||
      document.documentElement.msRequestFullscreen
    );
  }, []);

  const isFsActive = useCallback(() => {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      if (!assessmentActive.current) return;
      if (assessmentCompleted.current) return;

      if (!isFsActive()) {
        // User exited fullscreen during active assessment
        setFullscreenExited(true);
        logIntegrityEvent(token, 'FULLSCREEN_EXIT', questionIndexRef.current);
      } else {
        setFullscreenExited(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, [token, isFsActive]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB-SWITCH & WINDOW BLUR DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const sendTabSwitch = useDebounce((qi) => {
    logIntegrityEvent(token, 'TAB_SWITCH', qi);
    tabSwitchSent.current = true;
    setShowIntegrityWarning(true);
    // reset so next real switch also triggers
    setTimeout(() => { tabSwitchSent.current = false; }, 2000);
  }, 500);

  const sendWindowBlur = useDebounce((qi) => {
    // Don't double-count if a TAB_SWITCH was already sent within 2s
    if (!tabSwitchSent.current) {
      logIntegrityEvent(token, 'WINDOW_BLUR', qi);
    }
    blurSent.current = true;
    setTimeout(() => { blurSent.current = false; }, 3000);
  }, 800);

  useEffect(() => {
    const handleVisibility = () => {
      if (!assessmentActive.current) return;
      if (document.hidden) {
        sendTabSwitch(questionIndexRef.current);
      } else {
        logIntegrityEvent(token, 'WINDOW_FOCUS', questionIndexRef.current);
      }
    };

    const handleBlur = () => {
      if (!assessmentActive.current) return;
      sendWindowBlur(questionIndexRef.current);
    };

    const handleFocus = () => {
      if (!assessmentActive.current) return;
      logIntegrityEvent(token, 'WINDOW_FOCUS', questionIndexRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, sendTabSwitch, sendWindowBlur]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIPBOARD PREVENTION (question area)
  // ═══════════════════════════════════════════════════════════════════════════

  const sendCopy  = useDebounce((qi) => logIntegrityEvent(token, 'COPY_ATTEMPT', qi),  800);
  const sendPaste = useDebounce((qi) => logIntegrityEvent(token, 'PASTE_ATTEMPT', qi), 800);
  const sendCut   = useDebounce((qi) => logIntegrityEvent(token, 'CUT_ATTEMPT', qi),   800);

  const handleQuestionCopy = useCallback((e) => {
    e.preventDefault();
    sendCopy(questionIndexRef.current);
  }, [sendCopy]);

  const handleQuestionPaste = useCallback((e) => {
    e.preventDefault();
    sendPaste(questionIndexRef.current);
  }, [sendPaste]);

  const handleQuestionCut = useCallback((e) => {
    e.preventDefault();
    sendCut(questionIndexRef.current);
  }, [sendCut]);

  const handleQuestionContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleQuestionKeyDown = useCallback((e) => {
    const isCtrlCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlCmd) return;
    const key = e.key.toLowerCase();
    if (key === 'c') { e.preventDefault(); sendCopy(questionIndexRef.current); }
    if (key === 'v') { e.preventDefault(); sendPaste(questionIndexRef.current); }
    if (key === 'x') { e.preventDefault(); sendCut(questionIndexRef.current); }
  }, [sendCopy, sendPaste, sendCut]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSESSMENT FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStartOrResume = async () => {
    try {
      setLoading(true);
      setError(null);

      // Attempt fullscreen on user gesture
      if (isFsSupported()) {
        setFsSupported(true);
        try {
          await requestFs();
          logIntegrityEvent(token, 'FULLSCREEN_ENTERED', null);
        } catch {
          // User denied or browser blocked — allow assessment to continue
          logIntegrityEvent(token, 'FULLSCREEN_UNSUPPORTED', null);
        }
      } else {
        setFsSupported(false);
        logIntegrityEvent(token, 'FULLSCREEN_UNSUPPORTED', null);
      }

      await loadNextQuestion();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToFullscreen = async () => {
    try {
      await requestFs();
      setFullscreenExited(false);
      logIntegrityEvent(token, 'FULLSCREEN_REENTERED', questionIndexRef.current);
    } catch {
      // If rejected again, keep overlay visible
    }
  };

  const loadNextQuestion = async () => {
    try {
      const q = await getCurrentQuestion(token);
      if (q.ready_to_submit) {
        await handleFinalSubmit();
      } else {
        setCurrentQuestion(q);
        setSelectedOption(null);
        setIsTimingOut(false);
        setState('in_progress');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  // ─── Timer Management ──────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'in_progress' || !currentQuestion?.deadline_at || isTimingOut || submittingAnswer) {
      setTimeLeft(null);
      return;
    }

    const deadline = new Date(currentQuestion.deadline_at).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        handleTimeout();
      }
    };

    updateTimer(); // Initial check
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion, state, isTimingOut, submittingAnswer]);

  const handleTimeout = async () => {
    if (isTimingOut) return;
    try {
      setIsTimingOut(true);
      setTimeLeft(0);
      const nextQ = await reportQuestionTimeout(token);
      if (nextQ.ready_to_submit) {
        await handleFinalSubmit();
      } else {
        setCurrentQuestion(nextQ);
        setSelectedOption(null);
        setIsTimingOut(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setIsTimingOut(false);
    }
  };

  const handleAnswerSubmit = async () => {
    if (selectedOption === null || !currentQuestion) return;
    try {
      setSubmittingAnswer(true);
      await submitAnswer(token, {
        question_index: currentQuestion.question_number,
        selected_option: selectedOption
      });
      await loadNextQuestion();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      // Mark completed BEFORE exiting fullscreen to prevent spurious FULLSCREEN_EXIT event
      assessmentCompleted.current = true;
      if (isFsActive()) {
        try { await exitFs(); } catch { /* ignore */ }
      }
      const res = await submitAssessment(token);
      setResult(res);
      setState('completed');
    } catch (err) {
      assessmentCompleted.current = false; // revert if submit failed
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Loading splash ────────────────────────────────────────────────────────
  if (loading && !candidateData && !result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-sm font-semibold text-gray-600">Loading your assessment...</p>
        </div>
      </div>
    );
  }

  // ─── Fatal error (no data at all) ──────────────────────────────────────────
  if (error && !candidateData && !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-100 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-gray-900">Access Notice</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">

      {/* ── Fullscreen Exit Overlay ──────────────────────────────────────────── */}
      {fullscreenExited && state === 'in_progress' && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-200">
              ⛶
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Fullscreen Required</h2>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Please return to fullscreen mode to continue the assessment.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReturnToFullscreen}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow transition-all"
            >
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Top Header Card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">
            Technical Assessment
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {candidateData?.position || 'Technical Assessment'}
          </h1>
          {candidateData && (
            <p className="text-sm text-gray-500 font-medium">
              Candidate: <span className="font-semibold text-gray-800">{candidateData.candidate_name}</span> • Department: <span className="text-gray-700">{candidateData.department}</span>
            </p>
          )}
        </div>

        {/* ── Integrity Warning Banner (tab-switch) ──────────────────────── */}
        {showIntegrityWarning && state === 'in_progress' && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start justify-between gap-3 animate-fade-in shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🔔</span>
              <div>
                <p className="text-sm font-bold text-amber-900">Assessment Integrity Notice</p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  A tab or window change was detected. Please remain on the assessment page until completion.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIntegrityWarning(false)}
              className="text-amber-600 hover:text-amber-900 font-bold text-lg leading-none shrink-0 mt-0.5"
              aria-label="Dismiss integrity notice"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Global Error Banner ────────────────────────────────────────── */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2 animate-fade-in">
            <span className="text-base">⚠️</span>
            <p className="font-medium mt-0.5">{error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 1: Welcome & Instructions
        ══════════════════════════════════════════════════════════════════ */}
        {state === 'welcome' && candidateData && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900">Assessment Instructions</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Welcome to your technical evaluation for the <strong>{candidateData.position}</strong> role. Please read the guidelines carefully before starting.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-center space-y-1">
                <span className="text-2xl">📋</span>
                <p className="text-xs font-semibold text-gray-500 uppercase">Questions</p>
                <p className="text-lg font-extrabold text-gray-900">{candidateData.total_questions} Questions</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-center space-y-1">
                <span className="text-2xl">🔒</span>
                <p className="text-xs font-semibold text-gray-500 uppercase">Answer Policy</p>
                <p className="text-sm font-bold text-gray-900">Locked on submit</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-center space-y-1">
                <span className="text-2xl">⚡</span>
                <p className="text-xs font-semibold text-gray-500 uppercase">Navigation</p>
                <p className="text-sm font-bold text-gray-900">Sequential only</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <span>⚠️</span> Important Guidelines:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-amber-900/90 leading-relaxed">
                <li>Questions appear one at a time.</li>
                <li>Once submitted, an answer cannot be changed or revisited.</li>
                <li>There is no previous-question navigation.</li>
                <li>Your progress is saved continuously. Refreshing will resume at your current question.</li>
                <li>The assessment must remain in fullscreen mode throughout.</li>
                <li>Do not switch tabs or open other windows during the assessment.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleStartOrResume}
              disabled={loading}
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {candidateData.answered_count > 0
                ? `Resume Assessment (Question ${candidateData.answered_count + 1} of ${candidateData.total_questions}) →`
                : 'Start Assessment →'}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 2: Active MCQ Question View
            Clipboard prevention applied to question area div
        ══════════════════════════════════════════════════════════════════ */}
        {state === 'in_progress' && currentQuestion && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">

            {/* Progress & Timer Header */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                  <span>Question {currentQuestion.question_number} of {currentQuestion.total_questions}</span>
                  <span className="text-gray-300">•</span>
                  <span>{Math.round(((currentQuestion.question_number - 1) / currentQuestion.total_questions) * 100)}% Complete</span>
                </div>
                
                {/* Timer Display */}
                {timeLeft !== null && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg shadow-sm border transition-colors ${
                    timeLeft <= 5 
                      ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    <span className="text-xl -mt-0.5">⏱️</span>
                    <span>00:{timeLeft.toString().padStart(2, '0')}</span>
                  </div>
                )}
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestion.question_number - 1) / currentQuestion.total_questions) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Text — clipboard prevention area */}
            <div
              className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 select-none"
              onCopy={handleQuestionCopy}
              onPaste={handleQuestionPaste}
              onCut={handleQuestionCut}
              onContextMenu={handleQuestionContextMenu}
              onKeyDown={handleQuestionKeyDown}
              tabIndex={-1}
            >
              <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Options List — clipboard events also prevented here */}
            <div
              className="space-y-3"
              onCopy={handleQuestionCopy}
              onPaste={handleQuestionPaste}
              onCut={handleQuestionCut}
              onContextMenu={handleQuestionContextMenu}
              onKeyDown={handleQuestionKeyDown}
            >
              {currentQuestion.options?.map((option, idx) => {
                const isSelected = selectedOption === idx;
                return (
                  <label
                    key={idx}
                    className={`flex items-start p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center h-5 mt-0.5">
                      <input
                        type="radio"
                        name="assessment_mcq_option"
                        checked={isSelected}
                        onChange={() => setSelectedOption(idx)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <span className={`ml-3 text-sm leading-relaxed ${isSelected ? 'font-bold text-indigo-950' : 'font-medium text-gray-800'}`}>
                      {option}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Submit Answer Button */}
            <button
              type="button"
              onClick={handleAnswerSubmit}
              disabled={selectedOption === null || submittingAnswer || isTimingOut || (timeLeft !== null && timeLeft <= 0)}
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submittingAnswer ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Locking Answer...</span>
                </>
              ) : currentQuestion.question_number === currentQuestion.total_questions ? (
                'Submit Final Answer & Complete Assessment'
              ) : (
                'Confirm Answer & Next Question →'
              )}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 3: Assessment Completed View
        ══════════════════════════════════════════════════════════════════ */}
        {state === 'completed' && result && (
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-gray-100 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-xs border border-slate-200">
              ✓
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900">Assessment Completed</h2>
              {result.result === 'pass' ? (
                <p className="text-sm font-semibold text-emerald-600 mt-2">Congratulations! You have passed the assessment.</p>
              ) : (
                <p className="text-sm font-semibold text-slate-600 mt-2">Thank you for completing the assessment.</p>
              )}
            </div>
            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              Please check your registered email for further updates.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
