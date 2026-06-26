import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState } from '../../types';
import { 
  Users, UserCheck, GraduationCap, Calendar, 
  TrendingUp, Activity, AlertCircle, RefreshCw, 
  CheckCircle, ArrowUpRight, HelpCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid 
} from 'recharts';

interface DashboardProps {
  state: DatabaseState;
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

export default function Dashboard({ state }: DashboardProps) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalLecturers: 0,
    todayAttendanceRate: 0,
    totalCourseUnits: 0
  });
  const [chartData, setChartData] = useState<{ date: string; rate: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');

  const fetchLiveCounts = async () => {
    setLoading(true);
    setError(null);

    // Check if Supabase URL and Key are configured
    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      console.log('Supabase credentials not fully loaded. Utilizing local sync state for admin dashboard.');
      computeLocalStats();
      setDataSource('local');
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch live total students
      const { count: studentsCount, error: studErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // 2. Fetch live total lecturers
      const { count: lecturersCount, error: lectErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'lecturer');

      // 3. Fetch total course units
      const { count: unitsCount, error: unitErr } = await supabase
        .from('course_units')
        .select('*', { count: 'exact', head: true });

      if (studErr || lectErr || unitErr) {
        throw new Error('Some counts could not be retrieved from the active Postgres database.');
      }

      // 4. Fetch today's attendance rate
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: todayRecords, error: todayErr } = await supabase
        .from('attendance')
        .select('status')
        .eq('date', todayStr);

      if (todayErr) throw todayErr;

      let todayRate = 0;
      if (todayRecords && todayRecords.length > 0) {
        const presentCount = todayRecords.filter(r => r.status === 'Present').length;
        todayRate = (presentCount / todayRecords.length) * 100;
      } else {
        // Fallback: search for latest day in database with records to show representative attendance rate
        const { data: lastRecord, error: lastErr } = await supabase
          .from('attendance')
          .select('date')
          .order('date', { ascending: false })
          .limit(1);

        if (!lastErr && lastRecord && lastRecord.length > 0) {
          const { data: lastDayRecs } = await supabase
            .from('attendance')
            .select('status')
            .eq('date', lastRecord[0].date);

          if (lastDayRecs && lastDayRecs.length > 0) {
            const presentCount = lastDayRecs.filter(r => r.status === 'Present').length;
            todayRate = (presentCount / lastDayRecs.length) * 100;
          }
        }
      }

      // 5. Fetch attendance per day for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const { data: recentRecords, error: recentErr } = await supabase
        .from('attendance')
        .select('date, status')
        .gte('date', sevenDaysAgoStr);

      if (recentErr) throw recentErr;

      // Group records by date and compute rate
      const dailyMap: Record<string, { present: number; total: number }> = {};
      
      // Initialize last 7 days with 0 records to ensure empty days are represented
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        dailyMap[dStr] = { present: 0, total: 0 };
      }

      if (recentRecords) {
        recentRecords.forEach(rec => {
          if (dailyMap[rec.date] !== undefined) {
            dailyMap[rec.date].total += 1;
            if (rec.status === 'Present') {
              dailyMap[rec.date].present += 1;
            }
          }
        });
      }

      const formattedChartData = Object.entries(dailyMap)
        .map(([date, counts]) => {
          const rate = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0;
          
          // Format date for display (e.g. "Jun 24")
          const parsedDate = new Date(date);
          const formattedDate = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

          return {
            date: formattedDate,
            rate,
            total: counts.total,
            rawDate: date
          };
        })
        .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
        .map(({ date, rate, total }) => ({ date, rate, total }));

      setStats({
        totalStudents: studentsCount || 0,
        totalLecturers: lecturersCount || 0,
        todayAttendanceRate: Math.round(todayRate),
        totalCourseUnits: unitsCount || 0
      });
      setChartData(formattedChartData);
      setDataSource('supabase');

    } catch (err: any) {
      console.warn('Postgres database connection error. Utilizing high-fidelity local state instead.', err.message);
      computeLocalStats();
      setDataSource('local');
    } finally {
      setLoading(false);
    }
  };

  const computeLocalStats = () => {
    const students = state.profiles.filter(p => p.role === 'student');
    const lecturers = state.profiles.filter(p => p.role === 'lecturer');
    const totalCourseUnits = state.courseUnits.length;

    // Today's rate or fallback latest marked attendance
    let todayRate = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = state.attendance.filter(r => r.date === todayStr);

    if (todayRecords.length > 0) {
      const presentCount = todayRecords.filter(r => r.status === 'Present').length;
      todayRate = (presentCount / todayRecords.length) * 100;
    } else {
      // Find latest date in state with attendance
      if (state.attendance.length > 0) {
        const sortedAtt = [...state.attendance].sort((a, b) => b.date.localeCompare(a.date));
        const latestDate = sortedAtt[0].date;
        const latestRecords = state.attendance.filter(r => r.date === latestDate);
        if (latestRecords.length > 0) {
          const presentCount = latestRecords.filter(r => r.status === 'Present').length;
          todayRate = (presentCount / latestRecords.length) * 100;
        }
      }
    }

    // Process last 7 days chart data
    const dailyMap: Record<string, { present: number; total: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      dailyMap[dStr] = { present: 0, total: 0 };
    }

    state.attendance.forEach(rec => {
      if (dailyMap[rec.date] !== undefined) {
        dailyMap[rec.date].total += 1;
        if (rec.status === 'Present') {
          dailyMap[rec.date].present += 1;
        }
      }
    });

    const formattedChartData = Object.entries(dailyMap)
      .map(([date, counts]) => {
        const rate = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0;
        const parsedDate = new Date(date);
        const formattedDate = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

        return {
          date: formattedDate,
          rate,
          total: counts.total,
          rawDate: date
        };
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .map(({ date, rate, total }) => ({ date, rate, total }));

    setStats({
      totalStudents: students.length,
      totalLecturers: lecturers.length,
      todayAttendanceRate: Math.round(todayRate),
      totalCourseUnits
    });
    setChartData(formattedChartData);
  };

  useEffect(() => {
    fetchLiveCounts();
  }, [state]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse flex justify-between items-center">
          <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
          <div className="h-10 bg-slate-200 rounded-lg w-24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upper Headers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Academic Operations Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time analytics and management ledger for Butere Technical Training Institute.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dataSource === 'supabase' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Supabase Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Offline Sync
            </span>
          )}

          <button
            onClick={fetchLiveCounts}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center"
            title="Refresh database state"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          description="Registered TVET Students"
          icon={GraduationCap}
          colorClass="bg-blue-50 border-blue-100"
          iconColorClass="text-blue-600"
        />
        <StatCard
          title="Total Lecturers"
          value={stats.totalLecturers}
          description="Academic Faculty Staff"
          icon={Users}
          colorClass="bg-indigo-50 border-indigo-100"
          iconColorClass="text-indigo-600"
        />
        <StatCard
          title="Average Attendance"
          value={`${stats.todayAttendanceRate}%`}
          description="Audit Eligibility Benchmark"
          icon={UserCheck}
          colorClass={stats.todayAttendanceRate >= 75 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}
          iconColorClass={stats.todayAttendanceRate >= 75 ? "text-emerald-600" : "text-rose-600"}
        />
        <StatCard
          title="Course Units"
          value={stats.totalCourseUnits}
          description="Curriculum Syllabus Units"
          icon={Calendar}
          colorClass="bg-amber-50 border-amber-100"
          iconColorClass="text-amber-600"
        />
      </div>

      {/* Main Chart Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Daily Attendance Rate Trend
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Graph tracking aggregate student presence rate over the last 7 instructional days.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-blue-600" />
              Attendance Rate (%)
            </span>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-72 sm:h-80 w-full pt-2">
          {chartData.length > 0 && chartData.some(d => d.total > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontWeight="600"
                  fontFamily="monospace"
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontWeight="600"
                  fontFamily="monospace"
                  tickLine={false} 
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-md text-xs space-y-1">
                          <p className="font-bold font-mono">{data.date}</p>
                          <div className="flex items-center gap-2 text-blue-400 font-semibold">
                            <span>Rate: {data.rate}%</span>
                          </div>
                          <p className="text-[10px] text-slate-400">Total Marks: {data.total} records</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="rate" 
                  fill="#2563eb" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={45} 
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <HelpCircle className="w-10 h-10 text-slate-300" />
              <p className="text-xs font-bold text-slate-500">No recent attendance records marked</p>
              <p className="text-[10px] max-w-xs text-center leading-relaxed">
                When instructors mark attendance in classrooms, the daily percentages will render here automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
