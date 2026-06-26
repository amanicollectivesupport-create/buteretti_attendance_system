/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { DatabaseState } from '../../types';
import SQLViewer from '../../components/SQLViewer';
import { 
  Database, Trash2, RefreshCw, CheckCircle, AlertTriangle, 
  Terminal, ShieldAlert, FileCode, Check, Clipboard
} from 'lucide-react';

interface DatabaseSettingsProps {
  state: DatabaseState;
  onUpdate: (newState: DatabaseState) => Promise<void>;
}

export default function DatabaseSettings({ state, onUpdate }: DatabaseSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const sqlTeardown = `-- ==========================================
-- 1. TEARDOWN / CLEAR DATABASE TABLES
-- ==========================================
-- Run this block FIRST in Supabase SQL Editor to wipe existing tables and start clean.
-- WARNING: This will permanently delete all attendance logs, users, and course data!

DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.lecturer_units CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.course_units CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- Drop custom database functions and schemas
DROP FUNCTION IF EXISTS public.get_student_attendance_summary CASCADE;
DROP FUNCTION IF EXISTS public.validate_student_signup CASCADE;
DROP FUNCTION IF EXISTS public.handle_profile_auth_linking CASCADE;
DROP FUNCTION IF EXISTS auth.is_admin CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.attendance_status CASCADE;
`;

  const handleCopyTeardown = () => {
    navigator.clipboard.writeText(sqlTeardown);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Reset to empty state
  const handleClearDatabase = async (mode: 'empty' | 'seed') => {
    if (!window.confirm(`Are you sure you want to reset the database to ${mode === 'empty' ? 'a completely blank state' : 'the default seed state'}? This action is irreversible.`)) {
      return;
    }

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      let newState: DatabaseState;

      if (mode === 'empty') {
        // Keeps a basic admin profile so the user doesn't get locked out of local testing
        newState = {
          departments: [],
          courses: [],
          courseUnits: [],
          profiles: [
            { 
              id: 'usr-admin-1', 
              full_name: 'Madam Beatrice Wekesa', 
              role: 'admin', 
              adm_no: null, 
              course_id: null, 
              phone: '+254712345678', 
              created_at: new Date().toISOString() 
            }
          ],
          lecturerUnits: [],
          attendance: []
        };
      } else {
        // Restore initial default seed data
        const depts = [
          { id: 'dept-ict', name: 'Information Communication Technology (ICT)', created_at: new Date().toISOString() },
          { id: 'dept-elec', name: 'Electrical & Electronics Engineering', created_at: new Date().toISOString() },
          { id: 'dept-build', name: 'Building & Civil Engineering', created_at: new Date().toISOString() },
          { id: 'dept-biz', name: 'Business & Management Studies', created_at: new Date().toISOString() },
          { id: 'dept-hosp', name: 'Hospitality & Institutional Management', created_at: new Date().toISOString() }
        ];

        const courses = [
          { id: 'course-dict', name: 'Diploma in Information Communication Technology (DICT)', department_id: 'dept-ict', duration_years: 3, created_at: new Date().toISOString() },
          { id: 'course-cict', name: 'Certificate in Information Communication Technology (CICT)', department_id: 'dept-ict', duration_years: 2, created_at: new Date().toISOString() },
          { id: 'course-deee', name: 'Diploma in Electrical & Electronics Engineering (Power Option)', department_id: 'dept-elec', duration_years: 3, created_at: new Date().toISOString() },
          { id: 'course-cpbs', name: 'Certificate in Plumbing & Building Services', department_id: 'dept-build', duration_years: 2, created_at: new Date().toISOString() }
        ];

        newState = {
          departments: depts,
          courses: courses,
          courseUnits: [
            { id: 'unit-oop', name: 'Object Oriented Programming (Java)', course_id: 'course-dict', year_of_study: 2, semester: 1, created_at: new Date().toISOString() },
            { id: 'unit-dbms', name: 'Database Management Systems (MySQL)', course_id: 'course-dict', year_of_study: 2, semester: 1, created_at: new Date().toISOString() },
            { id: 'unit-epg', name: 'Electrical Power Generation & Transmission', course_id: 'course-deee', year_of_study: 2, semester: 1, created_at: new Date().toISOString() }
          ],
          profiles: [
            { id: 'usr-admin-1', full_name: 'Madam Beatrice Wekesa', role: 'admin', adm_no: null, course_id: null, phone: '+254712345678', created_at: new Date().toISOString() },
            { id: 'usr-lect-omwamba', full_name: 'Dr. Christopher Omwamba', role: 'lecturer', adm_no: null, course_id: null, phone: '+254722998877', created_at: new Date().toISOString() },
            { id: 'usr-stud-kipch', full_name: 'Emmanuel Kipchirchir', role: 'student', adm_no: 'BTTI/ICT/2024/001', course_id: 'course-dict', phone: '+254711223344', created_at: new Date().toISOString() }
          ],
          lecturerUnits: [
            { id: 'alloc-1', lecturer_id: 'usr-lect-omwamba', unit_id: 'unit-oop', academic_year: '2025/2026', semester: 'Year 2 Sem 1' }
          ],
          attendance: []
        };
      }

      await onUpdate(newState);

      // If connected to a live Supabase database, tell them how to do it there too
      if (isSupabaseReal()) {
        setSuccessMsg(
          `Local Storage and registry cache have been successfully cleared and set to ${
            mode === 'empty' ? 'blank slate' : 'fresh seed values'
          }. To wipe your remote Supabase database too, please run the Teardown SQL and Re-create tables below in the Supabase SQL Editor.`
        );
      } else {
        setSuccessMsg(`Local sandbox database reset successfully to ${mode === 'empty' ? 'blank slate' : 'default seed values'}!`);
      }
    } catch (err: any) {
      setErrorMsg(`An error occurred while resetting the database: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Upper Headers */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Database className="w-6 h-6 text-red-600" />
          Database Management & Sandbox Panel
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Perform administrative database resets, clean cache files, and extract Supabase creation and teardown scripts.
        </p>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Database Action Executed Successfully</p>
            <p className="leading-relaxed font-medium">{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">Execution Failed</p>
            <p className="leading-relaxed mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Quick Action Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Wipe / Reset Options */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950">Wipe and Reset Local Workspace</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                Quickly clear the browser cache and local storage keys. This instantly resets your offline testing environment.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] leading-relaxed font-medium">
              <strong>Precaution:</strong> Clearing the local database removes student pre-registrations and attendance records in sandbox mode. This is useful for restarting demo flows.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              id="btn-wipe-empty"
              disabled={loading}
              onClick={() => handleClearDatabase('empty')}
              className="flex-1 py-2.5 px-4 bg-slate-950 hover:bg-slate-900 active:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" /> Wipe Blank Slate
            </button>
            <button
              id="btn-wipe-reseed"
              disabled={loading}
              onClick={() => handleClearDatabase('seed')}
              className="flex-1 py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white border border-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-200" /> Reseed Default Data
            </button>
          </div>
        </div>

        {/* Card 2: Supabase Reset Instructions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950">How to Clear Real Supabase DB</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                If you have connected your real Supabase project, you cannot drop tables directly from the frontend due to security restrictions. Follow these steps to wipe:
              </p>
            </div>
          </div>

          <ol className="text-[11px] text-slate-600 space-y-2 list-decimal pl-4 font-medium">
            <li>
              Copy the <strong className="text-red-700">Teardown SQL</strong> query below.
            </li>
            <li>
              Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">Supabase Dashboard</a> and open the <strong>SQL Editor</strong>.
            </li>
            <li>
              Paste and run the Teardown SQL to clear all tables and types.
            </li>
            <li>
              Copy the complete <strong>DDL Schema</strong> and <strong>RLS Policies</strong> using the generator below and run them to rebuild clean tables!
            </li>
          </ol>
        </div>
      </div>

      {/* SQL Block: Teardown SQL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-red-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-red-200">Supabase Teardown / Clear Script</h3>
          </div>
          <button
            id="copy-teardown-sql-btn"
            onClick={handleCopyTeardown}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-200 bg-red-950/40 hover:bg-red-950 border border-red-900/40 rounded-lg transition-colors font-semibold cursor-pointer"
          >
            {copiedText ? (
              <>
                <Check className="w-3.5 h-3.5" /> Copied!
              </>
            ) : (
              <>
                <Clipboard className="w-3.5 h-3.5" /> Copy Teardown SQL
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto max-h-64 border-t border-slate-800">
          <pre className="whitespace-pre">{sqlTeardown}</pre>
        </div>
      </div>

      {/* Embedded Complete Schema SQL Builder */}
      <SQLViewer />
    </div>
  );
}
