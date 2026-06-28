import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { getAttendanceStatus } from '../../lib/attendanceHelpers';
import { 
  Users, Search, ChevronDown, ChevronUp, AlertCircle, Calendar, RefreshCw, Eye 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function MyStudents() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  // Filters State
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data State
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [studentRows, setStudentRows] = useState([]);
  const [expandedRowId, setExpandedRowId] = useState(null); // 'studentId-unitId'
  const [expandedData, setExpandedData] = useState({}); // { ['studentId-unitId']: Array of logs }
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Fetch lecturer's assigned units
      const { data: allocations, error: allocErr } = await supabase
        .from('lecturer_units')
        .select('unit_id, course_units!inner(id, name, course_id, semester, year_of_study)')
        .eq('lecturer_id', profile.id);

      if (allocErr) throw allocErr;

      const myUnits = allocations?.map(a => a.course_units) || [];
      setUnits(myUnits);

      // Pre-select unit if provided in URL parameter
      const urlUnit = searchParams.get('unit');
      if (urlUnit && myUnits.some(u => u.id === urlUnit)) {
        setUnitFilter(urlUnit);
      }

      const assignedUnitIds = myUnits.map(u => u.id);
      if (assignedUnitIds.length === 0) {
        setStudentRows([]);
        setLoading(false);
        return;
      }

      // 2. Fetch course details to map
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

      // 3. Fetch student profiles enrolled in our course IDs
      let studentProfiles = [];
      if (courseIds.length > 0) {
        const { data: profiles, error: profError } = await supabase
          .from('profiles')
          .select('id, full_name, adm_no, course_id')
          .eq('role', 'student')
          .in('course_id', courseIds);
        if (profError) throw profError;
        studentProfiles = profiles || [];
      }

      // Map course_id to students list
      const studentsByCourse = {};
      studentProfiles.forEach(student => {
        if (student.course_id) {
          if (!studentsByCourse[student.course_id]) {
            studentsByCourse[student.course_id] = [];
          }
          studentsByCourse[student.course_id].push(student);
        }
      });

      // 4. Fetch all attendance records for these units to compute student percentages
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('id, student_id, unit_id, status, date')
        .in('unit_id', assignedUnitIds);

      // Group attendance by key studentId_unitId
      const recordMap = {};
      attendanceRecords?.forEach(record => {
        const key = `${record.student_id}_${record.unit_id}`;
        if (!recordMap[key]) {
          recordMap[key] = [];
        }
        recordMap[key].push(record);
      });

      // 5. Construct student rows
      const rows = [];
      myUnits.forEach(unit => {
        const enrolledStudents = studentsByCourse[unit.course_id] || [];
        enrolledStudents.forEach(student => {
          const key = `${student.id}_${unit.id}`;
          const studentUnitRecords = recordMap[key] || [];
          
          const totalClasses = studentUnitRecords.length;
          const attendedClasses = studentUnitRecords.filter(r => r.status === 'Present' || r.status === 'Excused').length;
          const percentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 100;
          const status = getAttendanceStatus(percentage);

          rows.push({
            id: key,
            studentId: student.id,
            studentName: student.full_name,
            admNo: student.adm_no,
            unitId: unit.id,
            unitName: unit.name,
            courseName: courseMap[unit.course_id] || 'Registered Course',
            percentage: percentage,
            statusBadge: status,
            totalClasses: totalClasses,
            attendedClasses: attendedClasses
          });
        });
      });

      setStudentRows(rows);
    } catch (e) {
      toast.error('Error loading students data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile?.id, searchParams]);

  const handleToggleRow = async (rowId, studentId, unitId) => {
    if (expandedRowId === rowId) {
      setExpandedRowId(null);
      return;
    }

    setExpandedRowId(rowId);

    // If data is already cached, don't refetch
    if (expandedData[rowId]) return;

    setLoadingExpanded(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, status, marked_at')
        .eq('student_id', studentId)
        .eq('unit_id', unitId)
        .order('date', { ascending: false });

      if (error) throw error;

      setExpandedData(prev => ({
        ...prev,
        [rowId]: data || []
      }));
    } catch (e) {
      toast.error('Could not load session details: ' + e.message);
    } finally {
      setLoadingExpanded(false);
    }
  };

  // Client-side filtering logic
  const filteredRows = studentRows.filter(row => {
    // 1. Unit filter
    const matchUnit = unitFilter === 'all' ? true : row.unitId === unitFilter;
    
    // 2. Status filter
    let matchStatus = true;
    if (statusFilter !== 'all') {
      const label = row.statusBadge.label.toLowerCase().replace(/\s+/g, '');
      const filter = statusFilter.toLowerCase().replace(/\s+/g, '');
      matchStatus = label === filter;
    }

    // 3. Search filter (by student name or admission number)
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = q === '' ? true : (
      row.studentName.toLowerCase().includes(q) ||
      (row.admNo && row.admNo.toLowerCase().includes(q))
    );

    return matchUnit && matchStatus && matchSearch;
  });

  // Calculate live statistics summary for bottom line
  const studentHeadcount = filteredRows.length;
  const atRiskCount = filteredRows.filter(r => r.percentage < 75).length;
  const totalPercentageSum = filteredRows.reduce((acc, row) => acc + row.percentage, 0);
  const averagePercentage = studentHeadcount > 0 ? Math.round(totalPercentageSum / studentHeadcount) : 100;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            My Students
          </h2>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            Student registries enrolled across your assigned curriculum units. Monitor risk margins.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-lg transition-colors shadow-xs flex items-center justify-center cursor-pointer"
          title="Refresh students list"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Unit Filter */}
        <div className="relative sm:col-span-4">
          <select
            value={unitFilter}
            onChange={(e) => {
              setUnitFilter(e.target.value);
              setExpandedRowId(null);
            }}
            className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8 pl-3 font-semibold text-gray-700"
          >
            <option value="all">All Units</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} (Yr {unit.year_of_study})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-3.5 pointer-events-none" />
        </div>

        {/* Status Filter */}
        <div className="relative sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setExpandedRowId(null);
            }}
            className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8 pl-3 font-semibold text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="on track">On Track (&ge; 80%)</option>
            <option value="borderline">Borderline (75-79%)</option>
            <option value="at risk">At Risk (&lt; 75%)</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-3.5 pointer-events-none" />
        </div>

        {/* Search bar */}
        <div className="relative sm:col-span-5">
          <input
            type="text"
            placeholder="Search student by name or admin number..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setExpandedRowId(null);
            }}
            className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 pl-8"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3.5" />
        </div>
      </div>

      {/* Main Student Table */}
      {loading ? (
        <div className="bg-white border border-gray-100 rounded-xl p-6 animate-pulse space-y-4 shadow-2xs">
          <div className="h-4 bg-gray-200 rounded-sm w-1/4" />
          <div className="space-y-2">
            {[1, 2, 3, 5].map(n => (
              <div key={n} className="h-10 bg-gray-100 rounded-sm w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-gray-700">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Course Program</th>
                    <th className="py-3 px-4">Unit Assigned</th>
                    <th className="py-3 px-4 text-center">Attendance Rate</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => {
                      const isExpanded = expandedRowId === row.id;
                      const initials = getInitials(row.studentName);

                      return (
                        <React.Fragment key={row.id}>
                          <tr className="hover:bg-gray-50/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-[26px] h-[26px] bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-800 truncate leading-tight">
                                    {row.studentName}
                                  </p>
                                  <p className="text-[9.5px] text-gray-400 font-mono uppercase leading-none mt-0.5">
                                    {row.admNo || 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-500 truncate max-w-[150px]">
                              {row.courseName}
                            </td>
                            <td className="py-3 px-4 text-gray-800 font-bold truncate max-w-[140px]">
                              {row.unitName}
                            </td>
                            <td className="py-3 px-4 text-center font-bold font-mono">
                              <span className={row.statusBadge.color}>
                                {row.percentage}%
                              </span>
                              <p className="text-[9.5px] text-gray-400 font-normal mt-0.5 leading-none">
                                {row.attendedClasses} / {row.totalClasses} marked
                              </p>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${row.statusBadge.bg} ${row.statusBadge.color} border ${row.statusBadge.border}`}>
                                {row.statusBadge.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleToggleRow(row.id, row.studentId, row.unitId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors cursor-pointer font-bold uppercase text-[9.5px]"
                              >
                                {isExpanded ? (
                                  <>
                                    Close Details <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    View Details <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Accordion Expanded Row (Lazy Loaded) */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-gray-50/50 p-4 border-l-4 border-blue-500">
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Session-by-Session Attendance Logs
                                  </h4>

                                  {loadingExpanded ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                                      <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                                      Loading attendance logs...
                                    </div>
                                  ) : expandedData[row.id] && expandedData[row.id].length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                      {expandedData[row.id].map((log) => (
                                        <div 
                                          key={log.id} 
                                          className="p-2.5 bg-white border border-gray-100 rounded-lg flex justify-between items-center"
                                        >
                                          <div className="min-w-0 pr-2">
                                            <p className="font-mono font-bold text-[11px] text-gray-700">
                                              {log.date}
                                            </p>
                                            <p className="text-[9px] text-gray-400 font-medium">
                                              {log.marked_at ? new Date(log.marked_at).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' }) : 'Automated'}
                                            </p>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                            log.status === 'Present' 
                                              ? 'bg-green-50 text-green-700 border border-green-100' 
                                              : log.status === 'Absent'
                                              ? 'bg-red-50 text-red-700 border border-red-100'
                                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                                          }`}>
                                            {log.status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-6 text-gray-400 text-xs">
                                      <Calendar className="w-7 h-7 text-gray-300 mx-auto mb-1" />
                                      No attendance sessions recorded yet for this unit.
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="font-bold text-gray-700">No students found</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Try adjusting your search query, selecting different units, or checking other statuses.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SUMMARY LINE below table */}
          {filteredRows.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-2xs flex justify-between items-center text-xs font-semibold text-gray-500 font-mono">
              <span>Roster Summary</span>
              <div className="flex gap-4">
                <span>{studentHeadcount} student{studentHeadcount > 1 ? 's' : ''}</span>
                <span className="text-gray-300">|</span>
                <span className="text-red-600 font-bold">{atRiskCount} at risk (&lt; 75%)</span>
                <span className="text-gray-300">|</span>
                <span>{averagePercentage}% collective avg</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
