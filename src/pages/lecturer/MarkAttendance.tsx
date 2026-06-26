import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState, Profile, CourseUnit, LecturerUnit, AttendanceRecord, AttendanceStatus } from '../../types';
import { 
  BookmarkCheck, Calendar, Users, Search, Save, Loader2, 
  CheckCircle, AlertCircle, RefreshCw, Check, X, ShieldAlert 
} from 'lucide-react';

interface MarkAttendanceProps {
  state: DatabaseState;
  lecturerId: string;
  onUpdate: (newState: DatabaseState) => Promise<void>;
}

export default function MarkAttendance({ state, lecturerId, onUpdate }: MarkAttendanceProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlUnitId = searchParams.get('unitId') || '';

  // Step 1: Settings State
  const [selectedUnitId, setSelectedUnitId] = useState<string>(urlUnitId);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [academicYear, setAcademicYear] = useState<string>('2025/2026');
  const [semester, setSemester] = useState<string>('Sem 1');

  // Step 2: Students & Attendance Mapping State
  const [students, setStudents] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [existingRecordIds, setExistingRecordIds] = useState<Record<string, string>>({}); // student_id -> attendance_record_id for strict correlation

  // Interface states
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);

  // Get units assigned to this lecturer
  const myAllocations = state.lecturerUnits.filter(lu => lu.lecturer_id === lecturerId);
  const myAssignedUnits = state.courseUnits.filter(u => 
    myAllocations.some(alloc => alloc.unit_id === u.id)
  );

  // Auto pre-fill default selection when component loads or allocations update
  useEffect(() => {
    if (urlUnitId) {
      setSelectedUnitId(urlUnitId);
    } else if (myAssignedUnits.length > 0 && !selectedUnitId) {
      setSelectedUnitId(myAssignedUnits[0].id);
    }
  }, [urlUnitId, myAssignedUnits]);

  // Adjust default academic year/semester selection when unit changes
  useEffect(() => {
    if (selectedUnitId) {
      const activeUnit = state.courseUnits.find(u => u.id === selectedUnitId);
      const activeAlloc = state.lecturerUnits.find(
        lu => lu.lecturer_id === lecturerId && lu.unit_id === selectedUnitId
      );
      if (activeAlloc) {
        setAcademicYear(activeAlloc.academic_year);
        setSemester(activeAlloc.semester || `Year ${activeUnit?.year_of_study || 1} Sem ${activeUnit?.semester || 1}`);
      } else if (activeUnit) {
        setSemester(`Year ${activeUnit.year_of_study} Sem ${activeUnit.semester}`);
      }
    }
  }, [selectedUnitId, state.courseUnits, state.lecturerUnits, lecturerId]);

  // Fetch / filter students and preload attendance records
  useEffect(() => {
    const loadClassListAndAttendance = async () => {
      if (!selectedUnitId) {
        setStudents([]);
        setAttendanceMap({});
        return;
      }

      setLoading(true);
      setSuccessMsg(null);
      setErrorMsg(null);
      setIsPreloaded(false);

      const activeUnit = state.courseUnits.find(u => u.id === selectedUnitId);
      if (!activeUnit) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // 1. Load course student list
      let classList: Profile[] = [];
      const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

      if (isSupabaseConfigured) {
        try {
          const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .eq('course_id', activeUnit.course_id);

          if (profErr) throw profErr;
          classList = profiles || [];
        } catch (err: any) {
          console.warn('Fallback to local state students list', err);
          classList = state.profiles.filter(p => p.role === 'student' && p.course_id === activeUnit.course_id);
        }
      } else {
        classList = state.profiles.filter(p => p.role === 'student' && p.course_id === activeUnit.course_id);
      }

      // Sort students by admission number or full name
      classList.sort((a, b) => (a.adm_no || '').localeCompare(b.adm_no || ''));
      setStudents(classList);

      // 2. Preload existing attendance records for (selectedUnitId, date)
      let preloadedMap: Record<string, AttendanceStatus> = {};
      let recIdMap: Record<string, string> = {};
      let foundExisting = false;

      if (isSupabaseConfigured) {
        try {
          const { data: attendance, error: attErr } = await supabase
            .from('attendance')
            .select('*')
            .eq('unit_id', selectedUnitId)
            .eq('date', date);

          if (attErr) throw attErr;

          if (attendance && attendance.length > 0) {
            attendance.forEach((rec: any) => {
              preloadedMap[rec.student_id] = rec.status as AttendanceStatus;
              recIdMap[rec.student_id] = rec.id;
            });
            foundExisting = true;
          }
        } catch (err) {
          console.warn('Preloading existing attendance from local state backup', err);
          const localAtt = state.attendance.filter(a => a.unit_id === selectedUnitId && a.date === date);
          if (localAtt.length > 0) {
            localAtt.forEach(rec => {
              preloadedMap[rec.student_id] = rec.status;
              recIdMap[rec.student_id] = rec.id;
            });
            foundExisting = true;
          }
        }
      } else {
        const localAtt = state.attendance.filter(a => a.unit_id === selectedUnitId && a.date === date);
        if (localAtt.length > 0) {
          localAtt.forEach(rec => {
            preloadedMap[rec.student_id] = rec.status;
            recIdMap[rec.student_id] = rec.id;
          });
          foundExisting = true;
        }
      }

      // 3. Populate default "Present" state for student accounts that lack records
      const initialMap: Record<string, AttendanceStatus> = {};
      classList.forEach(student => {
        initialMap[student.id] = preloadedMap[student.id] || 'Present';
      });

      setAttendanceMap(initialMap);
      setExistingRecordIds(recIdMap);
      setIsPreloaded(foundExisting);
      setLoading(false);
    };

    loadClassListAndAttendance();
  }, [selectedUnitId, date, state.courseUnits, state.profiles, state.attendance]);

  const handleUpdateStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleBulkMark = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach(student => {
      updated[student.id] = status;
    });
    setAttendanceMap(updated);
  };

  const handleSaveAttendance = async () => {
    if (!selectedUnitId) {
      setErrorMsg('Please select a course unit.');
      return;
    }
    if (students.length === 0) {
      setErrorMsg('No students registered for this program syllabus.');
      return;
    }

    setSubmitLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    const nowISO = new Date().toISOString();

    // Prepare full list of record payloads
    const records = students.map(student => {
      const existingId = existingRecordIds[student.id];
      return {
        id: existingId || crypto.randomUUID(),
        student_id: student.id,
        unit_id: selectedUnitId,
        lecturer_id: lecturerId,
        date: date,
        status: attendanceMap[student.id] || 'Present',
        marked_at: nowISO,
        academic_year: academicYear,
        semester: semester
      };
    });

    try {
      if (isSupabaseConfigured) {
        // Upsert all attendance records in a single batch on conflict of (student_id, unit_id, date)
        const { error: upsertErr } = await supabase
          .from('attendance')
          .upsert(records, { onConflict: 'student_id,unit_id,date' });

        if (upsertErr) throw upsertErr;
      }

      // Always sync with the parent React databaseState to ensure instant offline-friendly updates
      const restOfAttendance = state.attendance.filter(
        a => !(a.unit_id === selectedUnitId && a.date === date)
      );

      const updatedState: DatabaseState = {
        ...state,
        attendance: [...restOfAttendance, ...records]
      };

      await onUpdate(updatedState);

      // Re-query existing record IDs to prevent subsequent double insertion issues
      const newRecIds: Record<string, string> = {};
      records.forEach(r => {
        newRecIds[r.student_id] = r.id;
      });
      setExistingRecordIds(newRecIds);
      setIsPreloaded(true);

      setSuccessMsg(`${students.length} students marked successfully! Roll submitted.`);
      
      // Auto scroll to top on success
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while saving attendance.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filter student list by quick keyword query
  const filteredStudents = students.filter(student => {
    const search = searchQuery.toLowerCase();
    const nameMatch = student.full_name.toLowerCase().includes(search);
    const admMatch = (student.adm_no || '').toLowerCase().includes(search);
    return nameMatch || admMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BookmarkCheck className="w-6 h-6 text-emerald-600" />
          Mark Lesson Attendance
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Perform digital roll-calls for assigned modules, save live sessions, and update rosters.
        </p>
      </div>

      {/* Step 1 Selector panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest border-b border-slate-100 pb-3">
          Session Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Unit Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              Curriculum Unit
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => {
                setSelectedUnitId(e.target.value);
                setSearchQuery('');
              }}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden transition-all font-bold text-slate-800"
            >
              {myAssignedUnits.length > 0 ? (
                myAssignedUnits.map(unit => {
                  const course = state.courses.find(c => c.id === unit.course_id);
                  return (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({course?.name || 'Syllabus'})
                    </option>
                  );
                })
              ) : (
                <option value="">No units assigned to your profile</option>
              )}
            </select>
          </div>

          {/* Date Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              Class Date
            </label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                setDate(e.target.value);
                setSearchQuery('');
              }}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden transition-all font-mono font-bold text-slate-800"
            />
          </div>

          {/* Academic Year */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              Academic Year
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden transition-all font-mono font-bold text-slate-800"
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>

          {/* Semester Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              Active Term Semester
            </label>
            <input
              type="text"
              readOnly
              value={semester}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-100 font-bold text-slate-600 outline-hidden"
            />
          </div>
        </div>

        {isPreloaded && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] leading-relaxed flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Note:</strong> Attendance record is already filed for this unit on this date. Re-submitting will update existing records.
            </span>
          </div>
        )}
      </div>

      {/* Error / Success Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold leading-relaxed flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs font-semibold leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Student list Matrix */}
      {selectedUnitId ? (
        loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-bold">Querying enrolled student registry...</p>
          </div>
        ) : students.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
            {/* Table Control Header */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono tracking-wider">Attendance Register</span>
                <h4 className="text-sm font-black text-slate-900 tracking-tight">
                  Enrolled Students ({students.length})
                </h4>
              </div>

              {/* Bulk operations & Search filters */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                {/* Search field */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name/adm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden transition-all"
                  />
                </div>

                {/* Mark all present */}
                <button
                  type="button"
                  onClick={() => handleBulkMark('Present')}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold font-mono border border-emerald-200 rounded-lg cursor-pointer transition-all"
                >
                  All Present
                </button>

                {/* Mark all absent */}
                <button
                  type="button"
                  onClick={() => handleBulkMark('Absent')}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold font-mono border border-red-200 rounded-lg cursor-pointer transition-all"
                >
                  All Absent
                </button>
              </div>
            </div>

            {/* Attendance Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[9px] text-slate-500 uppercase tracking-widest select-none">
                    <th className="py-3 px-4 md:px-6 font-bold w-12 text-center">#</th>
                    <th className="py-3 px-4 font-bold">Adm No</th>
                    <th className="py-3 px-4 font-bold">Full Student Name</th>
                    <th className="py-3 px-4 font-bold text-center w-28">Present</th>
                    <th className="py-3 px-4 font-bold text-center w-28">Absent</th>
                    <th className="py-3 px-4 font-bold text-center w-28">Excused</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student, idx) => {
                      const currentStatus = attendanceMap[student.id] || 'Present';
                      return (
                        <tr 
                          key={student.id} 
                          className={`hover:bg-slate-50/40 transition-colors ${
                            currentStatus === 'Absent' ? 'bg-red-50/10' : currentStatus === 'Excused' ? 'bg-amber-50/10' : ''
                          }`}
                        >
                          {/* Row Counter */}
                          <td className="py-3.5 px-4 md:px-6 text-center text-slate-400 font-mono font-bold">
                            {idx + 1}
                          </td>

                          {/* Admission Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {student.adm_no || 'N/A'}
                          </td>

                          {/* Student Full Name */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{student.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{student.phone || 'No phone provided'}</div>
                          </td>

                          {/* Present Column */}
                          <td className="py-3.5 px-4 text-center">
                            <label className="inline-flex items-center justify-center p-2 cursor-pointer w-full group">
                              <input
                                type="radio"
                                name={`attendance-${student.id}`}
                                checked={currentStatus === 'Present'}
                                onChange={() => handleUpdateStatus(student.id, 'Present')}
                                className="w-5 h-5 border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                              />
                            </label>
                          </td>

                          {/* Absent Column */}
                          <td className="py-3.5 px-4 text-center">
                            <label className="inline-flex items-center justify-center p-2 cursor-pointer w-full group">
                              <input
                                type="radio"
                                name={`attendance-${student.id}`}
                                checked={currentStatus === 'Absent'}
                                onChange={() => handleUpdateStatus(student.id, 'Absent')}
                                className="w-5 h-5 border-slate-300 text-red-600 focus:ring-red-500/20 cursor-pointer"
                              />
                            </label>
                          </td>

                          {/* Excused Column */}
                          <td className="py-3.5 px-4 text-center">
                            <label className="inline-flex items-center justify-center p-2 cursor-pointer w-full group">
                              <input
                                type="radio"
                                name={`attendance-${student.id}`}
                                checked={currentStatus === 'Excused'}
                                onChange={() => handleUpdateStatus(student.id, 'Excused')}
                                className="w-5 h-5 border-slate-300 text-amber-600 focus:ring-amber-500/20 cursor-pointer"
                              />
                            </label>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                        No students match search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Form Submission area */}
            <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-[11px] text-slate-400 text-center sm:text-left leading-relaxed">
                <span className="font-bold text-slate-600 uppercase font-mono tracking-wide block">Roster Audit Safety</span>
                Ensure rolls are updated thoroughly before clicking submit. Records will be saved immediately to the database.
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => navigate('/lecturer/dashboard')}
                  className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer w-full sm:w-auto text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={submitLoading || students.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Submit Roll-Call
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700">Roster Empty</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              No students are currently registered under this curriculum unit's course program. Add student accounts first.
            </p>
          </div>
        )
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <BookmarkCheck className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
          <h4 className="font-bold text-slate-700">Select Unit assignment</h4>
          <p className="text-xs text-slate-400">Please choose an assigned curriculum module above to load the student list.</p>
        </div>
      )}
    </div>
  );
}
