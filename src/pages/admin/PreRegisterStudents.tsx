import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabaseClient';
import { DatabaseState, Profile, Course } from '../../types';
import { saveDatabaseState } from '../../utils/mockDatabase';
import { 
  UserPlus, Upload, FileSpreadsheet, Search, Trash2, 
  CheckCircle, AlertTriangle, RefreshCw, X, HelpCircle, 
  ChevronRight, ArrowRight, Check, AlertCircle, Sparkles, Loader2
} from 'lucide-react';

interface PreRegisterStudentsProps {
  state: DatabaseState;
  onRefresh: () => void;
}

interface ParsedCSVRow {
  full_name?: string;
  adm_no?: string;
  course_id?: string;
  phone?: string;
  [key: string]: any;
}

export default function PreRegisterStudents({ state, onRefresh }: PreRegisterStudentsProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'registry' | 'manual' | 'bulk'>('registry');

  // Manual Register Form State
  const [fullName, setFullName] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [courseId, setCourseId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bulk Register State
  const [csvData, setCsvData] = useState<ParsedCSVRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search/Filter Registry
  const [searchTerm, setSearchTerm] = useState('');

  // Deletion Modal / States
  const [deletingStudent, setDeletingStudent] = useState<Profile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSupabaseConfigured = (import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  // 1. MANUAL REGISTRATION SUBMIT
  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!fullName.trim() || !admissionNo.trim() || !courseId || !phone.trim()) {
      setErrorMsg('Please populate all pre-registration fields.');
      return;
    }

    const cleanAdmNo = admissionNo.trim().toUpperCase();

    // Check if admission number duplicate already exists
    const duplicate = state.profiles.find(
      p => p.role === 'student' && p.adm_no?.toUpperCase() === cleanAdmNo
    );

    if (duplicate) {
      setErrorMsg(`Admission Number ${cleanAdmNo} is already registered in the system database.`);
      return;
    }

    setLoading(true);

    if (!isSupabaseConfigured) {
      // Offline local database simulation
      setTimeout(() => {
        const newProfile: Profile = {
          id: `usr-stud-pre-${Date.now()}`,
          full_name: fullName.trim(),
          role: 'student',
          adm_no: cleanAdmNo,
          course_id: courseId,
          phone: phone.trim(),
          created_at: new Date().toISOString()
        };

        // Add to our mock db and save
        const nextProfiles = [newProfile, ...state.profiles];
        saveDatabaseState({ ...state, profiles: nextProfiles });
        
        onRefresh();
        setSuccessMsg(`Student ${fullName} registered successfully!`);
        
        // Reset manual form fields
        setFullName('');
        setAdmissionNo('');
        setCourseId('');
        setPhone('');
        setLoading(false);
      }, 800);
      return;
    }

    try {
      const generatedUuid = self.crypto.randomUUID();

      const { error: insertErr } = await supabase
        .from('profiles')
        .insert({
          id: generatedUuid,
          full_name: fullName.trim(),
          role: 'student',
          adm_no: cleanAdmNo,
          course_id: courseId,
          phone: phone.trim()
        });

      if (insertErr) throw insertErr;

      onRefresh();
      setSuccessMsg(`Student ${fullName} registered successfully in live database!`);
      
      // Reset
      setFullName('');
      setAdmissionNo('');
      setCourseId('');
      setPhone('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to insert student pre-registration profile.');
    } finally {
      setLoading(false);
    }
  };

  // 2. CSV UPLOAD & DRAG HANDLERS
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  const processCSVFile = (file: File) => {
    setCsvError(null);
    setCsvData([]);

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setCsvError('Invalid file type. Please upload a structured .csv spreadsheet.');
      return;
    }

    Papa.parse<ParsedCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
        }

        if (results.data.length === 0) {
          setCsvError('The uploaded CSV file appears to contain no data rows.');
          return;
        }

        // Standardize headers
        const formattedData = results.data.map(row => {
          // Normalize header keys by lowercasing and trimming
          const cleanRow: ParsedCSVRow = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim().replace(/ /g, '_');
            cleanRow[normalizedKey] = row[key];
          });
          return cleanRow;
        });

        // Validate structure (must have full_name or name, and adm_no or admission_number)
        const sample = formattedData[0];
        const hasName = 'full_name' in sample || 'name' in sample;
        const hasAdm = 'adm_no' in sample || 'admission_number' in sample || 'admission_no' in sample;

        if (!hasName || !hasAdm) {
          setCsvError('Invalid CSV columns. Headers must include "full_name" (or "name") and "adm_no" (or "admission_number").');
          return;
        }

        // Map and clean rows
        const resolveCourseId = (csvCourseVal: string | undefined): string => {
          if (!csvCourseVal) return state.courses[0]?.id || '';
          const val = csvCourseVal.trim().toLowerCase();
          if (!val) return state.courses[0]?.id || '';

          // 1. Direct match on ID
          let match = state.courses.find(c => c.id.toLowerCase() === val);
          if (match) return match.id;

          // 2. Substring/Exact match on ID without prefix (e.g. if CSV has 'dict', match 'course-dict')
          match = state.courses.find(c => c.id.toLowerCase().replace('course-', '') === val);
          if (match) return match.id;

          // 3. Match on exact/substring of Course Name
          match = state.courses.find(c => c.name.toLowerCase().includes(val));
          if (match) return match.id;

          // 4. Try matching common codes (e.g. "DICT", "CICT", "DEEE", "CPBS", "DBM", "CFB")
          match = state.courses.find(c => {
            const parenthesized = c.name.match(/\(([^)]+)\)/);
            if (parenthesized && parenthesized[1]) {
              return parenthesized[1].toLowerCase() === val;
            }
            return false;
          });
          if (match) return match.id;

          // Default to first course if no match found
          return state.courses[0]?.id || '';
        };

        const cleanedRows = formattedData.map(row => {
          const rawCourse = (row.course_id || row.course || '').toString().trim();
          const resolvedId = resolveCourseId(rawCourse);

          const finalRow: ParsedCSVRow = {
            full_name: (row.full_name || row.name || '').toString().trim(),
            adm_no: (row.adm_no || row.admission_number || row.admission_no || '').toString().trim().toUpperCase(),
            course_id: resolvedId,
            phone: (row.phone || row.telephone || '').toString().trim() || '+254700000000'
          };
          return finalRow;
        });

        setCsvData(cleanedRows);
      },
      error: (err) => {
        setCsvError(`Failed to parse CSV spreadsheet: ${err.message}`);
      }
    });
  };

  // Submit CSV Bulk Students
  const handleBulkSubmit = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Filter valid rows (must have name and admission number)
    const validRows = csvData.filter(row => row.full_name && row.adm_no);

    if (validRows.length === 0) {
      setErrorMsg('No valid rows available to save. Ensure columns are correctly populated.');
      setLoading(false);
      return;
    }

    // Check duplicates in uploaded CSV vs Database
    const existingAdms = new Set(state.profiles.map(p => p.adm_no?.toUpperCase()));
    
    // Also handle internal duplicates in the CSV file
    const csvAdmsSeen = new Set<string>();
    const finalInsertRows: ParsedCSVRow[] = [];
    const skippedAdms: string[] = [];
    const internalDuplicates: string[] = [];

    validRows.forEach(row => {
      const uAdm = row.adm_no?.toUpperCase();
      if (uAdm) {
        if (existingAdms.has(uAdm)) {
          skippedAdms.push(uAdm);
        } else if (csvAdmsSeen.has(uAdm)) {
          internalDuplicates.push(uAdm);
        } else {
          csvAdmsSeen.add(uAdm);
          finalInsertRows.push(row);
        }
      }
    });

    if (finalInsertRows.length === 0) {
      setErrorMsg('All students in the CSV file are already pre-registered in the database.');
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      // Local bulk insert
      setTimeout(() => {
        const newProfiles: Profile[] = finalInsertRows.map((row, idx) => ({
          id: `usr-stud-pre-bulk-${Date.now()}-${idx}`,
          full_name: row.full_name!,
          role: 'student',
          adm_no: row.adm_no!,
          course_id: row.course_id || state.courses[0]?.id || '',
          phone: row.phone || '+254700000000',
          created_at: new Date().toISOString()
        }));

        const nextProfiles = [...newProfiles, ...state.profiles];
        saveDatabaseState({ ...state, profiles: nextProfiles });

        onRefresh();
        
        const skippedMsg = skippedAdms.length > 0 ? `Skipped ${skippedAdms.length} database duplicates.` : '';
        const internalMsg = internalDuplicates.length > 0 ? `Removed ${internalDuplicates.length} internal duplicates.` : '';
        setSuccessMsg(
          `Imported ${newProfiles.length} students successfully! ${skippedMsg} ${internalMsg}`.trim()
        );
        setCsvData([]);
        setLoading(false);
        setActiveTab('registry');
      }, 1000);
      return;
    }

    try {
      const inserts = finalInsertRows.map(row => ({
        id: self.crypto.randomUUID(),
        full_name: row.full_name,
        role: 'student',
        adm_no: row.adm_no,
        course_id: row.course_id || state.courses[0]?.id || null,
        phone: row.phone || '+254700000000'
      }));

      const { error: bulkErr } = await supabase
        .from('profiles')
        .insert(inserts);

      if (bulkErr) throw bulkErr;

      onRefresh();
      
      const skippedMsg = skippedAdms.length > 0 ? `Skipped ${skippedAdms.length} database duplicates.` : '';
      const internalMsg = internalDuplicates.length > 0 ? `Removed ${internalDuplicates.length} internal duplicates.` : '';
      setSuccessMsg(
        `Imported ${inserts.length} students successfully to live database! ${skippedMsg} ${internalMsg}`.trim()
      );
      setCsvData([]);
      setActiveTab('registry');
    } catch (err: any) {
      setErrorMsg(err.message || 'Bulk registry insertion failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3. STUDENT REGISTRY DELETION
  const requestDeleteStudent = (student: Profile) => {
    setDeletingStudent(student);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSupabaseConfigured) {
      // Local delete
      setTimeout(() => {
        const nextProfiles = state.profiles.filter(p => p.id !== deletingStudent.id);
        saveDatabaseState({ ...state, profiles: nextProfiles });
        onRefresh();
        setSuccessMsg(`Student ${deletingStudent.full_name} deleted from local registry.`);
        setDeletingStudent(null);
        setShowDeleteConfirm(false);
        setLoading(false);
      }, 600);
      return;
    }

    try {
      const { error: delErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deletingStudent.id);

      if (delErr) throw delErr;

      onRefresh();
      setSuccessMsg(`Student ${deletingStudent.full_name} removed from pre-registration database.`);
      setDeletingStudent(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove pre-registration profile.');
    } finally {
      setLoading(false);
    }
  };

  // Get registry student profiles (all students, filtered by search)
  const allRegistryStudents = state.profiles.filter(p => p.role === 'student');
  
  const filteredRegistry = allRegistryStudents.filter(student => {
    const term = searchTerm.toLowerCase();
    const nameMatch = student.full_name.toLowerCase().includes(term);
    const admMatch = (student.adm_no || '').toLowerCase().includes(term);
    return nameMatch || admMatch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pre-register Students</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gated registration registry: approve, import, or search student admission privileges.
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl text-center">
            <span className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest font-mono">Linked</span>
            <span className="text-lg font-black text-blue-800">
              {allRegistryStudents.filter(s => s.auth_linked).length}
            </span>
          </div>
          <div className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl text-center">
            <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono">Pending</span>
            <span className="text-lg font-black text-amber-800">
              {allRegistryStudents.filter(s => !s.auth_linked).length}
            </span>
          </div>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-xs text-emerald-800 flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-bold">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-xs text-red-800 flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6 -mb-px">
          <button
            onClick={() => setActiveTab('registry')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
              activeTab === 'registry' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Student Registry ({filteredRegistry.length})
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
              activeTab === 'manual' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Add Manually
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
              activeTab === 'bulk' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Bulk CSV Import
          </button>
        </nav>
      </div>

      {/* TAB CONTROLLERS */}

      {/* 1. STUDENT REGISTRY TABLE */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by student name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Table container */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100">
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student Name</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admission Number</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Course Program</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Contact</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRegistry.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                        No students found matching filters. Select <b>Add Manually</b> to pre-register your first student.
                      </td>
                    </tr>
                  ) : (
                    filteredRegistry.map((student) => {
                      const course = state.courses.find(c => c.id === student.course_id);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-xs font-black text-slate-800">{student.full_name}</td>
                          <td className="p-4 text-xs font-mono font-bold text-slate-700 uppercase">{student.adm_no}</td>
                          <td className="p-4 text-xs text-slate-600 max-w-[200px] truncate" title={course?.name || 'Unassigned'}>
                            {course?.name || 'Unassigned'}
                          </td>
                          <td className="p-4 text-xs font-mono text-slate-500">{student.phone || 'N/A'}</td>
                          <td className="p-4 text-center">
                            {student.auth_linked ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                <Check className="w-3 h-3" /> Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                <RefreshCw className="w-3 h-3 animate-pulse" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {student.auth_linked ? (
                              <span className="text-[10px] text-slate-400 font-medium italic select-none">Protected</span>
                            ) : (
                              <button
                                onClick={() => requestDeleteStudent(student)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Remove pre-registration record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. MANUAL PRE-REGISTRY FORM */}
      {activeTab === 'manual' && (
        <div className="max-w-xl bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
          <div className="mb-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Register Single Student</h2>
            <p className="text-xs text-slate-500 mt-1">Pre-authorize a new student to create their portal login.</p>
          </div>

          <form onSubmit={handleManualRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Stephen Kiprono"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Admission No */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Admission Number
              </label>
              <input
                type="text"
                required
                placeholder="e.g. BTTI/ICT/2024/110"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all uppercase"
              />
            </div>

            {/* Course Program Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Academic Program (Course)
              </label>
              <select
                required
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">-- Choose Course --</option>
                {state.courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Contact Phone
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +254711223344"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-blue-400"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pre-registering Student...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Authorize Student Registry
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 3. CSV BULK IMPORTER */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          {/* Instructions and Dropzone */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50/50 scale-[0.99]' 
                    : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/25'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInput}
                  accept=".csv"
                  className="hidden"
                />
                <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 border border-blue-100">
                  <Upload className="w-6 h-6 animate-bounce" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Upload Registry CSV</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Drag and drop your spreadsheet here, or <span className="text-blue-600 font-bold underline">browse local files</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-4 bg-slate-50 border border-slate-100 inline-block px-3 py-1.5 rounded-lg font-mono">
                  Supports *.csv up to 5MB
                </p>
              </div>

              {csvError && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-xs text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <p>{csvError}</p>
                </div>
              )}
            </div>

            {/* Format Instructions Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 self-start">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">CSV Layout Guidelines</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ensure your CSV file contains the following exactly spelled column headers in the first row:
              </p>
              <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 font-mono text-[9px] text-slate-600 space-y-1 shadow-2xs">
                <div><span className="font-bold text-indigo-700">full_name</span>: John Doe</div>
                <div><span className="font-bold text-indigo-700">adm_no</span>: BTTI/ICT/2024/001</div>
                <div><span className="font-bold text-indigo-700">course_id</span>: course-dict <span className="text-slate-400 text-[8px]">(optional)</span></div>
                <div><span className="font-bold text-indigo-700">phone</span>: +254700000000 <span className="text-slate-400 text-[8px]">(optional)</span></div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                * Unknown programs defaults to the primary department curriculum automatically.
              </p>
            </div>
          </div>

          {/* Validation preview table */}
          {csvData.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">CSV Validation Review</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Please double-check records below before completing import.</p>
                </div>
                <button
                  onClick={() => setCsvData([])}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <X className="w-3.5 h-3.5" /> Clear Imported
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 sticky top-0">
                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Admission #</th>
                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Course ID</th>
                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Phone</th>
                        <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvData.map((row, idx) => {
                        const isDuplicate = state.profiles.some(p => p.adm_no?.toUpperCase() === row.adm_no?.toUpperCase());
                        const isValid = row.full_name && row.adm_no;

                        return (
                          <tr key={idx} className={`text-xs border-b border-slate-100 ${isDuplicate ? 'bg-amber-50/20' : isValid ? 'bg-emerald-50/10' : 'bg-red-50/20'}`}>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.full_name || ''}
                                onChange={(e) => {
                                  const updated = [...csvData];
                                  updated[idx].full_name = e.target.value;
                                  setCsvData(updated);
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                                placeholder="Full Name"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.adm_no || ''}
                                onChange={(e) => {
                                  const updated = [...csvData];
                                  updated[idx].adm_no = e.target.value.toUpperCase();
                                  setCsvData(updated);
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 uppercase"
                                placeholder="Admission No"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={row.course_id || ''}
                                onChange={(e) => {
                                  const updated = [...csvData];
                                  updated[idx].course_id = e.target.value;
                                  setCsvData(updated);
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 cursor-pointer"
                              >
                                {state.courses.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.phone || ''}
                                onChange={(e) => {
                                  const updated = [...csvData];
                                  updated[idx].phone = e.target.value;
                                  setCsvData(updated);
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                                placeholder="+254700000000"
                              />
                            </td>
                            <td className="p-2 text-center whitespace-nowrap">
                              {isDuplicate ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                                  <AlertTriangle className="w-3 h-3" /> Duplicate
                                </span>
                              ) : isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                                  <Check className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-[10px] font-bold rounded-md">
                                  <X className="w-3 h-3" /> Invalid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirm submit bulk button */}
              <button
                onClick={handleBulkSubmit}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-indigo-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Inserting student roster...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Save {csvData.filter(row => row.full_name && row.adm_no && !state.profiles.some(p => p.adm_no?.toUpperCase() === row.adm_no?.toUpperCase())).length} Pre-registered Students
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && deletingStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="mx-auto w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            
            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Confirm Deletion</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to remove <b className="text-slate-800">{deletingStudent.full_name}</b> ({deletingStudent.adm_no}) from the student registry?
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed font-semibold bg-slate-50 border p-2 rounded-lg mt-2">
                This action is irreversible. The student will no longer be able to self-register.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingStudent(null);
                }}
                disabled={loading}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteStudent}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer flex items-center justify-center gap-1 disabled:bg-red-400"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
