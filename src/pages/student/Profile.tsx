import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { DatabaseState } from '../../types';
import { User, Mail, Phone, BookOpen, GraduationCap, School, ShieldAlert } from 'lucide-react';

interface ProfileProps {
  state: DatabaseState;
}

export default function Profile({ state }: ProfileProps) {
  const { user, profile } = useAuth();

  // Find enrolled course
  const enrolledCourse = state.courses.find(c => c.id === profile?.course_id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-blue-600" />
          My Student Account
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review your official academic enrollment details, status, and system attributes.
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 h-32 px-6 flex items-end pb-4">
          <div className="flex items-center gap-4 translate-y-8">
            <div className="w-20 h-20 bg-white p-1 rounded-2xl shadow-md border-2 border-slate-100 flex items-center justify-center">
              <div className="w-full h-full bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center font-black text-2xl uppercase">
                {profile?.full_name?.substring(0, 2) || 'ST'}
              </div>
            </div>
            <div className="pb-1">
              <h3 className="text-lg font-black text-slate-900 drop-shadow-sm">{profile?.full_name || 'Student Scholar'}</h3>
              <p className="text-xs text-slate-500 font-medium font-mono">{profile?.adm_no || 'No Admission Number'}</p>
            </div>
          </div>
        </div>

        {/* Content Details */}
        <div className="pt-12 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
            {/* Admission Number */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Admission Registry Number</span>
              <div className="flex items-center gap-2 text-slate-800 font-mono font-bold text-sm">
                <School className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{profile?.adm_no || 'Not Set'}</span>
              </div>
            </div>

            {/* Registered Course Program */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Enrolled Course Program</span>
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs truncate">
                <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">{enrolledCourse?.name || 'Unassigned Syllabus'}</span>
              </div>
            </div>

            {/* Email Address */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Official Email Address</span>
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs font-mono truncate">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">{user?.email || 'No email registered'}</span>
              </div>
            </div>

            {/* Phone Number */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Mobile Contact Number</span>
              <div className="flex items-center gap-2 text-slate-800 font-mono font-bold text-xs">
                <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{profile?.phone || 'No contact provided'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50/50 border border-blue-100 text-blue-800 rounded-2xl text-[11px] leading-relaxed flex items-start gap-2.5">
            <ShieldAlert className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block uppercase font-mono text-[10px] tracking-wider mb-0.5">Administrative Note</strong>
              For profile modifications, course changes, or corrections to registration details, kindly contact the registrar at the academic registry center.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
