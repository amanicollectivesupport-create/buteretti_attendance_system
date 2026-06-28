import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { getAttendanceStatus, getCurrentSemesterInfo } from '../../lib/attendanceHelpers';
import { 
  Notebook, Users, Calendar, BarChart3, ArrowRight, RefreshCw, ClipboardList, AlertCircle 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function MyUnits() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Filters state
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');

  // Loading and data state
  const [loading, setLoading] = useState(true);
  const [unitData, setUnitData] = useState([]);

  useEffect(() => {
    const semInfo = getCurrentSemesterInfo();
    setSelectedYear(semInfo.academicYear);
    setSelectedSemester(semInfo.semester);
  }, []);

  const fetchUnitsData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Get lecturer units assignments
      const { data: allocations, error: allocErr } = await supabase
        .from('lecturer_units')
        .select('unit_id, course_units!inner(id, name, course_id, semester, year_of_study)')
        .eq('lecturer_id', profile.id);

      if (allocErr) throw allocErr;

      const myUnits = allocations?.map(a => a.course_units) || [];
      const assignedUnitIds = myUnits.map(u => u.id);

      if (assignedUnitIds.length === 0) {
        setUnitData([]);
        setLoading(false);
        return;
      }

      // 2. Fetch course names to map
      const courseIds = Array.from(new Set(myUnits.map(u => u.course_id).filter(Boolean)));
      let courseMap = {};
      if (courseIds.length > 0) {
        const { data: courses } = await supabase
          .from('courses')
          .select('id, name')
          .in('id', courseIds);
        courses?.forEach(c => {
          courseMap[c.id] = c.name;
        });
      }

      // 3. Fetch student counts per course
      let studentProfiles = [];
      if (courseIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, course_id')
          .eq('role', 'student')
          .in('course_id', courseIds);
        studentProfiles = profiles || [];
      }

      const studentCountMap = {};
      studentProfiles.forEach(student => {
        if (student.course_id) {
          studentCountMap[student.course_id] = (studentCountMap[student.course_id] || 0) + 1;
        }
      });

      // 4. Fetch all attendance records for these units to compute statistics
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('unit_id, student_id, status, date')
        .in('unit_id', assignedUnitIds);

      const recordsByUnit = {};
      attendanceRecords?.forEach(record => {
        if (!recordsByUnit[record.unit_id]) {
          recordsByUnit[record.unit_id] = [];
        }
        recordsByUnit[record.unit_id].push(record);
      });

      // 5. Build rich unit metric summaries
      const computedUnits = myUnits.map(unit => {
        const unitRecords = recordsByUnit[unit.id] || [];
        const studentCount = studentCountMap[unit.course_id] || 0;

        // Count classes/sessions marked (unique dates marked)
        const uniqueDatesMarked = new Set(unitRecords.map(r => r.date));
        const classesMarkedCount = uniqueDatesMarked.size;

        // Compute average attendance rate
        let avgPct = 100;
        if (unitRecords.length > 0) {
          const attendedCount = unitRecords.filter(r => r.status === 'Present' || r.status === 'Excused').length;
          avgPct = Math.round((attendedCount / unitRecords.length) * 100);
        }

        // Compute students at risk (< 75%)
        const studentStats = {};
        unitRecords.forEach(r => {
          if (!studentStats[r.student_id]) {
            studentStats[r.student_id] = { attended: 0, total: 0 };
          }
          studentStats[r.student_id].total += 1;
          if (r.status === 'Present' || r.status === 'Excused') {
            studentStats[r.student_id].attended += 1;
          }
        });

        let atRiskCount = 0;
        Object.keys(studentStats).forEach(sId => {
          const stats = studentStats[sId];
          const pct = stats.total > 0 ? (stats.attended / stats.total) * 100 : 100;
          if (pct < 75) {
            atRiskCount++;
          }
        });

        return {
          id: unit.id,
          name: unit.name,
          courseName: courseMap[unit.course_id] || 'Registered Course',
          semester: unit.semester,
          year_of_study: unit.year_of_study,
          studentCount: studentCount,
          classesMarked: classesMarkedCount,
          percentage: avgPct,
          atRiskCount: atRiskCount
        };
      });

      setUnitData(computedUnits);
    } catch (e) {
      toast.error('Error fetching units information: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnitsData();
  }, [profile?.id]);

  // Apply filters client-side
  const filteredUnits = unitData.filter(unit => {
    const semMatch = selectedSemester ? unit.semester.toString() === selectedSemester.toString() : true;
    return semMatch;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Notebook className="w-5 h-5 text-blue-600" />
            My Assigned Units
          </h2>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            Course curriculum allocations assigned to you for instruction and attendance audit.
          </p>
        </div>

        <button
          onClick={fetchUnitsData}
          className="p-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-lg transition-colors shadow-xs flex items-center justify-center cursor-pointer"
          title="Refresh units data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-2xs flex flex-wrap gap-4 items-center">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Filter Options
        </span>
        
        {/* Semester selector */}
        <div className="relative">
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8 pl-3 font-semibold text-gray-700"
          >
            <option value="">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
          <ChevronDownIcon className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>

        {/* Academic year indicator */}
        <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600">
          Academic Year: {selectedYear}
        </div>
      </div>

      {/* Grid of cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-44 bg-white border border-gray-100 rounded-xl animate-pulse p-5 space-y-4">
              <div className="h-4 bg-gray-200 rounded-sm w-3/4" />
              <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
              <div className="h-6 bg-gray-200 rounded-sm w-full" />
              <div className="h-8 bg-gray-200 rounded-sm w-full" />
            </div>
          ))}
        </div>
      ) : filteredUnits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredUnits.map((unit) => {
            const status = getAttendanceStatus(unit.percentage);
            return (
              <div 
                key={unit.id} 
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow"
              >
                {/* Header */}
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h3 className="text-[13.5px] font-bold text-gray-900 truncate">
                      {unit.name}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium truncate">
                      {unit.courseName}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[9.5px] font-bold shrink-0 font-mono">
                    Yr {unit.year_of_study}
                  </span>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-gray-50 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-gray-400 font-medium">Total Students</p>
                    <p className="text-sm font-bold text-gray-800">{unit.studentCount}</p>
                  </div>
                  <div className="space-y-0.5 border-x border-gray-100">
                    <p className="text-[10px] text-gray-400 font-medium">Sessions Marked</p>
                    <p className="text-sm font-bold text-gray-800">{unit.classesMarked}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-gray-400 font-medium">Avg Attendance</p>
                    <p className={`text-sm font-bold ${status.color}`}>{unit.percentage}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${status.bar}`} 
                      style={{ width: `${unit.percentage}%` }}
                    />
                  </div>
                  
                  {/* At-risk text indicator */}
                  <div className="flex items-center gap-1">
                    {unit.atRiskCount > 0 ? (
                      <p className="text-red-600 text-[10.5px] font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {unit.atRiskCount} student{unit.atRiskCount > 1 ? 's' : ''} at risk (&lt; 75%)
                      </p>
                    ) : (
                      <p className="text-green-600 text-[10.5px] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        All students on track
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => navigate(`/lecturer/students?unit=${unit.id}`)}
                    className="w-full py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-[11px] font-bold uppercase transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    View students
                  </button>
                  <button
                    onClick={() => navigate(`/lecturer/mark-attendance?unit=${unit.id}`)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold uppercase transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                  >
                    Mark attendance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* EMPTY STATE */
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl p-6 shadow-2xs">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">No units assigned yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
            There are no assigned courses or subjects under your account. Please contact your administrator or director to get units assigned.
          </p>
        </div>
      )}
    </div>
  );
}

// Minimal inline ChevronDown icon component to avoid extra imports
function ChevronDownIcon(props) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}
