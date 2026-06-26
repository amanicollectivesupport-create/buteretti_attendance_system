import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState, CourseUnit, AttendanceRecord } from '../../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip 
} from 'recharts';
import { 
  ClipboardCheck, Calendar, Filter, HelpCircle, RefreshCw, 
  CheckCircle, AlertTriangle, BookOpen, Clock, TrendingUp 
} from 'lucide-react';

interface MyAttendanceProps {
  state: DatabaseState;
  studentId: string;
}

interface SummaryRow {
  unitId: string;
  unitName: string;
  attendedCount: number;
  totalCount: number;
  percentage: number;
  status: 'On Track' | 'At Risk';
}

export default function MyAttendance({ state, studentId }: MyAttendanceProps) {
  const [academicYear, setAcademicYear] = useState<string>('2025/2026');
  const [semester, setSemester] = useState<string>('Sem 1');
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');

  const fetchAttendanceSummary = async () => {
    setLoading(true);
    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      computeLocalSummary();
      setDataSource('local');
      setLoading(false);
      return;
    }

    try {
      // 1. Attempt to invoke the requested database RPC function
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'get_student_attendance_summary', 
        { 
          p_student_id: studentId,
          p_semester_filter: semester,
          p_academic_year_filter: academicYear
        }
      );

      // 2. If RPC succeeds and returns rows, map them to SummaryRow structure
      if (!rpcErr && rpcData && rpcData.length > 0) {
        const rows: SummaryRow[] = rpcData.map((row: any) => {
          const percentage = row.total_classes > 0 ? Math.round((row.classes_attended / row.total_classes) * 100) : 100;
          return {
            unitId: row.unit_id,
            unitName: row.unit_name || 'Subject Course',
            attendedCount: row.classes_attended || 0,
            totalCount: row.total_classes || 0,
            percentage,
            status: percentage >= 75 ? 'On Track' : 'At Risk'
          };
        });
        setSummaryData(rows);
        setDataSource('supabase');
        setLoading(false);
        return;
      }

      // 3. If RPC is missing or fails, fall back to direct Supabase query
      console.warn('RPC call failed or returned empty. Falling back to direct Supabase query...', rpcErr);
      const { data: attList, error: attErr } = await supabase
        .from('attendance')
        .select(`
          id,
          unit_id,
          status,
          course_units (
            name,
            year_of_study,
            semester
          )
        `)
        .eq('student_id', studentId)
        .eq('academic_year', academicYear);

      if (attErr) throw attErr;

      // Filter and aggregate locally from Supabase response
      const records = attList || [];
      const aggregated: Record<string, { name: string; attended: number; total: number }> = {};

      records.forEach((rec: any) => {
        const unitId = rec.unit_id;
        const unitName = rec.course_units?.name || 'Syllabus Subject';
        
        // Match chosen term filters roughly
        const unitSem = rec.course_units?.semester;
        const belongsToSelectedSemester = semester.includes(String(unitSem)) || semester === 'All Term';

        if (!belongsToSelectedSemester) return;

        if (!aggregated[unitId]) {
          aggregated[unitId] = { name: unitName, attended: 0, total: 0 };
        }
        aggregated[unitId].total += 1;
        if (rec.status === 'Present' || rec.status === 'Excused') {
          aggregated[unitId].attended += 1;
        }
      });

      const rows: SummaryRow[] = Object.entries(aggregated).map(([unitId, val]) => {
        const percentage = val.total > 0 ? Math.round((val.attended / val.total) * 100) : 0;
        return {
          unitId,
          unitName: val.name,
          attendedCount: val.attended,
          totalCount: val.total,
          percentage,
          status: percentage >= 75 ? 'On Track' : 'At Risk'
        };
      });

      setSummaryData(rows);
      setDataSource('supabase');

    } catch (err) {
      console.warn('Unable to query Supabase directly. Computing local cache state summary.', err);
      computeLocalSummary();
      setDataSource('local');
    } finally {
      setLoading(false);
    }
  };

  const computeLocalSummary = () => {
    // Filter attendance records by student ID, academic year and semester
    const filteredAtt = state.attendance.filter(rec => {
      const yearMatch = rec.academic_year === academicYear;
      // semester check (rec.semester matches 'Sem 1' or custom labels)
      const semMatch = rec.semester.toLowerCase().includes(semester.toLowerCase()) || 
                       semester.toLowerCase().includes(rec.semester.toLowerCase());
      return rec.student_id === studentId && yearMatch && semMatch;
    });

    const aggregated: Record<string, { name: string; attended: number; total: number }> = {};

    filteredAtt.forEach(rec => {
      const unitId = rec.unit_id;
      const unit = state.courseUnits.find(u => u.id === unitId);
      const unitName = unit ? unit.name : 'Unknown Syllabus Subject';

      if (!aggregated[unitId]) {
        aggregated[unitId] = { name: unitName, attended: 0, total: 0 };
      }

      aggregated[unitId].total += 1;
      if (rec.status === 'Present' || rec.status === 'Excused') {
        aggregated[unitId].attended += 1;
      }
    });

    const rows: SummaryRow[] = Object.entries(aggregated).map(([unitId, val]) => {
      const percentage = val.total > 0 ? Math.round((val.attended / val.total) * 100) : 0;
      return {
        unitId,
        unitName: val.name,
        attendedCount: val.attended,
        totalCount: val.total,
        percentage,
        status: percentage >= 75 ? 'On Track' : 'At Risk'
      };
    });

    setSummaryData(rows);
  };

  useEffect(() => {
    if (studentId) {
      fetchAttendanceSummary();
    }
  }, [studentId, academicYear, semester, state.attendance]);

  // Overall Statistics computed for the Doughnut Pie Chart
  const overallStats = React.useMemo(() => {
    if (summaryData.length === 0) {
      return { totalAttended: 0, totalClasses: 0, overallPercentage: 0 };
    }
    const totalAttended = summaryData.reduce((acc, row) => acc + row.attendedCount, 0);
    const totalClasses = summaryData.reduce((acc, row) => acc + row.totalCount, 0);
    const overallPercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 100;
    
    return {
      totalAttended,
      totalClasses,
      overallPercentage
    };
  }, [summaryData]);

  // Pie Chart Data
  const chartData = [
    { name: 'Attended Classes', value: overallStats.totalAttended, color: '#2563eb' }, // Blue accent
    { name: 'Missed Classes', value: Math.max(0, overallStats.totalClasses - overallStats.totalAttended), color: '#ef4444' } // Red danger
  ];

  return (
    <div className="space-y-6">
      {/* Upper header segment */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            My Attendance Record
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review your academic registry records, track minimum 75% thresholds, and view cumulative stats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dataSource === 'supabase' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Local Cache
            </span>
          )}

          <button
            onClick={fetchAttendanceSummary}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 shrink-0">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wider">Configure Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
          {/* Academic Session filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono shrink-0">Session:</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-bold text-slate-700"
            >
              <option value="2025/2026">2025/2026 Academic Year</option>
              <option value="2026/2027">2026/2027 Academic Year</option>
            </select>
          </div>

          {/* Academic Semester filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono shrink-0">Term:</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-bold text-slate-700"
            >
              <option value="Sem 1">First Semester (Sem 1)</option>
              <option value="Sem 2">Second Semester (Sem 2)</option>
              <option value="Year 1 Sem 1">Year 1 Semester 1</option>
              <option value="Year 1 Sem 2">Year 1 Semester 2</option>
              <option value="Year 2 Sem 1">Year 2 Semester 1</option>
              <option value="Year 2 Sem 2">Year 2 Semester 2</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid containing Pie Chart (Left/Top) & Attendance table (Right/Main) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Doughnut Pie Chart summary */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-full text-left border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest">
              Overall Compliance
            </h3>
            <span className="text-[10px] text-slate-400 leading-relaxed font-medium">Cumulative attendance for current session query.</span>
          </div>

          {/* Recharts Pie Chart representation */}
          <div className="w-full h-48 relative flex items-center justify-center">
            {overallStats.totalClasses > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Classes`, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Visual Label in the center of the Doughnut Chart */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black tracking-tight ${overallStats.overallPercentage >= 75 ? 'text-blue-600' : 'text-red-600'}`}>
                    {overallStats.overallPercentage}%
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Total Compliance
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-300">
                <Clock className="w-12 h-12 stroke-1" />
              </div>
            )}
          </div>

          {/* Metrics Legends */}
          <div className="grid grid-cols-2 gap-3 w-full text-left pt-2">
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">Present Count</span>
              <p className="text-lg font-black text-slate-900">{overallStats.totalAttended} <span className="text-xs text-slate-400">Classes</span></p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">Missed Count</span>
              <p className="text-lg font-black text-red-600">{Math.max(0, overallStats.totalClasses - overallStats.totalAttended)} <span className="text-xs text-slate-400">Classes</span></p>
            </div>
          </div>

          {/* Threshold alert summary */}
          <div className="w-full">
            {overallStats.totalClasses === 0 ? (
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl text-[11px] text-center font-medium">
                No active roll records recorded for this term.
              </div>
            ) : overallStats.overallPercentage >= 75 ? (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] leading-relaxed flex items-start gap-2 text-left">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Compliant (On Track):</strong> Your attendance rate is above the required <strong>75%</strong> threshold. You are fully qualified to take examinations.
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-red-50 text-red-800 border border-red-200 rounded-xl text-[11px] leading-relaxed flex items-start gap-2 text-left">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                <span>
                  <strong>Non-Compliant (At Risk):</strong> Your attendance has fallen below the <strong>75%</strong> threshold. You risk being de-registered from end-term assessments. Contact administration immediately.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed units compliance breakdown table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest">
                Unit Summary Breakdown
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">Syllabus-specific attendance metrics & eligibility checklists.</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[9px] text-slate-500 uppercase tracking-widest select-none">
                  <th className="py-3 px-4 font-bold">Curriculum Module Subject</th>
                  <th className="py-3 px-4 font-bold text-center">Attended Sessions</th>
                  <th className="py-3 px-4 font-bold text-center">Total Sessions</th>
                  <th className="py-3 px-4 font-bold text-center">Percentage</th>
                  <th className="py-3 px-4 font-bold text-right">Status Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {summaryData.length > 0 ? (
                  summaryData.map((row) => (
                    <tr key={row.unitId} className="hover:bg-slate-50/50 transition-colors">
                      {/* Unit name */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{row.unitName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {row.unitId.substring(0, 8)}</span>
                      </td>

                      {/* Classes Attended */}
                      <td className="py-3.5 px-4 text-center font-bold font-mono text-blue-600">
                        {row.attendedCount}
                      </td>

                      {/* Total Session Audits */}
                      <td className="py-3.5 px-4 text-center font-bold font-mono text-slate-500">
                        {row.totalCount}
                      </td>

                      {/* Progress meter percentage */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-black font-mono text-sm ${row.percentage >= 75 ? 'text-slate-900' : 'text-red-600'}`}>
                            {row.percentage}%
                          </span>
                          {/* Visual progress bar segment */}
                          <div className="w-20 bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${row.percentage >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                              style={{ width: `${Math.min(row.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Attendance Eligibility indicator */}
                      <td className="py-3.5 px-4 text-right">
                        {row.percentage >= 75 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[10px] font-bold uppercase tracking-wider font-mono">
                            ● On Track
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-md text-[10px] font-bold uppercase tracking-wider font-mono animate-pulse">
                            ● At Risk
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 space-y-2">
                      <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-900">No records resolved</p>
                      <p className="text-[10px] text-slate-400">
                        There are no active attendance records registered under your profile for the configured session filter.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
