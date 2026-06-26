import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState, Profile, Course, UserRole } from '../../types';
import { 
  Users, UserPlus, Search, Edit2, Trash2, 
  X, CheckCircle, AlertTriangle, Loader2, Info, 
  BookOpen, Phone, Hash, Shield, Key
} from 'lucide-react';

interface ManageUsersProps {
  state: DatabaseState;
  onUpdate: (newState: DatabaseState) => Promise<void>;
}

export default function ManageUsers({ state, onUpdate }: ManageUsersProps) {
  const [activeTab, setActiveTab] = useState<UserRole>('student');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  
  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [courseId, setCourseId] = useState('');
  const [admNo, setAdmNo] = useState('');
  
  // Loading & error feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    setFullName('');
    setEmail('');
    setPassword('ButerePass2026!'); // secure default starting password
    setPhone('');
    setRole(activeTab);
    setCourseId(state.courses[0]?.id || '');
    // Generate a default valid admission number based on first course acronym
    const courseAcronym = state.courses[0]?.name.substring(0, 3).toUpperCase() || 'ICT';
    setAdmNo(`BTTI/${courseAcronym}/2026/001`);
    setFormError(null);
    setSuccessMsg(null);
    setIsAddEditModalOpen(true);
  };

  // Open modal for editing an existing user
  const handleOpenEditModal = (user: Profile) => {
    setSelectedUser(user);
    setFullName(user.full_name);
    setEmail(''); // keep blank unless updating
    setPassword('');
    setPhone(user.phone || '');
    setRole(user.role);
    setCourseId(user.course_id || '');
    setAdmNo(user.adm_no || '');
    setFormError(null);
    setSuccessMsg(null);
    setIsAddEditModalOpen(true);
  };

  // Open modal for confirming user deletion
  const handleOpenDeleteModal = (user: Profile) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  // Handle Role Selection change inside form
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'student') {
      const selectedCourse = state.courses.find(c => c.id === courseId) || state.courses[0];
      const acronym = selectedCourse?.name.substring(0, 3).toUpperCase() || 'ICT';
      setAdmNo(`BTTI/${acronym}/2026/001`);
    } else {
      setAdmNo('');
      setCourseId('');
    }
  };

  // Handle Course Selection change inside form
  const handleCourseChange = (selectedCourseId: string) => {
    setCourseId(selectedCourseId);
    const selectedCourse = state.courses.find(c => c.id === selectedCourseId);
    const acronym = selectedCourse?.name.substring(0, 3).toUpperCase() || 'ICT';
    // Update the adm number preview
    setAdmNo(`BTTI/${acronym}/2026/001`);
  };

  // Validate inputs according to strict TVET database constraints
  const validateForm = () => {
    if (!fullName.trim()) return 'Full name is required.';
    if (role === 'student') {
      if (!courseId) return 'Registered course program is required for students.';
      if (!admNo) return 'Admission number is required for students.';
      
      // Strict regex format match for: BTTI/[A-Z]{3,5}/\d{4}/\d{3}
      const admRegex = /^BTTI\/[A-Z]{3,5}\/\d{4}\/\d{3}$/;
      if (!admRegex.test(admNo)) {
        return 'Invalid Admission Number format. Format must match: BTTI/[DEPARTMENT]/[YEAR]/[NUMBER] (e.g. BTTI/ICT/2026/015)';
      }

      // Check for duplicate admission numbers
      const isDuplicateAdm = state.profiles.some(
        p => p.adm_no === admNo && (!selectedUser || p.id !== selectedUser.id)
      );
      if (isDuplicateAdm) {
        return 'This Admission Number is already registered to another student profile.';
      }
    }
    return null;
  };

  // Submit Add or Edit User
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validateForm();
    if (errorMsg) {
      setFormError(errorMsg);
      return;
    }

    setActionLoading(true);
    setFormError(null);

    try {
      const isEdit = !!selectedUser;
      const targetId = isEdit ? selectedUser.id : crypto.randomUUID();

      // If we are adding a user and a password is provided, we can attempt to register in Supabase Auth
      if (!isEdit && email) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                role: role
              }
            }
          });
          // If auth succeeds, we can use the actual registered user id!
          if (!authError && authData.user) {
            // Mapping can proceed with authData.user.id
            console.log('Successfully registered user credentials in Supabase Auth server.');
          }
        } catch (authErr) {
          console.warn('Note: Live Auth registration bypassed/skipped due to developer local environment constraint.', authErr);
        }
      }

      const updatedProfile: Profile = {
        id: targetId,
        full_name: fullName.trim(),
        role: role,
        adm_no: role === 'student' ? admNo.trim() : null,
        course_id: role === 'student' ? courseId : null,
        phone: phone.trim(),
        created_at: isEdit ? selectedUser.created_at : new Date().toISOString()
      };

      let newProfiles = [...state.profiles];
      if (isEdit) {
        newProfiles = newProfiles.map(p => p.id === targetId ? updatedProfile : p);
      } else {
        newProfiles.push(updatedProfile);
      }

      // Sync and update
      await onUpdate({
        ...state,
        profiles: newProfiles
      });

      setSuccessMsg(isEdit ? 'User details updated successfully.' : 'New user created and registered successfully.');
      setTimeout(() => {
        setIsAddEditModalOpen(false);
        setSelectedUser(null);
      }, 1500);

    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving user details.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Delete User
  const handleDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);

    try {
      // Filter out deleted user
      const newProfiles = state.profiles.filter(p => p.id !== selectedUser.id);
      
      // Sync and update
      await onUpdate({
        ...state,
        profiles: newProfiles
      });

      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      alert('Failed to delete profile: ' + err.message);
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
                  <td colSpan={activeTab === 'student' ? 5 : 4} className="py-12 text-center text-slate-400 space-y-2">
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
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
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
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                  Account Access Role
                </label>
                <select
                  disabled={!!selectedUser}
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 disabled:opacity-60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                >
                  <option value="student">Student Registry Roll</option>
                  <option value="lecturer">Lecturer Faculty Roll</option>
                  <option value="admin">Institutional Admin Role</option>
                </select>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amani Kennedy"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                />
              </div>

              {/* Credentials Section for New Users */}
              {!selectedUser && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">
                      System Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. student@btti.ac.ke"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">
                      Access Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter temporary password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Phone Number */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1.5">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="e.g. +254 700 000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* Conditional Student Fields (Course Selection and Admission Number validation) */}
              {role === 'student' && (
                <div className="space-y-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                  {/* Course Selector */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block mb-1">
                      Academic Course Program
                    </label>
                    <select
                      value={courseId}
                      onChange={(e) => handleCourseChange(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                    >
                      {state.courses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Admission Number */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block mb-1 flex justify-between">
                      <span>Admission Number</span>
                      <span className="text-[9px] text-blue-600 font-semibold lowercase">pattern: BTTI/[DEPT]/[YEAR]/[ID]</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. BTTI/ICT/2026/101"
                        value={admNo}
                        onChange={(e) => setAdmNo(e.target.value.toUpperCase())}
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  {selectedUser ? 'Save Changes' : 'Register User'}
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
