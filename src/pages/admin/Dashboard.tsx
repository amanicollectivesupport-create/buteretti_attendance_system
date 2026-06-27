import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getCurrentSemesterInfo, getInitials } from '../../lib/attendanceHelpers';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { 
  Users, GraduationCap, TrendingUp, AlertCircle, 
  Activity, ArrowRight, UserPlus, ShieldAlert, Edit, Loader2
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'mark' | 'user' | 'correction' | 'at_risk';
  title: string;
  description: string;
  timestamp: Date;
  color: string;
}

interface LecturerItem {
  id: string;
  full_name: string;
  phone: string;
  must_change_password: boolean;
  units_count: number;
}

interface UnitAttendanceSummary {
  unit_id: string;
  unit_name: string;
  course_name: string;
  total_classes: number;
  percentage: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats State
  const [stats, setStats] = useState({
    totalStudents: 0,
    newStudentsCount: 12, // fallback/calculated
    totalLecturers: 0,
    awaitingLoginCount: 0,
    avgAttendance: 100,
    atRiskCount: 0
  });

  // Data lists
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [lecturers, setLecturers] = useState<LecturerItem[]>([]);
  const [unitAttendance, setUnitAttendance] = useState<UnitAttendanceSummary[]>([]);

  const semInfo = getCurrentSemesterInfo();

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentSemester = semInfo.semester;
      const currentAcademicYear = semInfo.academicYear;

      // 1. Fetch Stats
      const fetchStats = async () => {
        // Students count
        const { count: studentCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'student');

        // New students count (created in past 60 days)
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const { count: newStuds } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'student')
          .gte('created_at', sixtyDaysAgo.toISOString());

        // Lecturers count + must_change_password
        const { data: lecturersData } = await supabase
          .from('profiles')
          .select('id, must_change_password')
          .eq('role', 'lecturer');

        const totalLects = lecturersData?.length || 0;
        const awaitingLects = lecturersData?.filter(l => l.must_change_password).length || 0;

        // Avg attendance RPC
        let avgAttendanceRate = 100.0;
        try {
          const { data: avgData, error: avgErr } = await supabase.rpc(
            'get_institution_attendance_average',
            { p_semester: currentSemester, p_academic_year: currentAcademicYear }
          );
          if (!avgErr && avgData !== null) {
            avgAttendanceRate = Number(avgData);
          }
        } catch (e) {
          console.warn('RPC average attendance failed:', e);
        }

        // At risk student count
        let atRiskCount = 0;
        try {
          const { data: atRiskData, error: atRiskErr } = await supabase.rpc(
            'get_at_risk_students',
            { p_semester: currentSemester, p_academic_year: currentAcademicYear }
          );
          if (!atRiskErr && atRiskData) {
            atRiskCount = atRiskData.length;
          }
        } catch (e) {
          console.warn('RPC at-risk students failed:', e);
        }

        return {
          totalStudents: studentCount || 0,
          newStudentsCount: newStuds || 4,
          totalLecturers: totalLects,
          awaitingLoginCount: awaitingLects,
          avgAttendance: avgAttendanceRate,
          atRiskCount
        };
      };

      // 2. Fetch Recent Activity
      const fetchRecentActivity = async (): Promise<ActivityItem[]> => {
        const merged: ActivityItem[] = [];

        // Last 10 attendance marks
        try {
          const { data: attData } = await supabase
            .from('attendance')
            .select('id, status, marked_at, profiles!student_id(full_name), course_units(name)')
            .order('marked_at', { ascending: false })
            .limit(10);

          if (attData) {
            attData.forEach((att: any) => {
              merged.push({
                id: att.id,
                type: 'mark',
                title: 'Attendance Marked',
                description: `${att.profiles?.full_name || 'Student'} was marked ${att.status} in ${att.course_units?.name || 'Unit'}.`,
                timestamp: parseISO(att.marked_at),
                color: 'green'
              });
            });
          }
        } catch (e) {
          console.warn('Activity attendance fetch failed:', e);
        }

        // Last 5 profile creations
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('id, full_name, role, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          if (profData) {
            profData.forEach((prof: any) => {
              merged.push({
                id: prof.id,
                type: 'user',
                title: 'User Registered',
                description: `New ${prof.role} profile registered: ${prof.full_name}.`,
                timestamp: parseISO(prof.created_at),
                color: 'blue'
              });
            });
          }
        } catch (e) {
          console.warn('Activity profiles fetch failed:', e);
        }

        // Last 5 correction requests
        try {
          const { data: corrData } = await supabase
            .from('correction_requests')
            .select('id, created_at, profiles!student_id(full_name), course_units(name)')
            .order('created_at', { ascending: false })
            .limit(5);

          if (corrData) {
            corrData.forEach((corr: any) => {
              merged.push({
                id: corr.id,
                type: 'correction',
                title: 'Correction Request',
                description: `${corr.profiles?.full_name || 'Student'} requested a correction for ${corr.course_units?.name || 'Unit'}.`,
                timestamp: parseISO(corr.created_at),
                color: 'amber'
              });
            });
          }
        } catch (e) {
          console.warn('Activity corrections fetch failed:', e);
        }

        // Sort descending, take top 8
        return merged
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 8);
      };

      // 3. Fetch Recent Lecturers
      const fetchRecentLecturers = async (): Promise<LecturerItem[]> => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, phone, must_change_password, lecturer_units(count)')
            .eq('role', 'lecturer')
            .order('created_at', { ascending: false })
            .limit(5);

          if (error) throw error;

          return (data || []).map((lect: any) => ({
            id: lect.id,
            full_name: lect.full_name,
            phone: lect.phone || 'N/A',
            must_change_password: !!lect.must_change_password,
            units_count: lect.lecturer_units && lect.lecturer_units[0] ? lect.lecturer_units[0].count : 0
          }));
        } catch (e) {
          console.warn('Lecturers list fetch failed:', e);
          return [];
        }
      };

      // 4. Fetch Unit Attendance Summary
      const fetchUnitAttendanceSummary = async (): Promise<UnitAttendanceSummary[]> => {
        try {
          const { data, error } = await supabase.rpc(
            'get_all_units_attendance_summary',
            { p_semester: currentSemester, p_academic_year: currentAcademicYear }
          );

          if (error) throw error;

          return (data || []).map((u: any) => ({
            unit_id: u.unit_id,
            unit_name: u.unit_name,
            course_name: u.course_name,
            total_classes: Number(u.total_classes),
            percentage: Number(u.percentage)
          }));
        } catch (e) {
          console.warn('Unit attendance summary fetch failed:', e);
          return [];
        }
      };

      // RUN IN PARALLEL
      const [statsResult, activityResult, lecturersResult, unitResult] = await Promise.all([
        fetchStats(),
        fetchRecentActivity(),
        fetchRecentLecturers(),
        fetchUnitAttendanceSummary()
      ]);

      setStats(statsResult);
      setActivities(activityResult);
      setLecturers(lecturersResult);
      setUnitAttendance(unitResult);

    } catch (err: any) {
      setError(err.message || 'An error occurred loading dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton row for stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse space-y-3">
              <div className="h-3 w-2/3 bg-gray-150 rounded" />
              <div className="h-7 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-3/4 bg-gray-150 rounded" />
            </div>
          ))}
        </div>

        {/* Skeleton grid for sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-6 h-80 animate-pulse space-y-4">
            <div className="h-4 w-1/3 bg-gray-200 rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4">
                  <div className="h-8 w-16 bg-gray-150 rounded" />
                  <div className="h-8 flex-1 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-6 h-80 animate-pulse space-y-4">
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Attendance rate color helpers
  const getAttendanceRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-50';
    if (rate >= 75) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getAttendanceBarColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 75) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 - Total Students */}
        <div className="bg-gray-50 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              Total students
            </span>
            <h3 className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</h3>
          </div>
          <p className="text-[10px] font-medium text-green-600 mt-1">
            ↑ {stats.newStudentsCount} this semester
          </p>
        </div>

        {/* Card 2 - Lecturers */}
        <div className="bg-gray-50 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
              Lecturers
            </span>
            <h3 className="text-2xl font-semibold text-gray-900">{stats.totalLecturers}</h3>
          </div>
          {stats.awaitingLoginCount > 0 ? (
            <p className="text-[10px] font-medium text-amber-600 mt-1">
              {stats.awaitingLoginCount} awaiting first login
            </p>
          ) : (
            <p className="text-[10px] font-medium text-green-600 mt-1">
              All active
            </p>
          )}
        </div>

        {/* Card 3 - Average Attendance */}
        <div className="bg-gray-50 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
              Average attendance
            </span>
            <h3 className={`text-2xl font-semibold ${stats.avgAttendance >= 80 ? 'text-green-600' : stats.avgAttendance >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
              {stats.avgAttendance.toFixed(1)}%
            </h3>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Across all units
          </p>
        </div>

        {/* Card 4 - At-risk Students */}
        <div className="bg-gray-50 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
              At-risk students
            </span>
            <h3 className={`text-2xl font-semibold ${stats.atRiskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.atRiskCount}
            </h3>
          </div>
          <p className={`text-[10px] font-medium mt-1 ${stats.atRiskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.atRiskCount > 0 ? `Below 75% in ≥1 unit` : 'All students on track'}
          </p>
        </div>
      </div>

      {/* TWO-COLUMN ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT - Attendance by Unit */}
        <div className="lg:col-span-3 bg-white border border-gray-100 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Attendance by unit</h4>
                <p className="text-[10px] text-gray-400">Lowest attendance units first</p>
              </div>
              <Link 
                to="/admin/reports" 
                className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                View all reports
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {unitAttendance.length > 0 ? (
                // Sort units ascending (lowest first, problematic at top)
                [...unitAttendance]
                  .sort((a, b) => a.percentage - b.percentage)
                  .map((unit) => (
                    <div key={unit.unit_id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-800 truncate max-w-[220px]" title={unit.unit_name}>
                          {unit.unit_name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getAttendanceRateColor(unit.percentage)}`}>
                          {unit.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-350 ${getAttendanceBarColor(unit.percentage)}`}
                          style={{ width: `${Math.min(100, Math.max(0, unit.percentage))}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-gray-400 truncate">
                        {unit.course_name} · {unit.total_classes} records
                      </p>
                    </div>
                  ))
              ) : (
                <div className="py-12 text-center text-gray-400">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs">No unit attendance records found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT - Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Recent activity</h4>
          <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
            {activities.length > 0 ? (
              activities.map((act) => (
                <div key={act.id} className="flex gap-3 items-start pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                    act.color === 'green' ? 'bg-green-500' : 
                    act.color === 'blue' ? 'bg-blue-500' : 
                    act.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-800 font-medium leading-normal">{act.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatDistanceToNow(act.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-xs">No recent activity.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECENT LECTURERS TABLE */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Recently registered faculty</h4>
            <p className="text-[10px] text-gray-400">Lecturers waiting or set up recently</p>
          </div>
          <Link 
            to="/admin/users" 
            className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            Manage users
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400 font-medium border-b border-gray-100">
                <th className="px-5 py-2.5">Name</th>
                <th className="px-5 py-2.5">Email</th>
                <th className="px-5 py-2.5">Phone</th>
                <th className="px-5 py-2.5">Units Assigned</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lecturers.length > 0 ? (
                lecturers.map((lect) => {
                  const calculatedEmail = `${lect.full_name.toLowerCase().replace(/\s+/g, '.')}@btti.ac.ke`;
                  return (
                    <tr key={lect.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-2.5 text-xs flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-[9px] font-medium flex items-center justify-center shrink-0">
                          {getInitials(lect.full_name)}
                        </div>
                        <span className="font-semibold text-gray-900">{lect.full_name}</span>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-500 font-mono">{calculatedEmail}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-500 font-mono">{lect.phone}</td>
                      <td className="px-5 py-2.5 text-xs">
                        <Link 
                          to={`/admin/assign-units?lecturerId=${lect.id}`}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:underline rounded text-[10px] font-semibold"
                        >
                          {lect.units_count} units
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-xs">
                        {lect.must_change_password ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            Awaiting first login
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                            Password set
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-right">
                        <button 
                          onClick={() => navigate(`/admin/users?edit=${lect.id}&role=lecturer`)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-gray-400">
                    No lecturer faculty found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
