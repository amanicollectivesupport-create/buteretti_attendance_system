import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <SettingsIcon className="w-16 h-16 text-slate-300 mb-4" />
      <h2 className="text-xl font-bold text-slate-800 mb-2">Settings</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        This section is coming soon. Soon you will be able to customize your preferences and notifications here.
      </p>
    </div>
  );
}
