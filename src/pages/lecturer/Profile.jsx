import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { getInitials } from '../../lib/attendanceHelpers';
import { User, Phone, Mail, Award, Save, RefreshCw, KeyRound } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function LecturerProfile() {
  const { user, profile, refreshProfile } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!fullName.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim()
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Profile updated.');
    } catch (e) {
      toast.error('Failed to update profile: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(profile?.full_name || 'Lecturer');

  return (
    <div className="space-y-6 max-w-lg mx-auto py-4">
      {/* Profile Card Container */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-2xs space-y-6">
        
        {/* Card Header (Avatar + Name + Badge) */}
        <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-gray-50">
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xl shadow-xs border border-blue-200">
            {initials}
          </div>
          <div>
            <h3 className="text-[18px] font-black text-gray-900 tracking-tight leading-tight">
              {profile?.full_name || 'Faculty Lecturer'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">{user?.email}</p>
          </div>
          <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            Lecturer
          </span>
        </div>

        {/* Editable Fields Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name..."
                required
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium text-gray-800 pl-8.5"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +254 712 345678"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium text-gray-800 pl-8.5"
              />
              <Phone className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-1 opacity-75">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full p-2.5 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg cursor-not-allowed pl-8.5"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Profile
              </>
            )}
          </button>
        </form>
      </div>

      {/* Navigation Footer links below Card */}
      <div className="text-center pt-2">
        <Link 
          to="/lecturer/change-password"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          <KeyRound className="w-4 h-4" />
          Change account password
        </Link>
      </div>
    </div>
  );
}
