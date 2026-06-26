import React from 'react';
import { CalendarDays } from 'lucide-react';

export default function Timetable() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <CalendarDays className="w-16 h-16 text-slate-300 mb-4" />
      <h2 className="text-xl font-bold text-slate-800 mb-2">Timetable</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        This section is coming soon. Soon you will be able to see your class schedule here.
      </p>
    </div>
  );
}
