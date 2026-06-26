import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { 
  ShieldCheck, LayoutDashboard, ClipboardCheck, CalendarDays, 
  UserCircle, Settings, Bell, Menu, X, LogOut 
} from 'lucide-react';
import { getInitials, getCurrentSemesterInfo } from '../../lib/attendanceHelpers';

export default function StudentLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasAtRisk, setHasAtRisk] = useState(false);

  useEffect(() => {
    const fetchAtRiskStatus = async () => {
      if (!profile?.id) return;
      try {
        const { semester, academicYear } = getCurrentSemesterInfo();
        const { data, error } = await supabase.rpc('get_student_attendance_summary', {
          p_student_id: profile.id,
          p_semester_filter: semester,
          p_academic_year_filter: academicYear
        });
        
        if (!error && data) {
          const atRisk = data.some((row: any) => {
            const total = row.total_classes || 0;
            const attended = row.classes_attended || 0;
            const pct = total > 0 ? (attended / total) * 100 : 100;
            return pct < 75;
          });
          setHasAtRisk(atRisk);
        }
      } catch (err) {
        console.error('Error fetching at-risk status for bell icon:', err);
      }
    };

    fetchAtRiskStatus();
  }, [profile?.id, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleBellClick = () => {
    if (location.pathname !== '/student/dashboard') {
      navigate('/student/dashboard');
      // Set a brief timeout for navigation to complete before scrolling
      setTimeout(() => {
        const alertBanner = document.getElementById('at-risk-alert');
        if (alertBanner) {
          alertBanner.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    } else {
      const alertBanner = document.getElementById('at-risk-alert');
      if (alertBanner) {
        alertBanner.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const menuItems = [
    { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Attendance', path: '/student/attendance', icon: ClipboardCheck },
    { label: 'Timetable', path: '/student/timetable', icon: CalendarDays },
  ];

  const accountItems = [
    { label: 'Profile', path: '/student/profile', icon: UserCircle },
    { label: 'Settings', path: '/student/settings', icon: Settings },
  ];

  const initials = getInitials(profile?.full_name || '');

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-800">
      {/* Mobile Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed inset-y-0 left-0 w-[200px] bg-white border-r border-slate-200 z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col">
          {/* Sidebar Brand header (hidden on desktop because navbar is full-width) */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-xs font-bold text-slate-800">Butere TTI</h2>
                <p className="text-[10px] text-slate-400 font-medium">Attendance</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Menu Sections */}
          <div className="p-4 space-y-6">
            {/* Top Menu Section */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Menu</p>
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600 font-semibold' 
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Account Section */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Account</p>
              <nav className="space-y-1">
                {accountItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600 font-semibold' 
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Pinned Footer (above logout) */}
        <div className="border-t border-slate-100 p-3 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-800 truncate" title={profile?.full_name || ''}>
                  {profile?.full_name || 'Student'}
                </p>
                <p className="text-[9px] text-slate-400 font-mono truncate" title={profile?.adm_no || ''}>
                  {profile?.adm_no || 'N/A'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 md:pl-[200px] flex flex-col min-w-0">
        {/* NAVBAR */}
        <header className="sticky top-0 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 md:px-6 shrink-0 z-30 shadow-xs">
          {/* Left: Shield Logo & Brand Stack */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <div className="flex flex-col leading-tight">
                <span className="text-[13px] font-bold text-slate-800">Butere TTI</span>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Attendance System</span>
              </div>
            </div>
          </div>

          {/* Right: Bell Alert Button & Avatar Circle Dropdown */}
          <div className="flex items-center gap-3">
            {/* Bell button */}
            <button
              onClick={handleBellClick}
              className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-full transition-all cursor-pointer"
              title="Alerts"
            >
              <Bell className="w-4.5 h-4.5" />
              {hasAtRisk && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Avatar Circle and Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs uppercase border border-blue-200 hover:bg-blue-200 transition-colors cursor-pointer"
              >
                {initials}
              </button>
              
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-800 truncate">{profile?.full_name || 'Student'}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{profile?.adm_no || 'N/A'}</p>
                    </div>
                    <Link
                      to="/student/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Profile settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="w-full text-left block px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-medium cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
