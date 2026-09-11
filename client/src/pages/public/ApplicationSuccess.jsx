import React from 'react';
import { useLocation, Link } from 'react-router-dom';

export default function ApplicationSuccess() {
  const location = useLocation();
  const state = location.state || {};

  const candidateName = state.candidate_name || 'Candidate';
  const email = state.email || '';
  const position = state.position || 'Open Role';
  const verificationToken = state.verification_token;
  const verificationUrl = state.verification_url || (verificationToken ? `/apply/skills/${verificationToken}` : null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-gray-800">
      {/* Public Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              HR
            </div>
            <span className="font-bold text-gray-900 tracking-tight text-base">Talent Acquisition Portal</span>
          </div>

          <Link
            to="/apply"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Browse Other Positions
          </Link>
        </div>
      </header>

      {/* Main Success Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-gray-200 shadow-xl p-8 sm:p-10 text-center space-y-6 animate-fade-in">
          {/* Animated Success Checkmark Badge */}
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner">
            ✓
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Application Submitted Successfully!
            </h1>
            <p className="text-sm text-gray-600">
              Thank you, <span className="font-semibold text-gray-900">{candidateName}</span>. Your application for <span className="font-semibold text-indigo-600">{position}</span> has been received.
            </p>
          </div>

          {/* Step 2 Callout if token present */}
          {verificationUrl && (
            <div className="p-5 bg-gradient-to-r from-indigo-50 via-indigo-100/50 to-indigo-50 rounded-2xl border-2 border-indigo-200 text-left space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  Step 2 of 2: Mandatory Step
                </span>
                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                  Next Step
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Verify Your Job-Relevant Skills</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Complete a quick 1-minute self-rating of the core technical competencies required for this role so our evaluation model and recruiters can review your match.
                </p>
              </div>
              <Link
                to={verificationUrl}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
              >
                <span>Continue to Skill Verification</span>
                <span className="text-base">→</span>
              </Link>
            </div>
          )}

          {/* Details Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 text-left space-y-2 text-xs text-gray-600">
            <div className="flex justify-between py-1 border-b border-gray-200/60">
              <span className="font-medium text-gray-500">Applicant:</span>
              <span className="font-semibold text-gray-800">{candidateName}</span>
            </div>
            {email && (
              <div className="flex justify-between py-1 border-b border-gray-200/60">
                <span className="font-medium text-gray-500">Confirmation Email:</span>
                <span className="font-semibold text-gray-800">{email}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-gray-200/60">
              <span className="font-medium text-gray-500">Status:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Application Received
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-medium text-gray-500">Channel:</span>
              <span className="font-semibold text-gray-800">Direct Web Application</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/apply"
              className="w-full sm:w-auto px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Submit Another Application
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} HR Recruitment System. All rights reserved.</p>
      </footer>
    </div>
  );
}
