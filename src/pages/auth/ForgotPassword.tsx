import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { School, Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide a registered email address.');
      return;
    }

    setLoading(true);
    setError(null);

    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      // Mock reset offline
      setTimeout(() => {
        setSuccess(true);
        setLoading(false);
      }, 1000);
      return;
    }

    try {
      // Get the current site URL for redirects
      const redirectToUrl = `${window.location.origin}/reset-password`;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectToUrl,
      });

      if (resetErr) throw resetErr;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending the reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
        {/* Branding header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-8 text-center relative">
          <div className="mx-auto w-14 h-14 bg-white text-blue-700 rounded-2xl shadow flex items-center justify-center mb-4">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight">Recover Password</h1>
          <p className="text-xs text-blue-100 font-mono font-medium uppercase tracking-wider mt-1">
            Student & Staff Registry Portal
          </p>
        </div>

        {/* Content area */}
        <div className="p-6 sm:p-8">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-slate-900">Email Dispatched</h2>
                <p className="text-xs text-slate-500 leading-relaxed px-2">
                  A password reset link has been successfully generated and sent to:
                  <span className="block font-bold text-slate-800 font-mono mt-1 bg-slate-50 border border-slate-100 p-2 rounded-lg">{email}</span>
                </p>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Check your spam folder if you do not receive the recovery email within a few minutes.
              </p>
              <div className="pt-4">
                <Link
                  id="return-to-login"
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                >
                  <ArrowLeft className="w-4 h-4" /> Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">Forgot Password?</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Provide your registered email address and we will dispatch a secure link to update your portal password.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-xs text-red-800 flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Account Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="e.g. yourname@buteretti.ac.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <button
                id="reset-password-button"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-blue-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending recovery link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center pt-3 border-t border-slate-100">
                <Link
                  id="cancel-reset-link"
                  to="/login"
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors uppercase tracking-wider"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
