import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

interface AttendanceStats {
  employee_id: string;
  employee_name: string;
  position: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  total_late_minutes: number;
  on_leave_days: number;
}

interface AttendanceDetail {
  date: string;
  employee_name: string;
  position: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  late_minutes: number;
  notes: string | null;
}

async function getLogoBytes(): Promise<Buffer | null> {
  const logoPath = process.env.SCHOOL_LOGO_PATH || path.join(process.cwd(), 'public', 'school-logo.png');
  
  if (process.env.SCHOOL_LOGO_PATH && fs.existsSync(process.env.SCHOOL_LOGO_PATH)) {
    return fs.readFileSync(process.env.SCHOOL_LOGO_PATH);
  }

  if (fs.existsSync(logoPath)) {
    return fs.readFileSync(logoPath);
  }

  const logoJpgPath = path.join(process.cwd(), 'public', 'school-logo.jpg');
  if (fs.existsSync(logoJpgPath)) {
    return fs.readFileSync(logoJpgPath);
  }

  if (process.env.SCHOOL_LOGO_URL) {
    try {
      const response = await fetch(process.env.SCHOOL_LOGO_URL);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
      }
    } catch (err) {
      console.error('Erreur chargement logo URL:', err);
    }
  }

  return null;
}

async function generateAttendanceReportPdf(
  stats: AttendanceStats[],
  details: AttendanceDetail[],
  schoolName: string,
  schoolAddress: string,
  schoolPhone: string,
  startDate: string,
  endDate: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([842, 595]); // A4 landscape
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  let currentY = height - 50;

  // Logo
  const logoBytes = await getLogoBytes();
  if (logoBytes) {
    try {
      let logoImage;
      const logoPathCheck = process.env.SCHOOL_LOGO_PATH || path.join(process.cwd(), 'public', 'school-logo.png');
      const isPng = logoPathCheck.toLowerCase().endsWith('.png');
      
      if (isPng) {
        logoImage = await pdfDoc.embedPng(logoBytes);
      } else {
        logoImage = await pdfDoc.embedJpg(logoBytes);
      }
      
      const logoHeight = 60;
      const logoWidth = (logoImage.width * logoHeight) / logoImage.height;
      page.drawImage(logoImage, {
        x: 50,
        y: currentY - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (err) {
      console.error('Erreur intégration logo:', err);
    }
  }

  // En-tête
  page.drawText(schoolName, {
    x: 150,
    y: currentY - 15,
    size: 16,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  page.drawText(schoolAddress, {
    x: 150,
    y: currentY - 35,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(`Tél: ${schoolPhone}`, {
    x: 150,
    y: currentY - 50,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  currentY -= 90;

  // Titre
  const title = 'RAPPORT DE POINTAGES';
  page.drawText(title, {
    x: (width - helveticaBold.widthOfTextAtSize(title, 18)) / 2,
    y: currentY,
    size: 18,
    font: helveticaBold,
    color: rgb(0, 0, 0.5),
  });

  currentY -= 25;

  // Période
  const periodText = `Période: ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`;
  page.drawText(periodText, {
    x: (width - helvetica.widthOfTextAtSize(periodText, 12)) / 2,
    y: currentY,
    size: 12,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  currentY -= 40;

  // Statistiques globales
  const totalLate = stats.reduce((sum, s) => sum + s.late_days, 0);
  const totalAbsent = stats.reduce((sum, s) => sum + s.absent_days, 0);
  
  page.drawText('STATISTIQUES GLOBALES', {
    x: 50,
    y: currentY,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  currentY -= 25;

  page.drawText(`Nombre total de retards: ${totalLate}`, {
    x: 70,
    y: currentY,
    size: 11,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });

  currentY -= 20;

  page.drawText(`Nombre total d'absences: ${totalAbsent}`, {
    x: 70,
    y: currentY,
    size: 11,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });

  currentY -= 40;

  // Classement des employés
  page.drawText('CLASSEMENT DES EMPLOYÉS (Meilleurs pointages)', {
    x: 50,
    y: currentY,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  currentY -= 25;

  // Trier par nombre de retards (croissant) puis absences
  const sortedStats = [...stats].sort((a, b) => {
    if (a.late_days !== b.late_days) return a.late_days - b.late_days;
    if (a.absent_days !== b.absent_days) return a.absent_days - b.absent_days;
    return b.present_days - a.present_days;
  });

  // Tableau des statistiques
  const tableStartY = currentY;
  const colWidths = [40, 200, 120, 80, 80, 80, 100];
  const rowHeight = 20;
  
  // En-têtes
  const headers = ['Rang', 'Nom', 'Poste', 'Présents', 'Retards', 'Absences', 'Min. retard'];
  let startX = 50;
  
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: startX,
      y: currentY,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    
    // Background header
    page.drawRectangle({
      x: startX - 5,
      y: currentY - 5,
      width: colWidths[i],
      height: rowHeight,
      color: rgb(0, 0, 0.5),
      opacity: 0.8,
    });
    
    page.drawText(header, {
      x: startX,
      y: currentY,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    
    startX += colWidths[i];
  });

  currentY -= rowHeight + 5;

  // Lignes de données
  sortedStats.slice(0, 15).forEach((stat, index) => {
    if (currentY < 80) {
      page = pdfDoc.addPage([842, 595]);
      currentY = height - 50;
    }

    startX = 50;
    const values = [
      (index + 1).toString(),
      stat.employee_name,
      stat.position,
      stat.present_days.toString(),
      stat.late_days.toString(),
      stat.absent_days.toString(),
      stat.total_late_minutes.toString() + ' min',
    ];

    // Background alterné
    if (index % 2 === 0) {
      page.drawRectangle({
        x: 45,
        y: currentY - 5,
        width: colWidths.reduce((a, b) => a + b, 0),
        height: rowHeight,
        color: rgb(0.95, 0.95, 0.95),
      });
    }

    values.forEach((value, i) => {
      page.drawText(value, {
        x: startX,
        y: currentY,
        size: 9,
        font: helvetica,
        color: rgb(0, 0, 0),
      });
      startX += colWidths[i];
    });

    currentY -= rowHeight;
  });

  currentY -= 30;

  // Détails des pointages (page suivante)
  if (details.length > 0) {
    page = pdfDoc.addPage([842, 595]);
    currentY = height - 50;

    page.drawText('DÉTAILS DES POINTAGES', {
      x: 50,
      y: currentY,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    currentY -= 30;

    // Tableau détaillé
    const detailHeaders = ['Date', 'Nom', 'Poste', 'Statut', 'Entrée', 'Sortie', 'Retard'];
    const detailColWidths = [80, 140, 100, 80, 70, 70, 70];
    startX = 50;

    detailHeaders.forEach((header, i) => {
      page.drawRectangle({
        x: startX - 5,
        y: currentY - 5,
        width: detailColWidths[i],
        height: rowHeight,
        color: rgb(0, 0, 0.5),
        opacity: 0.8,
      });

      page.drawText(header, {
        x: startX,
        y: currentY,
        size: 9,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      startX += detailColWidths[i];
    });

    currentY -= rowHeight + 5;

    // Lignes de détails
    details.slice(0, 30).forEach((detail, index) => {
      if (currentY < 80) {
        page = pdfDoc.addPage([842, 595]);
        currentY = height - 50;
      }

      startX = 50;
      
      // Pour les absents, ne pas afficher d'heure d'entrée/sortie
      const checkIn = detail.status === 'absent' ? '-' : (detail.check_in_time || '-');
      const checkOut = detail.status === 'absent' ? '-' : (detail.check_out_time || '-');
      const lateText = detail.late_minutes > 0 ? `${detail.late_minutes} min` : '-';
      
      const values = [
        new Date(detail.date).toLocaleDateString('fr-FR'),
        detail.employee_name,
        detail.position,
        detail.status === 'present' ? 'Présent' :
        detail.status === 'absent' ? 'Absent' :
        detail.status === 'late' ? 'Retard' :
        detail.status === 'half_day' ? 'Demi-j.' :
        detail.status === 'on_leave' ? 'Congé' : detail.status,
        checkIn,
        checkOut,
        lateText,
      ];

      // Background alterné
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 45,
          y: currentY - 5,
          width: detailColWidths.reduce((a, b) => a + b, 0),
          height: rowHeight,
          color: rgb(0.95, 0.95, 0.95),
        });
      }

      // Couleur selon statut
      let textColor = rgb(0, 0, 0);
      if (detail.status === 'absent') textColor = rgb(0.8, 0, 0);
      else if (detail.status === 'late') textColor = rgb(0.8, 0.5, 0);
      else if (detail.status === 'present') textColor = rgb(0, 0.6, 0);

      values.forEach((value, i) => {
        page.drawText(value, {
          x: startX,
          y: currentY,
          size: 8,
          font: helvetica,
          color: i === 3 ? textColor : rgb(0, 0, 0),
        });
        startX += detailColWidths[i];
      });

      currentY -= rowHeight;
    });
  }

  // Pied de page sur toutes les pages
  const pages = pdfDoc.getPages();
  pages.forEach((p, index) => {
    const footerText = `Rapport généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${index + 1}/${pages.length}`;
    p.drawText(footerText, {
      x: 50,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, schoolId } = body;

    if (!startDate || !endDate || !schoolId) {
      return NextResponse.json(
        { error: 'Dates de début/fin et school_id requis' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer les informations de l'école
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('name, address, phone')
      .eq('id', schoolId)
      .single();

    if (schoolError) {
      return NextResponse.json(
        { error: 'École non trouvée' },
        { status: 404 }
      );
    }

    // Récupérer les données de pointage
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance_records')
      .select(`
        *,
        employees:employee_id(
          id,
          first_name,
          last_name,
          position
        )
      `)
      .eq('school_id', schoolId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (attendanceError) {
      console.error('Erreur récupération pointages:', attendanceError);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des pointages' },
        { status: 500 }
      );
    }

    // Calculer les statistiques par employé
    const employeeStats = new Map<string, AttendanceStats>();

    (attendanceData || []).forEach((record: any) => {
      const empId = record.employee_id;
      const empName = `${record.employees.first_name} ${record.employees.last_name}`;
      const position = record.employees.position;

      if (!employeeStats.has(empId)) {
        employeeStats.set(empId, {
          employee_id: empId,
          employee_name: empName,
          position: position,
          total_days: 0,
          present_days: 0,
          absent_days: 0,
          late_days: 0,
          total_late_minutes: 0,
          on_leave_days: 0,
        });
      }

      const stats = employeeStats.get(empId)!;
      stats.total_days++;

      if (record.status === 'present') stats.present_days++;
      else if (record.status === 'absent') stats.absent_days++;
      else if (record.status === 'late') stats.late_days++;
      else if (record.status === 'on_leave') stats.on_leave_days++;

      if (record.late_minutes > 0) {
        stats.total_late_minutes += record.late_minutes;
      }
    });

    const statsArray = Array.from(employeeStats.values());

    // Préparer les détails pour le PDF
    const details: AttendanceDetail[] = (attendanceData || []).map((record: any) => ({
      date: record.date,
      employee_name: `${record.employees.first_name} ${record.employees.last_name}`,
      position: record.employees.position,
      status: record.status,
      check_in_time: record.check_in_time,
      check_out_time: record.check_out_time,
      late_minutes: record.late_minutes || 0,
      notes: record.notes,
    }));

    // Générer le PDF
    const pdfBuffer = await generateAttendanceReportPdf(
      statsArray,
      details,
      schoolData.name,
      schoolData.address || '',
      schoolData.phone || '',
      startDate,
      endDate
    );

    const filename = `rapport-pointages-${startDate}-${endDate}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Erreur génération rapport pointages:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport' },
      { status: 500 }
    );
  }
}
