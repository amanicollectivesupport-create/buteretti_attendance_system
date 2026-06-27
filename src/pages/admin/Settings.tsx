import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Server, Bell, Globe, Percent, Save, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Settings() {
  const [institutionName, setInstitutionName] = useState('Butere Technical Training Institute');
  const [domainName, setDomainName] = useState('btti.ac.ke');
  const [academicYear, setAcademicYear] = useState('2024/2025');
  const [semester, setSemester] = useState('1');
  const [greenThreshold, setGreenThreshold] = useState(80);
  const [amberThreshold, setAmberThreshold] = useState(75);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('System settings updated successfully!');
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          System Configuration & Settings
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Adjust portal-wide thresholds, academic timelines, and system behaviors.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel 1: Institution settings */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-50 pb-2">
            <Globe className="w-4 h-4 text-blue-500" />
            Institution Identity
          </h3>

          <div className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-gray-700">Institution Name</label>
              <input 
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-gray-700">Official Email Domain</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-200 bg-gray-50 text-gray-500 font-mono text-[11px]">
                  @
                </span>
                <input 
                  type="text"
                  required
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-r-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-1">Used to validate registrations and auto-generate faculty addresses.</p>
            </div>
          </div>
        </div>

        {/* Panel 2: Academic Period Settings */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-50 pb-2">
            <Server className="w-4 h-4 text-purple-500" />
            Academic Period Calendar
          </h3>

          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Academic Year</label>
                <select 
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Current Semester</label>
                <select 
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
            </div>
            <p className="text-[9px] text-gray-400">Controls default semester filters displayed across admin dashboards.</p>
          </div>
        </div>

        {/* Panel 3: Attendance Threshold Standards */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-50 pb-2">
            <Percent className="w-4 h-4 text-green-500" />
            Attendance Compliance Rules
          </h3>

          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Green Threshold (%)</label>
                <input 
                  type="number"
                  min={50}
                  max={100}
                  value={greenThreshold}
                  onChange={(e) => setGreenThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Amber Threshold (%)</label>
                <input 
                  type="number"
                  min={40}
                  max={99}
                  value={amberThreshold}
                  onChange={(e) => setAmberThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-[9px] text-gray-400">
              Students falling below the Amber threshold (default {amberThreshold}%) are flagged as &quot;At risk&quot; and disqualified from exam eligibility.
            </p>
          </div>
        </div>

        {/* Panel 4: Notification Alerts */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-50 pb-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Security & Alerts
          </h3>

          <div className="space-y-4 text-xs">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 max-w-[240px]">
                <p className="font-semibold text-gray-800">Email System Alerts</p>
                <p className="text-[10px] text-gray-400">Notify registry when correction requests are submitted.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center gap-2 text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-gray-500">
              <Shield className="w-4 h-4 text-gray-400 shrink-0" />
              <span>TLS Security and row-level access control (RLS) is fully active.</span>
            </div>
          </div>
        </div>

        {/* Save button spanning full width */}
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving Standards...' : 'Save Configuration'}
          </button>
        </div>

      </form>
    </div>
  );
}
