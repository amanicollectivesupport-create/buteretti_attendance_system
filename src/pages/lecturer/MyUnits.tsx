import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState, CourseUnit, LecturerUnit } from '../../types';
import { 
  BookOpen, BookmarkCheck, Calendar, ArrowRight, HelpCircle, 
  Layers, School, Loader2, RefreshCw 
} from 'lucide-react';

interface MyUnitsProps {
  state: DatabaseState;
  lecturerId: string;
}

interface AssignedUnitDetails extends CourseUnit {
  courseName: string;
  academicYear: string;
  semesterLabel: string;
  classesMarkedCount: number;
}

export default function MyUnits({ state, lecturerId }: MyUnitsProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignedUnits, setAssignedUnits] = useState<AssignedUnitDetails[]>([]);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');

  const loadUnitsData = async () => {
    setLoading(true);
    const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

    if (!isSupabaseConfigured) {
      calculateLocalUnits();
      setDataSource('local');
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch lecturer units allocations
      const { data: allocations, error: allocErr } = await supabase
        .from('lecturer_units')
        .select('*')
        .eq('lecturer_id', lecturerId);

      if (allocErr) throw allocErr;
      const myAllocations = allocations || [];

      if (myAllocations.length === 0) {
        setAssignedUnits([]);
        setLoading(false);
        return;
      }

      const assignedUnitIds = myAllocations.map(a => a.unit_id);

      // 2. Fetch full Course Unit descriptions
      const { data: courseUnits, error: unitErr } = await supabase
        .from('course_units')
        .select('*')
        .in('id', assignedUnitIds);

      if (unitErr) throw unitErr;
      const myUnits = courseUnits || [];

      // 3. Fetch courses
      const courseIds = Array.from(new Set(myUnits.map(u => u.course_id)));
      let coursesMap: Record<string, string> = {};
      if (courseIds.length > 0) {
        const { data: courses, error: courseErr } = await supabase
          .from('courses')
          .select('id, name')
          .in('id', courseIds);
        if (!courseErr && courses) {
          courses.forEach(c => {
            coursesMap[c.id] = c.name;
          });
        }
      }

      // 4. Calculate total distinct classes marked (group by date)
      // Query all attendance records for these unit IDs
      const { data: attendance, error: attErr } = await supabase
        .from('attendance')
        .select('unit_id, date')
        .in('unit_id', assignedUnitIds);

      const uniqueClassSessionsMap: Record<string, Set<string>> = {};
      assignedUnitIds.forEach(id => {
        uniqueClassSessionsMap[id] = new Set<string>();
      });

      if (!attErr && attendance) {
        attendance.forEach((att: any) => {
          if (uniqueClassSessionsMap[att.unit_id]) {
            uniqueClassSessionsMap[att.unit_id].add(att.date);
          }
        });
      }

      // 5. Combine everything together
      const details: AssignedUnitDetails[] = myAllocations.map(alloc => {
        const unit = myUnits.find(u => u.id === alloc.unit_id);
        const courseName = unit ? (coursesMap[unit.course_id] || 'Registered Course') : 'Unknown Program';
        const distinctDates = uniqueClassSessionsMap[alloc.unit_id] || new Set();

        return {
          id: alloc.unit_id,
          name: unit ? unit.name : 'Unknown syllabus unit',
          course_id: unit ? unit.course_id : '',
          year_of_study: unit ? unit.year_of_study : 1,
          semester: unit ? unit.semester : 1,
          created_at: unit ? unit.created_at : '',
          courseName,
          academicYear: alloc.academic_year,
          semesterLabel: alloc.semester || `Sem ${unit?.semester || 1}`,
          classesMarkedCount: distinctDates.size
        };
      });

      setAssignedUnits(details);
      setDataSource('supabase');
    } catch (err) {
      console.warn('Unable to retrieve MyUnits directly from Supabase. Rendering from local state.', err);
      calculateLocalUnits();
      setDataSource('local');
    } finally {
      setLoading(false);
    }
  };

  const calculateLocalUnits = () => {
    const myAllocations = state.lecturerUnits.filter(lu => lu.lecturer_id === lecturerId);
    
    const courseMap: Record<string, string> = {};
    state.courses.forEach(c => {
      courseMap[c.id] = c.name;
    });

    const details: AssignedUnitDetails[] = myAllocations.map(alloc => {
      const unit = state.courseUnits.find(u => u.id === alloc.unit_id);
      
      // Filter attendance records by this unit and determine unique dates count
      const unitAtts = state.attendance.filter(a => a.unit_id === alloc.unit_id);
      const uniqueDates = new Set(unitAtts.map(a => a.date));

      return {
        id: alloc.unit_id,
        name: unit ? unit.name : 'Unknown syllabus unit',
        course_id: unit ? unit.course_id : '',
        year_of_study: unit ? unit.year_of_study : 1,
        semester: unit ? unit.semester : 1,
        created_at: unit ? unit.created_at : '',
        courseName: unit ? (courseMap[unit.course_id] || 'Syllabus Program') : 'Unknown Program',
        academicYear: alloc.academic_year,
        semesterLabel: alloc.semester || `Sem ${unit?.semester || 1}`,
        classesMarkedCount: uniqueDates.size
      };
    });

    setAssignedUnits(details);
  };

  useEffect(() => {
    if (lecturerId) {
      loadUnitsData();
    }
  }, [state, lecturerId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-1/4" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-600" />
            My Assigned Syllabus Units
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse and manage all the curriculum subjects currently assigned to your active instruction roster.
          </p>
        </div>

        <button
          onClick={loadUnitsData}
          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-xs transition-colors flex items-center justify-center cursor-pointer"
          title="Refresh assignment directory"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest">
            Assigned Course Units Catalog
          </h3>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg">
            Active Allocations: {assignedUnits.length}
          </span>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-mono text-[9px] text-slate-500 uppercase tracking-widest select-none">
                <th className="py-3.5 px-4 font-bold">Curriculum Module</th>
                <th className="py-3.5 px-4 font-bold">Course Program</th>
                <th className="py-3.5 px-4 font-bold">Syllabus Placement</th>
                <th className="py-3.5 px-4 font-bold">Academic Session</th>
                <th className="py-3.5 px-4 font-bold text-center">Lessons Marked</th>
                <th className="py-3.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {assignedUnits.length > 0 ? (
                assignedUnits.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Unit Name */}
                    <td className="py-4 px-4 font-bold text-slate-900">
                      {item.name}
                    </td>

                    {/* Course Program */}
                    <td className="py-4 px-4 font-semibold text-slate-500">
                      {item.courseName}
                    </td>

                    {/* Syllabus Year/Sem */}
                    <td className="py-4 px-4 font-mono text-slate-600">
                      Year {item.year_of_study}, Semester {item.semester}
                    </td>

                    {/* Session Label */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">{item.academicYear}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.semesterLabel}</div>
                    </td>

                    {/* Lessons Marked Count */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold font-mono rounded-lg text-xs">
                        {item.classesMarkedCount} Sessions
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => navigate(`/lecturer/mark-attendance?unitId=${item.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[10px] tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
                      >
                        Roll-Call <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                    <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-900">No units assigned</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                      Please reach out to the administrative registrar to assign syllabus units to your lecturer profile.
                    </p>
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
