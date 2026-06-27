import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DatabaseState, Department, Course, CourseUnit } from '../../types';
import { 
  Folder, BookOpen, Layers, Plus, Edit, Trash2, 
  X, Check, AlertTriangle, ChevronRight, Loader2 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CoursesProps {
  state: DatabaseState;
  onUpdate: (newState: DatabaseState) => Promise<void>;
  onRefresh?: () => void;
}

export default function Courses({ state, onUpdate, onRefresh }: CoursesProps) {
  const [searchParams] = useSearchParams();
  
  // Selected IDs for cascading filter
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Active modal state
  const [modalType, setModalType] = useState<'dept' | 'course' | 'unit' | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null);

  // Form states
  const [deptName, setDeptName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseDeptId, setCourseDeptId] = useState('');
  const [courseDuration, setCourseDuration] = useState(3);
  const [unitName, setUnitName] = useState('');
  const [unitCourseId, setUnitCourseId] = useState('');
  const [unitYear, setUnitYear] = useState(1);
  const [unitSem, setUnitSem] = useState(1);

  const [saving, setSaving] = useState(false);

  // Initialize filters
  useEffect(() => {
    if (state.departments.length > 0 && !selectedDeptId) {
      setSelectedDeptId(state.departments[0].id);
    }
  }, [state.departments]);

  useEffect(() => {
    const filteredCourses = state.courses.filter(c => c.department_id === selectedDeptId);
    if (filteredCourses.length > 0) {
      setSelectedCourseId(filteredCourses[0].id);
    } else {
      setSelectedCourseId('');
    }
  }, [selectedDeptId, state.courses]);

  // Read query params for tab selection (if any)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'units') {
      // Focus on units
    }
  }, [searchParams]);

  // Generate a random stable UUID for local additions
  const generateUUID = () => {
    return crypto.randomUUID();
  };

  // Open modals helper
  const openModal = (type: 'dept' | 'course' | 'unit', mode: 'add' | 'edit' | 'delete', item: any = null) => {
    setModalType(type);
    setModalMode(mode);
    setActiveItem(item);

    if (type === 'dept') {
      setDeptName(mode === 'add' ? '' : item?.name || '');
    } else if (type === 'course') {
      setCourseName(mode === 'add' ? '' : item?.name || '');
      setCourseDeptId(mode === 'add' ? selectedDeptId : item?.department_id || '');
      setCourseDuration(mode === 'add' ? 3 : item?.duration_years || 3);
    } else if (type === 'unit') {
      setUnitName(mode === 'add' ? '' : item?.name || '');
      setUnitCourseId(mode === 'add' ? selectedCourseId : item?.course_id || '');
      setUnitYear(mode === 'add' ? 1 : item?.year_of_study || 1);
      setUnitSem(mode === 'add' ? 1 : item?.semester || 1);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setModalMode(null);
    setActiveItem(null);
  };

  // Submit operations
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType || !modalMode) return;

    setSaving(true);
    try {
      const newState = { ...state };

      // --- DEPARTMENTS ---
      if (modalType === 'dept') {
        if (modalMode === 'add') {
          if (!deptName.trim()) throw new Error('Department name is required');
          const newDept: Department = {
            id: generateUUID(),
            name: deptName.trim(),
            created_at: new Date().toISOString()
          };
          newState.departments = [...newState.departments, newDept];
          toast.success('Department created');
        } else if (modalMode === 'edit') {
          if (!deptName.trim()) throw new Error('Department name is required');
          newState.departments = newState.departments.map(d => 
            d.id === activeItem.id ? { ...d, name: deptName.trim() } : d
          );
          toast.success('Department updated');
        } else if (modalMode === 'delete') {
          // Check for dependencies
          const hasCourses = state.courses.some(c => c.department_id === activeItem.id);
          if (hasCourses) {
            throw new Error('Cannot delete: Department contains registered courses');
          }
          newState.departments = newState.departments.filter(d => d.id !== activeItem.id);
          toast.success('Department deleted');
        }
      }

      // --- COURSES ---
      else if (modalType === 'course') {
        if (modalMode === 'add') {
          if (!courseName.trim()) throw new Error('Course name is required');
          if (!courseDeptId) throw new Error('Department must be selected');
          const newCourse: Course = {
            id: generateUUID(),
            name: courseName.trim(),
            department_id: courseDeptId,
            duration_years: Number(courseDuration),
            created_at: new Date().toISOString()
          };
          newState.courses = [...newState.courses, newCourse];
          toast.success('Course program created');
        } else if (modalMode === 'edit') {
          if (!courseName.trim()) throw new Error('Course name is required');
          newState.courses = newState.courses.map(c => 
            c.id === activeItem.id 
              ? { ...c, name: courseName.trim(), department_id: courseDeptId, duration_years: Number(courseDuration) } 
              : c
          );
          toast.success('Course program updated');
        } else if (modalMode === 'delete') {
          // Check for dependencies
          const hasUnits = state.courseUnits.some(cu => cu.course_id === activeItem.id);
          const hasStudents = state.profiles.some(p => p.course_id === activeItem.id);
          if (hasUnits || hasStudents) {
            throw new Error('Cannot delete: Course has units or registered students');
          }
          newState.courses = newState.courses.filter(c => c.id !== activeItem.id);
          toast.success('Course program deleted');
        }
      }

      // --- COURSE UNITS ---
      else if (modalType === 'unit') {
        if (modalMode === 'add') {
          if (!unitName.trim()) throw new Error('Unit name is required');
          if (!unitCourseId) throw new Error('Course must be selected');
          const newUnit: CourseUnit = {
            id: generateUUID(),
            name: unitName.trim(),
            course_id: unitCourseId,
            year_of_study: Number(unitYear),
            semester: Number(unitSem),
            created_at: new Date().toISOString()
          };
          newState.courseUnits = [...newState.courseUnits, newUnit];
          toast.success('Unit created successfully');
        } else if (modalMode === 'edit') {
          if (!unitName.trim()) throw new Error('Unit name is required');
          newState.courseUnits = newState.courseUnits.map(u => 
            u.id === activeItem.id 
              ? { ...u, name: unitName.trim(), course_id: unitCourseId, year_of_study: Number(unitYear), semester: Number(unitSem) } 
              : u
          );
          toast.success('Unit updated successfully');
        } else if (modalMode === 'delete') {
          // Check for dependencies
          const hasAttendance = state.attendance.some(a => a.unit_id === activeItem.id);
          const hasAllocations = state.lecturerUnits.some(lu => lu.unit_id === activeItem.id);
          if (hasAttendance || hasAllocations) {
            throw new Error('Cannot delete: Unit has attendance history or lecturer allocations');
          }
          newState.courseUnits = newState.courseUnits.filter(u => u.id !== activeItem.id);
          toast.success('Unit deleted successfully');
        }
      }

      await onUpdate(newState);
      if (onRefresh) onRefresh();
      closeModal();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const filteredCourses = state.courses.filter(c => c.department_id === selectedDeptId);
  const filteredUnits = state.courseUnits.filter(u => u.course_id === selectedCourseId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600" />
            Curriculum Structure Management
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure Departments, Programs, and Course Units structure.
          </p>
        </div>
      </div>

      {/* 3-Panel Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* PANEL 1: DEPARTMENTS (Col Span 3) */}
        <div className="lg:col-span-3 bg-white border border-gray-100 rounded-xl p-4 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-blue-500" />
              Departments
            </span>
            <button 
              onClick={() => openModal('dept', 'add')}
              className="p-1 hover:bg-blue-50 rounded text-blue-600 transition-colors"
              title="Add Department"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {state.departments.length > 0 ? (
              state.departments.map((dept) => {
                const isActive = selectedDeptId === dept.id;
                const coursesCount = state.courses.filter(c => c.department_id === dept.id).length;
                return (
                  <div 
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    className={`group w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{dept.name}</p>
                      <p className={`text-[9px] ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                        {coursesCount} {coursesCount === 1 ? 'program' : 'programs'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal('dept', 'edit', dept);
                        }}
                        className="p-1 hover:bg-white text-gray-500 hover:text-blue-600 rounded"
                        title="Edit Department"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal('dept', 'delete', dept);
                        }}
                        className="p-1 hover:bg-white text-gray-500 hover:text-red-600 rounded"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <ChevronRight className={`w-3 h-3 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center text-gray-400">
                <Folder className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-[10px]">No departments found</p>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 2: COURSES (Col Span 4) */}
        <div className="lg:col-span-4 bg-white border border-gray-100 rounded-xl p-4 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              Programs / Courses
            </span>
            <button 
              disabled={!selectedDeptId}
              onClick={() => openModal('course', 'add')}
              className="p-1 hover:bg-indigo-50 rounded text-indigo-600 transition-colors disabled:opacity-40"
              title="Add Program"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto">
            {selectedDeptId ? (
              filteredCourses.length > 0 ? (
                filteredCourses.map((course) => {
                  const isActive = selectedCourseId === course.id;
                  const unitsCount = state.courseUnits.filter(u => u.course_id === course.id).length;
                  return (
                    <div 
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`group w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isActive 
                          ? 'bg-indigo-50 text-indigo-700 font-medium' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{course.name}</p>
                        <p className={`text-[9px] ${isActive ? 'text-indigo-500' : 'text-gray-400'}`}>
                          {course.duration_years} Years duration · {unitsCount} Units
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('course', 'edit', course);
                          }}
                          className="p-1 hover:bg-white text-gray-500 hover:text-indigo-600 rounded"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('course', 'delete', course);
                          }}
                          className="p-1 hover:bg-white text-gray-500 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <ChevronRight className={`w-3 h-3 shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center text-gray-400">
                  <BookOpen className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-[10px]">No courses in this department</p>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center text-gray-400">
                <Folder className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-[10px]">Select a department first</p>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: UNITS (Col Span 5) */}
        <div className="lg:col-span-5 bg-white border border-gray-100 rounded-xl p-4 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              Course Units
            </span>
            <button 
              disabled={!selectedCourseId}
              onClick={() => openModal('unit', 'add')}
              className="p-1 hover:bg-emerald-50 rounded text-emerald-600 transition-colors disabled:opacity-40"
              title="Add Course Unit"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {selectedCourseId ? (
              filteredUnits.length > 0 ? (
                // Group by year and semester
                [1, 2, 3].map((year) => {
                  const yearUnits = filteredUnits.filter(u => u.year_of_study === year);
                  if (yearUnits.length === 0) return null;

                  return (
                    <div key={year} className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                        Year {year} Units
                      </span>
                      <div className="divide-y divide-gray-50">
                        {yearUnits.map((unit) => (
                          <div 
                            key={unit.id}
                            className="group py-2 flex items-center justify-between gap-2 text-xs text-gray-700 hover:bg-gray-50/50 px-1 rounded"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">{unit.name}</p>
                              <p className="text-[9px] text-gray-400">
                                Semester {unit.semester}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openModal('unit', 'edit', unit)}
                                className="p-1 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => openModal('unit', 'delete', unit)}
                                className="p-1 hover:bg-gray-100 text-gray-500 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center text-gray-400">
                  <Layers className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-[10px]">No syllabus units created yet</p>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center text-gray-400">
                <BookOpen className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-[10px]">Select a course program first</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODALS SCREEN OVERLAY */}
      {modalType && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={closeModal} />
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                {modalMode === 'add' ? 'Create' : modalMode === 'edit' ? 'Edit' : 'Delete'}{' '}
                {modalType === 'dept' ? 'Department' : modalType === 'course' ? 'Course Program' : 'Syllabus Unit'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {modalMode === 'delete' ? (
                <div className="space-y-3 text-center">
                  <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Are you sure you want to permanently delete <strong className="text-gray-800">{activeItem?.name}</strong>?
                    </p>
                    <p className="text-[10px] text-amber-600 bg-amber-50 p-2 border border-amber-100 rounded text-left">
                      ⚠️ Deleting this configuration record will prevent future curriculum allocations. Ensure no students, classes, or attendance logs depend on it.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-xs">
                  
                  {/* Department Form Fields */}
                  {modalType === 'dept' && (
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700">Department Name</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. School of Business"
                        value={deptName}
                        onChange={(e) => setDeptName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Course Form Fields */}
                  {modalType === 'course' && (
                    <>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Department</label>
                        <select 
                          required
                          value={courseDeptId}
                          onChange={(e) => setCourseDeptId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          {state.departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Program / Course Name</label>
                        <input 
                          type="text"
                          required
                          placeholder="e.g. Diploma in Information Technology"
                          value={courseName}
                          onChange={(e) => setCourseName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Duration (Years)</label>
                        <input 
                          type="number"
                          required
                          min={1}
                          max={5}
                          value={courseDuration}
                          onChange={(e) => setCourseDuration(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Unit Form Fields */}
                  {modalType === 'unit' && (
                    <>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Course Program</label>
                        <select 
                          required
                          value={unitCourseId}
                          onChange={(e) => setUnitCourseId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          {state.courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-700">Unit Name</label>
                        <input 
                          type="text"
                          required
                          placeholder="e.g. Structured Programming"
                          value={unitName}
                          onChange={(e) => setUnitName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-semibold text-gray-700">Year of study</label>
                          <select 
                            value={unitYear}
                            onChange={(e) => setUnitYear(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                          >
                            <option value={1}>Year 1</option>
                            <option value={2}>Year 2</option>
                            <option value={3}>Year 3</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-gray-700">Semester</label>
                          <select 
                            value={unitSem}
                            onChange={(e) => setUnitSem(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                          >
                            <option value={1}>Semester 1</option>
                            <option value={2}>Semester 2</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-2.5 pt-2 border-t border-gray-50">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                    modalMode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Processing...' : modalMode === 'delete' ? 'Confirm Delete' : 'Save Details'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
