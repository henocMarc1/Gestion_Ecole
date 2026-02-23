import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

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

    // Trier par nombre de retards (croissant) puis absences
    const sortedStats = [...statsArray].sort((a, b) => {
      if (a.late_days !== b.late_days) return a.late_days - b.late_days;
      if (a.absent_days !== b.absent_days) return a.absent_days - b.absent_days;
      return b.present_days - a.present_days;
    });

    // Préparer les détails pour Excel
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

    // Créer le classeur Excel
    const workbook = new ExcelJS.Workbook();

    // === FEUILLE 1: STATISTIQUES GLOBALES ===
    const statsSheet = workbook.addWorksheet('Statistiques');

    // En-tête de l'école
    const titleRow = statsSheet.addRow([schoolData.name]);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } };
    titleRow.height = 24;

    statsSheet.addRow([schoolData.address || '']);
    statsSheet.addRow([`Tél: ${schoolData.phone || ''}`]);
    statsSheet.addRow([]);

    // Titre
    const reportTitle = statsSheet.addRow(['RAPPORT DE POINTAGES']);
    reportTitle.font = { bold: true, size: 14 };
    reportTitle.height = 22;

    // Période
    const periodRow = statsSheet.addRow([
      `Période: ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
    ]);
    periodRow.font = { italic: true, size: 11 };
    statsSheet.addRow([]);

    // Statistiques globales
    const totalLate = statsArray.reduce((sum, s) => sum + s.late_days, 0);
    const totalAbsent = statsArray.reduce((sum, s) => sum + s.absent_days, 0);

    const globalStatsTitle = statsSheet.addRow(['STATISTIQUES GLOBALES']);
    globalStatsTitle.font = { bold: true, size: 12, color: { argb: 'FF1E40AF' } };
    
    statsSheet.addRow(['Nombre total de retards:', totalLate]);
    statsSheet.addRow(['Nombre total d\'absences:', totalAbsent]);
    statsSheet.addRow([]);

    // En-têtes du classement
    const classementTitle = statsSheet.addRow(['CLASSEMENT DES EMPLOYÉS (Meilleurs pointages)']);
    classementTitle.font = { bold: true, size: 12, color: { argb: 'FF1E40AF' } };
    statsSheet.addRow([]);

    const headerRow = statsSheet.addRow([
      'Rang',
      'Nom',
      'Poste',
      'Jours présents',
      'Retards',
      'Absences',
      'Minutes de retard',
    ]);

    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Données du classement
    sortedStats.forEach((stat, index) => {
      const dataRow = statsSheet.addRow([
        index + 1,
        stat.employee_name,
        stat.position,
        stat.present_days,
        stat.late_days,
        stat.absent_days,
        stat.total_late_minutes,
      ]);

      dataRow.height = 20;
      const isEven = index % 2 === 0;

      dataRow.eachCell((cell, colNumber) => {
        cell.alignment = {
          horizontal: colNumber === 1 || colNumber >= 4 ? 'center' : 'left',
          vertical: 'middle',
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        };
      });
    });

    // Ajuster les largeurs de colonnes
    statsSheet.columns = [
      { width: 8 }, // Rang
      { width: 25 }, // Nom
      { width: 20 }, // Poste
      { width: 15 }, // Présents
      { width: 12 }, // Retards
      { width: 12 }, // Absences
      { width: 18 }, // Minutes de retard
    ];

    // === FEUILLE 2: DÉTAILS DES POINTAGES ===
    const detailsSheet = workbook.addWorksheet('Détails');

    // En-tête
    const detailsTitle = detailsSheet.addRow(['DÉTAILS DES POINTAGES']);
    detailsTitle.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
    detailsTitle.height = 22;
    detailsSheet.addRow([]);

    const detailsHeaderRow = detailsSheet.addRow([
      'Date',
      'Nom',
      'Poste',
      'Statut',
      'Heure d\'entrée',
      'Heure de sortie',
      'Retard (min)',
      'Notes',
    ]);

    detailsHeaderRow.height = 24;
    detailsHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Données des détails
    details.forEach((detail, index) => {
      const statusLabel =
        detail.status === 'present' ? 'Présent' :
        detail.status === 'absent' ? 'Absent' :
        detail.status === 'late' ? 'Retard' :
        detail.status === 'half_day' ? 'Demi-journée' :
        detail.status === 'on_leave' ? 'Congé' : detail.status;

      // Pour les absents, ne pas afficher d'heure d'entrée/sortie
      const checkIn = detail.status === 'absent' ? '-' : (detail.check_in_time || '-');
      const checkOut = detail.status === 'absent' ? '-' : (detail.check_out_time || '-');

      const dataRow = detailsSheet.addRow([
        new Date(detail.date).toLocaleDateString('fr-FR'),
        detail.employee_name,
        detail.position,
        statusLabel,
        checkIn,
        checkOut,
        detail.late_minutes > 0 ? detail.late_minutes : '-',
        detail.notes || '',
      ]);

      dataRow.height = 20;
      const isEven = index % 2 === 0;

      dataRow.eachCell((cell, colNumber) => {
        cell.alignment = {
          horizontal: colNumber === 7 ? 'center' : 'left',
          vertical: 'middle',
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        };

        // Couleur selon statut (colonne 4)
        if (colNumber === 4) {
          if (detail.status === 'absent') {
            cell.font = { color: { argb: 'FFDC2626' } }; // Rouge
          } else if (detail.status === 'late') {
            cell.font = { color: { argb: 'FFD97706' } }; // Orange
          } else if (detail.status === 'present') {
            cell.font = { color: { argb: 'FF059669' } }; // Vert
          }
        }
      });
    });

    // Ajuster les largeurs de colonnes
    detailsSheet.columns = [
      { width: 12 }, // Date
      { width: 25 }, // Nom
      { width: 20 }, // Poste
      { width: 15 }, // Statut
      { width: 15 }, // Entrée
      { width: 15 }, // Sortie
      { width: 12 }, // Retard
      { width: 30 }, // Notes
    ];

    // Ajouter les filtres automatiques
    detailsSheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: details.length + 3, column: 8 },
    };

    // Générer le buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `rapport-pointages-${startDate}-${endDate}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Erreur génération rapport Excel:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport' },
      { status: 500 }
    );
  }
}
