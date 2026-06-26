import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState, Profile } from '../../types';
import { saveDatabaseState } from '../../utils/mockDatabase';
import ButereLogo from '../../components/ButereLogo';
import { 
  School, CheckCircle, AlertCircle, Phone, 
  Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, UserCheck 
} from 'lucide-react';

interface StudentSignupProps {
  state: DatabaseState;
  onRefresh?: () => void;
}

export default function StudentSignup({ state, onRefresh }: StudentSignupProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // STEP 1 FIELDS
  const [admissionNo, setAdmissionNo] = useState('');

  // Loaded Profile Data
  const [studentProfile, setStudentProfile] = useState<Profile | null>(null);

  // STEP 2 FIELDS
  const [phone, setPhone] = useState('');

  // STEP 3 FIELDS
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password strength checker
  const getPasswordStrength = () => {
    if (!password) return { label: 'Empty', color: 'bg-slate-200', text: 'text-slate-400', width: 'w-0' };
    if (password.length < 8) return { label: 'Weak (Min 8 characters)', color: 'bg-red-500', text: 'text-red-500', width: 'w-1/3' };
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    
    if (password.length >= 10 && hasNumbers && hasSpecial && hasUpper) {
      return { label: 'Strong (Secure)', color: 'bg-emerald-500', text: 'text-emerald-500', width: 'w-full' };
    }
    return { label: 'Medium', color: 'bg-amber-500', text: 'text-amber-500', width: 'w-2/3' };
  };

  const checkMockRegistry = (admNo: string) => {
    const match = state.profiles.find(
      p => p.role === 'student' && p.adm_no?.toUpperCase() === admNo.toUpperCase()
    );
    if (!match) return 'not_found';
    if (match.auth_linked) {
      return 'taken';
    }
    return 'valid';
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionNo.trim()) {
      setError('Please enter your admission number.');
      return;
    }

    setLoading(true);
    setError(null);
    const cleanAdmNo = admissionNo.trim().toUpperCase();

    // Enforce standard regex on submit
    const admNoRegex = /^BTTI\/[A-Z]{3,5}\/\d{4}\/\d{3}$/;
    if (!admNoRegex.test(cleanAdmNo)) {
      setError('Invalid Admission Number format. Must match BTTI/[DEPT]/YYYY/NNN (e.g., BTTI/ICT/2026/101).');
      setLoading(false);
      return;
    }

    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      // Mock validation offline
      setTimeout(() => {
        const res = checkMockRegistry(cleanAdmNo);
        if (res === 'not_found') {
          setError('Admission number not found. Contact the admin.');
          setLoading(false);
          return;
        } else if (res === 'taken') {
          setError('This admission number is already registered. Try logging in instead.');
          setLoading(false);
          return;
        }

        const match = state.profiles.find(
          p => p.role === 'student' && p.adm_no?.toUpperCase() === cleanAdmNo
        );
        if (match) {
          setStudentProfile(match);
          setPhone(match.phone || '');
          setStep(2);
        }
        setLoading(false);
      }, 800);
      return;
    }

    try {
      // Attempt RPC first
      const { data, error: rpcErr } = await supabase.rpc('validate_student_signup', { p_adm_no: cleanAdmNo });
      
      let validationStatus = data;
      if (rpcErr) {
        console.warn('RPC validate_student_signup not found, falling back to direct select');
        const { data: directProf, error: directErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .eq('adm_no', cleanAdmNo)
          .maybeSingle();

        if (directErr) throw directErr;
        if (!directProf) {
          validationStatus = 'not_found';
        } else if (directProf.auth_linked) {
          validationStatus = 'taken';
        } else {
          validationStatus = 'valid';
          setStudentProfile(directProf);
          setPhone(directProf.phone || '');
          setStep(2);
          setLoading(false);
          return;
        }
      }

      if (validationStatus === 'not_found') {
        setError('Admission number not found. Contact the admin.');
      } else if (validationStatus === 'taken') {
        setError('This admission number is already registered. Try logging in instead.');
      } else if (validationStatus === 'valid') {
        const { data: prof, error: getErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .eq('adm_no', cleanAdmNo)
          .single();

        if (getErr) throw getErr;
        setStudentProfile(prof);
        setPhone(prof.phone || '');
        setStep(2);
      }
    } catch (err: any) {
      setError(err.message || 'A validation error occurred. Please contact registrar.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Please provide a mobile phone number.');
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleRegisterAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password || !confirmPassword) {
      setError('Please fill in all login credential fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      // Mock Local Signup
      setTimeout(() => {
        const studentId = studentProfile?.id || `usr-stud-linked-${Date.now()}`;
        
        // Update local state profiles array
        const updatedProfiles = state.profiles.map(p => {
          if (p.adm_no?.toUpperCase() === studentProfile?.adm_no?.toUpperCase()) {
            return {
              ...p,
              id: studentId,
              phone: phone.trim(),
              auth_linked: true
            };
          }
          return p;
        });

        const nextState = { ...state, profiles: updatedProfiles };
        saveDatabaseState(nextState);

        if (onRefresh) onRefresh();

        setSuccess('Account created! Welcome to Butere TTI Attendance System');
        setLoading(false);
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }, 1000);
      return;
    }

    try {
      // 1. Create supabase auth user
      const { data: signUpData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: studentProfile?.full_name,
            role: 'student',
            adm_no: studentProfile?.adm_no,
            phone: phone.trim()
          }
        }
      });

      if (authErr) throw authErr;

      const newUserId = signUpData.user?.id;
      if (!newUserId) {
        throw new Error('Could not resolve created authentication context.');
      }

      // 2. Link the existing profile to this newly registered auth context
      // SET id = new_auth_user_id, auth_linked = true, phone = phone
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          id: newUserId,
          phone: phone.trim(),
          auth_linked: true
        })
        .eq('adm_no', studentProfile?.adm_no);

      if (updateErr) {
        console.warn('Direct profile update failed, verifying if database trigger handled the linkage...', updateErr);
        
        // If we are connected to a real Supabase, the trigger handles this automatically.
        // Let's check if the profile was successfully linked anyway.
        const { data: checkProf } = await supabase
          .from('profiles')
          .select('id, auth_linked')
          .eq('adm_no', studentProfile?.adm_no)
          .maybeSingle();

        if ((!checkProf || !checkProf.auth_linked || checkProf.id !== newUserId) && updateErr.code !== '42501') {
          console.error('Failed to update profile linkage', updateErr);
          throw new Error('Pre-registered profile lookup linkage failed. Contact register division.');
        }
      }

      if (onRefresh) onRefresh();

      setSuccess('Account created! Welcome to Butere TTI Attendance System');
      setLoading(false);
      setTimeout(() => {
        navigate('/login');
      }, 1800);

    } catch (err: any) {
      setError(err.message || 'An error occurred during student registration.');
      setLoading(false);
    }
  };

  // Find course name for display
  const courseName = state.courses.find(c => c.id === studentProfile?.course_id)?.name || 'Course Program';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
        {/* Banner header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-6 text-center relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 transform rotate-45" />
          
          <div className="mx-auto w-16 h-16 bg-white rounded-xl shadow flex items-center justify-center mb-3 border border-yellow-400 p-0.5">
            <ButereLogo size={56} />
          </div>
          <h1 className="text-lg font-bold uppercase tracking-tight">Butere TTI Student Registration</h1>
          
          {/* Progress Multi-step indicator */}
          <div className="mt-5 flex items-center justify-center gap-2 select-none">
            <span className={`w-2.5 h-2.5 rounded-full ${step >= 1 ? 'bg-amber-400' : 'bg-slate-500'}`} />
            <div className={`h-0.5 w-8 ${step >= 2 ? 'bg-amber-400' : 'bg-slate-600'}`} />
            <span className={`w-2.5 h-2.5 rounded-full ${step >= 2 ? 'bg-amber-400' : 'bg-slate-500'}`} />
            <div className={`h-0.5 w-8 ${step >= 3 ? 'bg-amber-400' : 'bg-slate-600'}`} />
            <span className={`w-2.5 h-2.5 rounded-full ${step >= 3 ? 'bg-amber-400' : 'bg-slate-500'}`} />
          </div>
          <p className="text-[10px] text-blue-200 mt-2 font-mono font-bold uppercase tracking-widest">
            Step {step} of 3: {step === 1 && 'Admission verification'}{step === 2 && 'Identity checks'}{step === 3 && 'Account credentials'}
          </p>
        </div>

        {/* Content body */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-xs text-red-800 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-5 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-bold leading-relaxed">{success}</p>
            </div>
          )}

          {/* STEP 1: Verify Admission Number */}
          {step === 1 && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Official Admission Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BTTI/ICT/2024/001"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-mono font-semibold"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Your admission number must be pre-loaded into the system registry by the administrator before creating your student account.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-blue-400"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Admission Number'}
              </button>
            </form>
          )}

          {/* STEP 2: Confirm Personal Details */}
          {step === 2 && studentProfile && (
            <form onSubmit={handleConfirmDetails} className="space-y-4">
              <div className="space-y-4">
                {/* Full Name Read-Only */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Student Name</span>
                  <p className="text-sm font-black text-slate-800 bg-slate-50 border border-slate-100 p-3 rounded-xl mt-1">
                    {studentProfile.full_name}
                  </p>
                </div>

                {/* Course Name Read-Only */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Assigned Curriculum Program</span>
                  <p className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-100 p-3 rounded-xl mt-1 leading-relaxed">
                    {courseName}
                  </p>
                </div>

                {/* Phone Editable */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Contact Mobile Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +254712345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  Confirm & Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Create Login Credentials */}
          {step === 3 && (
            <form onSubmit={handleRegisterAccount} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Choose Login Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="e.g. student@bttl.ac.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Choose Portal Password
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

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Portal Password
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

              {/* Strength Visual Indicator */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">
                  <span>Password Security:</span>
                  <span className={getPasswordStrength().text}>{getPasswordStrength().label}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength().color} ${getPasswordStrength().width}`} />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer disabled:bg-emerald-400"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserCheck className="w-4 h-4" /> Create Account</>}
                </button>
              </div>
            </form>
          )}

          {/* Login redirection option */}
          <div className="mt-6 text-center border-t border-slate-100 pt-5">
            <span className="text-xs text-slate-400 font-medium">Already registered a portal account? </span>
            <Link
              id="back-to-login"
              to="/login"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase font-mono tracking-wider"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
