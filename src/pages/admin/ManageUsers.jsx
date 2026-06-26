import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useCreateUser } from '../../hooks/useCreateUser';
import { 
  Users, UserPlus, Search, Edit2, Trash2, 
  X, CheckCircle, AlertTriangle, Loader2, Info, 
  BookOpen, Phone, Hash, Shield, Key, Eye, EyeOff,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ManageUsers({ state, onUpdate, onRefresh }) {
  const [activeTab, setActiveTab] = useState('student');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: '', // empty by default to force selection
    courseId: '',
    admNo: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Hook for Edge Function
  const { createUser, loading: creatingUser } = useCreateUser();
  
  // Loading & error feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Setup Realtime Subscription to update live when lecturer completes password change
  useEffect(() => {
    const channel = supabase
      .channel('profiles-realtime-users-view')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.new && payload.new.role === 'lecturer') {
            console.log('Realtime profile update received for lecturer in ManageUsers:', payload.new);
            if (onRefresh) {
              onRefresh();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);

  // Filter users based on tab and search query
  const filteredUsers = state.profiles.filter((u) => {
    const matchesRole = u.role === activeTab;
    const matchesSearch = u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.adm_no && u.adm_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (u.phone && u.phone.includes(searchQuery));
    return matchesRole && matchesSearch;
  });

  // Open modal for creating a new user
  const handleOpenAddModal = () => {
    setSelectedUser(null);
    setFormData({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      role: '', // default empty to force selection
      courseId: state.courses[0]?.id || '',
      admNo: ''
    });
    setFormError(null);
    setSuccessMsg(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAddEditModalOpen(true);
  };

  // Open modal for editing an existing user
  const handleOpenEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.full_name,
      email: '', // keep blank unless updating
      password: '',
      confirmPassword: '',
      phone: user.phone || '',
      role: user.role,
      courseId: user.course_id || '',
      admNo: user.adm_no || ''
    });
    setFormError(null);
    setSuccessMsg(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAddEditModalOpen(true);
  };

  // Open modal for confirming user deletion
  const handleOpenDeleteModal = (user) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  // Handle Role Selection change inside form
  const handleRoleChange = (newRole) => {
    const defaultCourseId = state.courses[0]?.id || '';
    const acronym = state.courses[0]?.name.substring(0, 3).toUpperCase() || 'ICT';
    
    setFormData(prev => ({
      ...prev,
      role: newRole,
      admNo: newRole === 'student' ? `BTTI/${acronym}/2026/001` : '',
      courseId: newRole === 'student' ? defaultCourseId : ''
    }));
  };

  // Handle Course Selection change inside form
  const handleCourseChange = (selectedCourseId) => {
    const selectedCourse = state.courses.find(c => c.id === selectedCourseId);
    const acronym = selectedCourse?.name.substring(0, 3).toUpperCase() || 'ICT';
    setFormData(prev => ({
      ...prev,
      courseId: selectedCourseId,
      admNo: `BTTI/${acronym}/2026/001`
    }));
  };

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    if (pwd.length < 8) {
      return { label: 'Too short', color: 'text-red-600 bg-red-50 border-red-100' };
    }
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasDigitsOrSymbols = /[\d\W]/.test(pwd);
    if (hasLetters && hasDigitsOrSymbols) {
      return { label: 'Strong', color: 'text-green-600 bg-green-50 border-green-100' };
    }
    return { label: 'Weak — consider stronger', color: 'text-amber-600 bg-amber-50 border-amber-100' };
  };

  // Generate random 12-character password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({
      ...prev,
      password: newPassword,
      confirmPassword: newPassword
    }));
    navigator.clipboard.writeText(newPassword);
    toast.success('Password generated and copied to clipboard');
  };

  // Validate inputs
  const validateForm = () => {
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (!formData.role) return 'Role selection is required.';
    
    if (formData.role === 'student') {
      if (!formData.courseId) return 'Registered course program is required for students.';
      if (!formData.admNo) return 'Admission number is required for students.';
      
      const admRegex = /^BTTI\/[A-Z]{3,5}\/\d{4}\/\d{3}$/;
      if (!admRegex.test(formData.admNo)) {
        return 'Invalid Admission Number format. Format must match: BTTI/[DEPARTMENT]/[YEAR]/[NUMBER] (e.g. BTTI/ICT/2026/015)';
      }

      // Check for duplicate admission numbers
      const isDuplicateAdm = state.profiles.some(
        p => p.adm_no === formData.admNo && (!selectedUser || p.id !== selectedUser.id)
      );
      if (isDuplicateAdm) {
        return 'This Admission Number is already registered to another student profile.';
      }
    }
    return null;
  };

  // Create User Handler
  const handleCreateUser = async () => {
    // Basic common validations
    if (!formData.fullName.trim() || !formData.role) {
      toast.error('Full name and role are required');
      setFormError('Full name and role are required');
      return;
    }

    // Lecturer-specific validation
    if (formData.role === 'lecturer') {
      if (!formData.email || !formData.email.includes('@')) {
        toast.error('A valid email address is required for lecturer accounts');
        setFormError('A valid email address is required for lecturer accounts');
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        toast.error('A temporary password of at least 8 characters is required');
        setFormError('A temporary password of at least 8 characters is required');
        return;
      }
    }

    // Student-specific validation
    if (formData.role === 'student') {
      if (!formData.admNo) {
        toast.error('Admission number is required');
        setFormError('Admission number is required');
        return;
      }
      if (!formData.courseId) {
        toast.error('Course selection is required');
        setFormError('Course selection is required');
        return;
      }
    }

    const { success, error } = await createUser({
      email:    formData.email || `${formData.fullName.toLowerCase().replace(/\s+/g, '')}@btti.ac.ke`, // fallback for students
      password: formData.password || 'BTTIStudent123!', // fallback for students
      fullName: formData.fullName,
      role:     formData.role,
      admNo:    formData.admNo    || null,
      courseId: formData.courseId || null,
      phone:    formData.phone    || null
    });

    if (!success) {
      toast.error(error);
      setFormError(error);
      return; // Modal stays open for admin to correct and retry
    }

    if (formData.role === 'lecturer') {
      toast.success(
        'Lecturer account created. Share the temporary password securely. They will be prompted to change it on first login.',
        { duration: 6000 }
      );
    } else {
      toast.success('Student account pre-registered.');
    }

    setIsAddEditModalOpen(false);
    resetForm();
    if (onRefresh) {
      await onRefresh();
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      role: '',
      courseId: '',
      admNo: ''
    });
    setFormError(null);
    setSuccessMsg(null);
  };

  // Submit Add or Edit User
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      await handleCreateUser();
    } else {
      // Edit mode (profile details only)
      const errorMsg = validateForm();
      if (errorMsg) {
        toast.error(errorMsg);
        setFormError(errorMsg);
        return;
      }

      setActionLoading(true);
      setFormError(null);
      setSuccessMsg(null);

      try {
        const updatedProfile = {
          id: selectedUser.id,
          full_name: formData.fullName.trim(),
          role: formData.role,
          adm_no: formData.role === 'student' ? formData.admNo.trim() : null,
          course_id: formData.role === 'student' ? formData.courseId : null,
          phone: formData.phone.trim(),
          created_at: selectedUser.created_at || new Date().toISOString()
        };

        const newProfiles = state.profiles.map(p => p.id === selectedUser.id ? updatedProfile : p);

        // Sync and update
        await onUpdate({
          ...state,
          profiles: newProfiles
        });

        toast.success('User details updated successfully.');
        setSuccessMsg('User details updated successfully.');
        setTimeout(() => {
          setIsAddEditModalOpen(false);
          setSelectedUser(null);
        }, 1500);

      } catch (err) {
        toast.error(err.message || 'An error occurred while saving user details.');
        setFormError(err.message || 'An error occurred while saving user details.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Submit Delete User
  const handleDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);

    try {
      const newProfiles = state.profiles.filter(p => p.id !== selectedUser.id);
      
      // Sync and update
      await onUpdate({
        ...state,
        profiles: newProfiles
      });

      toast.success('Profile deleted successfully.');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      toast.error('Failed to delete profile: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Registry Directory Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Create, edit, and delete student admission rolls and lecturing staff accounts.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Add New User
        </button>
      </div>

      {/* Tabs and Search Bar Grid */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Tabs switcher */}
        <div className="flex p-1 bg-slate-100 rounded-xl space-x-1 self-start md:self-auto shrink-0">
          <button
            onClick={() => { setActiveTab('student'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'student' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Students Roll
          </button>
          <button
            onClick={() => { setActiveTab('lecturer'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'lecturer' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Lecturers Directory
          </button>
        </div>

        {/* Search Input bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder={activeTab === 'student' ? 'Search by name, admission no...' : 'Search by faculty name or phone...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
          />
        </div>
      </div>

      {/* Main Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                <th className="py-4 px-6 font-bold">Full Name</th>
                {activeTab === 'student' && <th className="py-4 px-6 font-bold">Admission Number</th>}
                <th className="py-4 px-6 font-bold">
                  {activeTab === 'student' ? 'Assigned Program' : 'Faculty Role'}
                </th>
                {activeTab === 'lecturer' && <th className="py-4 px-6 font-bold">Password Status</th>}
                <th className="py-4 px-6 font-bold">Contact Phone</th>
                <th className="py-4 px-6 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const course = state.courses.find(c => c.id === u.course_id);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase ${
                            activeTab === 'student' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {u.full_name.substring(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.full_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">UID: {u.id.substring(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Admission Number Column */}
                      {activeTab === 'student' && (
                        <td className="py-4 px-6 font-mono font-bold text-slate-600">
                          {u.adm_no || 'N/A'}
                        </td>
                      )}

                      {/* Course / Role Column */}
                      <td className="py-4 px-6">
                        {activeTab === 'student' ? (
                          <span className="font-medium text-slate-800 line-clamp-1 max-w-xs" title={course?.name || 'Unassigned'}>
                            {course?.name || 'No Course Registered'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-bold uppercase font-mono">
                            <Shield className="w-3 h-3" /> Senior Faculty
                          </span>
                        )}
                      </td>

                      {/* Password Status Column for Lecturers */}
                      {activeTab === 'lecturer' && (
                        <td className="py-4 px-6">
                          {u.must_change_password ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold">
                              ⚠️ Awaiting first login
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold">
                              ✓ Password set
                            </span>
                          )}
                        </td>
                      )}

                      {/* Contact Phone Column */}
                      <td className="py-4 px-6 font-mono text-slate-500">
                        {u.phone || 'No Phone Registered'}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit profile Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(u)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={activeTab === 'student' ? 5 : 5} className="py-12 text-center text-slate-400 space-y-2">
                    <Info className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-500">No profile matches found</p>
                    <p className="text-[10px] text-slate-400">Try adjusting your filters or add a new record.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD / EDIT USER DIALOG MODAL --- */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsAddEditModalOpen(false)} />
          
          {/* Content Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5 uppercase tracking-wider">
                  {selectedUser ? 'Edit Registry Profile' : 'Register Academic Account'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Ensure metadata matches Butere Technical Training Institute policies.
                </p>
              </div>
              <button 
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Fields Wrapper */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed">{formError}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed">{successMsg}</span>
                  </div>
                )}

                {/* Account Type / Role (Disabled on Edit to avoid data conflict) */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1.5">
                    Account Access Role *
                  </label>
                  <select
                    disabled={!!selectedUser}
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 disabled:opacity-60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all font-bold"
                  >
                    <option value="">-- Select Role --</option>
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                  </select>
                </div>

                {/* Full Name */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amani Kennedy"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                  />
                </div>

                {/* Fields shown ONLY when role = 'lecturer' */}
                {!selectedUser && formData.role === 'lecturer' && (
                  <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-slate-700 text-xs">
                      <p className="font-bold flex items-center gap-1 text-blue-800">
                        📧 SIGN-IN CREDENTIALS
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        The lecturer will use these to access their dashboard. They will be required to change their password on first login.
                      </p>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="lecturer@btti.ac.ke"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                      />
                      <p className="text-[9px] text-slate-400 mt-1">
                        This email will be used to sign in to the lecturer dashboard.
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">
                        Temporary password *
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Min 8 characters"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value, confirmPassword: e.target.value }))}
                            className="w-full pl-3 pr-10 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Generate
                        </button>
                      </div>

                      {/* Amber Info Box */}
                      <div className="p-2.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg text-[10px] mt-2 flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Temporary password:</strong> This is a temporary password. The lecturer will be forced to change it when they first sign in. Share it with them securely.
                        </div>
                      </div>
                      
                      {/* Password strength indicator */}
                      {formData.password && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                          <span className="font-medium text-slate-400">Strength:</span>
                          {(() => {
                            const str = getPasswordStrength(formData.password);
                            return str ? (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${str.color}`}>
                                {str.label}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fields shown ONLY when role = 'student' */}
                {!selectedUser && formData.role === 'student' && (
                  <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                    {/* Course Selector */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block mb-1">
                        Academic Course Program *
                      </label>
                      <select
                        value={formData.courseId}
                        onChange={(e) => handleCourseChange(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                      >
                        <option value="">-- Select Course --</option>
                        {state.courses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Admission Number */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block mb-1 flex justify-between">
                        <span>Admission Number *</span>
                        <span className="text-[9px] text-blue-600 font-semibold lowercase font-sans">BTTI/XXX/YYYY/NNN</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. BTTI/ICT/2026/101"
                          value={formData.admNo}
                          onChange={(e) => setFormData(prev => ({ ...prev, admNo: e.target.value.toUpperCase() }))}
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                        />
                      </div>
                    </div>

                    {/* Optional Student Email */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. student@btti.ac.ke"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Phone Number (shared or optional for either) */}
                {(formData.role === 'student' || formData.role === 'lecturer' || selectedUser) && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1.5">
                      Phone Number {formData.role === 'student' ? '(Optional)' : ''}
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="e.g. +254 700 000000"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="bg-slate-50 border-t border-slate-100 p-5 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser || actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {creatingUser || actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  {creatingUser || actionLoading ? (
                    selectedUser ? 'Saving...' : 'Creating account...'
                  ) : (
                    selectedUser ? 'Save Changes' : 'Create account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider">Confirm Profile Deletion</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you absolutely sure you want to delete <strong className="text-slate-900">{selectedUser.full_name}</strong> from the academic registries?
                </p>
                <p className="text-[10px] text-amber-600 bg-amber-50 p-2 border border-amber-100 rounded-lg leading-relaxed text-left">
                  ⚠️ Deleting this profile will also strip all attendance sheets, marked histories, and instructor/student allocations bound to this profile record. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer"
                >
                  Abort
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Delete Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
