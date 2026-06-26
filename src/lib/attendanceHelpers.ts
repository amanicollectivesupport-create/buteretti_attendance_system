import { isToday, isYesterday, format, parseISO, isThisWeek } from 'date-fns';

export interface AttendanceStatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  bar: string;
}

export const getAttendanceStatus = (pct: number): AttendanceStatusConfig => {
  if (pct >= 80) {
    return { 
      label: 'On track', 
      color: 'text-green-600', 
      bg: 'bg-green-50', 
      border: 'border-green-200',
      bar: 'bg-green-500'
    };
  }
  if (pct >= 75) {
    return { 
      label: 'Borderline', 
      color: 'text-amber-600', 
      bg: 'bg-amber-50', 
      border: 'border-amber-200',
      bar: 'bg-amber-400'
    };
  }
  return { 
    label: 'At risk', 
    color: 'text-red-600', 
    bg: 'bg-red-50', 
    border: 'border-red-200',
    bar: 'bg-red-500'
  };
};

export const getCurrentSemesterInfo = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-indexed (0 is Jan, 5 is Jun, 11 is Dec)
  const year = today.getFullYear();
  
  if (month >= 0 && month <= 5) {
    // Jan - Jun
    return {
      semester: '1',
      academicYear: `${year - 1}/${year}`
    };
  } else {
    // Jul - Dec
    return {
      semester: '2',
      academicYear: `${year}/${year + 1}`
    };
  }
};

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export const formatAttendanceDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = parseISO(dateString);
  if (isNaN(date.getTime())) {
    const fallbackDate = new Date(dateString);
    if (isNaN(fallbackDate.getTime())) return dateString;
    return formatAttendanceDateWithDate(fallbackDate, dateString);
  }
  return formatAttendanceDateWithDate(date, dateString);
};

const formatAttendanceDateWithDate = (date: Date, originalString: string): string => {
  const hasTime = originalString.includes('T') || originalString.includes(':') || originalString.includes(' ');
  const timeStr = hasTime ? `, ${format(date, 'h:mm a')}` : '';
  
  if (isToday(date)) {
    return `Today${timeStr}`;
  }
  if (isYesterday(date)) {
    return `Yesterday${timeStr}`;
  }
  if (isThisWeek(date)) {
    return `${format(date, 'eee')}${timeStr}`;
  }
  return format(date, 'dd MMM yyyy');
};

export const getInitials = (fullName: string): string => {
  if (!fullName) return 'ST';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().substring(0, 2);
};
