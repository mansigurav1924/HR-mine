import React, { useRef, useState } from 'react';

export default function ResumeUploadField({
  file,
  onFileSelect,
  onFileRemove,
  error,
  isParsing = false,
  parseStatus = null // { type: 'success' | 'warning' | 'error', message: string }
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  const validateAndSetFile = (selectedFile) => {
    setLocalError('');
    if (!selectedFile) return;

    // Check size
    if (selectedFile.size > MAX_SIZE) {
      setLocalError('File size exceeds the 5 MB limit. Please upload a smaller file.');
      return;
    }

    // Check extension
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      setLocalError('Invalid file type. Only .pdf and .docx files are permitted.');
      return;
    }

    onFileSelect(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
      />

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
              : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50/70 bg-gray-50/30'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
              📄
            </div>
            <div className="text-sm font-medium text-gray-700">
              <span className="text-indigo-600 font-semibold hover:underline">Click to upload resume</span> or drag and drop
            </div>
            <p className="text-xs text-gray-500">
              PDF or DOCX (Max 5 MB) — Auto-fills skills, experience, and profile details!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg flex-shrink-0 shadow-sm">
                {file.name.endsWith('.pdf') ? '📕' : '📘'}
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={isParsing}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 bg-white rounded-lg border border-indigo-200 shadow-xs hover:bg-indigo-50 transition disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={isParsing}
                onClick={onFileRemove}
                className="text-xs font-medium text-rose-600 hover:text-rose-800 px-2.5 py-1.5 bg-white rounded-lg border border-rose-200 shadow-xs hover:bg-rose-50 transition disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="flex items-center gap-2.5 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-medium text-indigo-800 animate-pulse">
              <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Extracting details from your resume...</span>
            </div>
          )}

          {/* Parse Status Notification */}
          {!isParsing && parseStatus && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                parseStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <span className="text-sm">{parseStatus.type === 'success' ? '✓' : '⚠️'}</span>
              <div className="flex-1">{parseStatus.message}</div>
            </div>
          )}
        </div>
      )}

      {(localError || error) && (
        <p className="text-xs text-red-600 font-medium flex items-center gap-1">
          <span>⚠️</span> {localError || error}
        </p>
      )}
    </div>
  );
}
