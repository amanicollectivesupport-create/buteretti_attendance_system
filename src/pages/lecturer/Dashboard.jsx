import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCorrectionRequests } from '../../hooks/useCorrectionRequests';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { 
  getAttendanceStatus, getGreeting, formatAttendanceDate, getInitials 
} from '../../lib/attendanceHelpers';
import { 
  Notebook, Users, TrendingUp, AlertCircle, Calendar, 
  CheckCircle, ArrowRight, XCircle, RefreshCw, MessageSquareWarning 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export default function LecturerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { getLecturerRequests, approveRequest, rejectRequest } = useCorrectionRequests();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    unitsAssigned: 0,
    totalStudents: 0,
    avgAttendance: 100,
    atRiskStudents: 0
  });

  const [unitSummary, setUnitSummary] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);

  // Modal Dialogs for Approval/Rejection
  const [activeAction, setActiveAction] = useState(null); // { req, type: 'approve' | 'reject' }
  const [reviewerNote, setReviewerNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Fetch lecturer units assigned
      const { data: allocations, error: allocError } = await supabase
        .from('lecturer_units')
        .select('unit_id, course_units!inner(id, name, course_id, semester, year_of_study)')
        .eq('lecturer_id', profile.id);

      if (allocError) throw allocError;

      const myUnits = allocations?.map(a => a.course_units) || [];
      const assignedUnitIds = myUnits.map(u => u.id);

      // 2. Fetch all student headcount for these units
      const courseIds = Array.from(new Set(myUnits.map(u => u.course_id).filter(Boolean)));
      let studentCountMap = {};
      let totalStudents = 0;

      if (courseIds.length > 0) {
        const { data: studentProfiles } = await supabase
          .from('profiles')
          .select('id, course_id')
          .eq('role', 'student')
          .in('course_id', courseIds);

        // Map course_id to student list
        (studentProfiles || []).forEach(student => {
          if (student.course_id) {
            if (!studentCountMap[student.course_id]) {
              studentCountMap[student.course_id] = 0;
            }
            studentCountMap[student.course_id] += 1;
            totalStudents += 1;
          }
        });
      }

      // 3. Fetch all attendance records across this lecturer's units this semester
      let allAttendance = [];
      if (assignedUnitIds.length > 0) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('id, unit_id, status, student_id')
          .in('unit_id', assignedUnitIds);
        allAttendance = attData || [];
      }

      // Group attendance by unit
      const attendanceByUnit = {};
      allAttendance.forEach(att => {
        if (!attendanceByUnit[att.unit_id]) {
          attendanceByUnit[att.unit_id] = [];
        }
        attendanceByUnit[att.unit_id].push(att);
      });

      // Calculate unit summaries
      const computedUnitSummary = myUnits.map(unit => {
        const unitAtt = attendanceByUnit[unit.id] || [];
        const studentCount = studentCountMap[unit.course_id] || 0;
        
        let percentage = 100;
        if (unitAtt.length > 0) {
          const presentCount = unitAtt.filter(a => a.status === 'Present' || a.status === 'Excused').length;
          percentage = Math.round((presentCount / unitAtt.length) * 100 * 10) / 10;
        }

        return {
          unit_id: unit.id,
          unit_name: unit.name,
          student_count: studentCount,
          percentage: percentage,
          year_of_study: unit.year_of_study
        };
      });

      // Sort My Units by lowest percentage first
      computedUnitSummary.sort((a, b) => a.percentage - b.percentage);
      setUnitSummary(computedUnitSummary);

      // Compute general average attendance percentage
      let avgAttendance = 100;
      if (allAttendance.length > 0) {
        const totalPresent = allAttendance.filter(a => a.status === 'Present' || a.status === 'Excused').length;
        avgAttendance = Math.round((totalPresent / allAttendance.length) * 100 * 10) / 10;
      }

      // Compute at risk students count (< 75%)
      const studentAttendanceMap = {};
      allAttendance.forEach(record => {
        if (!studentAttendanceMap[record.student_id]) {
          studentAttendanceMap[record.student_id] = { attended: 0, total: 0 };
        }
        studentAttendanceMap[record.student_id].total += 1;
        if (record.status === 'Present' || record.status === 'Excused') {
          studentAttendanceMap[record.student_id].attended += 1;
        }
      });

      let atRiskStudents = 0;
      Object.keys(studentAttendanceMap).forEach(studentId => {
        const stats = studentAttendanceMap[studentId];
        const pct = stats.total > 0 ? (stats.attended / stats.total) * 100 : 100;
        if (pct < 75) {
          atRiskStudents++;
        }
      });

      setStats({
        unitsAssigned: myUnits.length,
        totalStudents: totalStudents,
        avgAttendance: avgAttendance,
        atRiskStudents: atRiskStudents
      });

      // 4. Fetch Today's schedule check
      const today = new Date().toISOString().split('T')[0];
      let markedUnitIdsToday = new Set();
      if (assignedUnitIds.length > 0) {
        const { data: todayAtt } = await supabase
          .from('attendance')
          .select('unit_id')
          .eq('date', today)
          .eq('lecturer_id', profile.id);
        
        todayAtt?.forEach(r => markedUnitIdsToday.add(r.unit_id));
      }

      const computedTodaySchedule = myUnits.map(unit => {
        const studentCount = studentCountMap[unit.course_id] || 0;
        return {
          unit_id: unit.id,
          unit_name: unit.name,
          year_of_study: unit.year_of_study,
          student_count: studentCount,
          marked_today: markedUnitIdsToday.has(unit.id)
        };
      });

      // Sort: unmarked first (needs action at top)
      computedTodaySchedule.sort((a, b) => (a.marked_today ? 1 : 0) - (b.marked_today ? 1 : 0));
      setTodaySchedule(computedTodaySchedule);

      // 5. Fetch Pending Corrections via Hook (with fallbacks built-in!)
      const corrRes = await getLecturerRequests();
      setPendingCorrections(corrRes?.pending?.slice(0, 3) || []);

      // 6. Fetch Recent Attendance (Last 5 records)
      let computedRecentAttendance = [];
      if (assignedUnitIds.length > 0) {
        const { data: recentRaw, error: recError } = await supabase
          .from('attendance')
          .select('id, date, status, student_id, unit_id, marked_at')
          .eq('lecturer_id', profile.id)
          .order('marked_at', { ascending: false })
          .limit(5);

        if (!recError && recentRaw && recentRaw.length > 0) {
          const studentIds = Array.from(new Set(recentRaw.map(r => r.student_id).filter(Boolean)));
          const unitIds = Array.from(new Set(recentRaw.map(r => r.unit_id).filter(Boolean)));

          const [studentsRes, unitsRes] = await Promise.all([
            studentIds.length > 0 ? supabase.from('profiles').select('id, full_name, adm_no').in('id', studentIds) : Promise.resolve({ data: [] }),
            unitIds.length > 0 ? supabase.from('course_units').select('id, name').in('id', unitIds) : Promise.resolve({ data: [] })
          ]);

          const studentsMap = new Map(studentsRes.data?.map(s => [s.id, s]) || []);
          const unitsMap = new Map(unitsRes.data?.map(u => [u.id, u]) || []);

          computedRecentAttendance = recentRaw.map(record => ({
            ...record,
            profiles: studentsMap.get(record.student_id) || { full_name: 'Unknown Student', adm_no: 'N/A' },
            course_units: unitsMap.get(record.unit_id) || { name: 'Unknown Subject' }
          }));
        }
      }
      setRecentAttendance(computedRecentAttendance);

    } catch (e) {
      console.error('Error loading dashboard metrics:', e);
      toast.error('Could not refresh dashboard metrics completely.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [profile?.id]);

  const handleActionSubmit = async () => {
    if (!activeAction) return;
    setActionLoading(true);
    try {
      const { req, type } = activeAction;
      if (type === 'approve') {
        await approveRequest(req.id, reviewerNote);
        toast.success(`Dispute approved successfully.`);
      } else {
        await rejectRequest(req.id, reviewerNote);
        toast.success(`Dispute rejected.`);
      }
      setActiveAction(null);
      setReviewerNote('');
      fetchDashboardData();
    } catch (e) {
      toast.error(e.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Compute Time-aware Greeting & Live smart summary line
  const greeting = getGreeting();
  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Lecturer';
  
  const unmarkedToday = todaySchedule.filter(s => !s.marked_today).length;
  const pendingCount = pendingCorrections.length;

  let smartSummary = '';
  if (unmarkedToday > 0 && pendingCount > 0) {
    smartSummary = `You have ${unmarkedToday} class${unmarkedToday > 1 ? 'es' : ''} to mark today and ${pendingCount} pending correction request${pendingCount > 1 ? 's' : ''}.`;
  } else if (unmarkedToday > 0) {
    smartSummary = `You have ${unmarkedToday} class${unmarkedToday > 1 ? 'es' : ''} to mark today.`;
  } else if (pendingCount > 0) {
    smartSummary = `All classes marked. You have ${pendingCount} pending correction request${pendingCount > 1 ? 's' : ''}.`;
  } else {
    smartSummary = "All classes marked and no pending requests. You're all caught up.";
  }

  // Get active class unit name for recent table header
  const activeUnitName = recentAttendance.length > 0 
    ? recentAttendance[0].course_units?.name 
    : (unitSummary.length > 0 ? unitSummary[0].unit_name : 'Assigned Units');

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-gray-200 rounded-lg w-1/4" />
          <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-28 bg-white border border-gray-100 rounded-xl p-5 animate-pulse space-y-3">
              <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
              <div className="h-6 bg-gray-200 rounded-sm w-1/3" />
              <div className="h-3 bg-gray-200 rounded-sm w-2/3" />
            </div>
          ))}
        </div>

        {/* Two Columns Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white border border-gray-100 rounded-xl animate-pulse" />
          <div className="h-80 bg-white border border-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting Header & Live Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">
            {greeting}, {firstName}
          </h2>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            {smartSummary}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-lg transition-colors shadow-xs flex items-center justify-center cursor-pointer"
          title="Refresh dashboard stats"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 — Units Assigned */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-start shadow-2xs">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              Units Assigned
            </span>
            <span className="text-[22px] font-black text-gray-900 leading-none block">
              {stats.unitsAssigned}
            </span>
            <span className="text-[11px] text-gray-400 block font-medium">
              This semester
            </span>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <Notebook className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 — Total Students */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-start shadow-2xs">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              Total Students
            </span>
            <span className="text-[22px] font-black text-gray-900 leading-none block">
              {stats.totalStudents}
            </span>
            <span className="text-[11px] text-gray-400 block font-medium">
              Across all units
            </span>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 — Average Attendance */}
        {(() => {
          const status = getAttendanceStatus(stats.avgAttendance);
          return (
            <div className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-start shadow-2xs">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Average Attendance
                </span>
                <span className={`text-[22px] font-black leading-none block ${status.color}`}>
                  {stats.avgAttendance}%
                </span>
                <span className="text-[11px] text-gray-400 block font-medium">
                  My units average
                </span>
              </div>
              <div className={`p-2 rounded-lg border ${status.bg} ${status.border} ${status.color}`}>
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          );
        })()}

        {/* Card 4 — At-Risk Students */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-start shadow-2xs">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              At-Risk Students
            </span>
            <span className={`text-[22px] font-black leading-none block ${stats.atRiskStudents > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.atRiskStudents}
            </span>
            <span className="text-[11px] text-gray-400 block font-medium">
              {stats.atRiskStudents > 0 ? "Below 75%" : "All on track"}
            </span>
          </div>
          <div className={`p-2 rounded-lg border ${stats.atRiskStudents > 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-600'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Two-Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — My units card */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">
                My Units Performance
              </h3>
              <Link to="/lecturer/my-units" className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                View all &rarr;
              </Link>
            </div>

            <div className="space-y-4">
              {unitSummary.length > 0 ? (
                unitSummary.map((unit) => {
                  const status = getAttendanceStatus(unit.percentage);
                  return (
                    <div key={unit.unit_id} className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2">
                          <p className="text-[12px] font-bold text-gray-800 truncate">
                            {unit.unit_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Yr {unit.year_of_study} &middot; {unit.student_count} students
                          </p>
                        </div>
                        <span className={`text-[12px] font-bold ${status.color}`}>
                          {unit.percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${status.bar}`} 
                          style={{ width: `${unit.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400 text-xs">
                  <Notebook className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  No units currently assigned.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Today's schedule card */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">
                Today's Schedule
              </h3>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-bold">
                {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {todaySchedule.length > 0 ? (
                todaySchedule.map((unit) => {
                  const itemState = unit.marked_today ? 'marked' : 'needs_marking';
                  return (
                    <div key={unit.unit_id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${itemState === 'marked' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-gray-800 truncate">
                            {unit.unit_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Year {unit.year_of_study} &middot; {unit.student_count} students
                          </p>
                        </div>
                      </div>

                      {itemState === 'marked' ? (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-bold shrink-0">
                          ✓ Marked
                        </span>
                      ) : (
                        <button
                          onClick={() => navigate(`/lecturer/mark-attendance?unit=${unit.unit_id}`)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                        >
                          Mark now
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400 text-xs">
                  <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  No classes scheduled today.
                </div>
              )}
            </div>

            {/* Banner if all classes done */}
            {todaySchedule.length > 0 && todaySchedule.every(s => s.marked_today) && (
              <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl text-green-800 text-[11px] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <span className="font-medium">All classes marked for today. Awesome job!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW (two columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — Pending corrections (top 3) - 7 cols */}
        <div className="lg:col-span-7 bg-white border border-gray-100 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">
                  Pending Corrections
                </h3>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-[10px] font-bold font-mono">
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <Link to="/lecturer/corrections" className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1">
                View all &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {pendingCorrections.length > 0 ? (
                pendingCorrections.map((req, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div 
                      key={req.id} 
                      className={`p-3.5 border rounded-xl flex flex-col justify-between gap-2.5 transition-all ${
                        isFirst ? 'border-amber-200 bg-amber-50/10' : 'border-gray-100 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h4 className="text-[12px] font-bold text-gray-800 leading-tight">
                            {req.profiles?.full_name}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase">
                            {req.profiles?.adm_no || 'N/A'}
                          </p>
                        </div>
                        <span className="text-[9.5px] text-gray-400 font-mono">
                          {req.created_at ? formatDistanceToNow(new Date(req.created_at), { addSuffix: true }) : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10.5px] text-gray-600 font-medium">
                        <Notebook className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{req.course_units?.name || 'Subject'}</span>
                        <span className="text-gray-300">&middot;</span>
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{req.attendance?.date ? formatAttendanceDate(req.attendance.date) : 'N/A'}</span>
                        <span className="text-gray-300">&middot;</span>
                        <span className="px-1.5 py-0.2 bg-red-50 text-red-600 border border-red-100 rounded text-[9.5px] font-bold">
                          {req.original_status}
                        </span>
                      </div>

                      <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-600 text-[11px] leading-relaxed italic">
                        &ldquo;{req.reason}&rdquo;
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setActiveAction({ req, type: 'reject' })}
                          className="px-3 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => setActiveAction({ req, type: 'approve' })}
                          className="px-3 py-1 bg-white hover:bg-green-50 text-green-600 border border-green-200 hover:border-green-300 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 bg-gray-50/50 border border-dashed border-gray-200 rounded-xl">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2.5" />
                  <p className="text-[12px] font-bold text-gray-800">No pending requests</p>
                  <p className="text-[10px] text-gray-400 max-w-xs mx-auto mt-0.5">
                    You're all caught up. Student correction requests are empty!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Recent attendance table - 5 cols */}
        <div className="lg:col-span-5 bg-white border border-gray-100 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider truncate max-w-[70%]">
                Recent Attendance &mdash; {activeUnitName}
              </h3>
              <Link to="/lecturer/my-units" className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1 shrink-0">
                View all &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              {recentAttendance.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs text-gray-700">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentAttendance.map((rec) => {
                      const initial = getInitials(rec.profiles?.full_name);
                      return (
                        <tr key={rec.id} className="hover:bg-gray-50/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-[22px] h-[22px] bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">
                                {initial}
                              </div>
                              <div className="truncate">
                                <p className="font-bold text-gray-800 truncate">{rec.profiles?.full_name}</p>
                                <p className="text-[9px] text-gray-400 font-mono truncate uppercase">{rec.profiles?.adm_no}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-gray-500 font-mono">
                            {rec.date ? formatAttendanceDate(rec.date) : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === 'Present' 
                                ? 'bg-green-50 text-green-700 border border-green-100' 
                                : rec.status === 'Absent'
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-10 text-gray-400 text-xs">
                  <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  No attendance marked yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal approve/reject dialog */}
      {activeAction && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-100 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareWarning className={`w-4 h-4 ${activeAction.type === 'approve' ? 'text-green-600' : 'text-red-600'}`} />
                {activeAction.type === 'approve' ? 'Approve Correction Request' : 'Reject Correction Request'}
              </h3>
              <button 
                onClick={() => { setActiveAction(null); setReviewerNote(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-gray-500">
                You are about to <strong>{activeAction.type}</strong> the correction request from{' '}
                <strong>{activeAction.req.profiles?.full_name}</strong> for{' '}
                <strong>{activeAction.req.course_units?.name}</strong>.
              </p>
              {activeAction.type === 'approve' && (
                <div className="p-2.5 bg-green-50 border border-green-100 text-green-800 rounded-lg text-[11px] font-medium leading-relaxed">
                  ✓ Approving this request will automatically update the student's attendance to <strong>Present</strong> in the database.
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Reviewer Note / Feedback
              </label>
              <textarea
                placeholder="Specify reason or feedback (optional for approval, recommended for rejection)..."
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 text-xs">
              <button
                disabled={actionLoading}
                onClick={() => { setActiveAction(null); setReviewerNote(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold uppercase transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleActionSubmit}
                className={`px-4 py-2 text-white rounded-lg font-bold uppercase transition-colors cursor-pointer flex items-center gap-1 ${
                  activeAction.type === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading ? 'Saving...' : activeAction.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
