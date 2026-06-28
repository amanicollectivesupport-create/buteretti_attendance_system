/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/auth/Login';
import StudentSignup from './pages/auth/StudentSignup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Unauthorized from './pages/auth/Unauthorized';
import PreRegisterStudents from './pages/admin/PreRegisterStudents';
import AdminReports from './pages/admin/Reports';
import DatabaseSettings from './pages/admin/DatabaseSettings';
import AdminDashboard from './components/AdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import SQLViewer from './components/SQLViewer';
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboardView from './pages/admin/Dashboard';
import ManageUsersView from './pages/admin/ManageUsers';
import AssignLecturerUnitsView from './pages/admin/AssignLecturerUnits';
import LecturerLayout from './components/layout/LecturerLayout';
import LecturerDashboard from './pages/lecturer/Dashboard';
import MarkAttendance from './pages/lecturer/MarkAttendance';
import MyUnits from './pages/lecturer/MyUnits';
import MyStudents from './pages/lecturer/MyStudents';
import LecturerProfile from './pages/lecturer/Profile';
import CorrectionRequests from './pages/lecturer/CorrectionRequests';
import ChangePassword from './pages/lecturer/ChangePassword';
import StudentLayout from './components/layout/StudentLayout';
import MyAttendance from './pages/student/MyAttendance';
import CorrectionRequestsAdmin from './pages/admin/CorrectionRequestsAdmin';
import Courses from './pages/admin/Courses';
import AdminSettings from './pages/admin/Settings';
import Profile from './pages/student/Profile';
import Dashboard from './pages/student/Dashboard';
import Timetable from './pages/student/Timetable';
import Settings from './pages/student/Settings';
import ButereLogo from './components/ButereLogo';
import Landing from './pages/Landing';
import { getDatabaseState, saveDatabaseState } from './utils/mockDatabase';
import { DatabaseState } from './types';
import { supabase, isSupabaseReal } from './lib/supabaseClient';
import { 
  School, Shield, User, Database, Code2, LogOut, Key, Info, HelpCircle, 
  Loader2, Users, FileText, LayoutDashboard, BookmarkCheck, ServerCrash, UserCheck
} from 'lucide-react';

// Get a stable UUID from standard local state ID to map safely to Supabase
const getStableUUID = (id: string): string => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  
  let cached = localStorage.getItem(`uuid_map_${id}`);
  if (cached) return cached;
  const newUuid = crypto.randomUUID();
  localStorage.setItem(`uuid_map_${id}`, newUuid);
  return newUuid;
};

// Main routing and state management app
function AppContent() {
  const { user, profile, role, loading: authLoading } = useAuth();
  const [dbState, setDbState] = useState<DatabaseState>(getDatabaseState());
  const [dbLoading, setDbLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Sync state back to localStorage & background-sync to Supabase
  const handleUpdateDatabase = async (newState: DatabaseState) => {
    const oldState = dbState;
    setDbState(newState);
    saveDatabaseState(newState);

    // If connected to Supabase and user is authenticated
    if (user && isSupabaseReal()) {
      setSyncing(true);
      try {
        await syncStateWithSupabase(oldState, newState);
      } catch (err) {
        console.error('Failed background sync to Supabase:', err);
      } finally {
        setSyncing(false);
      }
    }
  };

  // Sync actions to Supabase Postgres Engine
  const syncStateWithSupabase = async (oldState: DatabaseState, newState: DatabaseState) => {
    // 1. Sync departments
    const addedDepts = newState.departments.filter(n => !oldState.departments.some(o => o.id === n.id));
    for (const d of addedDepts) {
      await supabase.from('departments').insert({
        id: getStableUUID(d.id),
        name: d.name,
        created_at: d.created_at
      });
    }
    const removedDepts = oldState.departments.filter(o => !newState.departments.some(n => n.id === o.id));
    for (const d of removedDepts) {
      await supabase.from('departments').delete().eq('id', getStableUUID(d.id));
    }

    // 2. Sync courses
    const addedCourses = newState.courses.filter(n => !oldState.courses.some(o => o.id === n.id));
    for (const c of addedCourses) {
      await supabase.from('courses').insert({
        id: getStableUUID(c.id),
        name: c.name,
        department_id: getStableUUID(c.department_id),
        duration_years: c.duration_years,
        created_at: c.created_at
      });
    }
    const removedCourses = oldState.courses.filter(o => !newState.courses.some(n => n.id === o.id));
    for (const c of removedCourses) {
      await supabase.from('courses').delete().eq('id', getStableUUID(c.id));
    }

    // 3. Sync course units
    const addedUnits = newState.courseUnits.filter(n => !oldState.courseUnits.some(o => o.id === n.id));
    for (const u of addedUnits) {
      await supabase.from('course_units').insert({
        id: getStableUUID(u.id),
        name: u.name,
        course_id: getStableUUID(u.course_id),
        year_of_study: u.year_of_study,
        semester: u.semester,
        created_at: u.created_at
      });
    }
    const removedUnits = oldState.courseUnits.filter(o => !newState.courseUnits.some(n => n.id === o.id));
    for (const u of removedUnits) {
      await supabase.from('course_units').delete().eq('id', getStableUUID(u.id));
    }

    // 4. Sync profiles
    const addedProfiles = newState.profiles.filter(n => !oldState.profiles.some(o => o.id === n.id));
    for (const p of addedProfiles) {
      await supabase.from('profiles').insert({
        id: getStableUUID(p.id),
        full_name: p.full_name,
        role: p.role,
        adm_no: p.adm_no,
        course_id: p.course_id ? getStableUUID(p.course_id) : null,
        phone: p.phone,
        created_at: p.created_at
      });
    }
    const removedProfiles = oldState.profiles.filter(o => !newState.profiles.some(n => n.id === o.id));
    for (const p of removedProfiles) {
      await supabase.from('profiles').delete().eq('id', getStableUUID(p.id));
    }

    // 5. Sync allocations
    const addedAllocs = newState.lecturerUnits.filter(n => !oldState.lecturerUnits.some(o => o.id === n.id));
    for (const lu of addedAllocs) {
      await supabase.from('lecturer_units').insert({
        id: getStableUUID(lu.id),
        lecturer_id: getStableUUID(lu.lecturer_id),
        unit_id: getStableUUID(lu.unit_id),
        academic_year: lu.academic_year,
        semester: lu.semester
      });
    }
    const removedAllocs = oldState.lecturerUnits.filter(o => !newState.lecturerUnits.some(n => n.id === o.id));
    for (const lu of removedAllocs) {
      await supabase.from('lecturer_units').delete().eq('id', getStableUUID(lu.id));
    }

    // 6. Sync attendance records (upsert and delete)
    const attendanceDiff = newState.attendance.filter(n => {
      const oldRec = oldState.attendance.find(o => o.id === n.id);
      return !oldRec || oldRec.status !== n.status || oldRec.date !== n.date;
    });

    for (const r of attendanceDiff) {
      await supabase.from('attendance').upsert({
        id: getStableUUID(r.id),
        student_id: getStableUUID(r.student_id),
        unit_id: getStableUUID(r.unit_id),
        lecturer_id: r.lecturer_id ? getStableUUID(r.lecturer_id) : null,
        date: r.date,
        status: r.status,
        marked_at: r.marked_at,
        academic_year: r.academic_year,
        semester: r.semester
      });
    }

    const removedAttendance = oldState.attendance.filter(o => !newState.attendance.some(n => n.id === o.id));
    for (const r of removedAttendance) {
      await supabase.from('attendance').delete().eq('id', getStableUUID(r.id));
    }
  };

  // Seed Supabase if empty (helps developer easily bootstrap real table data)
  const seedSupabaseIfEmpty = async () => {
    try {
      const { data, error } = await supabase.from('departments').select('id').limit(1);
      if (!error && (!data || data.length === 0)) {
        console.log('Supabase tables appear empty. Seeding with high-quality TVET academic structure...');
        const initial = getDatabaseState();
        
        // Departments
        for (const d of initial.departments) {
          await supabase.from('departments').upsert({ id: getStableUUID(d.id), name: d.name, created_at: d.created_at });
        }
        // Courses
        for (const c of initial.courses) {
          await supabase.from('courses').upsert({ id: getStableUUID(c.id), name: c.name, department_id: getStableUUID(c.department_id), duration_years: c.duration_years, created_at: c.created_at });
        }
        // Units
        for (const u of initial.courseUnits) {
          await supabase.from('course_units').upsert({ id: getStableUUID(u.id), name: u.name, course_id: getStableUUID(u.course_id), year_of_study: u.year_of_study, semester: u.semester, created_at: u.created_at });
        }
        // Profiles
        for (const p of initial.profiles) {
          try {
            await supabase.from('profiles').upsert({ id: getStableUUID(p.id), full_name: p.full_name, role: p.role, adm_no: p.adm_no, course_id: p.course_id ? getStableUUID(p.course_id) : null, phone: p.phone, created_at: p.created_at });
          } catch (e) {}
        }
        // Allocations
        for (const lu of initial.lecturerUnits) {
          try {
            await supabase.from('lecturer_units').upsert({ id: getStableUUID(lu.id), lecturer_id: getStableUUID(lu.lecturer_id), unit_id: getStableUUID(lu.unit_id), academic_year: lu.academic_year, semester: lu.semester });
          } catch (e) {}
        }
        // Attendance
        for (const r of initial.attendance) {
          try {
            await supabase.from('attendance').upsert({ id: getStableUUID(r.id), student_id: getStableUUID(r.student_id), unit_id: getStableUUID(r.unit_id), lecturer_id: r.lecturer_id ? getStableUUID(r.lecturer_id) : null, date: r.date, status: r.status, marked_at: r.marked_at, academic_year: r.academic_year, semester: r.semester });
          } catch (e) {}
        }
        console.log('Seeding finished successfully.');
      }
    } catch (err) {
      console.warn('Unable to auto-seed Supabase database:', err);
    }
  };

  // Load state from real Supabase Postgres Instance
  const loadStateFromSupabase = async () => {
    if (!isSupabaseReal()) return;
    setDbLoading(true);
    try {
      await seedSupabaseIfEmpty();

      const [
        { data: depts, error: deptsErr },
        { data: courses, error: coursesErr },
        { data: units, error: unitsErr },
        { data: profs, error: profsErr },
        { data: allocs, error: allocsErr },
        { data: atts, error: attsErr }
      ] = await Promise.all([
        supabase.from('departments').select('*'),
        supabase.from('courses').select('*'),
        supabase.from('course_units').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('lecturer_units').select('*'),
        supabase.from('attendance').select('*')
      ]);

      if (deptsErr || coursesErr || unitsErr || profsErr || allocsErr || attsErr) {
        console.warn('Some tables could not be loaded from Supabase. Falling back to local data.');
        return;
      }

      // Convert back to local structure (mapping Supabase snake_case tables correctly)
      const mappedState: DatabaseState = {
        departments: depts || [],
        courses: courses || [],
        courseUnits: (units || []).map(u => ({
          id: u.id,
          name: u.name,
          course_id: u.course_id,
          year_of_study: u.year_of_study,
          semester: u.semester,
          created_at: u.created_at
        })),
        profiles: profs || [],
        lecturerUnits: (allocs || []).map(a => ({
          id: a.id,
          lecturer_id: a.lecturer_id,
          unit_id: a.unit_id,
          academic_year: a.academic_year,
          semester: a.semester
        })),
        attendance: (atts || []).map(att => ({
          id: att.id,
          student_id: att.student_id,
          unit_id: att.unit_id,
          lecturer_id: att.lecturer_id,
          date: att.date,
          status: att.status,
          marked_at: att.marked_at,
          academic_year: att.academic_year,
          semester: att.semester
        }))
      };

      setDbState(mappedState);
      saveDatabaseState(mappedState);
    } catch (err: any) {
      console.error('Error synchronizing from Supabase:', err);
      const errMsg = err?.message || String(err);
      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror') || errMsg.toLowerCase().includes('fetch')) {
        if (isSupabaseReal()) {
          localStorage.setItem('force_demo_mode', 'true');
          toast.error('Database sync offline. Automatically switching to interactive Demo Mode fallback...', { duration: 5000 });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }
      }
    } finally {
      setDbLoading(false);
    }
  };

  // Reload database state when user authenticates
  useEffect(() => {
    if (user) {
      loadStateFromSupabase();
    }
  }, [user]);

  if (authLoading || dbLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-800 animate-spin" />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono mt-4">
          Synchronizing Registry Database...
        </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<StudentSignup state={dbState} onRefresh={loadStateFromSupabase} />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Admin Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardView state={dbState} />} />
        <Route path="users" element={<ManageUsersView state={dbState} onUpdate={handleUpdateDatabase} onRefresh={loadStateFromSupabase} />} />
        <Route path="pre-register" element={<PreRegisterStudents state={dbState} onRefresh={loadStateFromSupabase} />} />
        <Route path="courses" element={<Courses state={dbState} onUpdate={handleUpdateDatabase} onRefresh={loadStateFromSupabase} />} />
        <Route path="assign-units" element={<AssignLecturerUnitsView state={dbState} onUpdate={handleUpdateDatabase} />} />
        <Route path="reports" element={<AdminReports state={dbState} onRefresh={loadStateFromSupabase} />} />
        <Route path="corrections" element={<CorrectionRequestsAdmin />} />
        <Route path="correction-requests" element={<CorrectionRequestsAdmin />} />
        <Route path="seed" element={<DatabaseSettings state={dbState} onUpdate={handleUpdateDatabase} />} />
        <Route path="database" element={<DatabaseSettings state={dbState} onUpdate={handleUpdateDatabase} />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Lecturer Protected Routes */}
      <Route
        path="/lecturer"
        element={
          <ProtectedRoute requiredRole="lecturer">
            <LecturerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<LecturerDashboard state={dbState} lecturerId={profile?.id || user?.id || ''} onUpdate={handleUpdateDatabase} />} />
        <Route path="mark-attendance" element={<MarkAttendance state={dbState} lecturerId={profile?.id || user?.id || ''} onUpdate={handleUpdateDatabase} />} />
        <Route path="my-units" element={<MyUnits state={dbState} lecturerId={profile?.id || user?.id || ''} />} />
        <Route path="students" element={<MyStudents />} />
        <Route path="corrections" element={<CorrectionRequests />} />
        <Route path="profile" element={<LecturerProfile />} />
      </Route>

      {/* Lecturer Forced Change Password (Standalone - no layout) */}
      <Route
        path="/lecturer/change-password"
        element={
          <ProtectedRoute requiredRole="lecturer">
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Student Protected Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="attendance" element={<MyAttendance state={dbState} studentId={profile?.id || user?.id || ''} />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="profile" element={<Profile state={dbState} />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Wildcard redirects to respective dashboard or login */}
      <Route
        path="*"
        element={
          user ? (
            role === 'admin' ? (
              <Navigate to="/admin/dashboard" replace />
            ) : role === 'lecturer' ? (
              <Navigate to="/lecturer/dashboard" replace />
            ) : role === 'student' ? (
              <Navigate to="/student/dashboard" replace />
            ) : (
              <Navigate to="/unauthorized" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

// Global Dashboard Layout with clean top institution header, role navigation links, and TVET footers
function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      {/* Top Banner & Crest */}
      <header className="bg-emerald-900 border-b-4 border-yellow-500 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl shadow-md flex items-center justify-center border-2 border-yellow-400">
              <ButereLogo size={52} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight uppercase">Butere Technical Training Institute</h1>
              <p className="text-[10px] md:text-xs text-yellow-300 font-medium tracking-wide uppercase font-mono">
                Student Attendance Management & Academic Audit Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left md:text-right hidden sm:block">
              <span className="text-[10px] text-emerald-200 block font-mono">Kakamega County, Kenya</span>
              <span className="text-xs font-semibold text-white bg-emerald-800 px-2.5 py-0.5 rounded-md mt-1 inline-block border border-emerald-700/60">
                TVET ISO 9001:2015
              </span>
            </div>
            <button
              id="sign-out-button"
              onClick={handleSignOut}
              className="px-3.5 py-2 bg-emerald-950 hover:bg-emerald-950/80 hover:text-white border border-emerald-800 rounded-lg text-xs font-bold text-emerald-200 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Sub-bar */}
      <section className="bg-white border-b border-slate-200 shadow-xs py-3">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* User Profile Summary */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              role === 'admin' ? 'bg-blue-500' : role === 'lecturer' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}></span>
            <span className="text-slate-500 font-medium">Active Profile:</span>
            <span className="font-bold text-slate-900 border-r border-slate-200 pr-2.5 mr-0.5">{profile?.full_name || user?.email}</span>
            <span className={`px-2.5 py-0.5 font-bold uppercase rounded text-[10px] border font-mono shadow-2xs ${
              role === 'admin' 
                ? 'bg-blue-100 text-blue-800 border-blue-200' 
                : role === 'lecturer' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                  : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}>
              {role === 'admin' ? 'Admin' : role === 'lecturer' ? 'Lecturer' : 'Student'}
            </span>
          </div>

          {/* Role Navigation Links */}
          <div className="flex flex-wrap items-center gap-1.5">
            {role === 'admin' && (
              <>
                <Link
                  id="nav-admin-dashboard"
                  to="/admin/dashboard"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/admin/dashboard'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </Link>
                <Link
                  id="nav-admin-users"
                  to="/admin/users"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/admin/users'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Users
                </Link>
                <Link
                  id="nav-admin-pre-register"
                  to="/admin/pre-register"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/admin/pre-register'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" /> Pre-Register
                </Link>
                <Link
                  id="nav-admin-reports"
                  to="/admin/reports"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/admin/reports'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Audit Reports
                </Link>
                <Link
                  id="nav-admin-database"
                  to="/admin/database"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/admin/database'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" /> Database Console
                </Link>
              </>
            )}

            {role === 'lecturer' && (
              <>
                <Link
                  id="nav-lecturer-dashboard"
                  to="/lecturer/dashboard"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/lecturer/dashboard'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </Link>
                <Link
                  id="nav-lecturer-mark"
                  to="/lecturer/mark-attendance"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/lecturer/mark-attendance'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" /> Mark Attendance
                </Link>
              </>
            )}

            {role === 'student' && (
              <>
                <Link
                  id="nav-student-dashboard"
                  to="/student/dashboard"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/student/dashboard'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </Link>
                <Link
                  id="nav-student-attendance"
                  to="/student/attendance"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/student/attendance'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Attendance Logs
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main Container Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer Branding Area */}
      <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-semibold text-white uppercase text-xs">Butere Technical Training Institute</h4>
            <p className="text-[11px] leading-relaxed">
              Serving Western Kenya with superior vocational technical instruction. Ensuring disciplined attendance in strict compliance with the Ministry of Education and TVETA standards.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-white uppercase text-xs">Technical Architecture Summary</h4>
            <p className="text-[11px] leading-relaxed font-mono">
              - Frontend: React 19, Tailwind CSS v4<br />
              - DB Model: Postgres + Supabase Auth / RLS<br />
              - Client Export: jsPDF (PDF) & SheetJS (XLSX)
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-white uppercase text-xs">National TVET Mandate</h4>
            <p className="text-[11px] leading-relaxed">
              Attendance criteria are designed to encourage consistent academic participation. Students with less than <strong className="text-yellow-400 font-bold">75% attendance</strong> are barred from KNEC final assessments, in accordance with Section 7 of academic standards.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-800/80 py-4 text-center text-[10px] text-slate-500 max-w-7xl mx-auto">
          © {new Date().getFullYear()} Butere TTI Attendance Audit Registry. Designed with professional integrity.
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}
