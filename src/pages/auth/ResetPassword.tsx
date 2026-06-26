import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { School, Lock, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Validate the reset state link on mount
  useEffect(() => {
    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    if (!isSupabaseConfigured) return;

    // Check if we have hash recovery params
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Supabase is handling the recovery link session automatically
      console.log('Recovery session detected.');
    }
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      // Mock update offline
      setTimeout(() => {
        setSuccess(true);
        setLoading(false);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }, 1000);
      return;
    }

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateErr) throw updateErr;

      setSuccess(true);
      setLoading(false);
      
      setTimeout(() => {
        navigate('/login');
      }, 2200);

    } catch (err: any) {
      setError(err.message || 'Could not update your password. The link may have expired.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
        {/* Branding Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-8 text-center relative">
          <div className="mx-auto w-14 h-14 bg-white text-blue-700 rounded-2xl shadow flex items-center justify-center mb-4">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight font-sans">Set New Password</h1>
          <p className="text-xs text-blue-100 font-mono font-medium uppercase tracking-wider mt-1">
            Secure Password Update
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">Password Updated!</h2>
                <p className="text-xs text-slate-500 leading-relaxed px-4">
                  Your portal credential update was successful. Redirecting you to the sign-in portal...
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest font-mono">
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating view...
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900">Define Credentials</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your new password below. Ensure it is at least 8 characters and contains numbers/letters.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-xs text-red-800 flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              {/* Password field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Repeat New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-mono"
                  />
                </div>
              </div>

              <button
                id="update-password-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-blue-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating credentials...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
