import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, TrendingUp, AlertCircle, CalendarCheck, 
  AlertTriangle, X, Check, Minus, CalendarOff, ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { 
  getAttendanceStatus, 
  getCurrentSemesterInfo, 
  getGreeting, 
  formatAttendanceDate 
} from '../../lib/attendanceHelpers';

interface UnitSummaryRow {
  unitId: string;
  unitName: string;
  totalClasses: number;
  classesAttended: number;
  percentage: number;
}

interface RecentRecord {
  id: string;
  date: string;
  status: 'Present' | 'Absent' | 'Excused';
  markedAt: string;
  unitName: string;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const alertRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [unitSummary, setUnitSummary] = useState<UnitSummaryRow[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<RecentRecord[]>([]);
  const [classesThisWeekCount, setClassesThisWeekCount] = useState(0);
  const [attendedThisWeekCount, setAttendedThisWeekCount] = useState(0);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [progressWidths, setProgressWidths] = useState<Record<string, number>>({});

  const { semester: currentSemester, academicYear: currentAcademicYear } = getCurrentSemesterInfo();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile?.id) return;
      setLoading(true);

      try {
        // 1. Fetch RPC Summary
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'get_student_attendance_summary',
          {
            p_student_id: profile.id,
            p_semester_filter: currentSemester,
            p_academic_year_filter: currentAcademicYear
          }
        );

        if (rpcError) {
          toast.error(`Summary load failed: ${rpcError.message}`);
          return;
        }

        const mappedSummary: UnitSummaryRow[] = (rpcData || []).map((row: any) => {
          const total = row.total_classes || 0;
          const attended = row.classes_attended || 0;
          const pct = total > 0 ? Math.round((attended / total) * 100) : 100;
          return {
            unitId: row.unit_id,
            unitName: row.unit_name || 'Unassigned Unit',
            totalClasses: total,
            classesAttended: attended,
            percentage: pct
          };
        });
        setUnitSummary(mappedSummary);

        // 2. Fetch all attendance for detailed queries (weekly counts + recents)
        const { data: attList, error: attError } = await supabase
          .from('attendance')
          .select(`
            id, date, status, marked_at,
            course_units ( name )
          `)
          .eq('student_id', profile.id)
          .eq('semester', currentSemester)
          .eq('academic_year', currentAcademicYear)
          .order('date', { ascending: false });

        if (attError) {
          toast.error(`Attendance fetch failed: ${attError.message}`);
          return;
        }

        const allRecords = attList || [];

        // Map recent 5
        const mappedRecent: RecentRecord[] = allRecords.slice(0, 5).map((rec: any) => ({
          id: rec.id,
          date: rec.date,
          status: rec.status,
          markedAt: rec.marked_at,
          unitName: rec.course_units?.name || 'Syllabus Subject'
        }));
        setRecentAttendance(mappedRecent);

        // Compute classes this week
        const startOfThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 }); // Mon
        const endOfThisWeek = endOfWeek(new Date(), { weekStartsOn: 1 }); // Sun

        const weeklyRecords = allRecords.filter(rec => {
          try {
            const d = parseISO(rec.date);
            return isWithinInterval(d, { start: startOfThisWeek, end: endOfThisWeek });
          } catch {
            const d = new Date(rec.date);
            return isWithinInterval(d, { start: startOfThisWeek, end: endOfThisWeek });
          }
        });

        setClassesThisWeekCount(weeklyRecords.length);
        const attendedThisWeek = weeklyRecords.filter(rec => rec.status === 'Present' || rec.status === 'Excused').length;
        setAttendedThisWeekCount(attendedThisWeek);

      } catch (err: any) {
        toast.error(err.message || 'An unexpected error occurred loading dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [profile?.id, currentSemester, currentAcademicYear]);

  // Mount animation for progress bar width
  useEffect(() => {
    if (unitSummary.length > 0) {
      const timer = setTimeout(() => {
        const widths: Record<string, number> = {};
        unitSummary.forEach(unit => {
          widths[unit.unitId] = unit.percentage;
        });
        setProgressWidths(widths);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [unitSummary]);

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Scholar';
  const greeting = getGreeting();

  // Find if any unit is at risk (< 75%)
  const atRiskUnits = unitSummary.filter(u => u.percentage < 75);
  const isAtRisk = atRiskUnits.length > 0;

  // Compute stat card values
  const totalUnits = unitSummary.length;
  
  const overallAttendanceRate = totalUnits > 0
    ? (unitSummary.reduce((acc, curr) => acc + curr.percentage, 0) / totalUnits).toFixed(1)
    : '100.0';

  const atRiskCount = atRiskUnits.length;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="h-20 bg-slate-200 rounded-xl w-3/4"></div>
        {/* Banner skeleton */}
        <div className="h-16 bg-slate-200 rounded-xl"></div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
        </div>
        {/* Split grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-slate-200 rounded-xl"></div>
          <div className="h-80 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const overallStatus = getAttendanceStatus(parseFloat(overallAttendanceRate));

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}, {firstName}!
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Here's your attendance summary for this semester.
          </p>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-green-200 text-green-700 bg-green-50">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Semester {currentSemester} · {currentAcademicYear}
          </span>
        </div>
      </div>

      {/* AT-RISK ALERT BANNER */}
      {isAtRisk && !isAlertDismissed && (
        <div 
          id="at-risk-alert"
          ref={alertRef}
          className="relative bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3 shadow-2xs pr-10 animate-in fade-in slide-in-from-top duration-300"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <h4 className="font-bold text-red-900 mb-0.5">Attendance warning</h4>
            <p>
              Your attendance in <strong className="font-bold">{atRiskUnits.map(u => u.unitName).join(', ')}</strong> is below 75%. 
              Contact your lecturer or you risk being barred from the exam.
            </p>
          </div>
          <button
            onClick={() => setIsAlertDismissed(true)}
            className="absolute top-3 right-3 text-red-400 hover:text-red-600 rounded-md p-1 transition-colors hover:bg-red-100/50"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Units Enrolled */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-2xs flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Units enrolled</span>
            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-500">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900 leading-none">{totalUnits}</span>
            <span className="text-[10px] text-slate-400 block mt-1">This semester</span>
          </div>
        </div>

        {/* Card 2: Overall attendance rate */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-2xs flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall attendance</span>
            <div className={`p-2 rounded-lg border ${overallStatus.bg} ${overallStatus.border} ${overallStatus.color}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className={`text-2xl font-extrabold leading-none ${overallStatus.color}`}>
              {overallAttendanceRate}%
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Across all units</span>
          </div>
        </div>

        {/* Card 3: At risk units */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-2xs flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">At-risk units</span>
            <div className={`p-2 rounded-lg border ${atRiskCount > 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-600'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className={`text-2xl font-extrabold leading-none ${atRiskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {atRiskCount}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              {atRiskCount === 0 ? 'All units on track' : 'Below 75% threshold'}
            </span>
          </div>
        </div>

        {/* Card 4: Classes this week */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-2xs flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classes this week</span>
            <div className="p-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900 leading-none">{classesThisWeekCount}</span>
            <span className="text-[10px] text-slate-400 block mt-1">
              {attendedThisWeekCount} attended so far
            </span>
          </div>
        </div>
      </div>

      {/* DASHBOARD GRIDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Unit Attendance Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Unit attendance</h2>
            <Link 
              to="/student/attendance" 
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-all"
            >
              <span>View details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {unitSummary.map((unit) => {
              const status = getAttendanceStatus(unit.percentage);
              const ProgressIcon = unit.percentage >= 80 ? Check : unit.percentage >= 75 ? Minus : AlertTriangle;
              
              return (
                <div 
                  key={unit.unitId} 
                  className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs flex flex-col justify-between h-36 hover:shadow-2xs transition-shadow"
                >
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-800 line-clamp-2 h-10 leading-tight mb-2" title={unit.unitName}>
                      {unit.unitName}
                    </h3>
                    
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`font-extrabold ${status.color}`}>{unit.percentage}%</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {unit.classesAttended}/{unit.totalClasses} classes
                      </span>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-600 ease-out ${status.bar}`}
                        style={{ width: `${progressWidths[unit.unitId] || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide border ${status.bg} ${status.border} ${status.color}`}>
                      <ProgressIcon className="w-3 h-3" />
                      <span>{status.label}</span>
                    </span>
                  </div>
                </div>
              );
            })}

            {unitSummary.length === 0 && (
              <div className="col-span-full bg-white border border-slate-150 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                <BookOpen className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No units registered for this semester yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Attendance Log */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent attendance</h2>
            <Link 
              to="/student/attendance" 
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              View all
            </Link>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
            {recentAttendance.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentAttendance.map((rec) => {
                  const isPresent = rec.status === 'Present';
                  const isAbsent = rec.status === 'Absent';
                  const isExcused = rec.status === 'Excused';
                  
                  return (
                    <div key={rec.id} className="p-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                      {/* Status Dot indicator */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        isPresent ? 'bg-green-500' : isAbsent ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate" title={rec.unitName}>
                          {rec.unitName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {formatAttendanceDate(rec.markedAt || rec.date)}
                        </p>
                      </div>

                      {/* Status badge pill */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        isPresent 
                          ? 'bg-green-50 text-green-700 border border-green-100' 
                          : isAbsent 
                            ? 'bg-red-50 text-red-700 border border-red-100' 
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {rec.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <CalendarOff className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No attendance records yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
