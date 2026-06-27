import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { getInitials, getCurrentSemesterInfo } from '../../lib/attendanceHelpers';
import { 
  LayoutDashboard, ChartBar, Users, UserPlus, BookOpen, Notebook, 
  ArrowLeftRight, MessageSquareWarning, Database, Settings as SettingsIcon, 
  ShieldCheck, LogOut, Menu, X, Bell, Search, ChevronDown 
} from 'lucide-react';

export default function AdminLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const semesterInfo = getCurrentSemesterInfo();

  // Fetch pending correction requests count
  const fetchPendingCount = async () => {
    try {
      const { count, error } = await supabase
        .from('correction_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (!error && count !== null) {
        setPendingCorrectionsCount(count);
      }
    } catch (err) {
      console.warn('Failed to fetch pending corrections count:', err);
    }
  };

  useEffect(() => {
    fetchPendingCount();

    // Subscribe to realtime changes on correction_requests
    const channel = supabase
      .channel('admin-correction-requests-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'correction_requests' },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  // Helper to determine active state
  const isActive = (path: string) => location.pathname === path;

  // Render navigation item
  const renderNavItem = (item: { label: string; path: string; icon: React.ComponentType<{ className?: string }> }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setIsSidebarOpen(false)}
        className={`flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
          active 
            ? 'bg-blue-50 text-blue-600 font-medium rounded-lg' 
            : 'text-gray-600 hover:bg-gray-50 rounded-lg'
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
          <span>{item.label}</span>
        </span>
        {item.label === 'Corrections' && pendingCorrectionsCount > 0 && (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold leading-none text-white bg-red-500 rounded-full">
            {pendingCorrectionsCount}
          </span>
        )}
      </Link>
    );
  };

  // Get current page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/admin/dashboard')) return 'Dashboard';
    if (path.includes('/admin/reports')) return 'Reports';
    if (path.includes('/admin/users')) return 'Users';
    if (path.includes('/admin/pre-register')) return 'Pre-register';
    if (path.includes('/admin/courses')) return 'Courses and Units';
    if (path.includes('/admin/assign-units')) return 'Assign Units';
    if (path.includes('/admin/corrections')) return 'Corrections';
    if (path.includes('/admin/seed')) return 'Seed Data';
    if (path.includes('/admin/settings')) return 'System Settings';
    return 'Admin Panel';
  };

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Reports', path: '/admin/reports', icon: ChartBar }
      ]
    },
    {
      title: 'Management',
      items: [
        { label: 'Users', path: '/admin/users', icon: Users },
        { label: 'Pre-register', path: '/admin/pre-register', icon: UserPlus },
        { label: 'Courses', path: '/admin/courses', icon: BookOpen },
        { label: 'Units', path: '/admin/courses?tab=units', icon: Notebook },
        { label: 'Assign units', path: '/admin/assign-units', icon: ArrowLeftRight }
      ]
    },
    {
      title: 'Disputes',
      items: [
        { label: 'Corrections', path: '/admin/corrections', icon: MessageSquareWarning }
      ]
    },
    {
      title: 'System',
      items: [
        { label: 'Seed data', path: '/admin/seed', icon: Database },
        { label: 'Settings', path: '/admin/settings', icon: SettingsIcon }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Overlay on mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR - Fixed 196px width */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 w-[196px] bg-white border-r border-gray-100 flex flex-col z-50 transform md:translate-x-0 transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* BRAND HEADER */}
        <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-[18px] h-[18px] text-blue-600 shrink-0" />
            <div>
              <h1 className="text-[13px] font-bold text-gray-900 leading-tight">Butere TTI</h1>
              <p className="text-[10px] text-gray-400 font-medium">Admin panel</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* NAVIGATION GROUPS */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 px-3 block mb-1">
                {group.title}
              </span>
              <div className="space-y-0.5">
                {group.items.map(renderNavItem)}
              </div>
            </div>
          ))}
        </nav>

        {/* ADMIN USER CHIP (pinned) */}
        <div className="p-3 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[26px] h-[26px] rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
              {getInitials(profile?.full_name || 'Admin')}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {profile?.full_name || 'Admin'}
              </p>
              <p className="text-[10px] text-gray-400 truncate leading-none">
                Administrator
              </p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP BAR */}
        <header className="h-14 bg-white border-b border-gray-100 sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 shrink-0">
          {/* Left info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-gray-900 leading-tight">
                {getPageTitle()}
              </h2>
              <p className="text-[10px] text-gray-400 font-medium">
                Butere TTI · Semester {semesterInfo.semester} · {semesterInfo.academicYear}
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button 
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 relative"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            <button 
              onClick={() => navigate('/admin/corrections')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {pendingCorrectionsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold border border-blue-100">
                  {getInitials(profile?.full_name || 'Admin')}
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-gray-100 rounded-lg shadow-sm py-1 z-50 text-xs">
                  <div className="px-3 py-1.5 border-b border-gray-100">
                    <p className="font-semibold text-gray-900 truncate">
                      {profile?.full_name || 'Admin User'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <Link 
                    to="/admin/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="block px-3 py-1.5 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    System settings
                  </Link>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 font-semibold"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MAIN PANEL CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
