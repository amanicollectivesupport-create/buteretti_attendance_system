import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseReal } from '../../lib/supabaseClient';
import { getCurrentSemesterInfo, getInitials } from '../../lib/attendanceHelpers';
import { 
  AlertCircle, ChevronDown, Check, Save, Notebook, RefreshCw, AlertTriangle, Users 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function MarkAttendance({ state, lecturerId, onUpdate }) {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();

  // Selection state
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  
  // Roster state
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { [student_id]: 'Present' | 'Absent' | 'Excused' }
  const [isEditMode, setIsEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [studentAtRiskMap, setStudentAtRiskMap] = useState({}); // { [student_id]: boolean }

  // Initialize and load assigned units
  useEffect(() => {
    const semInfo = getCurrentSemesterInfo();
    setSelectedYear(semInfo.academicYear);
    setSelectedSemester(semInfo.semester);

    const fetchAssignedUnits = async () => {
      if (!profile?.id) return;
      setLoadingUnits(true);
      try {
        const { data, error } = await supabase
          .from('lecturer_units')
          .select('unit_id, course_units!inner(id, name, course_id, semester, year_of_study)')
          .eq('lecturer_id', profile.id);

        if (error) throw error;

        const mappedUnits = data?.map(d => d.course_units) || [];
        setUnits(mappedUnits);

        // Pre-select unit if provided in search params
        const urlUnit = searchParams.get('unit');
        if (urlUnit && mappedUnits.some(u => u.id === urlUnit)) {
          setSelectedUnit(urlUnit);
        } else if (mappedUnits.length > 0) {
          setSelectedUnit(mappedUnits[0].id);
        }
      } catch (e) {
        toast.error('Error fetching assigned units: ' + e.message);
      } finally {
        setLoadingUnits(false);
      }
    };

    fetchAssignedUnits();
  }, [profile?.id, searchParams]);

  // Load students and existing attendance
  const handleLoadStudents = async () => {
    if (!selectedUnit) {
      toast.error('Please select a course unit first.');
      return;
    }
    setLoadingRoster(true);
    setRosterLoaded(false);
    try {
      // 1. Get Course ID for selected unit
      const selectedUnitDetails = units.find(u => u.id === selectedUnit);
      if (!selectedUnitDetails) throw new Error('Selected unit details not found.');

      // 2. Fetch student profiles enrolled in this course
      const { data: studentProfiles, error: studErr } = await supabase
        .from('profiles')
        .select('id, full_name, adm_no, course_id')
        .eq('role', 'student')
        .eq('course_id', selectedUnitDetails.course_id);

      if (studErr) throw studErr;
      const fetchedStudents = studentProfiles || [];
      setStudents(fetchedStudents);

      // 3. Fetch existing attendance records for unit + date combination
      const { data: existingRecords, error: attErr } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('unit_id', selectedUnit)
        .eq('date', selectedDate);

      if (attErr) throw attErr;

      const existingMap = {};
      (existingRecords || []).forEach(rec => {
        existingMap[rec.student_id] = rec.status;
      });

      // If existing records found, we are in Edit Mode
      const hasExisting = (existingRecords || []).length > 0;
      setIsEditMode(hasExisting);

      // Initialize attendance dictionary (Default to 'Present')
      const initialAttendance = {};
      fetchedStudents.forEach(student => {
        initialAttendance[student.id] = existingMap[student.id] || 'Present';
      });
      setAttendance(initialAttendance);

      // 4. Fetch overall attendance for this unit to flag at-risk students (< 75%)
      const { data: allUnitAttendance, error: allAttErr } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('unit_id', selectedUnit);

      if (!allAttErr && allUnitAttendance) {
        const studentUnitAttendanceMap = {};
        allUnitAttendance.forEach(att => {
          if (!studentUnitAttendanceMap[att.student_id]) {
            studentUnitAttendanceMap[att.student_id] = { attended: 0, total: 0 };
          }
          studentUnitAttendanceMap[att.student_id].total += 1;
          if (att.status === 'Present' || att.status === 'Excused') {
            studentUnitAttendanceMap[att.student_id].attended += 1;
          }
        });

        const riskMap = {};
        fetchedStudents.forEach(student => {
          const stats = studentUnitAttendanceMap[student.id];
          if (stats && stats.total > 0) {
            const pct = (stats.attended / stats.total) * 100;
            riskMap[student.id] = pct < 75;
          } else {
            riskMap[student.id] = false; // No records yet, not at risk
          }
        });
        setStudentAtRiskMap(riskMap);
      }

      setRosterLoaded(true);
      if (hasExisting) {
        toast.success('Roster loaded with existing marked records.');
      } else {
        toast.success('Fresh roster loaded.');
      }
    } catch (e) {
      toast.error('Failed to load student list: ' + e.message);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const markAll = (status) => {
    const updated = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setAttendance(updated);
    toast.success(`All set to ${status}`);
  };

  const handleSubmitAttendance = async () => {
    if (!selectedUnit || students.length === 0) return;
    setSubmitting(true);
    try {
      const records = students.map(s => ({
        student_id: s.id,
        unit_id: selectedUnit,
        lecturer_id: profile.id,
        date: selectedDate,
        status: attendance[s.id] || 'Present',
        academic_year: selectedYear,
        semester: String(selectedSemester || '1')
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { 
          onConflict: 'student_id,unit_id,date' 
        });

      if (error) throw error;

      toast.success(`Attendance saved — ${students.length} students marked successfully.`);
      
      // Update parent state
      const dbStateStr = localStorage.getItem('butere_tti_attendance_db');
      if (dbStateStr && onUpdate) {
        try {
          onUpdate(JSON.parse(dbStateStr));
        } catch (err) {
          console.error('onUpdate error:', err);
        }
      }

      // Reload roster with fresh data
      handleLoadStudents();
    } catch (e) {
      toast.error('Failed to save attendance: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Compute live statistics
  const countPresent = Object.values(attendance).filter(status => status === 'Present').length;
  const countAbsent = Object.values(attendance).filter(status => status === 'Absent').length;
  const countExcused = Object.values(attendance).filter(status => status === 'Excused').length;

  const selectedUnitDetails = units.find(u => u.id === selectedUnit);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-[18px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Notebook className="w-5 h-5 text-blue-600" />
          Mark Attendance
        </h2>
        <p className="text-[12.5px] text-gray-500 mt-0.5">
          Select a unit and mark students for today. Keep records up-to-date.
        </p>
      </div>

      {/* STEP 1 — SELECTION BAR (Sticky) */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-2xs sticky top-16 z-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Unit selector */}
          <div className="space-y-1 md:col-span-4">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Course Unit
            </label>
            <div className="relative">
              <select
                value={selectedUnit}
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  setRosterLoaded(false);
                }}
                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
              >
                <option value="">Select unit...</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} (Yr {unit.year_of_study})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setRosterLoaded(false);
              }}
              max={new Date().toISOString().split('T')[0]}
              className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
            />
          </div>

          {/* Academic Year */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Academic Year
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setRosterLoaded(false);
                }}
                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
              >
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Semester Selector */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Semester
            </label>
            <div className="relative">
              <select
                value={selectedSemester}
                onChange={(e) => {
                  setSelectedSemester(e.target.value);
                  setRosterLoaded(false);
                }}
                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8"
              >
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Action Button */}
          <div className="md:col-span-2">
            <button
              onClick={handleLoadStudents}
              disabled={loadingUnits || loadingRoster || !selectedUnit}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loadingRoster ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" /> Load students
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* STEP 2 — ATTENDANCE TABLE */}
      {rosterLoaded && (
        <div className="space-y-4">
          {/* Info and Bulk actions bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 shadow-2xs">
            <div className="text-xs">
              <p className="font-bold text-gray-800">
                {students.length} students &middot; {selectedUnitDetails?.name}
              </p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                Session: {selectedDate} ({selectedYear} Sem {selectedSemester})
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => markAll('Present')}
                className="px-3 py-1.5 border border-green-200 bg-green-50/50 hover:bg-green-50 text-green-700 rounded-lg text-[10.5px] font-bold uppercase transition-colors cursor-pointer"
              >
                Mark all present
              </button>
              <button
                onClick={() => markAll('Absent')}
                className="px-3 py-1.5 border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 rounded-lg text-[10.5px] font-bold uppercase transition-colors cursor-pointer"
              >
                Mark all absent
              </button>
            </div>
          </div>

          {/* Edit mode warning banner */}
          {isEditMode && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Existing Record Found!</span> Attendance already marked for this session. You are currently editing existing records. Saving will overwrite previous states.
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-gray-700">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono sticky top-0 z-10">
                    <th className="py-3 px-4 w-[40px] text-center">#</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4 text-center w-[120px] bg-green-50/10">Present</th>
                    <th className="py-3 px-4 text-center w-[120px] bg-red-50/10">Absent</th>
                    <th className="py-3 px-4 text-center w-[120px] bg-amber-50/10">Excused</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.length > 0 ? (
                    students.map((student, idx) => {
                      const initial = getInitials(student.full_name);
                      const currentStatus = attendance[student.id] || 'Present';
                      const isAtRisk = studentAtRiskMap[student.id];

                      return (
                        <tr key={student.id} className="hover:bg-gray-50/40 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-gray-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-[26px] h-[26px] bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-gray-800 truncate">{student.full_name}</p>
                                  {isAtRisk && (
                                    <span 
                                      className="inline-flex text-red-500"
                                      title="Below 75% — at risk of being barred"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tight">
                                  {student.adm_no || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Present Column */}
                          <td 
                            onClick={() => handleStatusChange(student.id, 'Present')}
                            className={`p-1.5 text-center cursor-pointer select-none transition-all ${
                              currentStatus === 'Present' 
                                ? 'bg-green-50 text-green-700 font-bold border-x border-green-200' 
                                : 'hover:bg-green-50/10'
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                checked={currentStatus === 'Present'}
                                onChange={() => handleStatusChange(student.id, 'Present')}
                                className="w-4.5 h-4.5 accent-green-600 cursor-pointer"
                              />
                            </div>
                          </td>

                          {/* Absent Column */}
                          <td 
                            onClick={() => handleStatusChange(student.id, 'Absent')}
                            className={`p-1.5 text-center cursor-pointer select-none transition-all ${
                              currentStatus === 'Absent' 
                                ? 'bg-red-50 text-red-700 font-bold border-x border-red-200' 
                                : 'hover:bg-red-50/10'
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                checked={currentStatus === 'Absent'}
                                onChange={() => handleStatusChange(student.id, 'Absent')}
                                className="w-4.5 h-4.5 accent-red-600 cursor-pointer"
                              />
                            </div>
                          </td>

                          {/* Excused Column */}
                          <td 
                            onClick={() => handleStatusChange(student.id, 'Excused')}
                            className={`p-1.5 text-center cursor-pointer select-none transition-all ${
                              currentStatus === 'Excused' 
                                ? 'bg-amber-50 text-amber-700 font-bold border-x border-amber-200' 
                                : 'hover:bg-amber-50/10'
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                checked={currentStatus === 'Excused'}
                                onChange={() => handleStatusChange(student.id, 'Excused')}
                                className="w-4.5 h-4.5 accent-amber-600 cursor-pointer"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">
                        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        No students enrolled in this course.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* STEP 3 — SUBMIT */}
          {students.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-2xs space-y-4">
              {/* Live Count Summary */}
              <div className="flex justify-between items-center text-xs font-bold border-b border-gray-50 pb-3">
                <span className="text-gray-400 uppercase tracking-wider">Attendance Summary</span>
                <div className="flex gap-4 font-mono">
                  <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                    {countPresent} Present
                  </span>
                  <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                    {countAbsent} Absent
                  </span>
                  <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    {countExcused} Excused
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitAttendance}
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save attendance &mdash; {students.length} students
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
