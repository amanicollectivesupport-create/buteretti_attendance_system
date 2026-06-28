import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import ButereLogo from '../../components/ButereLogo';
import { School, Lock, Mail, AlertCircle, Eye, EyeOff, Loader2, ArrowRight, Info } from 'lucide-react';

export default function Login() {
  const { user, role, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in and role resolved
  useEffect(() => {
    if (!authLoading && user && role) {
      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'lecturer') {
        navigate('/lecturer/dashboard', { replace: true });
      } else if (role === 'student') {
        navigate('/student/attendance', { replace: true });
      }
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        const errMsg = authError.message.toLowerCase();
        if (errMsg.includes('failed to fetch') || errMsg.includes('networkerror') || errMsg.includes('fetch')) {
          if (isSupabaseReal()) {
            localStorage.setItem('force_demo_mode', 'true');
            setError('Database connection offline. Automatically switching to interactive Demo Mode fallback...');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
            return;
          }
        }
        if (errMsg.includes('invalid grant') || errMsg.includes('invalid login') || errMsg.includes('credentials')) {
          setError('Incorrect email or password. Please try again.');
        } else if (errMsg.includes('email not confirmed') || errMsg.includes('confirm')) {
          setError('Please verify your email before signing in.');
        } else {
          setError('Sign in failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Fetch profile to read role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profileData) {
          const profileErrMsg = profileError?.message?.toLowerCase() || '';
          if (profileErrMsg.includes('failed to fetch') || profileErrMsg.includes('networkerror') || profileErrMsg.includes('fetch')) {
            if (isSupabaseReal()) {
              localStorage.setItem('force_demo_mode', 'true');
              setError('Database connection offline. Automatically switching to interactive Demo Mode fallback...');
              setTimeout(() => {
                window.location.reload();
              }, 1500);
              return;
            }
          }
          setError('Account not found. Contact system administrator.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        const userRole = profileData.role;
        if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (userRole === 'lecturer') {
          navigate('/lecturer/dashboard', { replace: true });
        } else if (userRole === 'student') {
          navigate('/student/attendance', { replace: true });
        } else {
          navigate('/unauthorized', { replace: true });
        }
      }
    } catch (err: any) {
      const errMsg = (err?.message || String(err)).toLowerCase();
      if (errMsg.includes('failed to fetch') || errMsg.includes('networkerror') || errMsg.includes('fetch')) {
        if (isSupabaseReal()) {
          localStorage.setItem('force_demo_mode', 'true');
          setError('Database connection offline. Automatically switching to interactive Demo Mode fallback...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }
      }
      setError(err?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If already logged in and role check is in progress, show full page loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider font-mono mt-4">
          Loading Academic Portal...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Branding Banner */}
        <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white px-6 py-8 text-center relative border-b-4 border-yellow-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 transform rotate-45" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full -ml-4 -mb-4" />
          
          <div className="mx-auto w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4 border-2 border-yellow-400 p-1">
            <ButereLogo size={80} />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase">Butere TTI</h1>
          <p className="text-xs text-yellow-300 font-semibold tracking-wider uppercase font-mono mt-1">
            Attendance Management System
          </p>
        </div>

        {/* Login Form Body */}
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-950">Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your official academic email credentials to access your portal.
            </p>
          </div>

          {/* Interactive Demo Mode Help Panel */}
          {!isSupabaseReal() && (
            <div className="mb-5 p-4 bg-blue-50/80 border-l-4 border-blue-600 rounded-r-xl text-xs text-blue-900">
              <div className="flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-xs text-blue-950">Interactive Demo Mode Active</span>
                  <p className="mt-1 leading-relaxed text-blue-800">
                    Click any pre-registered account to autofill:
                  </p>
                  
                  <div className="mt-2.5 grid grid-cols-1 gap-1 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => { setEmail('admin1@bttl.ac.ke'); setPassword('Admin@1234'); }}
                      className="text-left px-2 py-1.5 bg-white hover:bg-slate-50 rounded-lg border border-blue-100 text-blue-900 transition-all flex justify-between items-center cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">Admin (Madam Beatrice)</span>
                        <span className="text-[9px] text-slate-500 font-sans">admin1@bttl.ac.ke</span>
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Autofill</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEmail('omwamba@buteretti.ac.ke'); setPassword('omwamba123'); }}
                      className="text-left px-2 py-1.5 bg-white hover:bg-slate-50 rounded-lg border border-blue-100 text-blue-900 transition-all flex justify-between items-center cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">Lecturer (Dr. Omwamba)</span>
                        <span className="text-[9px] text-slate-500 font-sans">omwamba@buteretti.ac.ke</span>
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Autofill</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEmail('kipch@buteretti.ac.ke'); setPassword('kipch123'); }}
                      className="text-left px-2 py-1.5 bg-white hover:bg-slate-50 rounded-lg border border-blue-100 text-blue-900 transition-all flex justify-between items-center cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">Student (Kipchirchir)</span>
                        <span className="text-[9px] text-slate-500 font-sans">kipch@buteretti.ac.ke</span>
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Autofill</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-xs text-red-800 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Sign-in Failed</span>
                <span className="mt-1 block leading-relaxed">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email-address" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Official Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  id="email-address"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@bttl.ac.ke"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password-field" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link to="/forgot-password" id="forgot-password-link" className="text-[11px] text-emerald-700 hover:underline cursor-pointer font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  id="password-field"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white transition-all text-slate-800"
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

            {/* Submit Button */}
            <button
              id="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:bg-emerald-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Student Signup Prompt */}
          <div className="mt-6 text-center border-t border-slate-100 pt-5">
            <Link
              id="signup-link"
              to="/signup"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors uppercase tracking-wider"
            >
              Student? Create account →
            </Link>
          </div>
        </div>

        {/* Footer Area */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 text-center">
          <p className="text-[10px] text-slate-400 font-mono">
            Butere Technical Training Institute Attendance Portal
          </p>
          <p className="text-[9px] text-slate-400 mt-0.5 font-medium text-slate-400">
            TVET ISO 9001:2015 Certified Institution
          </p>
        </div>
      </div>
    </div>
  );
}
