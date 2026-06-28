import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCorrectionRequests } from '../../hooks/useCorrectionRequests';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { getCurrentSemesterInfo, getInitials } from '../../lib/attendanceHelpers';
import { 
  ShieldCheck, LayoutDashboard, ClipboardCheck, Notebook, 
  Users, MessageSquareWarning, UserCircle, Lock, LogOut, Menu, X, Bell 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function LecturerLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { getLecturerRequests } = useCorrectionRequests();
  const [pendingCount, setPendingCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const semInfo = getCurrentSemesterInfo();
  const currentDateStr = new Date().toLocaleDateString('en-KE', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short' 
  });

  const fetchPendingCount = async () => {
    if (!profile?.id) return;
    try {
      const res = await getLecturerRequests();
      setPendingCount(res?.pending?.length || 0);
    } catch (e) {
      console.error('Error in fetchPendingCount:', e);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;

    fetchPendingCount();

    if (!isSupabaseReal()) return;

    const channel = supabase
      .channel('lecturer_layout_cr_changes')
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login', { replace: true });
    } catch (e) {
      toast.error('Error signing out');
    }
  };

  const menuSections = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', path: '/lecturer/dashboard', icon: LayoutDashboard },
        { label: 'Mark attendance', path: '/lecturer/mark-attendance', icon: ClipboardCheck },
        { label: 'My units', path: '/lecturer/my-units', icon: Notebook }
      ]
    },
    {
      title: 'Students',
      items: [
        { label: 'My students', path: '/lecturer/students', icon: Users },
        { 
          label: 'Corrections', 
          path: '/lecturer/corrections', 
          icon: MessageSquareWarning,
          badge: pendingCount
        }
      ]
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile', path: '/lecturer/profile', icon: UserCircle },
        { label: 'Change password', path: '/lecturer/change-password', icon: Lock }
      ]
    }
  ];

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Dashboard';
    if (path.includes('mark-attendance')) return 'Mark Attendance';
    if (path.includes('my-units')) return 'My Units';
    if (path.includes('students')) return 'My Students';
    if (path.includes('corrections')) return 'Dispute Corrections';
    if (path.includes('profile')) return 'My Profile';
    if (path.includes('change-password')) return 'Change Password';
    return 'Lecturer Portal';
  };

  const userInitials = getInitials(profile?.full_name || 'Lecturer');

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans antialiased text-gray-800">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation - Fixed 190px */}
      <aside 
        className={`fixed inset-y-0 left-0 w-[190px] bg-white border-r border-gray-100 z-50 transform lg:translate-x-0 lg:static lg:flex lg:flex-col shrink-0 transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-[18px] h-[18px] text-blue-600 shrink-0" />
            <div>
              <h2 className="text-[12.5px] font-bold text-gray-900 leading-tight">Butere TTI</h2>
              <p className="text-[10px] text-gray-400 font-medium">Lecturer portal</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {menuSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <span className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-wider px-3 block mb-1">
                {section.title}
              </span>
              {section.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={itemIdx}
                    id={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-[12px] transition-colors group ${
                      isActive 
                        ? 'bg-blue-50 text-blue-600 font-medium' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none shrink-0 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Pinned Footer */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[26px] h-[26px] rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-[11px] shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-gray-800 truncate leading-tight">
                {profile?.full_name || 'Lecturer'}
              </p>
              <p className="text-[10px] text-gray-400 leading-none">Lecturer</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sticky Top Navbar */}
        <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[13px] font-bold text-gray-900 leading-tight">
                {getPageTitle()}
              </h1>
              <p className="text-[11px] text-gray-400 font-medium">
                Semester {semInfo.semester} &middot; {semInfo.academicYear} &middot; {currentDateStr}
              </p>
            </div>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-4">
            {/* Bell Notifications */}
            <Link 
              to="/lecturer/corrections"
              className="relative p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
            >
              <Bell className="w-[18px] h-[18px]" />
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
              )}
            </Link>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-left cursor-pointer focus:outline-none"
              >
                <div className="w-[30px] h-[30px] rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs border border-blue-100">
                  {userInitials}
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-50 text-[12px]">
                  <div className="px-3 py-2 border-b border-gray-50">
                    <p className="font-bold text-gray-800 truncate">{profile?.full_name || 'Lecturer'}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{user?.email}</p>
                  </div>
                  <Link
                    to="/lecturer/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className="block px-3 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    My Profile
                  </Link>
                  <Link
                    to="/lecturer/change-password"
                    onClick={() => setIsDropdownOpen(false)}
                    className="block px-3 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Change password
                  </Link>
                  <div className="border-t border-gray-50 my-1" />
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 font-medium flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Outlet with bg-gray-50 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
