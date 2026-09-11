import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const MFAVerify = () => {
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const getFactor = async () => {
      try {
        const { data: { factors }, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        
        const totpFactor = factors?.find(f => f.status === 'verified' && f.factor_type === 'totp');
        if (totpFactor) {
          setFactorId(totpFactor.id);
        } else {
          setError('No verified MFA factor found.');
        }
      } catch (err) {
        setError('Failed to retrieve MFA factors.');
      } finally {
        setInitializing(false);
      }
    };
    getFactor();
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!factorId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode
      });
      
      if (verify.error) throw verify.error;
      
      navigate('/');
    } catch (err) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-2xl font-extrabold text-gray-900 tracking-tight">
            Two-Factor Authentication
          </h2>
          <p className="mt-3 text-center text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleVerify}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="code">Authenticator Code</label>
            <input
              id="code"
              name="code"
              type="text"
              required
              autoComplete="one-time-code"
              className="appearance-none relative block w-full px-3 py-2.5 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center tracking-widest text-lg"
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              maxLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading || verifyCode.length < 6 || !factorId}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MFAVerify;
