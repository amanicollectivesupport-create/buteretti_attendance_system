import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState, Profile, CourseUnit, LecturerUnit } from '../../types';
import { 
  Users, BookmarkCheck, Calendar, BookOpen, 
  Search, AlertCircle, Save, Loader2, CheckCircle, HelpCircle
} from 'lucide-react';

interface AssignLecturerUnitsProps {
  state: DatabaseState;
  onUpdate: (newState: DatabaseState) => Promise<void>;
}

export default function AssignLecturerUnits({ state, onUpdate }: AssignLecturerUnitsProps) {
  const lecturers = state.profiles.filter(p => p.role === 'lecturer');
  
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('2025/2026');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prefill fields with first lecturer if available
  useEffect(() => {
    if (lecturers.length > 0 && !selectedLecturerId) {
      setSelectedLecturerId(lecturers[0].id);
    }
  }, [lecturers]);

  // Read current lecturer assignments when selection changes
  useEffect(() => {
    if (selectedLecturerId) {
      const existingAllocs = state.lecturerUnits.filter(
        lu => lu.lecturer_id === selectedLecturerId && lu.academic_year === academicYear
      );
      setSelectedUnitIds(existingAllocs.map(a => a.unit_id));
      setSuccessMsg(null);
      setErrorMsg(null);
    } else {
      setSelectedUnitIds([]);
    }
  }, [selectedLecturerId, academicYear, state.lecturerUnits]);

  const handleToggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId) 
        : [...prev, unitId]
    );
  };

  const handleToggleSelectAllCourseUnits = (courseId: string, courseUnitIds: string[]) => {
    const allAlreadyChecked = courseUnitIds.every(id => selectedUnitIds.includes(id));
    if (allAlreadyChecked) {
      // Remove all course units from active selections
      setSelectedUnitIds(prev => prev.filter(id => !courseUnitIds.includes(id)));
    } else {
      // Add all missing course units to selections
      setSelectedUnitIds(prev => {
        const union = new Set([...prev, ...courseUnitIds]);
        return Array.from(union);
      });
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedLecturerId) {
      setErrorMsg('Please select a lecturer profile first.');
      return;
    }

    setSaveLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // 1. Filter out all existing lecturer assignments for this lecturer & academic year
      const restOfAllocations = state.lecturerUnits.filter(
        lu => !(lu.lecturer_id === selectedLecturerId && lu.academic_year === academicYear)
      );

      // 2. Build the list of newly selected allocations
      const newAllocations: LecturerUnit[] = selectedUnitIds.map(unitId => {
        const unit = state.courseUnits.find(u => u.id === unitId);
        const semesterLabel = unit ? `Year ${unit.year_of_study} Sem ${unit.semester}` : 'Sem 1';
        return {
          id: crypto.randomUUID(),
          lecturer_id: selectedLecturerId,
          unit_id: unitId,
          academic_year: academicYear,
          semester: semesterLabel
        };
      });

      // 3. Update parent state, which triggers a background-sync with Supabase
      const updatedState: DatabaseState = {
        ...state,
        lecturerUnits: [...restOfAllocations, ...newAllocations]
      };

      await onUpdate(updatedState);

      const lecturerProfile = lecturers.find(l => l.id === selectedLecturerId);
      setSuccessMsg(`Assignments updated successfully for ${lecturerProfile?.full_name || 'lecturer'}.`);
      
      // Clear success feedback alert after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);

    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving unit assignments.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Group Course Units by Course Program for elegant visual structuring
  const groupedUnits = state.courses.map(course => {
    const units = state.courseUnits.filter(
      unit => unit.course_id === course.id && 
              unit.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return {
      course,
      units
    };
  }).filter(group => group.units.length > 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BookmarkCheck className="w-6 h-6 text-blue-600" />
          Lecturer Unit Allocation Matrix
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Assign and allocate curriculum units to lecturers for active instructional semesters.
        </p>
      </div>

      {/* Main Grid: Control Panel (Left/Top) & Unit Matrix Checklist (Right/Main) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Control Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 space-y-5 lg:sticky lg:top-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest border-b border-slate-100 pb-3">
            Allocation settings
          </h3>

          {/* Lecturer Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              Active Lecturer Profile
            </label>
            <select
              value={selectedLecturerId}
              onChange={(e) => setSelectedLecturerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all font-bold text-slate-800"
            >
              {lecturers.length > 0 ? (
                lecturers.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} ({l.phone || 'no phone'})
                  </option>
                ))
              ) : (
                <option value="">No lecturers registered</option>
              )}
            </select>
          </div>

          {/* Academic Year Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              Academic Year Session
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all font-mono font-bold"
            >
              <option value="2025/2026">2025/2026 Academic Session</option>
              <option value="2026/2027">2026/2027 Academic Session</option>
            </select>
          </div>

          {/* Current Allocations Count badge */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
            <span className="text-[10px] text-blue-500 font-mono font-bold uppercase tracking-wide">
              Selection Summary
            </span>
            <p className="text-xs text-slate-700 leading-relaxed">
              Lecturer is assigned to <strong className="text-blue-700 font-bold">{selectedUnitIds.length}</strong> syllabus units.
            </p>
          </div>

          {/* Save Action Button */}
          <div className="pt-2">
            <button
              onClick={handleSaveAssignments}
              disabled={saveLoading || !selectedLecturerId}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {saveLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Assignments
            </button>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[11px] leading-relaxed flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[11px] leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right Units checklist matrix */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Search bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              placeholder="Search curriculum units by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border-none bg-transparent focus:ring-0 outline-hidden"
            />
          </div>

          {/* Grouped Course Units Matrix */}
          <div className="space-y-4">
            {groupedUnits.length > 0 ? (
              groupedUnits.map(({ course, units }) => {
                const courseUnitIds = units.map(u => u.id);
                const allSelected = courseUnitIds.every(id => selectedUnitIds.includes(id));
                const noneSelected = courseUnitIds.every(id => !selectedUnitIds.includes(id));
                const someSelected = !allSelected && !noneSelected;

                return (
                  <div key={course.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    {/* Course Section Title Bar */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">Course Program Syllabus</span>
                        <h4 className="text-xs font-black text-slate-900 tracking-tight leading-snug">{course.name}</h4>
                      </div>

                      {/* Select/Deselect All Course Units check */}
                      <button
                        onClick={() => handleToggleSelectAllCourseUnits(course.id, courseUnitIds)}
                        className="px-2.5 py-1 text-[10px] font-bold uppercase font-mono border border-slate-200 hover:border-blue-300 hover:text-blue-600 rounded-lg bg-white cursor-pointer select-none transition-colors"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {/* Unit list checklist */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {units.map(unit => {
                        const isChecked = selectedUnitIds.includes(unit.id);
                        return (
                          <div 
                            key={unit.id}
                            onClick={() => handleToggleUnit(unit.id)}
                            className={`p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer select-none flex items-start gap-3 ${
                              isChecked 
                                ? 'bg-blue-50/50 border-blue-600/80' 
                                : 'bg-white hover:bg-slate-50/50 border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="mt-0.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                            />
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-slate-900 leading-tight block">
                                {unit.name}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-slate-400">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Yr {unit.year_of_study}
                                </span>
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Sem {unit.semester}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-2 shadow-xs">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-500">No syllabus units match search criteria</p>
                <p className="text-[10px] text-slate-400">Try adjusting your filters or search keywords.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
