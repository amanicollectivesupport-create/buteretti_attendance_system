import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { DatabaseState } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCorrectionRequests } from '../../hooks/useCorrectionRequests';
import DisputeModal from '../../components/student/DisputeModal';
import { 
  ClipboardCheck, Download, ChevronDown, ChevronUp, 
  CalendarDays, Check, Minus, AlertTriangle, HelpCircle, RefreshCw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { 
  getAttendanceStatus, 
  getCurrentSemesterInfo,
  formatAttendanceDate
} from '../../lib/attendanceHelpers';

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
}

interface DetailRecord {
  id: string;
  unit_id: string;
  lecturer_id: string;
  date: string;
  status: 'Present' | 'Absent' | 'Excused';
  markedAt: string;
  markedBy: string;
}

export default function MyAttendance({ state, studentId }: MyAttendanceProps) {
  const { profile } = useAuth();
  const { getStudentRequests } = useCorrectionRequests();
  
  const { semester: curSem, academicYear: curYear } = getCurrentSemesterInfo();
  
  const [academicYear, setAcademicYear] = useState<string>(curYear);
  const [semester, setSemester] = useState<string>(curSem);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');

  // Accordion & detail record state
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [unitRecords, setUnitRecords] = useState<Record<string, DetailRecord[]>>({});
  const [recordsLoading, setRecordsLoading] = useState<Record<string, boolean>>({});

  // Correction Requests State
  const [requests, setRequests] = useState<any[]>([]);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await getStudentRequests();
      setRequests(res);
    } catch (e) {
      console.error('Failed to fetch requests', e);
    }
  };

  const isSupabaseConfigured = () => {
    return !!((import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY);
  };

  const fetchAttendanceSummary = async () => {
    setLoading(true);
    const activeStudentId = profile?.id || studentId;

    if (!activeStudentId) {
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      computeLocalSummary();
      setDataSource('local');
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch RPC summary
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'get_student_attendance_summary', 
        { 
          p_student_id: activeStudentId,
          p_semester_filter: semester,
          p_academic_year_filter: academicYear
        }
      );

      if (!rpcErr && rpcData) {
        const rows: SummaryRow[] = rpcData.map((row: any) => {
          const total = row.total_classes || 0;
          const attended = row.classes_attended || 0;
          const percentage = total > 0 ? Math.round((attended / total) * 100) : 100;
          return {
            unitId: row.unit_id,
            unitName: row.unit_name || 'Subject Course',
            attendedCount: attended,
            totalCount: total,
            percentage
          };
        });
        setSummaryData(rows);
        setDataSource('supabase');
        setLoading(false);
        return;
      }

      console.warn('RPC call failed or returned empty. Querying directly...', rpcErr);

      // 2. Direct Query Fallback
      const { data: attList, error: attErr } = await supabase
        .from('attendance')
        .select(`
          id,
          unit_id,
          status,
          course_units (
            name,
            semester
          )
        `)
        .eq('student_id', activeStudentId)
        .eq('semester', semester)
        .eq('academic_year', academicYear);

      if (attErr) throw attErr;

      const records = attList || [];
      const aggregated: Record<string, { name: string; attended: number; total: number }> = {};

      records.forEach((rec: any) => {
        const uId = rec.unit_id;
        const uName = rec.course_units?.name || 'Syllabus Subject';

        if (!aggregated[uId]) {
          aggregated[uId] = { name: uName, attended: 0, total: 0 };
        }
        aggregated[uId].total += 1;
        if (rec.status === 'Present' || rec.status === 'Excused') {
          aggregated[uId].attended += 1;
        }
      });

      const rows: SummaryRow[] = Object.entries(aggregated).map(([uId, val]) => {
        const percentage = val.total > 0 ? Math.round((val.attended / val.total) * 100) : 0;
        return {
          unitId: uId,
          unitName: val.name,
          attendedCount: val.attended,
          totalCount: val.total,
          percentage
        };
      });

      setSummaryData(rows);
      setDataSource('supabase');
    } catch (err: any) {
      console.warn('Unable to query Supabase directly. Computing local cache state summary.', err);
      computeLocalSummary();
      setDataSource('local');
    } finally {
      setLoading(false);
    }
  };

  const computeLocalSummary = () => {
    const activeStudentId = profile?.id || studentId;
    if (!activeStudentId) return;

    // Filter attendance records by student ID, academic year and semester
    const filteredAtt = state.attendance.filter(rec => {
      const yearMatch = rec.academic_year === academicYear;
      const semMatch = rec.semester === semester;
      return rec.student_id === activeStudentId && yearMatch && semMatch;
    });

    const aggregated: Record<string, { name: string; attended: number; total: number }> = {};

    filteredAtt.forEach(rec => {
      const uId = rec.unit_id;
      const unit = state.courseUnits.find(u => u.id === uId);
      const uName = unit ? unit.name : 'Unknown Syllabus Subject';

      if (!aggregated[uId]) {
        aggregated[uId] = { name: uName, attended: 0, total: 0 };
      }

      aggregated[uId].total += 1;
      if (rec.status === 'Present' || rec.status === 'Excused') {
        aggregated[uId].attended += 1;
      }
    });

    const rows: SummaryRow[] = Object.entries(aggregated).map(([uId, val]) => {
      const percentage = val.total > 0 ? Math.round((val.attended / val.total) * 100) : 0;
      return {
        unitId: uId,
        unitName: val.name,
        attendedCount: val.attended,
        totalCount: val.total,
        percentage
      };
    });

    setSummaryData(rows);
  };

  useEffect(() => {
    fetchAttendanceSummary();
    setExpandedUnitId(null);
    setUnitRecords({});
  }, [academicYear, semester, profile?.id]);

  // Fetch correction requests and register real-time updates
  useEffect(() => {
    if (!profile?.id) return;

    fetchRequests();

    if (!isSupabaseReal()) return;

    const channel = supabase
      .channel('student_cr_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'correction_requests',
        filter: `student_id=eq.${profile.id}`
      }, (payload: any) => {
        if (payload.new.status === 'approved') {
          toast.success('Your dispute was approved! Attendance updated to Present.');
        } else if (payload.new.status === 'rejected') {
          toast.error(`Your dispute was rejected: ${payload.new.reviewer_note || 'No reason specified'}`);
        }
        fetchRequests();
        fetchAttendanceSummary();
        // Clear unit records to force re-fetch
        setUnitRecords({});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Lazy load records for selected unit
  const handleToggleAccordion = async (unitId: string) => {
    if (expandedUnitId === unitId) {
      setExpandedUnitId(null);
      return;
    }

    setExpandedUnitId(unitId);

    // If records are already fetched, don't fetch again
    if (unitRecords[unitId]) return;

    setRecordsLoading(prev => ({ ...prev, [unitId]: true }));

    const activeStudentId = profile?.id || studentId;

    if (dataSource === 'local' || !isSupabaseConfigured()) {
      // Load from local state
      const filtered = state.attendance.filter(rec => {
        return rec.student_id === activeStudentId &&
          rec.unit_id === unitId &&
          rec.semester === semester &&
          rec.academic_year === academicYear;
      });

      const mapped = filtered.map(rec => {
        const lecturer = state.profiles.find(p => p.id === rec.lecturer_id);
        return {
          id: rec.id,
          unit_id: rec.unit_id,
          lecturer_id: rec.lecturer_id,
          date: rec.date,
          status: rec.status,
          markedAt: rec.marked_at,
          markedBy: lecturer ? lecturer.full_name : 'System Auto'
        };
      });

      mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setUnitRecords(prev => ({ ...prev, [unitId]: mapped }));
      setRecordsLoading(prev => ({ ...prev, [unitId]: false }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id, unit_id, lecturer_id, date, status, marked_at,
          profiles!lecturer_id ( full_name )
        `)
        .eq('student_id', activeStudentId)
        .eq('unit_id', unitId)
        .eq('semester', semester)
        .eq('academic_year', academicYear)
        .order('date', { ascending: false });

      if (error) {
        toast.error(`Failed to load unit details: ${error.message}`);
        return;
      }

      const mapped: DetailRecord[] = (data || []).map((rec: any) => ({
        id: rec.id,
        unit_id: rec.unit_id,
        lecturer_id: rec.lecturer_id,
        date: rec.date,
        status: rec.status,
        markedAt: rec.marked_at,
        markedBy: rec.profiles?.full_name || 'System Auto'
      }));

      setUnitRecords(prev => ({ ...prev, [unitId]: mapped }));
    } catch (err: any) {
      toast.error(err.message || 'Error fetching detailed attendance list.');
    } finally {
      setRecordsLoading(prev => ({ ...prev, [unitId]: false }));
    }
  };

  // Sort rows: At-risk first (<75), borderline (75-79), on track (>=80)
  const sortedSummary = [...summaryData].sort((a, b) => {
    const getPriority = (pct: number) => {
      if (pct < 75) return 1;
      if (pct < 80) return 2;
      return 3;
    };
    const pA = getPriority(a.percentage);
    const pB = getPriority(b.percentage);
    
    if (pA !== pB) return pA - pB;
    return a.unitName.localeCompare(b.unitName);
  });

  // Overall calculations
  const totalUnits = summaryData.length;
  const overallPct = totalUnits > 0
    ? Math.round(summaryData.reduce((acc, r) => acc + r.percentage, 0) / totalUnits)
    : 100;

  // PDF Export
  const handleExportPDF = () => {
    if (summaryData.length === 0) {
      toast.error("No attendance data to export.");
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Setup Forest Green and Gold layout
      doc.setFillColor(22, 101, 52); // Forest Green (#166534)
      doc.rect(0, 0, 210, 42, 'F');
      
      // Institute Brand Name
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('BUTERE TECHNICAL TRAINING INSTITUTE', 15, 16);
      
      // Subtitle Box
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(234, 179, 8); // Gold (#eab308)
      doc.text('EXCELLENCE IN SKILLS DEVELOPMENT • P.O. Box 98-50101, Butere, Kenya', 15, 23);
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('OFFICIAL STUDENT ATTENDANCE REPORT & REGISTRY AUDIT', 15, 32);
      
      // Gold line separator
      doc.setFillColor(234, 179, 8);
      doc.rect(0, 42, 210, 2, 'F');
      
      // Student Metadata Details Block
      doc.setTextColor(55, 65, 81); // gray-700
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Student Name:', 15, 54);
      doc.text('Admission No:', 15, 60);
      doc.text('Academic Period:', 120, 54);
      doc.text('Report Generated:', 120, 60);
      
      doc.setFont('Helvetica', 'normal');
      doc.text(profile?.full_name || 'Student Scholar', 45, 54);
      doc.text(profile?.adm_no || 'N/A', 45, 60);
      doc.text(`Semester ${semester} | AY ${academicYear}`, 155, 54);
      doc.text(format(new Date(), 'dd MMM yyyy, hh:mm a'), 155, 60);
      
      // Build Table Data
      const tableRows = sortedSummary.map((row) => {
        const status = getAttendanceStatus(row.percentage);
        return [
          row.unitName,
          row.attendedCount.toString(),
          row.totalCount.toString(),
          `${row.percentage}%`,
          status.label
        ];
      });

      // Compute Total statistics
      const totalAttended = sortedSummary.reduce((acc, curr) => acc + curr.attendedCount, 0);
      const totalClasses = sortedSummary.reduce((acc, curr) => acc + curr.totalCount, 0);
      const overallAvgPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 100;
      const overallStatus = getAttendanceStatus(overallAvgPct);

      // Add Totals Summary Row
      tableRows.push([
        'TOTALS / OVERALL COMPLIANCE',
        totalAttended.toString(),
        totalClasses.toString(),
        `${overallAvgPct}%`,
        overallStatus.label
      ]);

      autoTable(doc, {
        startY: 68,
        head: [['Unit Name', 'Classes Attended', 'Total Classes', 'Percentage', 'Status']],
        body: tableRows,
        headStyles: {
          fillColor: [22, 101, 52],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 85 },
          1: { halign: 'center', cellWidth: 28 },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'center', cellWidth: 25 },
          4: { halign: 'center', cellWidth: 25 }
        },
        didParseCell: (data) => {
          // Format the summary footer row specifically
          if (data.row.index === sortedSummary.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249]; // Slate-100 bg
          } else if (data.column.index === 3) {
            const val = parseInt(data.cell.text[0]);
            if (!isNaN(val)) {
              if (val >= 80) {
                data.cell.styles.textColor = [22, 163, 74]; // green-600
              } else if (val >= 75) {
                data.cell.styles.textColor = [217, 119, 6]; // amber-600
              } else {
                data.cell.styles.textColor = [220, 38, 38]; // red-600
              }
              data.cell.styles.fontStyle = 'bold';
            }
          } else if (data.column.index === 4) {
            const txt = data.cell.text[0];
            if (txt === 'On track') {
              data.cell.styles.textColor = [22, 163, 74];
            } else if (txt === 'Borderline') {
              data.cell.styles.textColor = [217, 119, 6];
            } else if (txt === 'At risk') {
              data.cell.styles.textColor = [220, 38, 38];
            }
            data.cell.styles.fontStyle = 'bold';
          }
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setTextColor(156, 163, 175); // gray-400
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'italic');
      doc.text('Butere TTI Attendance Management System - Official Registry Document', 15, finalY + 12);

      const safeAdm = (profile?.adm_no || 'N-A').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`AttendanceReport_${safeAdm}_Sem${semester}_${academicYear.replace('/', '-')}.pdf`);
      toast.success("PDF report generated successfully!");
    } catch (err: any) {
      toast.error(`PDF generation failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            My Attendance Records
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review detailed academic registry transcripts and export certified PDF reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            title="Download PDF Transcript"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchAttendanceSummary}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center justify-center cursor-pointer"
            title="Reload Summary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-3xs flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Academic Year select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-hidden font-bold text-slate-700"
            >
              <option value="2024/2025">2024/2025 Academic Year</option>
              <option value="2023/2024">2023/2024 Academic Year</option>
              <option value="2022/2023">2022/2023 Academic Year</option>
            </select>
          </div>

          {/* Semester select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-hidden font-bold text-slate-700"
            >
              <option value="1">Semester 1 (First Term)</option>
              <option value="2">Semester 2 (Second Term)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SUMMARY TABLE SECTION */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-150 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Semester Course Units Summary</h2>
        </div>
        
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded-md w-full"></div>
            <div className="h-6 bg-slate-200 rounded-md w-full"></div>
            <div className="h-6 bg-slate-200 rounded-md w-full"></div>
          </div>
        ) : sortedSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Unit Name</th>
                  <th className="py-3 px-4 text-center">Classes Attended</th>
                  <th className="py-3 px-4 text-center">Total Classes</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sortedSummary.map((row) => {
                  const status = getAttendanceStatus(row.percentage);
                  return (
                    <tr key={row.unitId} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">{row.unitName}</td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-600">{row.attendedCount}</td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-600">{row.totalCount}</td>
                      <td className={`py-3 px-4 text-center font-extrabold ${status.color}`}>{row.percentage}%</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${status.bg} ${status.border} ${status.color}`}>
                          <span>{status.label}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <CalendarDays className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-medium">No registered classes or attendance statistics found for this period.</p>
          </div>
        )}

        {/* Overall Summary Line Footer */}
        {sortedSummary.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-150 text-right text-xs font-bold text-slate-700">
            Overall: <span className={getAttendanceStatus(overallPct).color}>{overallPct}%</span> average across {totalUnits} units
          </div>
        )}
      </div>

      {/* MY REQUESTS SUMMARY CARD */}
      {requests.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-3xs p-4 space-y-3 mb-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            My Correction Requests Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Filed</span>
              <span className="block text-lg font-extrabold text-slate-700 mt-0.5">{requests.length}</span>
            </div>
            <div className="bg-amber-50/40 border border-amber-100/50 rounded-xl p-3 text-center">
              <span className="block text-[10px] font-bold text-amber-500/80 uppercase tracking-wider">Pending Review</span>
              <span className="block text-lg font-extrabold text-amber-600 mt-0.5">{requests.filter(r => r.status === 'pending').length}</span>
            </div>
            <div className="bg-green-50/40 border border-green-100/50 rounded-xl p-3 text-center">
              <span className="block text-[10px] font-bold text-green-500/80 uppercase tracking-wider">Approved</span>
              <span className="block text-lg font-extrabold text-green-600 mt-0.5">{requests.filter(r => r.status === 'approved').length}</span>
            </div>
            <div className="bg-red-50/40 border border-red-100/50 rounded-xl p-3 text-center">
              <span className="block text-[10px] font-bold text-red-500/80 uppercase tracking-wider">Rejected</span>
              <span className="block text-lg font-extrabold text-red-600 mt-0.5">{requests.filter(r => r.status === 'rejected').length}</span>
            </div>
          </div>
        </div>
      )}

      {/* UNIT ACCORDION LIST */}
      {sortedSummary.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Detailed Attendance Timeline</h2>
          
          <div className="space-y-2">
            {sortedSummary.map((unit) => {
              const isExpanded = expandedUnitId === unit.unitId;
              const status = getAttendanceStatus(unit.percentage);
              const ProgressIcon = unit.percentage >= 80 ? Check : unit.percentage >= 75 ? Minus : AlertTriangle;
              
              const records = unitRecords[unit.unitId] || [];
              const isRecLoading = recordsLoading[unit.unitId];

              return (
                <div 
                  key={unit.unitId} 
                  className="bg-white border border-slate-200/85 rounded-xl overflow-hidden shadow-3xs transition-shadow hover:shadow-2xs"
                >
                  {/* Collapsed Bar clickable */}
                  <button
                    onClick={() => handleToggleAccordion(unit.unitId)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <h3 className="text-xs font-bold text-slate-800 truncate" title={unit.unitName}>
                        {unit.unitName}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {unit.attendedCount} of {unit.totalCount} lessons attended
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Percent badge */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${status.bg} ${status.border} ${status.color}`}>
                        <ProgressIcon className="w-2.5 h-2.5" />
                        <span>{unit.percentage}%</span>
                      </span>
                      
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Body Panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/20 p-4">
                      {isRecLoading ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400 font-medium">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Fetching official timestamps...</span>
                        </div>
                      ) : records.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                           <table className="w-full text-left border-collapse">
                             <thead>
                               <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                 <th className="py-2.5 px-3">Date</th>
                                 <th className="py-2.5 px-3 text-center">Status</th>
                                 <th className="py-2.5 px-3">Marked By</th>
                                 <th className="py-2.5 px-3 text-right">Action</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100 text-xs">
                               {records.map((rec, index) => {
                                 const isPresent = rec.status === 'Present';
                                 const isAbsent = rec.status === 'Absent';
                                 const req = requests.find((r: any) => r.attendance_id === rec.id);

                                 return (
                                   <tr key={index} className="hover:bg-slate-50/30 transition-colors">
                                     <td className="py-2.5 px-3 text-slate-700 font-medium">
                                       {formatAttendanceDate(rec.markedAt || rec.date)}
                                     </td>
                                     <td className="py-2.5 px-3 text-center">
                                       <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                         isPresent 
                                           ? 'bg-green-50 text-green-700 border border-green-100' 
                                           : isAbsent 
                                             ? 'bg-red-50 text-red-700 border border-red-100' 
                                             : 'bg-amber-50 text-amber-700 border border-amber-100'
                                       }`}>
                                         {rec.status}
                                       </span>
                                     </td>
                                     <td className="py-2.5 px-3 text-slate-500 font-medium">
                                       {rec.markedBy}
                                     </td>
                                     <td className="py-2.5 px-3 text-right">
                                       {req ? (
                                         req.status === 'pending' ? (
                                           <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-100">
                                             <span>⏳ Pending</span>
                                           </span>
                                         ) : req.status === 'approved' ? (
                                           <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-green-50 text-green-700 border border-green-100">
                                             <span>✓ Corrected</span>
                                           </span>
                                         ) : (
                                           <span 
                                             title={req.reviewer_note ? `Reason: ${req.reviewer_note}` : 'Rejected'}
                                             className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-red-50 text-red-700 border border-red-100 cursor-help"
                                           >
                                             <span>✗ Rejected</span>
                                           </span>
                                         )
                                       ) : (
                                         (rec.status === 'Absent' || rec.status === 'Excused') ? (
                                           <button
                                             onClick={() => {
                                               setSelectedRecord({
                                                 id: rec.id,
                                                 date: rec.date,
                                                 status: rec.status,
                                                 lecturer_id: rec.lecturer_id,
                                                 unit_id: rec.unit_id,
                                                 unit_name: unit.unitName
                                               });
                                               setDisputeModalOpen(true);
                                             }}
                                             className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide border border-amber-200 bg-amber-50/15 hover:bg-amber-50 text-amber-700 rounded-lg shadow-3xs transition-all cursor-pointer"
                                           >
                                             Dispute
                                           </button>
                                         ) : (
                                           <span className="text-[10px] text-slate-300 font-medium select-none">—</span>
                                         )
                                       )}
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                           </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-slate-400 font-medium">
                          No classes recorded for this unit yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DISPUTE MODAL */}
      <DisputeModal
        isOpen={disputeModalOpen}
        onClose={() => {
          setDisputeModalOpen(false);
          setSelectedRecord(null);
        }}
        onSuccess={() => {
          fetchRequests();
          // Reset accordion cache for expanded unit to reflect update immediately if resolved locally
          if (expandedUnitId) {
            setUnitRecords(prev => {
              const copy = { ...prev };
              delete copy[expandedUnitId];
              return copy;
            });
            handleToggleAccordion(expandedUnitId);
          }
        }}
        attendanceRecord={selectedRecord}
      />
    </div>
  );
}
