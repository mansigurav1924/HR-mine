/**
 * useFaceDetection.js
 *
 * Privacy-first, browser-side face detection hook using MediaPipe tasks-vision.
 * ONLY detects face COUNT (0 / 1 / 2+). No facial recognition, no embeddings,
 * no screenshots, no video/audio stored or transmitted.
 */

import { useRef, useEffect, useCallback, useState } from "react";

const FACE_MISSING_GRACE_MS  = 5000;
const MULTIPLE_FACE_GRACE_MS = 3000;
const DETECTION_INTERVAL_MS  = 333;

const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_MODEL_URL     = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export const CAMERA_STATUS = {
  IDLE:              "idle",
  INITIALIZING:      "initializing",
  ACTIVE:            "active",
  PERMISSION_DENIED: "permission_denied",
  ERROR:             "error",
  DISCONNECTED:      "disconnected",
  UNSUPPORTED:       "unsupported",
};

export const FACE_STATE = {
  PRESENT:  "present",
  MISSING:  "missing",
  MULTIPLE: "multiple",
  UNKNOWN:  "unknown",
};

export function useFaceDetection({ enabled = true, onViolation, onRestored, onDisconnected } = {}) {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);
  const intervalRef = useRef(null);

  const missingStartRef   = useRef(null);
  const multipleStartRef  = useRef(null);
  const episodeLoggedRef  = useRef(false);
  const faceStateRef      = useRef(FACE_STATE.UNKNOWN);

  const onViolationRef    = useRef(onViolation);
  const onRestoredRef     = useRef(onRestored);
  const onDisconnectedRef = useRef(onDisconnected);
  useEffect(() => { onViolationRef.current    = onViolation;    }, [onViolation]);
  useEffect(() => { onRestoredRef.current     = onRestored;     }, [onRestored]);
  useEffect(() => { onDisconnectedRef.current = onDisconnected; }, [onDisconnected]);

  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.IDLE);
  const [faceState,    setFaceState]    = useState(FACE_STATE.UNKNOWN);

  const handleFaceCount = useCallback((count) => {
    const now = Date.now();

    if (count === 1) {
      const wasViolation = episodeLoggedRef.current;
      const prevState    = faceStateRef.current;
      missingStartRef.current  = null;
      multipleStartRef.current = null;
      episodeLoggedRef.current = false;
      faceStateRef.current     = FACE_STATE.PRESENT;
      if (prevState !== FACE_STATE.PRESENT && prevState !== FACE_STATE.UNKNOWN) {
        setFaceState(FACE_STATE.PRESENT);
        if (wasViolation && onRestoredRef.current) onRestoredRef.current();
      }
    } else if (count === 0) {
      if (faceStateRef.current !== FACE_STATE.MISSING) {
        missingStartRef.current  = now;
        multipleStartRef.current = null;
        episodeLoggedRef.current = false;
        faceStateRef.current     = FACE_STATE.MISSING;
        setFaceState(FACE_STATE.MISSING);
      } else if (!episodeLoggedRef.current && missingStartRef.current &&
                 (now - missingStartRef.current) >= FACE_MISSING_GRACE_MS) {
        const durationSeconds = Math.round((now - missingStartRef.current) / 1000);
        episodeLoggedRef.current = true;
        if (onViolationRef.current) onViolationRef.current("FACE_MISSING", durationSeconds);
      }
    } else {
      if (faceStateRef.current !== FACE_STATE.MULTIPLE) {
        multipleStartRef.current = now;
        missingStartRef.current  = null;
        episodeLoggedRef.current = false;
        faceStateRef.current     = FACE_STATE.MULTIPLE;
        setFaceState(FACE_STATE.MULTIPLE);
      } else if (!episodeLoggedRef.current && multipleStartRef.current &&
                 (now - multipleStartRef.current) >= MULTIPLE_FACE_GRACE_MS) {
        const durationSeconds = Math.round((now - multipleStartRef.current) / 1000);
        episodeLoggedRef.current = true;
        if (onViolationRef.current) onViolationRef.current("MULTIPLE_FACES", durationSeconds);
      }
    }
  }, []);

  const stopDetectionLoop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const startDetectionLoop = useCallback(() => {
    stopDetectionLoop();
    intervalRef.current = setInterval(() => {
      const video    = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2 || video.paused) return;
      try {
        const results = detector.detectForVideo(video, performance.now());
        handleFaceCount(results.detections.length);
      } catch { /* silent */ }
    }, DETECTION_INTERVAL_MS);
  }, [handleFaceCount, stopDetectionLoop]);

  const loadDetector = useCallback(async () => {
    if (detectorRef.current) return;
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    detectorRef.current = await FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
      runningMode:            "VIDEO",
      minDetectionConfidence: 0.5,
    });
  }, []);

  const startCamera = useCallback(async () => {
    setCameraStatus(CAMERA_STATUS.INITIALIZING);
    try {
      await loadDetector();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopDetectionLoop();
        setCameraStatus(CAMERA_STATUS.DISCONNECTED);
        setFaceState(FACE_STATE.UNKNOWN);
        faceStateRef.current     = FACE_STATE.UNKNOWN;
        missingStartRef.current  = null;
        multipleStartRef.current = null;
        episodeLoggedRef.current = false;
        if (onDisconnectedRef.current) onDisconnectedRef.current();
      });
      setCameraStatus(CAMERA_STATUS.ACTIVE);
      startDetectionLoop();
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraStatus(CAMERA_STATUS.PERMISSION_DENIED);
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraStatus(CAMERA_STATUS.UNSUPPORTED);
      } else {
        setCameraStatus(CAMERA_STATUS.ERROR);
      }
    }
  }, [loadDetector, startDetectionLoop, stopDetectionLoop]);

  const stopCamera = useCallback(() => {
    stopDetectionLoop();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current)  { videoRef.current.srcObject = null; }
    faceStateRef.current     = FACE_STATE.UNKNOWN;
    missingStartRef.current  = null;
    multipleStartRef.current = null;
    episodeLoggedRef.current = false;
    setCameraStatus(CAMERA_STATUS.IDLE);
    setFaceState(FACE_STATE.UNKNOWN);
  }, [stopDetectionLoop]);

  const reconnectCamera = useCallback(async () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    await startCamera();
  }, [startCamera]);

  useEffect(() => {
    return () => {
      stopDetectionLoop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (detectorRef.current) { try { detectorRef.current.close(); } catch {} detectorRef.current = null; }
    };
  }, [stopDetectionLoop]);

  return { videoRef, cameraStatus, faceState, startCamera, stopCamera, reconnectCamera };
}
