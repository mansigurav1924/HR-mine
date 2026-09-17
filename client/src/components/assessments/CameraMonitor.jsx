import React from "react";
import { CAMERA_STATUS, FACE_STATE } from "../../hooks/useFaceDetection";

/**
 * CameraMonitor — small camera preview widget shown during assessment.
 * Displays live video + face detection status badge.
 * No video is recorded or uploaded.
 */
export default function CameraMonitor({ videoRef, cameraStatus, faceState, onReconnect }) {
  const isCameraActive = cameraStatus === CAMERA_STATUS.ACTIVE;
  const isDisconnected = cameraStatus === CAMERA_STATUS.DISCONNECTED;
  const isError        = cameraStatus === CAMERA_STATUS.ERROR;
  const isInit         = cameraStatus === CAMERA_STATUS.INITIALIZING;

  /* Badge config */
  let badgeBg      = "bg-emerald-100 text-emerald-800 border-emerald-200";
  let badgeLabel   = "Face detected \u2713";
  let badgeDot     = "bg-emerald-500";

  if (!isCameraActive) {
    badgeBg    = "bg-gray-100 text-gray-500 border-gray-200";
    badgeLabel = isInit ? "Initializing\u2026" : "Camera inactive";
    badgeDot   = "bg-gray-400";
  } else if (faceState === FACE_STATE.MISSING) {
    badgeBg    = "bg-amber-100 text-amber-800 border-amber-200";
    badgeLabel = "Face not visible \u26a0";
    badgeDot   = "bg-amber-500 animate-pulse";
  } else if (faceState === FACE_STATE.MULTIPLE) {
    badgeBg    = "bg-rose-100 text-rose-800 border-rose-200";
    badgeLabel = "Multiple faces \u26a0";
    badgeDot   = "bg-rose-500 animate-pulse";
  } else if (faceState === FACE_STATE.UNKNOWN && isCameraActive) {
    badgeBg    = "bg-blue-100 text-blue-800 border-blue-200";
    badgeLabel = "Detecting\u2026";
    badgeDot   = "bg-blue-400 animate-pulse";
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Video preview */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm bg-slate-900"
           style={{ width: 160, height: 120 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"  /* Mirror for natural feel */
          style={{ display: isCameraActive ? "block" : "none" }}
        />
        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-2xl">
              {isDisconnected ? "\ud83d\udce2" : isError ? "\u274c" : isInit ? "\ud83d\udd04" : "\ud83d\udcf7"}
            </span>
            <p className="text-[10px] text-gray-400 font-medium text-center px-2 leading-tight">
              {isDisconnected ? "Camera disconnected"
                : isError   ? "Camera error"
                : isInit    ? "Starting camera\u2026"
                : "Camera inactive"}
            </p>
            {(isDisconnected || isError) && onReconnect && (
              <button
                type="button"
                onClick={onReconnect}
                className="text-[10px] font-bold text-indigo-600 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        )}
        {/* Live indicator */}
        {isCameraActive && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-bold text-white tracking-wider">LIVE</span>
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${badgeBg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${badgeDot}`} />
        {badgeLabel}
      </div>

      {/* Privacy note */}
      <p className="text-[9px] text-gray-400 text-center leading-tight max-w-[160px]">
        Face count only &bull; no video stored
      </p>
    </div>
  );
}
