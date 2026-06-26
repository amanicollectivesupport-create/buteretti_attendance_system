import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ButereLogo from '../ButereLogo';
import { useCorrectionRequests } from '../../hooks/useCorrectionRequests';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { 
  School, LayoutDashboard, BookmarkCheck, BookOpen, 
  LogOut, Menu, X, User, ShieldCheck, GraduationCap, ClipboardCheck
} from 'lucide-react';

export default function LecturerLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { getLecturerRequests } = useCorrectionRequests();
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = async () => {
    if (!profile?.id) return;
    try {
      const res = await getLecturerRequests();
      setPendingCount(res.pending.length);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;

    fetchPendingCount();

    if (!isSupabaseReal()) return;

    const channel = supabase
      .channel('layout_cr_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'correction_requests',
        filter: `lecturer_id=eq.${profile.id}`
      }, () => {
        fetchPendingCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const navItems = [
    {
      id: 'lecturer-dash',
      label: 'Dashboard',
      path: '/lecturer/dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'lecturer-mark',
      label: 'Mark Attendance',
      path: '/lecturer/mark-attendance',
      icon: BookmarkCheck,
    },
    {
      id: 'lecturer-units',
      label: 'My Assigned Units',
      path: '/lecturer/units',
      icon: BookOpen,
    },
    {
      id: 'lecturer-corrections',
      label: 'Correction Requests',
      path: '/lecturer/correction-requests',
      icon: ClipboardCheck,
      badge: pendingCount > 0 ? pendingCount : null
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-800">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 z-50 transform lg:translate-x-0 lg:static lg:flex lg:flex-col transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-0.5 rounded-lg shadow-md flex items-center justify-center border border-yellow-500">
              <ButereLogo size={36} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Butere TTI</h2>
              <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-widest">Faculty Portal</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.id}
                id={`sidebar-${item.id}`}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'hover:bg-slate-800/60 hover:text-white text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge !== null && (
                  <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-950 text-emerald-300 rounded-xl flex items-center justify-center font-bold uppercase border border-emerald-800 text-xs">
              {profile?.full_name?.substring(0, 2) || 'LC'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{profile?.full_name || 'Senior Instructor'}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</p>
            </div>
          </div>
          <button
            id="sidebar-logout-button"
            onClick={handleSignOut}
            className="w-full py-2.5 bg-red-950/40 hover:bg-red-900 border border-red-900/30 text-red-200 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-700 bg-emerald-50 px-2 py-0.5 rounded uppercase text-[10px]">Academic Registry Live</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2 justify-end">
                <p className="text-xs font-bold text-slate-800">{profile?.full_name || 'Faculty Lecturer'}</p>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold uppercase rounded-md text-[9px] border border-emerald-200/60 font-mono shadow-2xs">
                  Lecturer
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">ID: {user?.id?.substring(0, 8)}...</p>
            </div>
            <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold text-xs uppercase border border-emerald-200">
              <User className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Dashboard Content Portal */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
