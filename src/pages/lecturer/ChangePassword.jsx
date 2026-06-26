import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { LockKeyhole, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';

export default function ChangePassword() {
  const { user, mustChangePassword, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Guard: redirect away if mustChangePassword is false
  useEffect(() => {
    if (mustChangePassword === false) {
      navigate('/lecturer/dashboard', { replace: true });
    }
  }, [mustChangePassword, navigate]);

  // Requirements check
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== '';

  const allRequirementsMet = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  // Strength Indicator
  const getStrength = () => {
    if (!newPassword) return null;
    if (newPassword.length < 8) {
      return { label: 'Too short', color: 'text-red-600 bg-red-50 border-red-100' };
    }
    const mixScore = [hasUppercase, hasLowercase, hasNumber, /[\W_]/.test(newPassword)].filter(Boolean).length;
    if (newPassword.length >= 12 || (newPassword.length >= 8 && mixScore >= 3)) {
      return { label: 'Strong', color: 'text-green-600 bg-green-50 border-green-100' };
    }
    return { label: 'Moderate', color: 'text-amber-600 bg-amber-50 border-amber-100' };
  };

  const strength = getStrength();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!allRequirementsMet) {
      toast.error('Please make sure all password requirements are met.');
      return;
    }

    if (!passwordsMatch) {
      toast.error('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      // Step 3: Update password via Supabase
      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (pwError) {
        toast.error(pwError.message || 'Failed to update password');
        setSubmitting(false);
        return;
      }

      // Step 4: Update must_change_password to false in profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);

      if (profileError) {
        toast.error('Password changed but profile update failed. Please contact admin.');
      }

      // Step 5: Call refreshProfile() to update context
      await refreshProfile();

      // Step 6: Show success toast
      toast.success('Password set successfully. Welcome to Butere TTI!');

      // Step 7: Navigate to /lecturer/dashboard
      navigate('/lecturer/dashboard', { replace: true });

    } catch (err) {
      toast.error(err.message || 'An unexpected error occurred.');
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-linear-to-tr from-blue-700 via-blue-600 to-indigo-800 flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-white/10 p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <LockKeyhole className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Set your password
          </h2>
        </div>

        {/* Info Box */}
        <div className="p-3.5 bg-blue-50/75 border border-blue-100 rounded-2xl text-xs text-slate-700 leading-relaxed mb-6">
          Welcome to Butere TTI Attendance System. Your account was created by the admin with a temporary password. You must set a new personal password before continuing.
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                disabled={submitting}
                placeholder="Choose a strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl text-xs border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Advice text */}
            <p className="text-[10px] text-slate-400 leading-normal">
              Choose a password different from the one given to you by the admin.
            </p>

            {/* Strength indicator */}
            {strength && (
              <div className="flex items-center gap-1.5 text-[10px] pt-1">
                <span className="font-medium text-slate-400">Strength:</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${strength.color}`}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Password Requirements Checklist */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-[11px] text-slate-600">
            <p className="font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-1 font-mono">Password Requirements</p>
            <div className="flex items-center gap-2">
              {hasMinLength ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-red-500" />}
              <span className={hasMinLength ? 'text-green-700 font-medium' : 'text-slate-500'}>At least 8 characters</span>
            </div>
            <div className="flex items-center gap-2">
              {hasUppercase ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-red-500" />}
              <span className={hasUppercase ? 'text-green-700 font-medium' : 'text-slate-500'}>Contains uppercase letter</span>
            </div>
            <div className="flex items-center gap-2">
              {hasLowercase ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-red-500" />}
              <span className={hasLowercase ? 'text-green-700 font-medium' : 'text-slate-500'}>Contains lowercase letter</span>
            </div>
            <div className="flex items-center gap-2">
              {hasNumber ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-red-500" />}
              <span className={hasNumber ? 'text-green-700 font-medium' : 'text-slate-500'}>Contains a number</span>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                disabled={submitting}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full pl-3 pr-10 py-2.5 rounded-xl text-xs border ${
                  confirmPassword && !passwordsMatch ? 'border-red-300 ring-2 ring-red-500/10' : 'border-slate-200'
                } focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all font-mono`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-[10px] text-red-600 font-medium">
                Passwords do not match
              </p>
            )}
          </div>

          {/* Set Password Button */}
          <button
            type="submit"
            disabled={submitting || !allRequirementsMet || !passwordsMatch}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold uppercase tracking-wider rounded-xl text-xs transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Setting password...' : 'Set password'}
          </button>
        </form>

      </div>

      {/* Footer Details */}
      <div className="text-center mt-6 space-y-2 select-none">
        <p className="text-xs text-white/60">
          Having trouble? Contact your administrator.
        </p>
        <button
          onClick={handleSignOut}
          className="text-xs font-bold text-white hover:text-blue-200 uppercase tracking-widest underline underline-offset-4 cursor-pointer transition-all"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
