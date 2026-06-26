/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DatabaseState, Profile, CourseUnit, AttendanceRecord, AttendanceStatus } from '../types';
import { exportToExcel, exportToPDF, AttendanceReportRow } from '../utils/export';
import { 
  Calendar, CheckCircle, XCircle, AlertCircle, 
  FileSpreadsheet, FileText, Check, Save, Clock, BarChart3, Users, GraduationCap 
} from 'lucide-react';

interface LecturerDashboardProps {
  id?: string;
  state: DatabaseState;
  lecturerId: string;
  onUpdate: (newState: DatabaseState) => void;
}

export default function LecturerDashboard({ id, state, lecturerId, onUpdate }: LecturerDashboardProps) {
  // Current lecturer profile details
  const lecturerProfile = state.profiles.find(p => p.id === lecturerId);

  // Find allocations assigned to this lecturer
  const myAllocations = state.lecturerUnits.filter(a => a.lecturer_id === lecturerId);
  
  // States for marking panel
  const [selectedAllocId, setSelectedAllocId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rosterStatus, setRosterStatus] = useState<Record<string, AttendanceStatus>>({});
  
  // Feedback alerts
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  // Find the selected allocation and its unit/course details
  const activeAllocation = state.lecturerUnits.find(a => a.id === selectedAllocId);
  const activeUnit = activeAllocation ? state.courseUnits.find(u => u.id === activeAllocation.unit_id) : null;
  const activeCourse = activeUnit ? state.courses.find(c => c.id === activeUnit.course_id) : null;

  // Auto-select the first allocation if none selected
  useEffect(() => {
    if (myAllocations.length > 0 && !selectedAllocId) {
      setSelectedAllocId(myAllocations[0].id);
    }
  }, [myAllocations, selectedAllocId]);

  // Find students enrolled in the active allocation's course
  const enrolledStudents = activeCourse 
    ? state.profiles.filter(p => p.role === 'student' && p.course_id === activeCourse.id)
    : [];

  // Load existing attendance if already marked for this unit + date
  useEffect(() => {
    if (activeUnit && selectedDate) {
      const existingRecords = state.attendance.filter(
        a => a.unit_id === activeUnit.id && a.date === selectedDate
      );

      const statusMap: Record<string, AttendanceStatus> = {};
      enrolledStudents.forEach(student => {
        const found = existingRecords.find(r => r.student_id === student.id);
        statusMap[student.id] = found ? found.status : 'Present'; // Default to Present
      });

      setRosterStatus(statusMap);
    }
  }, [selectedAllocId, selectedDate, state.attendance, enrolledStudents.length]);

  // Handle individual status change
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setRosterStatus(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Speed-marking actions
  const markAll = (status: AttendanceStatus) => {
    const newMap: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(s => {
      newMap[s.id] = status;
    });
    setRosterStatus(newMap);
    triggerAlert(`All students marked as ${status}`);
  };

  // Save/Submit attendance
  const handleSaveAttendance = () => {
    if (!activeAllocation || !activeUnit) {
      triggerAlert('Please select a valid unit allocation', 'error');
      return;
    }

    // Prepare updated attendance rows
    // Filter out previous records for this unit and date first
    const filteredAttendance = state.attendance.filter(
      a => !(a.unit_id === activeUnit.id && a.date === selectedDate)
    );

    const newRecords: AttendanceRecord[] = enrolledStudents.map((student, idx) => ({
      id: `att-rec-${Date.now()}-${idx}`,
      student_id: student.id,
      unit_id: activeUnit.id,
      lecturer_id: lecturerId,
      date: selectedDate,
      status: rosterStatus[student.id] || 'Present',
      marked_at: new Date().toISOString(),
      academic_year: activeAllocation.academic_year,
      semester: activeAllocation.semester
    }));

    onUpdate({
      ...state,
      attendance: [...filteredAttendance, ...newRecords]
    });

    triggerAlert('Attendance records saved and locked successfully!');
  };

  // ----------------------------------------------------
  // REPORT CALCULATIONS (For analytics & exporting)
  // ----------------------------------------------------
  const calculateReportData = (): AttendanceReportRow[] => {
    if (!activeUnit || !activeAllocation) return [];

    // All distinct dates attendance has been marked for this unit
    const allUnitDates = Array.from(new Set(
      state.attendance
        .filter(a => a.unit_id === activeUnit.id)
        .map(a => a.date)
    ));

    return enrolledStudents.map(student => {
      const studentRecords = state.attendance.filter(
        a => a.unit_id === activeUnit.id && a.student_id === student.id
      );

      const presentDays = studentRecords.filter(r => r.status === 'Present').length;
      const absentDays = studentRecords.filter(r => r.status === 'Absent').length;
      const excusedDays = studentRecords.filter(r => r.status === 'Excused').length;
      const totalDays = studentRecords.length;

      // Rate: Present days / Conducted days (if 0, default to 100%)
      const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 100;

      return {
        studentName: student.full_name,
        admNo: student.adm_no || 'N/A',
        phone: student.phone,
        presentDays,
        absentDays,
        excusedDays,
        totalDays,
        percentage
      };
    });
  };

  const reportRows = calculateReportData();
  
  // Lecturer Analytics Summaries
  const totalConductedClasses = Array.from(new Set(
    activeUnit ? state.attendance.filter(a => a.unit_id === activeUnit.id).map(a => a.date) : []
  )).length;

  const classAverage = reportRows.length > 0
    ? reportRows.reduce((acc, row) => acc + row.percentage, 0) / reportRows.length
    : 100;

  const barredCount = reportRows.filter(r => r.percentage < 75 && r.totalDays > 0).length;

  // Export triggers
  const triggerExcelExport = () => {
    if (!activeUnit || !activeAllocation) return;
    exportToExcel(reportRows, activeUnit.name, activeAllocation.academic_year, activeAllocation.semester);
    triggerAlert('Excel export generated!');
  };

  const triggerPDFExport = () => {
    if (!activeUnit || !activeAllocation || !activeCourse) return;
    exportToPDF(
      reportRows, 
      activeUnit.name, 
      activeCourse.name, 
      activeAllocation.academic_year, 
      activeAllocation.semester, 
      lecturerProfile?.full_name || 'Assigned Lecturer'
    );
    triggerAlert('Official PDF report generated!');
  };

  if (myAllocations.length === 0) {
    return (
      <div id={id} className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
        <h3 className="font-bold text-sm">No Units Assigned</h3>
        <p className="text-xs mt-1 text-amber-800">
          You are currently not allocated to any course units in Butere TTI. Please contact the registrar administrator to assign you teaching units.
        </p>
      </div>
    );
  }

  return (
    <div id={id} className="space-y-6">
      {/* Dynamic Alert Banner */}
      {alert && (
        <div id="lecturer-alert" className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm animate-bounce ${
          alert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {alert.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Top Selector Ribbon */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Select Assigned Course Unit</label>
          <select
            id="lect-select-unit"
            value={selectedAllocId}
            onChange={(e) => setSelectedAllocId(e.target.value)}
            className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
          >
            {myAllocations.map(alloc => {
              const unit = state.courseUnits.find(u => u.id === alloc.unit_id);
              const crs = unit ? state.courses.find(c => c.id === unit.course_id) : null;
              return (
                <option key={alloc.id} value={alloc.id}>
                  {unit?.name} ({crs?.name.split(' ')[0]}) - {alloc.semester}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider font-mono">Lecture / Register Date</label>
          <div className="relative">
            <input
              id="lect-select-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            id="btn-speed-present"
            type="button"
            onClick={() => markAll('Present')}
            className="flex-1 py-2.5 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200 cursor-pointer transition-all"
          >
            Mark All Present
          </button>
          <button
            id="btn-speed-absent"
            type="button"
            onClick={() => markAll('Absent')}
            className="flex-1 py-2.5 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold border border-red-200 cursor-pointer transition-all"
          >
            Mark All Absent
          </button>
        </div>
      </div>

      {/* Roster Marking Grid & Sidebar Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Student List to Mark */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-4 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{activeUnit?.name}</h3>
              <p className="text-[11px] text-gray-500">
                Enrolled Program: <span className="font-medium text-gray-700">{activeCourse?.name}</span>
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 font-semibold rounded-md">
              {enrolledStudents.length} Students Registered
            </span>
          </div>

          {enrolledStudents.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              No students are currently enrolled in this program. Register students in the admin panel to populate this roster.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {enrolledStudents.map((student) => {
                const currentStatus = rosterStatus[student.id] || 'Present';
                return (
                  <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        {student.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 text-xs">{student.full_name}</div>
                        <div className="font-mono text-[10px] text-gray-400 mt-0.5">{student.adm_no} • {student.phone}</div>
                      </div>
                    </div>

                    {/* Checkbox Group Status Selection */}
                    <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg w-fit">
                      <button
                        id={`btn-mark-p-${student.id}`}
                        type="button"
                        onClick={() => handleStatusChange(student.id, 'Present')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                          currentStatus === 'Present' 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Present
                      </button>
                      
                      <button
                        id={`btn-mark-a-${student.id}`}
                        type="button"
                        onClick={() => handleStatusChange(student.id, 'Absent')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                          currentStatus === 'Absent' 
                            ? 'bg-red-600 text-white shadow-xs' 
                            : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Absent
                      </button>
                      
                      <button
                        id={`btn-mark-e-${student.id}`}
                        type="button"
                        onClick={() => handleStatusChange(student.id, 'Excused')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                          currentStatus === 'Excused' 
                            ? 'bg-amber-600 text-white shadow-xs' 
                            : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" /> Excused
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
            <button
              id="btn-save-roster"
              type="button"
              onClick={handleSaveAttendance}
              disabled={enrolledStudents.length === 0}
              className="flex items-center gap-1.5 px-5 py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> Lock & Submit Attendance
            </button>
          </div>
        </div>

        {/* Right Column: Class Analytics & Export Section */}
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
            <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-emerald-700" /> Academic Audit & Analytics
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                <div className="text-[10px] text-emerald-800 font-semibold uppercase font-mono">Conducted</div>
                <div className="text-xl font-bold text-emerald-950 mt-1">{totalConductedClasses} Classes</div>
              </div>
              <div className={`p-3 rounded-lg border ${
                classAverage >= 75 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
              }`}>
                <div className="text-[10px] text-gray-500 font-semibold uppercase font-mono">Class Avg %</div>
                <div className={`text-xl font-bold mt-1 ${
                  classAverage >= 75 ? 'text-emerald-950' : 'text-red-950'
                }`}>{classAverage.toFixed(1)}%</div>
              </div>
            </div>

            {/* TVET Exam Eligibility Gauge */}
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] text-red-800 font-bold uppercase font-mono">Barred Candidates ({"<75%"})</div>
                <div className="text-sm font-semibold text-red-950 mt-0.5">{barredCount} {barredCount === 1 ? 'Student is' : 'Students are'} ineligible for KNEC Exams</div>
              </div>
            </div>
          </div>

          {/* Export / Document Generation Options */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
            <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> Export Official Registers
            </h4>
            <p className="text-[11px] text-gray-500">
              Generate signed summaries for submission to the Head of Department (HOD) and the Academic Registrar.
            </p>

            <div className="space-y-2">
              <button
                id="btn-export-pdf"
                type="button"
                onClick={triggerPDFExport}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4" /> Download Official PDF Report
              </button>
              
              <button
                id="btn-export-excel"
                type="button"
                onClick={triggerExcelExport}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> Export to Excel Spreadsheet
              </button>
            </div>
          </div>

          {/* Student warning summary roster list */}
          {reportRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
              <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-3">Unit Attendance Leaderboard</h4>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {reportRows.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700 truncate max-w-[130px]">{row.studentName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-400 text-[10px]">{row.presentDays}/{row.totalDays}</span>
                      <span className={`font-bold ${row.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                        {row.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
