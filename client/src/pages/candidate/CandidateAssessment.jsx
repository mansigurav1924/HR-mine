import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCandidateState,
  getCurrentQuestion,
  submitAnswer,
  submitAssessment,
  logIntegrityEvent,
  reportQuestionTimeout,
  startSession,
  sendHeartbeat
} from '../../services/assessmentApi';
import { useFaceDetection, CAMERA_STATUS, FACE_STATE } from '../../hooks/useFaceDetection';
import CameraMonitor from '../../components/assessments/CameraMonitor';

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
  const [state, setState]                   = useState('privacy_notice'); // 'privacy_notice' | 'welcome' | 'in_progress' | 'completed'
  const [candidateData, setCandidateData]   = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [result, setResult]                 = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [timeLeft, setTimeLeft]             = useState(null);
  const [isTimingOut, setIsTimingOut]       = useState(false);

  // ─── Privacy + camera consent state ───────────────────────────────────────
  const [privacyAgreed, setPrivacyAgreed]       = useState(false);
  const [requestingCamera, setRequestingCamera]  = useState(false);
  const [cameraWarning, setCameraWarning]        = useState(null); // null | 'missing' | 'multiple' | 'disconnected'
  const [showCameraRestored, setShowCameraRestored] = useState(false);

  // ─── Existing integrity state ──────────────────────────────────────────────
  const [showIntegrityWarning, setShowIntegrityWarning] = useState(false);
  const [fullscreenExited, setFullscreenExited]         = useState(false);
  const [fsSupported, setFsSupported]                   = useState(true);

  // ─── Termination state ─────────────────────────────────────────────────────
  const [terminated, setTerminated]             = useState(false);
  const [terminationMessage, setTerminationMessage] = useState('');

  // ─── Integrity refs ────────────────────────────────────────────────────────
  const assessmentActive    = useRef(false);
  const assessmentCompleted = useRef(false);
  const tabSwitchSent       = useRef(false);
  const blurSent            = useRef(false);
  const questionIndexRef    = useRef(null);

  // ─── Sync question index ref ───────────────────────────────────────────────
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
        setState('privacy_notice');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid or expired assessment link.');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA / FACE DETECTION INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCameraViolation = useCallback((eventType, durationSeconds) => {
    // Only fire during active assessment
    if (!assessmentActive.current) return;
    logIntegrityEvent(token, eventType, questionIndexRef.current, durationSeconds);
    if (eventType === 'FACE_MISSING') {
      setCameraWarning('missing');
    } else if (eventType === 'MULTIPLE_FACES') {
      setCameraWarning('multiple');
    }
  }, [token]);

  const handleCameraRestored = useCallback(() => {
    if (!assessmentActive.current) return;
    setCameraWarning(null);
    setShowCameraRestored(true);
    setTimeout(() => setShowCameraRestored(false), 3000);
  }, []);

  const handleCameraDisconnected = useCallback(() => {
    if (!assessmentActive.current) return;
    logIntegrityEvent(token, 'CAMERA_DISCONNECTED', questionIndexRef.current);
    setCameraWarning('disconnected');
  }, [token]);

  const {
    videoRef,
    cameraStatus,
    faceState,
    startCamera,
    stopCamera,
    reconnectCamera,
  } = useFaceDetection({
    enabled: true,
    onViolation:    handleCameraViolation,
    onRestored:     handleCameraRestored,
    onDisconnected: handleCameraDisconnected,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY NOTICE + CAMERA PERMISSION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAllowCameraAndProceed = async () => {
    if (!privacyAgreed) return;
    try {
      setRequestingCamera(true);
      setError(null);
      await startCamera();
      // Wait a tick to read status from state (startCamera updates state async)
      await new Promise(r => setTimeout(r, 200));
    } catch {
      // Error handled inside startCamera via cameraStatus
    } finally {
      setRequestingCamera(false);
    }
  };

  // Advance to welcome once camera is active
  useEffect(() => {
    if (state === 'privacy_notice' && cameraStatus === CAMERA_STATUS.ACTIVE) {
      logIntegrityEvent(token, 'ASSESSMENT_CAMERA_MONITORING_STARTED');
      setState('welcome');
    } else if (state === 'privacy_notice' && cameraStatus === CAMERA_STATUS.ERROR) {
      logIntegrityEvent(token, 'ASSESSMENT_CAMERA_MONITORING_FAILED');
    }
  }, [cameraStatus, state, token]);

  // Camera reconnect during assessment
  const handleReconnectCamera = useCallback(async () => {
    setCameraWarning(null);
    await reconnectCamera();
    logIntegrityEvent(token, 'ASSESSMENT_CAMERA_MONITORING_STARTED', questionIndexRef.current);
  }, [reconnectCamera, token]);

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

  useEffect(() => {
    const handleFsChange = () => {
      if (!assessmentActive.current) return;
      if (assessmentCompleted.current) return;
      if (!isFsActive()) {
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

  const sendTabSwitch = useDebounce(async (qi) => {
    const res = await logIntegrityEvent(token, 'TAB_SWITCH', qi);
    tabSwitchSent.current = true;
    if (res?.terminated) {
      // Server auto-terminated the assessment — block the candidate immediately
      assessmentActive.current = false;
      assessmentCompleted.current = true;
      try { if (isFsActive()) await exitFs(); } catch { /* ignore */ }
      stopCamera();
      setTerminated(true);
      setTerminationMessage(
        res.message ||
        'Your assessment has been terminated due to excessive tab switching. Your answers have been saved.'
      );
    } else {
      setShowIntegrityWarning(true);
    }
    setTimeout(() => { tabSwitchSent.current = false; }, 2000);
  }, 500);

  const sendWindowBlur = useDebounce((qi) => {
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
    const handleBlur  = () => { if (!assessmentActive.current) return; sendWindowBlur(questionIndexRef.current); };
    const handleFocus = () => { if (!assessmentActive.current) return; logIntegrityEvent(token, 'WINDOW_FOCUS', questionIndexRef.current); };

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
  // CLIPBOARD PREVENTION
  // ═══════════════════════════════════════════════════════════════════════════

  const sendCopy  = useDebounce((qi) => logIntegrityEvent(token, 'COPY_ATTEMPT', qi),  800);
  const sendPaste = useDebounce((qi) => logIntegrityEvent(token, 'PASTE_ATTEMPT', qi), 800);
  const sendCut   = useDebounce((qi) => logIntegrityEvent(token, 'CUT_ATTEMPT', qi),   800);

  const handleQuestionCopy        = useCallback((e) => { e.preventDefault(); sendCopy(questionIndexRef.current); }, [sendCopy]);
  const handleQuestionPaste       = useCallback((e) => { e.preventDefault(); sendPaste(questionIndexRef.current); }, [sendPaste]);
  const handleQuestionCut         = useCallback((e) => { e.preventDefault(); sendCut(questionIndexRef.current); }, [sendCut]);
  const handleQuestionContextMenu = useCallback((e) => { e.preventDefault(); }, []);
  const handleQuestionKeyDown     = useCallback((e) => {
    const isCtrlCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlCmd) return;
    const key = e.key.toLowerCase();
    if (key === 'c') { e.preventDefault(); sendCopy(questionIndexRef.current); }
    if (key === 'v') { e.preventDefault(); sendPaste(questionIndexRef.current); }
    if (key === 'x') { e.preventDefault(); sendCut(questionIndexRef.current); }
  }, [sendCopy, sendPaste, sendCut]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN PRESENTATION & SCREENSHOT PREVENTION
  // ═══════════════════════════════════════════════════════════════════════════

  const sendScreenPresentationAttempt = useDebounce((qi) => {
    logIntegrityEvent(token, 'SCREEN_PRESENTATION_ATTEMPT', qi);
    setShowIntegrityWarning(true);
  }, 1000);

  const sendScreenshotKeyAttempt = useDebounce((qi) => {
    logIntegrityEvent(token, 'SCREENSHOT_KEY_ATTEMPT', qi);
  }, 1000);

  useEffect(() => {
    // 1. Monkey-patch getDisplayMedia to block screen sharing attempts via browser APIs
    const originalGetDisplayMedia = navigator.mediaDevices ? navigator.mediaDevices.getDisplayMedia : null;
    if (navigator.mediaDevices && originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async function() {
        if (assessmentActive.current) {
          sendScreenPresentationAttempt(questionIndexRef.current);
          return Promise.reject(new Error("Screen sharing is restricted during the assessment."));
        }
        return originalGetDisplayMedia.apply(this, arguments);
      };
    }

    // 2. Listen for screenshot keys (PrintScreen, Meta+Shift+S, Meta+Shift+4)
    const handleGlobalKeyDown = (e) => {
      if (!assessmentActive.current) return;
      const isMacScreenshot = e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '4' || e.key === '3' || e.key === '5');
      if (e.key === 'PrintScreen' || isMacScreenshot) {
        sendScreenshotKeyAttempt(questionIndexRef.current);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (navigator.mediaDevices && originalGetDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
    };
  }, [token, sendScreenPresentationAttempt, sendScreenshotKeyAttempt]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSESSMENT FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStartOrResume = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Hit start_session API to track max 2 sessions
      await startSession(token);
      
      if (isFsSupported()) {
        setFsSupported(true);
        try {
          await requestFs();
          logIntegrityEvent(token, 'FULLSCREEN_ENTERED', null);
        } catch {
          logIntegrityEvent(token, 'FULLSCREEN_UNSUPPORTED', null);
        }
      } else {
        setFsSupported(false);
        logIntegrityEvent(token, 'FULLSCREEN_UNSUPPORTED', null);
      }
      await loadNextQuestion();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to start session.");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToFullscreen = async () => {
    try {
      await requestFs();
      setFullscreenExited(false);
      logIntegrityEvent(token, 'FULLSCREEN_REENTERED', questionIndexRef.current);
    } catch { /* keep overlay visible */ }
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

  // ─── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'in_progress' || !currentQuestion?.deadline_at || isTimingOut || submittingAnswer) {
      setTimeLeft(null);
      return;
    }
    const deadline = new Date(currentQuestion.deadline_at).getTime();
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) handleTimeout();
    };
    updateTimer();
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
      assessmentCompleted.current = true;
      if (isFsActive()) { try { await exitFs(); } catch { /* ignore */ } }
      // Stop camera cleanly after marking completed (prevents spurious CAMERA_DISCONNECTED)
      stopCamera();
      const res = await submitAssessment(token);
      setResult(res);
      setState('completed');
    } catch (err) {
      assessmentCompleted.current = false;
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
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto" />
          <p className="text-sm font-semibold text-gray-600">Loading your assessment...</p>
        </div>
      </div>
    );
  }

  // ─── Fatal error (no data at all) ─────────────────────────────────────────
  if (error && !candidateData && !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-100 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900">Access Notice</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">

      {/* ── Assessment Terminated Overlay ──────────────────────────────────── */}
      {terminated && (
        <div className="fixed inset-0 z-[60] bg-slate-900/98 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl border border-rose-200">
            <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-3xl">
              🚫
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Assessment Terminated</h2>
              <p className="text-sm text-rose-700 font-semibold mt-2">Your session has been ended.</p>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{terminationMessage}</p>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 text-left leading-relaxed">
              <span className="font-bold">What happens next: </span>
              Your answers have been automatically saved and scored. Our recruitment team will review your submission and contact you via email.
            </div>
          </div>
        </div>
      )}

      {fullscreenExited && state === 'in_progress' && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-200">⛶</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Fullscreen Required</h2>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">Please return to fullscreen mode to continue the assessment.</p>
            </div>
            <button type="button" onClick={handleReturnToFullscreen}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow transition-all">
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* ── Camera Disconnected Overlay (blocking) ──────────────────────────── */}
      {cameraWarning === 'disconnected' && state === 'in_progress' && (
        <div className="fixed inset-0 z-40 bg-slate-900/90 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-2xl border border-rose-200">📷</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Camera Disconnected</h2>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Your camera is no longer detected. Please reconnect your camera to continue the assessment.
                This event has been logged.
              </p>
            </div>
            <button type="button" onClick={handleReconnectCamera}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow transition-all">
              Reconnect Camera
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Top Header Card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2 flex-1">
            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">
              Technical Assessment
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {candidateData?.position || 'Technical Assessment'}
            </h1>
            {candidateData && (
              <p className="text-sm text-gray-500 font-medium">
                Candidate: <span className="font-semibold text-gray-800">{candidateData.candidate_name}</span>
                {' '}• Department: <span className="text-gray-700">{candidateData.department}</span>
              </p>
            )}
          </div>
          {/* Camera Monitor (moved to header) */}
          {(state === 'in_progress' || cameraStatus !== CAMERA_STATUS.IDLE) && (
            <div className="flex shrink-0">
              <CameraMonitor
                videoRef={videoRef}
                cameraStatus={cameraStatus}
                faceState={faceState}
                onReconnect={handleReconnectCamera}
              />
            </div>
          )}
        </div>

        {/* ── Integrity Warning Banner (tab-switch) ───────────────────────── */}
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
            <button type="button" onClick={() => setShowIntegrityWarning(false)}
              className="text-amber-600 hover:text-amber-900 font-bold text-lg leading-none shrink-0 mt-0.5"
              aria-label="Dismiss integrity notice">×</button>
          </div>
        )}

        {/* ── Camera Face-Missing Warning (non-blocking) ──────────────────── */}
        {cameraWarning === 'missing' && state === 'in_progress' && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start justify-between gap-3 animate-fade-in shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">👤</span>
              <div>
                <p className="text-sm font-bold text-amber-900">Face Not Detected</p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Your face is not visible to the camera. Please ensure you remain in frame throughout the assessment.
                  This has been logged. The timer continues.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setCameraWarning(null)}
              className="text-amber-600 hover:text-amber-900 font-bold text-lg leading-none shrink-0 mt-0.5"
              aria-label="Dismiss">×</button>
          </div>
        )}

        {/* ── Camera Multiple-Faces Warning (non-blocking) ────────────────── */}
        {cameraWarning === 'multiple' && state === 'in_progress' && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start justify-between gap-3 animate-fade-in shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">👥</span>
              <div>
                <p className="text-sm font-bold text-rose-900">Multiple Faces Detected</p>
                <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                  More than one face is visible in the camera. The assessment must be completed independently.
                  This has been logged. The timer continues.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setCameraWarning(null)}
              className="text-rose-600 hover:text-rose-900 font-bold text-lg leading-none shrink-0 mt-0.5"
              aria-label="Dismiss">×</button>
          </div>
        )}

        {/* ── Camera Restored Banner ───────────────────────────────────────── */}
        {showCameraRestored && state === 'in_progress' && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-fade-in shadow-sm">
            <span className="text-lg">✓</span>
            <p className="text-xs font-bold text-emerald-800">Face monitoring restored. Thank you.</p>
          </div>
        )}

        {/* ── Global Error Banner ──────────────────────────────────────────── */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2 animate-fade-in">
            <span className="text-base">⚠️</span>
            <p className="font-medium mt-0.5">{error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATE 0: Privacy Notice + Camera Consent
        ══════════════════════════════════════════════════════════════════ */}
        {state === 'privacy_notice' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔐</span>
                <h2 className="text-lg font-bold text-gray-900">Assessment Monitoring Notice</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Before you start, please review the monitoring measures active during this assessment.
                Your privacy is respected — read the details below carefully.
              </p>
            </div>

            {/* Monitoring details */}
            <div className="space-y-3">
              {[
                {
                  icon: '🖥️',
                  title: 'Fullscreen Enforcement',
                  desc: 'The assessment runs in fullscreen. Exiting fullscreen is detected and logged.'
                },
                {
                  icon: '🔀',
                  title: 'Tab & Window Switch Detection',
                  desc: 'Switching to another tab or window is detected and logged.'
                },
                {
                  icon: '📋',
                  title: 'Copy / Paste Restriction',
                  desc: 'Copy, paste, and cut operations are disabled within the question area.'
                },
                {
                  icon: '📷',
                  title: 'Camera Face Presence Monitoring',
                  desc: 'Your camera is used to verify a single person is present throughout the assessment. Only face COUNT (0, 1, or 2+) is used — face recognition is NOT performed, no facial embeddings are created, and NO video, audio, or screenshots are stored or transmitted.'
                },
                {
                  icon: '🚫',
                  title: 'Screen Presentation Guard',
                  desc: 'Screen sharing from the assessment page is disabled. Taking screenshots is monitored and logged.'
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Privacy statement */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 leading-relaxed">
              <span className="font-bold">Privacy Statement: </span>
              Camera data is processed entirely in your browser using on-device AI. No video, audio, or image frames leave your device.
              Only anonymised face-count integrity signals (e.g., "face not detected for 8 seconds") are sent to the server.
            </div>

            {/* Consent checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="privacy-consent-checkbox"
                type="checkbox"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-gray-700 leading-relaxed">
                I have read and understood the monitoring notice. I consent to camera face presence monitoring for the duration of this assessment.
              </span>
            </label>

            {/* Camera permission error */}
            {cameraStatus === CAMERA_STATUS.PERMISSION_DENIED && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold">
                ⚠️ Camera permission was denied. Please allow camera access in your browser settings and try again.
                Camera monitoring is required to start the assessment.
              </div>
            )}
            {cameraStatus === CAMERA_STATUS.UNSUPPORTED && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold">
                ⚠️ No camera was found on your device. A webcam is required to take this assessment.
                Please connect a camera and refresh this page.
              </div>
            )}
            {cameraStatus === CAMERA_STATUS.ERROR && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold">
                ⚠️ Camera could not be started. Please check your browser permissions and try again.
              </div>
            )}

            <button
              type="button"
              id="allow-camera-btn"
              onClick={handleAllowCameraAndProceed}
              disabled={!privacyAgreed || requestingCamera || cameraStatus === CAMERA_STATUS.INITIALIZING}
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestingCamera || cameraStatus === CAMERA_STATUS.INITIALIZING
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Starting Camera…</span></>
                : '📷 Allow Camera & Continue →'}
            </button>
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
                Welcome to your technical evaluation for the <strong>{candidateData.position}</strong> role.
                Please read the guidelines carefully before starting.
              </p>
              {candidateData.current_session && candidateData.current_session.session_number === 1 && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm font-semibold">
                  ⚠️ Your previous assessment session was interrupted. You are now entering your FINAL session (2 of 2). 
                  If you are interrupted again, your assessment will be automatically submitted with your current answers.
                </div>
              )}
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
                <li>Keep your face visible in the camera at all times.</li>
              </ul>
            </div>

            {/* Camera status in welcome */}
            <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
              cameraStatus === CAMERA_STATUS.ACTIVE
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span>{cameraStatus === CAMERA_STATUS.ACTIVE ? '📷 ✓' : '📷 ⚠'}</span>
              {cameraStatus === CAMERA_STATUS.ACTIVE
                ? 'Camera monitoring active — your face presence will be verified throughout.'
                : 'Camera not active — please refresh and allow camera access.'}
            </div>

            <button
              type="button"
              id="start-assessment-btn"
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

                <div className="flex items-center gap-3">
                  {/* Timer */}
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
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestion.question_number - 1) / currentQuestion.total_questions) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Text */}
            <div
              className="w-full p-6 bg-slate-50/80 rounded-2xl border border-slate-200 select-none"
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

            {/* Options List */}
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
              id="submit-answer-btn"
              onClick={handleAnswerSubmit}
              disabled={selectedOption === null || submittingAnswer || isTimingOut || (timeLeft !== null && timeLeft <= 0)}
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submittingAnswer ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Locking Answer…</span></>
              ) : currentQuestion.question_number === currentQuestion.total_questions
                ? 'Submit Final Answer & Complete Assessment'
                : 'Confirm Answer & Next Question →'}
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
