import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { resetPassword } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = searchParams.get('token');
    if (!token) {
      toast({ title: 'Invalid link', description: 'This reset link is invalid or incomplete.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', description: 'Please re-enter your new password.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const res = await resetPassword(token, password);
    setIsLoading(false);
    if (!res.ok) {
      toast({ title: 'Reset failed', description: res.error || 'The link may have expired.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
    void navigate('/sign-in');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 text-center">Reset your password</h1>
        <p className="text-xs text-slate-500 text-center mt-1">Choose a new password for your MedicoMatch account.</p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-1 text-left">
            <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">New Password</Label>
            <Input id="newPassword" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="text-xs h-10 rounded-xl" required />
          </div>
          <div className="space-y-1 text-left">
            <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">Confirm Password</Label>
            <Input id="confirmPassword" type="password" placeholder="Re-enter new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="text-xs h-10 rounded-xl" required />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full h-10 text-xs font-semibold bg-mediblue-600 hover:bg-mediblue-700 text-white rounded-xl">
            {isLoading ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
        <p className="text-xs text-slate-500 text-center mt-4">
          Remembered it?{' '}
          <Link to="/sign-in" className="text-mediblue-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
