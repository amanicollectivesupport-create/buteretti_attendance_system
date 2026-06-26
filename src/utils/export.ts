/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Define structures for exporting
export interface AttendanceReportRow {
  studentName: string;
  admNo: string;
  phone: string;
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  totalDays: number;
  percentage: number;
}

export function exportToExcel(
  data: AttendanceReportRow[],
  unitName: string,
  academicYear: string,
  semester: string
) {
  // Map row format for spreadsheet output
  const sheetRows = data.map((row, idx) => ({
    'S/No.': idx + 1,
    'Student Name': row.studentName,
    'Admission Number': row.admNo,
    'Phone Number': row.phone,
    'Present Days': row.presentDays,
    'Absent Days': row.absentDays,
    'Excused Days': row.excusedDays,
    'Total Classes': row.totalDays,
    'Attendance %': `${row.percentage.toFixed(1)}%`,
    'Eligible for Exam (75% Rule)': row.percentage >= 75 ? 'YES' : 'NO'
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  
  // Set custom column widths
  const max_widths = [
    { wch: 6 },  // S/No.
    { wch: 25 }, // Student Name
    { wch: 20 }, // Adm No
    { wch: 15 }, // Phone
    { wch: 12 }, // Present
    { wch: 12 }, // Absent
    { wch: 12 }, // Excused
    { wch: 12 }, // Total
    { wch: 12 }, // %
    { wch: 25 }  // Exam status
  ];
  worksheet['!cols'] = max_widths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Summary');
  
  // Sanitise filename
  const safeUnitName = unitName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  XLSX.writeFile(workbook, `Butere_TTI_Attendance_${safeUnitName}_${academicYear.replace('/', '-')}.xlsx`);
}

export function exportToPDF(
  data: AttendanceReportRow[],
  unitName: string,
  courseName: string,
  academicYear: string,
  semester: string,
  lecturerName: string
) {
  const doc = new jsPDF();
  
  // Setup color palette (Butere TTI Style: Forest Green, Gold, Charcoal)
  const primaryColor = [22, 101, 52]; // Tailwind emerald-800 (#166534)
  const accentColor = [202, 138, 4];  // Tailwind yellow-600 (#ca8a04)
  const textColor = [31, 41, 55];    // Tailwind gray-800
  
  // Header section
  doc.setFillColor(22, 101, 52); // Forest Green header background
  doc.rect(0, 0, 210, 42, 'F');
  
  // Institute Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('BUTERE TECHNICAL TRAINING INSTITUTE', 15, 16);
  
  // Subtitle
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(234, 179, 8); // Gold text
  doc.text('EXCELLENCE IN SKILLS DEVELOPMENT • P.O. Box 98-50101, Butere, Kenya', 15, 23);
  doc.setTextColor(255, 255, 255);
  doc.text('STUDENT ATTENDANCE REPORT & ACADEMIC AUDIT', 15, 30);
  
  // Divider line
  doc.setFillColor(234, 179, 8);
  doc.rect(0, 42, 210, 2, 'F');

  // Metadata block (Lecturer, Unit, Class, Semester)
  doc.setTextColor(55, 65, 81); // gray-700
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  
  doc.text('Course / Program:', 15, 55);
  doc.text('Course Unit:', 15, 61);
  doc.text('Lecturer In-Charge:', 15, 67);

  doc.text('Academic Year:', 125, 55);
  doc.text('Semester:', 125, 61);
  doc.text('Report Generated:', 125, 67);

  doc.setFont('Helvetica', 'normal');
  doc.text(courseName, 52, 55);
  doc.text(unitName, 52, 61);
  doc.text(lecturerName, 52, 67);

  doc.text(academicYear, 162, 55);
  doc.text(semester, 162, 61);
  doc.text(new Date().toLocaleDateString('en-GB'), 162, 67);

  // Policy indicator text (75% Rule in Kenyan TVETs)
  doc.setFillColor(254, 243, 199); // amber-50 background
  doc.setDrawColor(252, 211, 77); // amber-300 border
  doc.rect(15, 73, 180, 10, 'FD');
  
  doc.setTextColor(180, 83, 9); // amber-800
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ATTENDANCE MANDATE: Candidates must achieve a minimum of 75% attendance in each unit to qualify for KNEC exams.', 18, 79.5);

  // Prepare table headers
  const headers = ['S/No.', 'Student Name', 'Admission No.', 'Phone', 'Pres', 'Abs', 'Exc', 'Total', 'Rate %', 'Status'];
  
  // Map row data
  const rows = data.map((row, idx) => {
    const rate = row.percentage;
    const isEligible = rate >= 75;
    return [
      idx + 1,
      row.studentName,
      row.admNo,
      row.phone,
      row.presentDays,
      row.absentDays,
      row.excusedDays,
      row.totalDays,
      `${rate.toFixed(1)}%`,
      isEligible ? 'ELIGIBLE' : 'BARRED'
    ];
  });

  // Render Table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 88,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [22, 101, 52], // emerald-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 22 },
      4: { halign: 'center', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 10 },
      6: { halign: 'center', cellWidth: 10 },
      7: { halign: 'center', cellWidth: 10 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 20 }
    },
    didParseCell: (cellData) => {
      // Style the status and rate column color-coding
      if (cellData.section === 'body' && cellData.column.index === 9) {
        if (cellData.cell.raw === 'ELIGIBLE') {
          cellData.cell.styles.textColor = [21, 128, 61]; // green-700
        } else {
          cellData.cell.styles.textColor = [220, 38, 38]; // red-600
        }
      }
      if (cellData.section === 'body' && cellData.column.index === 8) {
        const rateStr = String(cellData.cell.raw).replace('%', '');
        const rateVal = parseFloat(rateStr);
        if (rateVal < 75) {
          cellData.cell.styles.textColor = [220, 38, 38];
        } else {
          cellData.cell.styles.textColor = [21, 128, 61];
        }
      }
    }
  });

  // Footer / Sign-off section
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  if (finalY < 260) {
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.line(15, finalY + 10, 195, finalY + 10);
    
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // gray-400
    doc.text('Disclaimer: This is an official, system-generated Butere TTI Academic Record. Tampering with this sheet is a disciplinary offense.', 15, finalY + 18);
    
    // Signature block
    doc.setTextColor(75, 85, 99); // gray-600
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Lecturer Sign-Off:', 15, finalY + 6);
    doc.line(48, finalY + 6, 95, finalY + 6); // underline
    
    doc.text('Registrar (Academic):', 115, finalY + 6);
    doc.line(152, finalY + 6, 195, finalY + 6); // underline
  }

  const safeUnitName = unitName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`Butere_TTI_Report_${safeUnitName}_${academicYear.replace('/', '-')}.pdf`);
}
