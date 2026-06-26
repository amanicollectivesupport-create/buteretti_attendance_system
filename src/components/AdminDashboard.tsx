/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DatabaseState, Department, Course, CourseUnit, Profile, LecturerUnit } from '../types';
import { Plus, Users, BookOpen, GraduationCap, School, Link, Check, AlertCircle, Trash2 } from 'lucide-react';

interface AdminDashboardProps {
  id?: string;
  state: DatabaseState;
  onUpdate: (newState: DatabaseState) => void;
  initialTab?: 'depts' | 'courses' | 'units' | 'profiles' | 'allocations';
}

export default function AdminDashboard({ id, state, onUpdate, initialTab }: AdminDashboardProps) {
  // Tabs within admin panel
  const [activeSubTab, setActiveSubTab] = useState<'depts' | 'courses' | 'units' | 'profiles' | 'allocations'>(initialTab || 'depts');

  // Status/Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Form states
  const [newDeptName, setNewDeptName] = useState('');
  
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDeptId, setNewCourseDeptId] = useState('');
  const [newCourseDuration, setNewCourseDuration] = useState(3);

  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCourseId, setNewUnitCourseId] = useState('');
  const [newUnitYear, setNewUnitYear] = useState(1);
  const [newUnitSem, setNewUnitSem] = useState(1);

  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState<'lecturer' | 'student'>('student');
  const [newProfileAdm, setNewProfileAdm] = useState('');
  const [newProfileCourseId, setNewProfileCourseId] = useState('');
  const [newProfilePhone, setNewProfilePhone] = useState('');

  const [newAllocLecturerId, setNewAllocLecturerId] = useState('');
  const [newAllocUnitId, setNewAllocUnitId] = useState('');
  const [newAllocYear, setNewAllocYear] = useState('2025/2026');
  const [newAllocSem, setNewAllocSem] = useState('Year 1 Sem 1');

  // Submit Handlers
  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return triggerToast('Department name is required', 'error');

    const exists = state.departments.some(d => d.name.toLowerCase() === newDeptName.trim().toLowerCase());
    if (exists) return triggerToast('Department already exists', 'error');

    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: newDeptName.trim(),
      created_at: new Date().toISOString()
    };

    onUpdate({
      ...state,
      departments: [...state.departments, newDept]
    });
    setNewDeptName('');
    triggerToast(`Department "${newDept.name}" added successfully`);
  };

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return triggerToast('Course name is required', 'error');
    if (!newCourseDeptId) return triggerToast('Please select a department', 'error');

    const exists = state.courses.some(c => c.name.toLowerCase() === newCourseName.trim().toLowerCase());
    if (exists) return triggerToast('Course already exists', 'error');

    const newCourse: Course = {
      id: `course-${Date.now()}`,
      name: newCourseName.trim(),
      department_id: newCourseDeptId,
      duration_years: Number(newCourseDuration),
      created_at: new Date().toISOString()
    };

    onUpdate({
      ...state,
      courses: [...state.courses, newCourse]
    });
    setNewCourseName('');
    triggerToast(`Course "${newCourse.name}" created successfully`);
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return triggerToast('Unit name is required', 'error');
    if (!newUnitCourseId) return triggerToast('Please select a course', 'error');

    const exists = state.courseUnits.some(
      u => u.course_id === newUnitCourseId && u.name.toLowerCase() === newUnitName.trim().toLowerCase()
    );
    if (exists) return triggerToast('This unit already exists for the selected course', 'error');

    const newUnit: CourseUnit = {
      id: `unit-${Date.now()}`,
      name: newUnitName.trim(),
      course_id: newUnitCourseId,
      year_of_study: Number(newUnitYear),
      semester: Number(newUnitSem),
      created_at: new Date().toISOString()
    };

    onUpdate({
      ...state,
      courseUnits: [...state.courseUnits, newUnit]
    });
    setNewUnitName('');
    triggerToast(`Course Unit "${newUnit.name}" added successfully`);
  };

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return triggerToast('Full name is required', 'error');
    if (!newProfilePhone.trim()) return triggerToast('Phone number is required', 'error');

    if (newProfileRole === 'student') {
      if (!newProfileAdm.trim()) return triggerToast('Admission number is required for students', 'error');
      if (!newProfileCourseId) return triggerToast('Please select a course for the student', 'error');

      // Simple admission number format check
      const admRegex = /^BTTI\/[A-Z]{3,5}\/\d{4}\/\d{3}$/;
      if (!admRegex.test(newProfileAdm.trim().toUpperCase())) {
        return triggerToast('Invalid Admission format. Use: BTTI/[DEPT]/[YEAR]/[NUMBER] (e.g. BTTI/ICT/2025/123)', 'error');
      }

      const admExists = state.profiles.some(p => p.adm_no === newProfileAdm.trim().toUpperCase());
      if (admExists) return triggerToast('Admission number is already registered', 'error');
    }

    const newProfile: Profile = {
      id: `usr-${Date.now()}`,
      full_name: newProfileName.trim(),
      role: newProfileRole,
      adm_no: newProfileRole === 'student' ? newProfileAdm.trim().toUpperCase() : null,
      course_id: newProfileRole === 'student' ? newProfileCourseId : null,
      phone: newProfilePhone.trim(),
      created_at: new Date().toISOString()
    };

    onUpdate({
      ...state,
      profiles: [...state.profiles, newProfile]
    });

    setNewProfileName('');
    setNewProfileAdm('');
    setNewProfilePhone('');
    triggerToast(`${newProfileRole === 'student' ? 'Student' : 'Lecturer'} "${newProfile.full_name}" registered successfully`);
  };

  const handleAddAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllocLecturerId) return triggerToast('Please select a lecturer', 'error');
    if (!newAllocUnitId) return triggerToast('Please select a course unit', 'error');

    const exists = state.lecturerUnits.some(
      a => a.lecturer_id === newAllocLecturerId && 
           a.unit_id === newAllocUnitId && 
           a.academic_year === newAllocYear && 
           a.semester === newAllocSem
    );
    if (exists) return triggerToast('Allocation already exists for this unit, year, and semester', 'error');

    const newAlloc: LecturerUnit = {
      id: `alloc-${Date.now()}`,
      lecturer_id: newAllocLecturerId,
      unit_id: newAllocUnitId,
      academic_year: newAllocYear,
      semester: newAllocSem
    };

    onUpdate({
      ...state,
      lecturerUnits: [...state.lecturerUnits, newAlloc]
    });
    triggerToast('Lecturer assigned to course unit successfully');
  };

  const handleDeleteProfile = (profileId: string, name: string) => {
    if (confirm(`Are you sure you want to remove profile "${name}"? This will delete all their historical allocations or records.`)) {
      onUpdate({
        ...state,
        profiles: state.profiles.filter(p => p.id !== profileId),
        lecturerUnits: state.lecturerUnits.filter(lu => lu.lecturer_id !== profileId),
        attendance: state.attendance.filter(a => a.student_id !== profileId && a.lecturer_id !== profileId)
      });
      triggerToast(`Removed profile "${name}"`);
    }
  };

  return (
    <div id={id} className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div id="admin-toast" className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Admin Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
            <School className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Departments</div>
            <div className="text-lg font-bold text-gray-900">{state.departments.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Programs</div>
            <div className="text-lg font-bold text-gray-900">{state.courses.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Course Units</div>
            <div className="text-lg font-bold text-gray-900">{state.courseUnits.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Users</div>
            <div className="text-lg font-bold text-gray-900">{state.profiles.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
            <Link className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Allocations</div>
            <div className="text-lg font-bold text-gray-900">{state.lecturerUnits.length}</div>
          </div>
        </div>
      </div>

      {/* Main Admin Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        {/* Navigation Sidebar Subtabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          <button
            id="tab-depts"
            onClick={() => setActiveSubTab('depts')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'depts' ? 'border-emerald-700 text-emerald-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Departments
          </button>
          <button
            id="tab-courses"
            onClick={() => setActiveSubTab('courses')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'courses' ? 'border-emerald-700 text-emerald-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Programs/Courses
          </button>
          <button
            id="tab-units"
            onClick={() => setActiveSubTab('units')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'units' ? 'border-emerald-700 text-emerald-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Course Units
          </button>
          <button
            id="tab-profiles"
            onClick={() => setActiveSubTab('profiles')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'profiles' ? 'border-emerald-700 text-emerald-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            User Profiles
          </button>
          <button
            id="tab-allocations"
            onClick={() => setActiveSubTab('allocations')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'allocations' ? 'border-emerald-700 text-emerald-800 bg-white' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Lecturer Allocations
          </button>
        </div>

        <div className="p-6">
          {/* Subtab Content: Departments */}
          {activeSubTab === 'depts' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add form */}
              <div className="lg:col-span-1 bg-gray-50 p-5 rounded-xl border border-gray-200 h-fit">
                <h4 className="font-semibold text-gray-900 text-sm mb-4">Add New Department</h4>
                <form onSubmit={handleAddDept} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Department Name</label>
                    <input
                      id="input-dept-name"
                      type="text"
                      placeholder="e.g. Electrical Engineering"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-sm"
                    />
                  </div>
                  <button
                    id="btn-add-dept"
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Save Department
                  </button>
                </form>
              </div>

              {/* Department List */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm">Registered Departments</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">S/No.</th>
                        <th className="px-4 py-3">Department Name</th>
                        <th className="px-4 py-3">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                      {state.departments.map((dept, idx) => (
                        <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{dept.name}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(dept.created_at).toLocaleDateString('en-GB')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Subtab Content: Courses */}
          {activeSubTab === 'courses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add form */}
              <div className="lg:col-span-1 bg-gray-50 p-5 rounded-xl border border-gray-200 h-fit">
                <h4 className="font-semibold text-gray-900 text-sm mb-4">Create Program / Course</h4>
                <form onSubmit={handleAddCourse} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                    <select
                      id="select-course-dept"
                      value={newCourseDeptId}
                      onChange={(e) => setNewCourseDeptId(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-sm"
                    >
                      <option value="">Select Department...</option>
                      {state.departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Program/Course Title</label>
                    <input
                      id="input-course-name"
                      type="text"
                      placeholder="e.g. Diploma in Business Management"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Duration (Years)</label>
                    <input
                      id="input-course-duration"
                      type="number"
                      min="1"
                      max="4"
                      value={newCourseDuration}
                      onChange={(e) => setNewCourseDuration(Number(e.target.value))}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-sm"
                    />
                  </div>
                  <button
                    id="btn-add-course"
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Save Course
                  </button>
                </form>
              </div>

              {/* Course List */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm">Registered Programs / Courses</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Course Code</th>
                        <th className="px-4 py-3">Course / Program Title</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                      {state.courses.map((course) => {
                        const dept = state.departments.find(d => d.id === course.department_id);
                        return (
                          <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-gray-400">
                              {course.id.substring(0, 8).toUpperCase()}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{course.name}</td>
                            <td className="px-4 py-3 text-gray-500">{dept?.name || 'Unknown'}</td>
                            <td className="px-4 py-3 font-medium text-emerald-800 bg-emerald-50/50 text-center rounded-sm max-w-[80px]">
                              {course.duration_years} Years
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Subtab Content: Course Units */}
          {activeSubTab === 'units' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add form */}
              <div className="lg:col-span-1 bg-gray-50 p-5 rounded-xl border border-gray-200 h-fit">
                <h4 className="font-semibold text-gray-900 text-sm mb-4">Add Course Unit</h4>
                <form onSubmit={handleAddUnit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Associated Course</label>
                    <select
                      id="select-unit-course"
                      value={newUnitCourseId}
                      onChange={(e) => setNewUnitCourseId(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-sm"
                    >
                      <option value="">Select Course...</option>
                      {state.courses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Unit Name</label>
                    <input
                      id="input-unit-name"
                      type="text"
                      placeholder="e.g. Quantitative Methods"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Year of Study</label>
                      <select
                        id="select-unit-year"
                        value={newUnitYear}
                        onChange={(e) => setNewUnitYear(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                      >
                        <option value={1}>Year 1</option>
                        <option value={2}>Year 2</option>
                        <option value={3}>Year 3</option>
                        <option value={4}>Year 4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
                      <select
                        id="select-unit-sem"
                        value={newUnitSem}
                        onChange={(e) => setNewUnitSem(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                      >
                        <option value={1}>Sem 1</option>
                        <option value={2}>Sem 2</option>
                      </select>
                    </div>
                  </div>
                  <button
                    id="btn-add-unit"
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Save Unit
                  </button>
                </form>
              </div>

              {/* Unit List */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm">Course Units Catalog</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Unit Title</th>
                        <th className="px-4 py-3">Course / Program</th>
                        <th className="px-4 py-3">Academic Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                      {state.courseUnits.map((unit) => {
                        const crs = state.courses.find(c => c.id === unit.course_id);
                        return (
                          <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-800">{unit.name}</td>
                            <td className="px-4 py-3 text-gray-500">{crs?.name || 'Unknown'}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded-md font-medium text-[10px] uppercase">
                                Yr {unit.year_of_study} • Sem {unit.semester}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Subtab Content: Profiles */}
          {activeSubTab === 'profiles' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add form */}
              <div className="lg:col-span-1 bg-gray-50 p-5 rounded-xl border border-gray-200 h-fit">
                <h4 className="font-semibold text-gray-900 text-sm mb-4">Register Student / Staff</h4>
                <form onSubmit={handleAddProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role / Profile Type</label>
                    <div className="grid grid-cols-2 gap-2 bg-gray-200/50 p-1 rounded-lg">
                      <button
                        id="btn-role-student"
                        type="button"
                        onClick={() => setNewProfileRole('student')}
                        className={`py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all ${
                          newProfileRole === 'student' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Student
                      </button>
                      <button
                        id="btn-role-lecturer"
                        type="button"
                        onClick={() => setNewProfileRole('lecturer')}
                        className={`py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all ${
                          newProfileRole === 'lecturer' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Lecturer
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      id="input-profile-name"
                      type="text"
                      placeholder="e.g. Silas Atieno Ouma"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                    />
                  </div>

                  {newProfileRole === 'student' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Admission Number</label>
                        <input
                          id="input-profile-adm"
                          type="text"
                          placeholder="BTTI/ICT/2026/045"
                          value={newProfileAdm}
                          onChange={(e) => setNewProfileAdm(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm font-mono uppercase"
                        />
                        <span className="text-[10px] text-gray-400 block mt-0.5">Format: BTTI/DEP/YEAR/NUM</span>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Enrolled Program/Course</label>
                        <select
                          id="select-profile-course"
                          value={newProfileCourseId}
                          onChange={(e) => setNewProfileCourseId(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                        >
                          <option value="">Select Course...</option>
                          {state.courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      id="input-profile-phone"
                      type="tel"
                      placeholder="e.g. +254711223344"
                      value={newProfilePhone}
                      onChange={(e) => setNewProfilePhone(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                    />
                  </div>

                  <button
                    id="btn-add-profile"
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Save Profile
                  </button>
                </form>
              </div>

              {/* Profile list */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm">Registered Students & Staff</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">User Details</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Adm No. / Phone</th>
                        <th className="px-4 py-3">Course / Department</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                      {state.profiles.map((profile) => {
                        const crs = state.courses.find(c => c.id === profile.course_id);
                        return (
                          <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-800">{profile.full_name}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                                profile.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                profile.role === 'lecturer' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {profile.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {profile.role === 'student' ? (
                                <span className="font-mono text-gray-900 font-bold">{profile.adm_no}</span>
                              ) : (
                                <span className="text-gray-500">{profile.phone}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {profile.role === 'student' ? crs?.name || '-' : 'Faculty'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {profile.role !== 'admin' ? (
                                <button
                                  id={`btn-del-profile-${profile.id}`}
                                  onClick={() => handleDeleteProfile(profile.id, profile.full_name)}
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete Profile"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-gray-400 text-[10px] italic">Protected</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Subtab Content: Allocations */}
          {activeSubTab === 'allocations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add form */}
              <div className="lg:col-span-1 bg-gray-50 p-5 rounded-xl border border-gray-200 h-fit">
                <h4 className="font-semibold text-gray-900 text-sm mb-4">Assign Lecturer to Unit</h4>
                <form onSubmit={handleAddAllocation} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Select Lecturer</label>
                    <select
                      id="select-alloc-lecturer"
                      value={newAllocLecturerId}
                      onChange={(e) => setNewAllocLecturerId(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                    >
                      <option value="">Select Lecturer...</option>
                      {state.profiles.filter(p => p.role === 'lecturer').map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Select Course Unit</label>
                    <select
                      id="select-alloc-unit"
                      value={newAllocUnitId}
                      onChange={(e) => setNewAllocUnitId(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                    >
                      <option value="">Select Unit...</option>
                      {state.courseUnits.map(unit => {
                        const crs = state.courses.find(c => c.id === unit.course_id);
                        return (
                          <option key={unit.id} value={unit.id}>
                            {unit.name} ({crs?.name.split(' ')[0]})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Academic Year</label>
                    <input
                      id="input-alloc-year"
                      type="text"
                      placeholder="2025/2026"
                      value={newAllocYear}
                      onChange={(e) => setNewAllocYear(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Semester Designation</label>
                    <select
                      id="select-alloc-sem"
                      value={newAllocSem}
                      onChange={(e) => setNewAllocSem(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden shadow-sm"
                    >
                      <option value="Year 1 Sem 1">Year 1 Sem 1</option>
                      <option value="Year 1 Sem 2">Year 1 Sem 2</option>
                      <option value="Year 2 Sem 1">Year 2 Sem 1</option>
                      <option value="Year 2 Sem 2">Year 2 Sem 2</option>
                      <option value="Year 3 Sem 1">Year 3 Sem 1</option>
                      <option value="Year 3 Sem 2">Year 3 Sem 2</option>
                    </select>
                  </div>

                  <button
                    id="btn-add-alloc"
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <Link className="w-3.5 h-3.5" /> Assign Unit
                  </button>
                </form>
              </div>

              {/* Allocation list */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm">Current Lecturer Allocation Registry</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Lecturer</th>
                        <th className="px-4 py-3">Course Unit Assigned</th>
                        <th className="px-4 py-3">Academic Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                      {state.lecturerUnits.map((alloc) => {
                        const lect = state.profiles.find(p => p.id === alloc.lecturer_id);
                        const unit = state.courseUnits.find(u => u.id === alloc.unit_id);
                        const crs = unit ? state.courses.find(c => c.id === unit.course_id) : null;
                        return (
                          <tr key={alloc.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-800">{lect?.full_name || 'Removed'}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{unit?.name || 'Removed'}</div>
                              <div className="text-[10px] text-gray-400">{crs?.name}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-500 block font-mono">{alloc.academic_year}</span>
                              <span className="text-[10px] text-emerald-800 font-semibold">{alloc.semester}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
