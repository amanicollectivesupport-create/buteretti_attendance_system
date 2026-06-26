import React, { useState } from 'react';
import { DatabaseState, Profile, Course, AttendanceRecord } from '../types';
import { getStudentAttendanceSummary } from '../utils/mockDatabase';
import { exportToExcel, exportToPDF, AttendanceReportRow } from '../utils/export';
import { 
  FileSpreadsheet, FileText, Search, Filter, 
  AlertTriangle, CheckCircle, HelpCircle, GraduationCap, 
  TrendingUp, RefreshCw 
} from 'lucide-react';

interface AdminReportsProps {
  state: DatabaseState;
  onRefresh?: () => void;
}

export default function AdminReports({ state, onRefresh }: AdminReportsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'eligible' | 'barred'>('all');
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [semester, setSemester] = useState('Year 2 Sem 1');

  // Filter students (profiles with role === 'student')
  const students = state.profiles.filter(p => p.role === 'student');

  // Compute reports list
  const reportRows = students.map(student => {
    const course = state.courses.find(c => c.id === student.course_id);
    const summaries = getStudentAttendanceSummary(state, student.id, academicYear, semester);
    
    const totalClasses = summaries.reduce((acc, s) => acc + s.totalClasses, 0);
    const attended = summaries.reduce((acc, s) => acc + s.attended, 0);
    const excused = summaries.reduce((acc, s) => acc + s.excused, 0);
    const absent = summaries.reduce((acc, s) => acc + s.absent, 0);

    const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : 100;

    return {
      studentId: student.id,
      studentName: student.full_name,
      admNo: student.adm_no || 'N/A',
      phone: student.phone || 'N/A',
      courseId: student.course_id || '',
      courseName: course?.name || 'N/A',
      totalClasses,
      attended,
      excused,
      absent,
      percentage,
      isEligible: percentage >= 75
    };
  });

  // Filter report rows based on Search and Dropdowns
  const filteredRows = reportRows.filter(row => {
    const matchesSearch = 
      row.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      row.admNo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCourse = selectedCourseId === 'all' || row.courseId === selectedCourseId;

    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'eligible' && row.isEligible) || 
      (statusFilter === 'barred' && !row.isEligible);

    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Aggregates
  const totalStudents = reportRows.length;
  const filteredCount = filteredRows.length;
  const barredCount = reportRows.filter(r => !r.isEligible).length;
  const overallAvg = reportRows.length > 0 
    ? reportRows.reduce((acc, r) => acc + r.percentage, 0) / reportRows.length 
    : 100;

  // Handle PDF Export
  const handleExportPDF = () => {
    // Format data to match export utility format
    const exportData: AttendanceReportRow[] = filteredRows.map(r => ({
      studentName: r.studentName,
      admNo: r.admNo,
      phone: r.phone,
      presentDays: r.attended,
      absentDays: r.absent,
      excusedDays: r.excused,
      totalDays: r.totalClasses,
      percentage: r.percentage
    }));

    const courseName = selectedCourseId === 'all' 
      ? 'All Courses Combined' 
      : state.courses.find(c => c.id === selectedCourseId)?.name || 'Course Audit';

    exportToPDF(
      exportData,
      'System Attendance Audit',
      courseName,
      academicYear,
      semester,
      'System Registrar'
    );
  };

  // Handle Excel Export
  const handleExportExcel = () => {
    const exportData: AttendanceReportRow[] = filteredRows.map(r => ({
      studentName: r.studentName,
      admNo: r.admNo,
      phone: r.phone,
      presentDays: r.attended,
      absentDays: r.absent,
      excusedDays: r.excused,
      totalDays: r.totalClasses,
      percentage: r.percentage
    }));

    exportToExcel(exportData, 'System_Attendance_Audit', academicYear, semester);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Attendance Audit Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review institution-wide attendance records, eligibility audits, and export official reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-200"
              title="Refresh database"
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

      {/* Aggregate Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Audited */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase font-mono">
            Audited Students
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">{totalStudents}</span>
            <span className="text-xs text-slate-400">enrolled</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Across {state.courses.length} courses
          </div>
        </div>

        {/* Overall Attendance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase font-mono">
            Average Attendance
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-blue-600">{overallAvg.toFixed(1)}%</span>
            <span className="text-xs text-slate-400">overall</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Standard 75% target threshold
          </div>
        </div>

        {/* Barred Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase font-mono">
            Barred Students
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-red-600">{barredCount}</span>
            <span className="text-xs text-slate-400">below 75%</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
            Action required for exam registration
          </div>
        </div>

        {/* Total Records Marked */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase font-mono">
            Marked Records
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">{state.attendance.length}</span>
            <span className="text-xs text-slate-400">records</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            In system-wide registry database
          </div>
        </div>
      </div>

      {/* Filters Board */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
          Report Parameters & Filters
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search student name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-medium"
            />
          </div>

          {/* Filter Course */}
          <div className="relative">
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500 cursor-pointer font-medium text-slate-800"
            >
              <option value="all">All Courses</option>
              {state.courses.map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500 cursor-pointer font-medium text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="eligible">Eligible (75%+)</option>
              <option value="barred">Barred (&lt; 75%)</option>
            </select>
          </div>

          {/* Academic Semester Filter */}
          <div className="relative">
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-500 cursor-pointer font-medium text-slate-800"
            >
              <option value="Year 1 Sem 1">Year 1 Sem 1</option>
              <option value="Year 1 Sem 2">Year 1 Sem 2</option>
              <option value="Year 2 Sem 1">Year 2 Sem 1</option>
              <option value="Year 2 Sem 2">Year 2 Sem 2</option>
              <option value="Year 3 Sem 1">Year 3 Sem 1</option>
              <option value="Year 3 Sem 2">Year 3 Sem 2</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
            Attendance Audit Ledger ({filteredCount} Records)
          </span>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md uppercase font-mono">
            Academic Year {academicYear}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Student Name</th>
                <th className="px-4 py-3">Adm Number</th>
                <th className="px-4 py-3">Registered Program</th>
                <th className="px-4 py-3 text-center">Total Classes</th>
                <th className="px-4 py-3 text-center">Attended</th>
                <th className="px-4 py-3 text-center">Percentage</th>
                <th className="px-5 py-3 text-right">KNEC Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{row.studentName}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">{row.admNo}</td>
                    <td className="px-4 py-3.5 text-slate-600 truncate max-w-[200px]" title={row.courseName}>
                      {row.courseName}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold font-mono text-slate-800">{row.totalClasses}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-emerald-700 font-mono">{row.attended}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`font-bold font-mono text-xs ${
                        row.isEligible ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {row.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {row.isEligible ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold uppercase">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          Barred (KNEC)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-500">No report entries found</p>
                      <p className="text-[11px] leading-relaxed">
                        Try modifying your search or filters to match records inside Butere TTI database.
                      </p>
                    </div>
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
