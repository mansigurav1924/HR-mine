import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const MFAGuard = () => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState(null); // 'enrolled', 'not_enrolled', 'verified'

  useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const currentAal = session?.aal;
        if (currentAal === 'aal2') {
          setMfaStatus('verified');
          setLoading(false);
          return;
        }

        const { data: { factors }, error } = await supabase.auth.mfa.listFactors();
        
        if (error) throw error;

        const hasVerifiedFactor = factors && factors.some(factor => factor.status === 'verified' && factor.factor_type === 'totp');
        
        if (hasVerifiedFactor) {
          setMfaStatus('enrolled');
        } else {
          setMfaStatus('not_enrolled');
        }
      } catch (err) {
        console.error('MFA check error');
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      checkMfaStatus();
    } else {
      setLoading(false);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (mfaStatus === 'not_enrolled') {
    return <Navigate to="/mfa-setup" replace />;
  }

  if (mfaStatus === 'enrolled') {
    return <Navigate to="/mfa-verify" replace />;
  }

  return <Outlet />;
};

export default MFAGuard;
