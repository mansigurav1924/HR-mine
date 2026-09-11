import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  getIntegrationsStatus,
  getGoogleConnectUrl,
  disconnectGoogle
  // getMicrosoftConnectUrl,
  // disconnectMicrosoft
} from '../services/integrationsApi';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState({
    google: { connected: false, account_email: null, granted_scopes: [] }
    // microsoft: { connected: false, account_email: null, granted_scopes: [] }
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadStatus();

    // Check OAuth return params
    const successProvider = searchParams.get('integration_success');
    const errorMsg = searchParams.get('integration_error');

    if (successProvider === 'google') {
      setAlert({ type: 'success', message: 'Google account connected successfully with Gmail API and Google Calendar access.' });
      setSearchParams({});
    } else if (errorMsg) {
      setAlert({ type: 'error', message: `Integration authorization was ${errorMsg}.` });
      setSearchParams({});
    }
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await getIntegrationsStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load integration status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setActionLoading(true);
    try {
      const data = await getGoogleConnectUrl();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to initiate Google authorization.' });
      setActionLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    const result = await Swal.fire({
      title: 'Disconnect Google?',
      text: 'Email delivery and Google Calendar sync will revert to offline fallback.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Disconnect',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setActionLoading(true);
    try {
      await disconnectGoogle();
      setAlert({ type: 'success', message: 'Google integration disconnected successfully.' });
      await loadStatus();
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to disconnect Google.' });
    } finally {
      setActionLoading(false);
    }
  };

  /*
  // Outlook / Microsoft Graph Integration handlers (deferred for future release)
  const handleConnectMicrosoft = async () => {
    setActionLoading(true);
    try {
      const data = await getMicrosoftConnectUrl();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to initiate Microsoft authorization.' });
      setActionLoading(false);
    }
  };

  const handleDisconnectMicrosoft = async () => {
    const result = await Swal.fire({
      title: 'Disconnect Microsoft Outlook?',
      text: 'Microsoft Outlook Calendar sync will be disabled.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Disconnect',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setActionLoading(true);
    try {
      await disconnectMicrosoft();
      setAlert({ type: 'success', message: 'Microsoft Outlook Calendar disconnected successfully.' });
      await loadStatus();
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to disconnect Microsoft.' });
    } finally {
      setActionLoading(false);
    }
  };
  */

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings & Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage external email (Gmail API) and Google Calendar communication providers for recruitment automation.
          </p>
        </div>
      </div>

      {/* Alert Notification */}
      {alert && (
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-sm border ${
          alert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-lg">{alert.type === 'success' ? '✓' : '⚠️'}</span>
            <p className="text-sm font-medium">{alert.message}</p>
          </div>
          <button onClick={() => setAlert(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">&times;</button>
        </div>
      )}

      {/* Security Info Card */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-5 flex items-start gap-4">
        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-indigo-950">Enterprise OAuth 2.0 Security</h3>
          <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
            All OAuth tokens are encrypted at rest with AES-256 and stored exclusively on the secure backend. Client secrets and refresh tokens are never exposed to the client or candidate-facing interfaces.
          </p>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Google & Gmail Integration Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between">
          <div className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg border border-red-100">
                  G
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Google Workspace / Gmail</h3>
                  <p className="text-xs text-gray-500">Email Delivery & Google Calendar API</p>
                </div>
              </div>

              {loading ? (
                <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse"></div>
              ) : status.google?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                  Not Connected
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                Connects HR recruitment communications to <strong>Gmail API</strong> for high-deliverability email dispatch and enables <strong>Google Calendar</strong> with automatic <strong>Google Meet</strong> video link provisioning.
              </p>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Connected Account:</span>
                  <span className="font-semibold text-gray-900">{status.google?.account_email || 'None'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Primary Transport:</span>
                  <span className="font-semibold text-indigo-600">Gmail API (users.messages.send)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Calendar & Meet:</span>
                  <span className="font-semibold text-emerald-600">Google Calendar v3 & Meet</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Granted Scopes</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-mono">gmail.send</span>
                  <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-mono">calendar.events</span>
                  <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-mono">userinfo.email</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Requires Google Cloud OAuth app</span>
            <div className="flex gap-2">
              {status.google?.connected ? (
                <>
                  <button
                    onClick={handleConnectGoogle}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition"
                  >
                    Reconnect
                  </button>
                  <button
                    onClick={handleDisconnectGoogle}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 shadow-sm transition"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                  </svg>
                  Connect Google
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 
          Microsoft Outlook Calendar Integration Card (Commented out - to be enabled in future release)
          ------------------------------------------------------------------------------------------
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between opacity-60">
            ...
          </div>
        */}

      </div>
    </div>
  );
}
