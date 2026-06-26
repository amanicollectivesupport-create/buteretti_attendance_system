import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatabaseState, Profile, CourseUnit, LecturerUnit, AttendanceRecord } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { 
  BookOpen, Calendar, Users, AlertCircle, RefreshCw, 
  CheckCircle, ArrowRight, HelpCircle, Activity, BookmarkPlus 
} from 'lucide-react';

interface DashboardProps {
  state: DatabaseState;
  lecturerId: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<any>;
  colorClass: string;
  iconColorClass: string;
}

function StatCard({ title, value, description, icon: Icon, colorClass, iconColorClass }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex justify-between items-start">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono block">
          {title}
        </span>
        <span className="text-3xl font-black text-slate-950 tracking-tight block">
          {value}
        </span>
        <span className="text-xs text-slate-400 block font-medium">
          {description}
        </span>
      </div>
      <div className={`p-3 rounded-xl border ${colorClass} ${iconColorClass} flex items-center justify-center shadow-xs`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

export default function Dashboard({ state, lecturerId }: DashboardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    unitsAssigned: 0,
    classesMarkedToday: 0,
    totalStudents: 0
  });
  const [pendingUnits, setPendingUnits] = useState<(CourseUnit & { courseName: string })[]>([]);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');

  const loadDashboardData = async () => {
    setLoading(true);
    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      computeLocalDashboard();
      setDataSource('local');
      setLoading(false);
      return;
    }

    try {
      // 1. Get lecturer units assignments
      const { data: allocations, error: allocErr } = await supabase
        .from('lecturer_units')
        .select('*')
        .eq('lecturer_id', lecturerId);

      if (allocErr) throw allocErr;

      const myAllocations = allocations || [];
      const assignedUnitIds = myAllocations.map(a => a.unit_id);

      // 2. Get Course Units details
      let myUnits: CourseUnit[] = [];
      let courseMap: Record<string, string> = {};

      if (assignedUnitIds.length > 0) {
        const { data: units, error: unitErr } = await supabase
          .from('course_units')
          .select('*')
          .in('id', assignedUnitIds);
        
        if (unitErr) throw unitErr;
        myUnits = units || [];

        // Fetch courses to match names
        const courseIds = Array.from(new Set(myUnits.map(u => u.course_id)));
        if (courseIds.length > 0) {
          const { data: courses, error: courseErr } = await supabase
            .from('courses')
            .select('id, name')
            .in('id', courseIds);
          if (!courseErr && courses) {
            courses.forEach(c => {
              courseMap[c.id] = c.name;
            });
          }
        }
      }

      // 3. Count classes marked today
      const todayStr = new Date().toISOString().split('T')[0];
      let markedTodayCount = 0;

      if (assignedUnitIds.length > 0) {
        // Find distinct unit_id marked today
        const { data: todayAtts, error: attErr } = await supabase
          .from('attendance')
          .select('unit_id')
          .eq('date', todayStr)
          .in('unit_id', assignedUnitIds);

        if (!attErr && todayAtts) {
          const distinctMarked = new Set(todayAtts.map(a => a.unit_id));
          markedTodayCount = distinctMarked.size;
        }
      }

      // 4. Calculate total unique students across assigned course programs
      let uniqueStudentCount = 0;
      if (myUnits.length > 0) {
        const courseIds = Array.from(new Set(myUnits.map(u => u.course_id)));
        const { count, error: countErr } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student')
          .in('course_id', courseIds);

        if (!countErr) {
          uniqueStudentCount = count || 0;
        }
      }

      // 5. Determine today's pending units (assigned units NOT marked today)
      let markedSet = new Set<string>();
      if (assignedUnitIds.length > 0) {
        const { data: todayAtts } = await supabase
          .from('attendance')
          .select('unit_id')
          .eq('date', todayStr)
          .in('unit_id', assignedUnitIds);
        if (todayAtts) {
          todayAtts.forEach(a => markedSet.add(a.unit_id));
        }
      }

      const pending = myUnits
        .filter(unit => !markedSet.has(unit.id))
        .map(unit => ({
          ...unit,
          courseName: courseMap[unit.course_id] || 'Registered Course'
        }));

      setStats({
        unitsAssigned: myUnits.length,
        classesMarkedToday: markedTodayCount,
        totalStudents: uniqueStudentCount
      });
      setPendingUnits(pending);
      setDataSource('supabase');

    } catch (err) {
      console.warn('Unable to query Supabase directly. Loading local cache data for lecturer dashboard.', err);
      computeLocalDashboard();
      setDataSource('local');
    } finally {
      setLoading(false);
    }
  };

  const computeLocalDashboard = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Get allocations
    const myAllocations = state.lecturerUnits.filter(lu => lu.lecturer_id === lecturerId);
    const assignedUnitIds = myAllocations.map(a => a.unit_id);

    // Get Course Units
    const myUnits = state.courseUnits.filter(u => assignedUnitIds.includes(u.id));

    // Group courses
    const courseMap: Record<string, string> = {};
    state.courses.forEach(c => {
      courseMap[c.id] = c.name;
    });

    // Marked Today
    const myAttendanceToday = state.attendance.filter(
      r => r.date === todayStr && assignedUnitIds.includes(r.unit_id)
    );
    const markedUnitIds = new Set(myAttendanceToday.map(r => r.unit_id));

    // Unique student headcount across my units
    const myCourseIds = Array.from(new Set(myUnits.map(u => u.course_id)));
    const myStudents = state.profiles.filter(
      p => p.role === 'student' && p.course_id && myCourseIds.includes(p.course_id)
    );

    // Pending Units
    const pending = myUnits
      .filter(u => !markedUnitIds.has(u.id))
      .map(u => ({
        ...u,
        courseName: courseMap[u.course_id] || 'Registered Course'
      }));

    setStats({
      unitsAssigned: myUnits.length,
      classesMarkedToday: markedUnitIds.size,
      totalStudents: myStudents.length
    });
    setPendingUnits(pending);
  };

  useEffect(() => {
    if (lecturerId) {
      loadDashboardData();
    }
  }, [state, lecturerId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse flex justify-between items-center">
          <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
          <div className="h-10 bg-slate-200 rounded-lg w-24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upper Headers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            Instructor Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track daily academic attendance progress, managed classes, and student metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dataSource === 'supabase' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Database
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Offline Backup
            </span>
          )}

          <button
            onClick={loadDashboardData}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="My Assigned Units"
          value={stats.unitsAssigned}
          description="Total Syllabus Allocations"
          icon={BookOpen}
          colorClass="bg-blue-50 border-blue-100"
          iconColorClass="text-blue-600"
        />
        <StatCard
          title="Classes Marked Today"
          value={`${stats.classesMarkedToday} / ${stats.unitsAssigned}`}
          description="Today's Session Progress"
          icon={CheckCircle}
          colorClass={stats.classesMarkedToday === stats.unitsAssigned && stats.unitsAssigned > 0 ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}
          iconColorClass={stats.classesMarkedToday === stats.unitsAssigned && stats.unitsAssigned > 0 ? "text-emerald-600" : "text-amber-600"}
        />
        <StatCard
          title="Student Reach"
          value={stats.totalStudents}
          description="Unique Enrolled Students"
          icon={Users}
          colorClass="bg-indigo-50 border-indigo-100"
          iconColorClass="text-indigo-600"
        />
      </div>

      {/* Today's Pending Attendance List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
            Today's Attendance Status
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pending curriculum units requiring attendance audits today. Check and record rolls promptly.
          </p>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                <th className="py-3 px-4 font-bold">Curriculum Unit</th>
                <th className="py-3 px-4 font-bold">Course Program</th>
                <th className="py-3 px-4 font-bold">Academic Term</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
              {pendingUnits.length > 0 ? (
                pendingUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{unit.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {unit.id.substring(0, 8)}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-500">
                      {unit.courseName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      Year {unit.year_of_study}, Semester {unit.semester}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-md text-[10px] font-bold font-mono">
                        ● Pending Today
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/lecturer/mark-attendance?unitId=${unit.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                      >
                        Mark Now <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 space-y-2">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="font-bold text-slate-900">All attendance sheets marked!</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                      Congratulations! You have marked all attendance sheets assigned to you for today. You are fully compliant.
                    </p>
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
