import React, { useState, useMemo } from 'react';
import { DatabaseState, CourseUnit, Department, Profile, AttendanceRecord } from '../../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  FileText, FileSpreadsheet, Search, Filter, Calendar, BookOpen, 
  AlertTriangle, CheckCircle, RefreshCw, Layers, TrendingUp, Info 
} from 'lucide-react';

interface ReportsProps {
  state: DatabaseState;
  onRefresh?: () => void;
}

type ReportType = 'class_attendance' | 'daily_summary' | 'at_risk';

export default function Reports({ state, onRefresh }: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('class_attendance');

  // REPORT TYPE 1 FILTERS (Class Attendance)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(() => {
    return state.courseUnits[0]?.id || '';
  });
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2); // default 2 months range
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [academicYear, setAcademicYear] = useState<string>('2025/2026');
  const [semester, setSemester] = useState<string>('Sem 1');

  // REPORT TYPE 2 FILTERS (Daily Summary)
  const [dailyDate, setDailyDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');

  // Quick query filter
  const [searchTerm, setSearchTerm] = useState('');

  // ---------------------------------------------------------------------------
  // REPORT 1 COMPUTATION: Class Attendance Report
  // Table: Adm No | Name | Attended | Total | Percentage | Status
  // ---------------------------------------------------------------------------
  const classAttendanceData = useMemo(() => {
    if (!selectedUnitId) return [];

    const unit = state.courseUnits.find(u => u.id === selectedUnitId);
    if (!unit) return [];

    const courseId = unit.course_id;
    const courseStudents = state.profiles.filter(p => p.role === 'student' && p.course_id === courseId);

    // Get attendance records in date range & term filter
    const filteredRecords = state.attendance.filter(r => {
      const isCorrectUnit = r.unit_id === selectedUnitId;
      const isWithinDate = r.date >= startDate && r.date <= endDate;
      const isCorrectYear = r.academic_year === academicYear;
      const isCorrectSem = r.semester.toLowerCase().includes(semester.toLowerCase()) || 
                           semester.toLowerCase().includes(r.semester.toLowerCase());
      return isCorrectUnit && isWithinDate && isCorrectYear && isCorrectSem;
    });

    return courseStudents.map(student => {
      const studentRecords = filteredRecords.filter(r => r.student_id === student.id);
      const total = studentRecords.length;
      const attended = studentRecords.filter(r => r.status === 'Present').length;
      const percentage = total > 0 ? Math.round((attended / total) * 100) : 100; // default 100 if no classes held

      return {
        admNo: student.adm_no || 'N/A',
        name: student.full_name,
        phone: student.phone || 'N/A',
        attended,
        total,
        percentage,
        status: percentage >= 75 ? 'On Track' : 'At Risk'
      };
    });
  }, [selectedUnitId, startDate, endDate, academicYear, semester, state.profiles, state.attendance, state.courseUnits]);

  // ---------------------------------------------------------------------------
  // REPORT 2 COMPUTATION: Daily Attendance Summary
  // Columns: Unit Name | Department | Present | Absent | Excused | Total Marked
  // ---------------------------------------------------------------------------
  const dailySummaryData = useMemo(() => {
    const dailyRecords = state.attendance.filter(r => r.date === dailyDate);

    return state.courseUnits.map(unit => {
      const course = state.courses.find(c => c.id === unit.course_id);
      const deptId = course?.department_id || '';
      const department = state.departments.find(d => d.id === deptId);

      // Check department filter
      if (selectedDeptId !== 'all' && deptId !== selectedDeptId) {
        return null;
      }

      const recordsForUnit = dailyRecords.filter(r => r.unit_id === unit.id);
      if (recordsForUnit.length === 0) return null; // Only show units marked on this day

      const present = recordsForUnit.filter(r => r.status === 'Present').length;
      const absent = recordsForUnit.filter(r => r.status === 'Absent').length;
      const excused = recordsForUnit.filter(r => r.status === 'Excused').length;
      const total = recordsForUnit.length;

      return {
        unitId: unit.id,
        unitName: unit.name,
        courseName: course?.name || 'Unknown Course',
        deptName: department?.name || 'Registry Division',
        present,
        absent,
        excused,
        total
      };
    }).filter(row => row !== null) as {
      unitId: string;
      unitName: string;
      courseName: string;
      deptName: string;
      present: number;
      absent: number;
      excused: number;
      total: number;
    }[];
  }, [dailyDate, selectedDeptId, state.attendance, state.courseUnits, state.courses, state.departments]);

  // ---------------------------------------------------------------------------
  // REPORT 3 COMPUTATION: At-Risk Students Report
  // Auto-fetches all students below 75% in any unit.
  // Columns: Adm No | Name | Course | Unit with low attendance | Percentage | Attended / Total
  // ---------------------------------------------------------------------------
  const atRiskStudentsData = useMemo(() => {
    const students = state.profiles.filter(p => p.role === 'student');
    const riskList: {
      admNo: string;
      name: string;
      phone: string;
      courseName: string;
      unitName: string;
      percentage: number;
      attended: number;
      total: number;
    }[] = [];

    students.forEach(student => {
      const course = state.courses.find(c => c.id === student.course_id);
      const courseName = course?.name || 'Registered Course';

      // Find all course units for this course
      const courseUnits = state.courseUnits.filter(u => u.course_id === student.course_id);

      courseUnits.forEach(unit => {
        const studentRecords = state.attendance.filter(
          r => r.student_id === student.id && r.unit_id === unit.id
        );

        const total = studentRecords.length;
        if (total === 0) return; // skip if no classes have been recorded yet

        const attended = studentRecords.filter(r => r.status === 'Present').length;
        const percentage = Math.round((attended / total) * 100);

        if (percentage < 75) {
          riskList.push({
            admNo: student.adm_no || 'N/A',
            name: student.full_name,
            phone: student.phone || 'N/A',
            courseName,
            unitName: unit.name,
            percentage,
            attended,
            total
          });
        }
      });
    });

    return riskList;
  }, [state.profiles, state.courses, state.courseUnits, state.attendance]);

  // ---------------------------------------------------------------------------
  // EXCEL EXPORT (SheetJS)
  // ---------------------------------------------------------------------------
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    let worksheet: XLSX.WorkSheet;
    let fileName = '';

    if (activeReport === 'class_attendance') {
      const mappedRows = classAttendanceData.map((row, idx) => ({
        'S/No.': idx + 1,
        'Admission Number': row.admNo,
        'Student Name': row.name,
        'Phone Number': row.phone,
        'Attended Sessions': row.attended,
        'Total Sessions': row.total,
        'Attendance Rate': `${row.percentage}%`,
        'KNEC Compliance': row.status
      }));

      worksheet = XLSX.utils.json_to_sheet(mappedRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Class Attendance');
      fileName = `ClassAttendanceReport_${new Date().toISOString().split('T')[0]}.xlsx`;

    } else if (activeReport === 'daily_summary') {
      const mappedRows = dailySummaryData.map((row, idx) => ({
        'S/No.': idx + 1,
        'Unit Name': row.unitName,
        'Course Program': row.courseName,
        'Department': row.deptName,
        'Present': row.present,
        'Absent': row.absent,
        'Excused': row.excused,
        'Total Marked': row.total
      }));

      worksheet = XLSX.utils.json_to_sheet(mappedRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Summary');
      fileName = `DailyAttendanceSummary_${dailyDate}.xlsx`;

    } else {
      const mappedRows = atRiskStudentsData.map((row, idx) => ({
        'S/No.': idx + 1,
        'Admission Number': row.admNo,
        'Student Name': row.name,
        'Phone Number': row.phone,
        'Course Name': row.courseName,
        'Course Unit': row.unitName,
        'Attendance Rate': `${row.percentage}%`,
        'Attended / Total': `${row.attended} / ${row.total}`
      }));

      worksheet = XLSX.utils.json_to_sheet(mappedRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'At-Risk Students');
      fileName = `AtRiskStudentsReport_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    XLSX.writeFile(workbook, fileName);
  };

  // ---------------------------------------------------------------------------
  // PDF EXPORT (jsPDF + autoTable)
  // ---------------------------------------------------------------------------
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const primaryColor = [22, 101, 52]; // Forest Green
    const generatedDateStr = new Date().toLocaleDateString('en-GB');

    // Setup visual header bar
    doc.setFillColor(22, 101, 52);
    doc.rect(0, 0, 210, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('BUTERE TECHNICAL TRAINING INSTITUTE', 15, 14);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8); // Gold accent
    doc.text('P.O. Box 98-50101, Butere, Kenya • Excellence in Skills Development', 15, 21);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    
    // Sub-header depending on chosen report
    if (activeReport === 'class_attendance') {
      const activeUnit = state.courseUnits.find(u => u.id === selectedUnitId);
      doc.text(`CLASS ATTENDANCE REPORT — ${activeUnit?.name || 'Syllabus'}`, 15, 28);
    } else if (activeReport === 'daily_summary') {
      doc.text(`DAILY ATTENDANCE SUMMARY — DATE: ${dailyDate}`, 15, 28);
    } else {
      doc.text('AT-RISK STUDENTS AUDIT (BELOW 75% ATTENDANCE)', 15, 28);
    }

    doc.setFillColor(234, 179, 8);
    doc.rect(0, 38, 210, 2, 'F'); // gold divider bar

    // Meta blocks
    doc.setTextColor(55, 65, 81);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Academic Year:', 15, 48);
    doc.text('Semester term:', 15, 54);
    doc.text('Report Generated:', 130, 48);
    doc.text('System Integrity:', 130, 54);

    doc.setFont('Helvetica', 'normal');
    doc.text(academicYear, 45, 48);
    doc.text(semester, 45, 54);
    doc.text(generatedDateStr, 165, 48);
    doc.text('Official Certified Registry', 165, 54);

    if (activeReport === 'class_attendance') {
      const activeUnit = state.courseUnits.find(u => u.id === selectedUnitId);
      const course = state.courses.find(c => c.id === activeUnit?.course_id);

      doc.setFont('Helvetica', 'bold');
      doc.text('Subject Unit:', 15, 60);
      doc.text('Course Program:', 15, 66);
      doc.setFont('Helvetica', 'normal');
      doc.text(activeUnit?.name || 'N/A', 45, 60);
      doc.text(course?.name || 'N/A', 45, 66);

      // Warning text bar
      doc.setFillColor(254, 243, 199);
      doc.rect(15, 72, 180, 8, 'F');
      doc.setTextColor(180, 83, 9);
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'bold');
      doc.text('REGISTRY RULE: Students flagged as AT RISK (below 75% sessions) are not eligible to register for exam cards.', 18, 77.5);

      const headers = ['S/No.', 'Admission No.', 'Student Name', 'Phone', 'Attended', 'Total', 'Rate', 'KNEC Status'];
      const rows = classAttendanceData.map((row, index) => [
        index + 1,
        row.admNo,
        row.name,
        row.phone,
        row.attended,
        row.total,
        `${row.percentage}%`,
        row.status
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 84,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 101, 52] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 35 },
          2: { fontStyle: 'bold', cellWidth: 50 },
          3: { cellWidth: 25 },
          4: { halign: 'center', cellWidth: 18 },
          5: { halign: 'center', cellWidth: 18 },
          6: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
          7: { halign: 'center', fontStyle: 'bold', cellWidth: 20 }
        },
        didParseCell: (cell) => {
          if (cell.section === 'body' && cell.column.index === 7) {
            if (cell.cell.raw === 'On Track') {
              cell.cell.styles.textColor = [21, 128, 61];
            } else {
              cell.cell.styles.textColor = [220, 38, 38];
            }
          }
        }
      });

    } else if (activeReport === 'daily_summary') {
      doc.setFont('Helvetica', 'bold');
      doc.text('Audited Date:', 15, 60);
      doc.text('Department Filter:', 15, 66);
      doc.setFont('Helvetica', 'normal');
      doc.text(dailyDate, 45, 60);
      const deptName = selectedDeptId === 'all' ? 'All Departments Combined' : state.departments.find(d => d.id === selectedDeptId)?.name || 'N/A';
      doc.text(deptName, 45, 66);

      const headers = ['S/No.', 'Course Unit', 'Course Program', 'Department', 'Present', 'Absent', 'Excused', 'Total Marked'];
      const rows = dailySummaryData.map((row, idx) => [
        idx + 1,
        row.unitName,
        row.courseName,
        row.deptName,
        row.present,
        row.absent,
        row.excused,
        row.total
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 74,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 101, 52] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { fontStyle: 'bold', cellWidth: 45 },
          2: { cellWidth: 45 },
          3: { cellWidth: 35 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 15 },
          6: { halign: 'center', cellWidth: 15 },
          7: { halign: 'center', fontStyle: 'bold', cellWidth: 15 }
        }
      });

    } else {
      // Risk report
      doc.setFillColor(254, 226, 226);
      doc.rect(15, 60, 180, 8, 'F');
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(8.5);
      doc.setFont('Helvetica', 'bold');
      doc.text('CRITICAL WATCHLIST: Active roster listing of students below the 75% exam sitting benchmark.', 18, 65.5);

      const headers = ['S/No.', 'Admission No.', 'Student Name', 'Course Program', 'Assigned Unit', 'Attendance %', 'Sessions'];
      const rows = atRiskStudentsData.map((row, idx) => [
        idx + 1,
        row.admNo,
        row.name,
        row.courseName,
        row.unitName,
        `${row.percentage}%`,
        `${row.attended} / ${row.total}`
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 72,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] }, // Red for hazard watchlist
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 35 },
          2: { fontStyle: 'bold', cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 40 },
          5: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 15 }
        }
      });
    }

    // PDF FOOTER SIGN-OFF
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY < 275) {
      doc.setDrawColor(229, 231, 235);
      doc.line(15, finalY + 8, 195, finalY + 8);
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      doc.text('Generated by Attendance Management System • Butere Technical Training Institute', 15, finalY + 14);
    }

    doc.save(`AttendanceReport_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Filter lists by quick keyword search
  const searchedClassAttendance = classAttendanceData.filter(row => {
    const q = searchTerm.toLowerCase();
    return row.name.toLowerCase().includes(q) || row.admNo.toLowerCase().includes(q);
  });

  const searchedDailySummary = dailySummaryData.filter(row => {
    const q = searchTerm.toLowerCase();
    return row.unitName.toLowerCase().includes(q) || row.courseName.toLowerCase().includes(q);
  });

  const searchedAtRisk = atRiskStudentsData.filter(row => {
    const q = searchTerm.toLowerCase();
    return row.name.toLowerCase().includes(q) || row.admNo.toLowerCase().includes(q) || row.unitName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Institution Attendance Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate and audit system-wide classroom records, check TVET compliance rates, and export audits.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center"
              title="Refresh database state"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>

          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Segmented Tab control bars */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-1">
        <button
          onClick={() => {
            setActiveReport('class_attendance');
            setSearchTerm('');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeReport === 'class_attendance' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'
          }`}
        >
          1. Class Attendance Report
        </button>

        <button
          onClick={() => {
            setActiveReport('daily_summary');
            setSearchTerm('');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeReport === 'daily_summary' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'
          }`}
        >
          2. Daily Attendance Summary
        </button>

        <button
          onClick={() => {
            setActiveReport('at_risk');
            setSearchTerm('');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeReport === 'at_risk' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'
          }`}
        >
          3. At-Risk Students Watchlist
        </button>
      </div>

      {/* Dynamic Filters depending on chosen tab */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest border-b border-slate-100 pb-3">
          Configure Search Parameters
        </h3>

        {activeReport === 'class_attendance' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {/* Unit ID Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Curriculum Module</label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-bold text-slate-800 cursor-pointer"
              >
                {state.courseUnits.map(unit => {
                  const course = state.courses.find(c => c.id === unit.course_id);
                  return (
                    <option key={unit.id} value={unit.id}>{unit.name} ({course?.name || 'Syllabus'})</option>
                  );
                })}
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-mono font-bold text-slate-800"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-mono font-bold text-slate-800"
              />
            </div>

            {/* Academic Year */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Academic Session</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-mono font-bold text-slate-800 cursor-pointer"
              >
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
              </select>
            </div>

            {/* Semester */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Active Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-mono font-bold text-slate-800 cursor-pointer"
              >
                <option value="Sem 1">Sem 1</option>
                <option value="Sem 2">Sem 2</option>
                <option value="Year 1 Sem 1">Year 1 Sem 1</option>
                <option value="Year 1 Sem 2">Year 1 Sem 2</option>
                <option value="Year 2 Sem 1">Year 2 Sem 1</option>
                <option value="Year 2 Sem 2">Year 2 Sem 2</option>
                <option value="Year 3 Sem 1">Year 3 Sem 1</option>
                <option value="Year 3 Sem 2">Year 3 Sem 2</option>
              </select>
            </div>
          </div>
        )}

        {activeReport === 'daily_summary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">Audited Date</label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-mono font-bold text-slate-800"
              />
            </div>

            {/* Target Department */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono">College Department</label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-bold text-slate-800 cursor-pointer"
              >
                <option value="all">All Departments Combined</option>
                {state.departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeReport === 'at_risk' && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Watchlist Audit:</strong> This report displays any student whose cumulative attendance rate falls below the mandatory <strong>75%</strong> benchmark for any individual subject module. No parameter filtering is needed.
            </span>
          </div>
        )}

        {/* Global Keyword Quicksearch bar */}
        <div className="relative pt-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-5" />
          <input
            type="text"
            placeholder="Quick search tables by name, subject, or admission number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-hidden transition-all text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Main Table Rendering depending on Active Tab */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Title Block */}
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center select-none">
          <span className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest">
            {activeReport === 'class_attendance' && 'Class Attendance Roll Table'}
            {activeReport === 'daily_summary' && 'Daily Attendance Summary Matrix'}
            {activeReport === 'at_risk' && 'TVET Barred Roster Watchlist'}
          </span>
          <span className="text-[10px] font-bold font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
            {activeReport === 'class_attendance' && `${searchedClassAttendance.length} students`}
            {activeReport === 'daily_summary' && `${searchedDailySummary.length} units`}
            {activeReport === 'at_risk' && `${searchedAtRisk.length} entries`}
          </span>
        </div>

        <div className="overflow-x-auto">
          {/* TAB 1: Class Attendance Report */}
          {activeReport === 'class_attendance' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">Adm No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 text-center">Attended Sessions</th>
                  <th className="py-3 px-4 text-center">Total Sessions</th>
                  <th className="py-3 px-4 text-center">Rate</th>
                  <th className="py-3 px-4 text-right">KNEC Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {searchedClassAttendance.length > 0 ? (
                  searchedClassAttendance.map((row, idx) => {
                    const isBelowThreshold = row.percentage < 75;
                    return (
                      <tr 
                        key={row.admNo + idx} 
                        className={`hover:bg-slate-50/40 transition-colors ${
                          isBelowThreshold ? 'bg-red-50/40 text-red-900' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-mono font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {row.admNo}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold block">{row.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{row.phone}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-blue-600">
                          {row.attended}
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-slate-500">
                          {row.total}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-black font-mono text-sm ${isBelowThreshold ? 'text-red-600' : 'text-slate-900'}`}>
                            {row.percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isBelowThreshold ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[10px] font-bold uppercase font-mono">
                              ● Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-md text-[10px] font-bold uppercase font-mono animate-pulse">
                              ● Barred
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      No records match configured criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: Daily Attendance Summary */}
          {activeReport === 'daily_summary' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">Curriculum Unit</th>
                  <th className="py-3 px-4">Course Program</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Present</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4 text-center">Excused</th>
                  <th className="py-3 px-4 text-center font-bold">Total Marked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {searchedDailySummary.length > 0 ? (
                  searchedDailySummary.map((row, idx) => (
                    <tr key={row.unitId} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {row.unitName}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-semibold">
                        {row.courseName}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400 uppercase">
                        {row.deptName}
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono text-emerald-600">
                        {row.present}
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono text-red-500">
                        {row.absent}
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono text-amber-500">
                        {row.excused}
                      </td>
                      <td className="py-3 px-4 text-center font-black font-mono text-slate-900">
                        {row.total}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                      No units have filed roll-calls for the selected date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: At-Risk Students Watchlist */}
          {activeReport === 'at_risk' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">Adm No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Course Program</th>
                  <th className="py-3 px-4">Subject Unit (Low Attendance)</th>
                  <th className="py-3 px-4 text-center">Rate</th>
                  <th className="py-3 px-4 text-right">Marked Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {searchedAtRisk.length > 0 ? (
                  searchedAtRisk.map((row, idx) => (
                    <tr key={row.admNo + row.unitName + idx} className="hover:bg-red-50/20 bg-red-50/5 text-red-900 transition-colors">
                      <td className="py-3 px-4 text-center text-red-400 font-mono font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-red-800">
                        {row.admNo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold block">{row.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{row.phone}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium truncate max-w-[150px]">
                        {row.courseName}
                      </td>
                      <td className="py-3 px-4 font-bold text-red-700 truncate max-w-[150px]">
                        {row.unitName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-black font-mono text-sm text-red-600">
                          {row.percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-500">
                        {row.attended} / {row.total}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      Excellent compliance! No students fall below the 75% threshold in this session query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
