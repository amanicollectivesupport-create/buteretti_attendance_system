/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DatabaseState, Profile, CourseUnit } from '../types';
import { getStudentAttendanceSummary, StudentAttendanceSummary } from '../utils/mockDatabase';
import { 
  CheckCircle, XCircle, AlertTriangle, GraduationCap, Calendar, 
  TrendingUp, HelpCircle, Award, Compass, FileWarning 
} from 'lucide-react';

interface StudentDashboardProps {
  id?: string;
  state: DatabaseState;
  studentId: string;
}

export default function StudentDashboard({ id, state, studentId }: StudentDashboardProps) {
  const studentProfile = state.profiles.find(p => p.id === studentId);
  const activeCourse = studentProfile ? state.courses.find(c => c.id === studentProfile.course_id) : null;

  // Let's default to Academic Year 2025/2026 and Year 2 Sem 1 as shown in mock data
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [semester, setSemester] = useState('Year 2 Sem 1');

  // Fetch summaries utilizing the SQL-equivalent function emulator
  const summaries = getStudentAttendanceSummary(state, studentId, academicYear, semester);

  // Compute Overall Stats
  const totalClasses = summaries.reduce((acc, s) => acc + s.totalClasses, 0);
  const totalAttended = summaries.reduce((acc, s) => acc + s.attended, 0);
  const totalExcused = summaries.reduce((acc, s) => acc + s.excused, 0);
  const totalAbsent = summaries.reduce((acc, s) => acc + s.absent, 0);
  
  const overallPercentage = totalClasses > 0 
    ? (totalAttended / totalClasses) * 100 
    : 100;

  const isEligible = overallPercentage >= 75;

  // Find detailed attendance logs for this student
  const studentLogs = state.attendance
    .filter(a => a.student_id === studentId && a.academic_year === academicYear && a.semester === semester)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first

  return (
    <div id={id} className="space-y-6">
      {/* Student Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-xl p-6 shadow-md border-b-4 border-yellow-500 relative overflow-hidden">
        {/* Absolute decorative design element to represent Butere TTI */}
        <div className="absolute top-0 right-0 p-8 opacity-10 font-mono text-7xl select-none font-bold">
          BTTI
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
          <div className="space-y-1.5">
            <span className="px-2.5 py-0.5 bg-yellow-500/30 text-yellow-300 font-bold text-[10px] uppercase rounded-full tracking-wider font-mono">
              Student Portal • Academic Year {academicYear}
            </span>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">{studentProfile?.full_name}</h2>
            <div className="text-xs text-emerald-100 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-yellow-400" /> {activeCourse?.name}
              </span>
              <span className="font-mono bg-emerald-900/40 px-2 py-0.5 rounded text-emerald-200">
                ADM: {studentProfile?.adm_no}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className={`p-3 rounded-full text-white flex items-center justify-center font-bold text-lg font-mono w-14 h-14 border-4 border-white/20 ${
              isEligible ? 'bg-green-700' : 'bg-red-600'
            }`}>
              {overallPercentage.toFixed(0)}%
            </div>
            <div>
              <div className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider font-mono">Overall Rate</div>
              <div className="text-xs font-bold text-white uppercase mt-0.5">
                {isEligible ? '✓ EXAM ELIGIBLE' : '⚠ BARRED FROM EXAMS'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extreme Alert Warning Box if overall attendance is below 75% */}
      {!isEligible && (
        <div id="student-barred-warning" className="bg-red-50 border-l-4 border-red-600 text-red-900 rounded-xl p-5 flex items-start gap-3.5 shadow-xs">
          <FileWarning className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-red-800">Severe Warning: Attendance Rate Below Mandate ({overallPercentage.toFixed(1)}%)</h4>
            <p className="text-xs text-red-700 leading-relaxed">
              Pursuant to the **Butere Technical Training Institute Academic Attendance Mandate**, a student must record a minimum attendance of **75%** in each unit to qualify for Kenyan National Examinations Council (KNEC) final assessments. 
              You are currently flagged as **BARRED** from your exams for this semester. Please report to the ICT/Engineering department registrar immediately to rectify your status.
            </p>
          </div>
        </div>
      )}

      {/* Grid of Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase font-mono">Total Lectures</div>
            <div className="text-lg font-bold text-gray-900">{totalClasses} Sessions</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-green-50 rounded-lg text-green-700">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase font-mono">Attended</div>
            <div className="text-lg font-bold text-gray-900">{totalAttended} Present</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-700">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase font-mono">Excused</div>
            <div className="text-lg font-bold text-gray-900">{totalExcused} Absences</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-red-50 rounded-lg text-red-600">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase font-mono">Unexcused Absences</div>
            <div className="text-lg font-bold text-gray-900">{totalAbsent} Absent</div>
          </div>
        </div>
      </div>

      {/* Unit Progress Breakdown Cards */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
          <TrendingUp className="w-4.5 h-4.5 text-emerald-700" /> Unit-by-Unit Attendance Audit
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {summaries.map((summary, idx) => {
            const hasClass = summary.totalClasses > 0;
            const meetsCriteria = summary.percentage >= 75;
            
            // Progress bar coloring
            const barColor = summary.percentage >= 75 
              ? 'bg-green-600' 
              : summary.percentage >= 65 ? 'bg-amber-500' : 'bg-red-500';

            return (
              <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-xs">{summary.unitName}</h4>
                    <span className="text-[9px] text-gray-400 font-mono">UNIT CODE: {summary.unitId.toUpperCase()}</span>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${
                    meetsCriteria ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {summary.percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="space-y-1.5">
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${barColor}`} 
                      style={{ width: `${summary.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>Progressive Target: 75%</span>
                    <span>Current: {summary.percentage.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Granular metrics */}
                <div className="grid grid-cols-4 gap-2 text-center text-[10px] border-t border-gray-100 pt-3">
                  <div>
                    <div className="text-gray-400">Total Lectures</div>
                    <div className="font-bold text-gray-900 mt-0.5">{summary.totalClasses}</div>
                  </div>
                  <div>
                    <div className="text-emerald-700 font-medium">Present</div>
                    <div className="font-bold text-emerald-800 mt-0.5">{summary.attended}</div>
                  </div>
                  <div>
                    <div className="text-amber-700 font-medium">Excused</div>
                    <div className="font-bold text-amber-800 mt-0.5">{summary.excused}</div>
                  </div>
                  <div>
                    <div className="text-red-600 font-medium">Absent</div>
                    <div className="font-bold text-red-700 mt-0.5">{summary.absent}</div>
                  </div>
                </div>

                {/* Criteria state tag label */}
                <div className={`p-2 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 ${
                  meetsCriteria ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {meetsCriteria ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" /> Eligible for KNEC assessments. Keep it up!
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> BELOW MANDATE! Barred from KNEC final exams in this unit.
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session Logs / Calendar Attendance */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4.5 h-4.5 text-emerald-700" /> Daily Lesson & Attendance Log
          </h3>
          <span className="text-[10px] font-mono text-gray-400">Current Semester</span>
        </div>

        {studentLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            No attendance sessions have been logged for you yet this semester.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {studentLogs.map((log) => {
              const unit = state.courseUnits.find(u => u.id === log.unit_id);
              const lect = state.profiles.find(p => p.id === log.lecturer_id);
              
              return (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/30 transition-all">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-800 text-xs">{unit?.name}</div>
                    <div className="text-[10px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-mono">Date: {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>Lecturer: {lect?.full_name || 'Faculty Member'}</span>
                    </div>
                  </div>

                  <span className={`px-3 py-1 font-bold text-xs rounded-full w-fit ${
                    log.status === 'Present' ? 'bg-green-100 text-green-800' :
                    log.status === 'Absent' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {log.status === 'Present' ? '✓ Present' :
                     log.status === 'Absent' ? '✗ Absent' : '⏰ Excused'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
