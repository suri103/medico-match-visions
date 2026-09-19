import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { verifyEmail } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';
import { hasCreatedProfile } from '@/lib/profile';
import { Button } from '@/components/ui/button';

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('This verification link is invalid or incomplete.');
      return;
    }
    let cancelled = false;
    verifyEmail(token).then((res) => {
      if (cancelled) return;
      // H-1: cookie-first — browsers get token:null (cookie carries session).
      if (res.ok && res.user) {
        signIn({
          id: res.user.id,
          email: res.user.email,
          firstName: res.user.firstName,
          lastName: res.user.lastName,
          fullName: res.user.fullName,
          specialty: res.user.specialty || undefined,
          degree: res.user.degree || undefined,
        }, res.token || undefined);
        toast({ title: 'Email verified', description: 'Your account is now active. Welcome!' });
        // Onboarding gap-fix #1: a brand-new member has no profile yet — send
        // them into the setup wizard rather than an empty Matches grid.
        navigate(hasCreatedProfile() ? '/matches' : '/onboarding');
      } else {
        setStatus('error');
        setError(res.error || 'Verification failed. The link may have expired.');
      }
    });
    return () => { cancelled = true; };
  }, [searchParams, signIn, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center">
        {status === 'verifying' ? (
          <>
            <div className="h-8 w-8 mx-auto border-2 border-mediblue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h1 className="text-lg font-bold text-slate-900">Verifying your email…</h1>
            <p className="text-xs text-slate-500 mt-1">One moment while we activate your account.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">Verification failed</h1>
            <p className="text-sm text-slate-600 mt-2">{error}</p>
            <div className="mt-5 space-y-3">
              <Button className="w-full" onClick={() => navigate('/sign-in')}>Go to Sign In</Button>
              <Link to="/sign-up" className="block text-xs text-mediblue-600 hover:underline">Register again</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
