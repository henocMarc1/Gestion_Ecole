'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/helpers';
import { exportToExcel, exportToPDFTable } from '@/utils/exportUtils';
import { useSchoolYear } from '@/context/SchoolYearContext';

interface Report {
  title: string;
  description: string;
  icon: keyof typeof Icons;
  color: string;
}

interface ClassOption {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { selectedYearId, selectedYear } = useSchoolYear();
  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    totalClasses: 0,
    totalTeachers: 0,
    totalRevenue: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    recoveryRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Ã‰tats pour le modal de sÃ©lection de classes
  const [showClassModal, setShowClassModal] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'csv'>('pdf');
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    loadReportData();
    loadClasses();
  }, [user?.school_id, selectedYearId, selectedYear?.name]);

  const loadClasses = async () => {
    if (!user?.school_id) return;
    try {
      let query = supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user.school_id)
        .order('name');

      if (selectedYearId) {
        query = query.eq('year_id', selectedYearId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setAvailableClasses(data || []);
    } catch (error) {
      console.error('Erreur chargement classes:', error);
    }
  };

  const handleOpenClassModal = (type: 'pdf' | 'csv') => {
    setExportType(type);
    setSelectedClasses([]); // RÃ©initialiser la sÃ©lection
    setShowClassModal(true);
  };

  const handleToggleClass = (classId: string) => {
    setSelectedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleToggleAllClasses = () => {
    if (selectedClasses.length === availableClasses.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(availableClasses.map(c => c.id));
    }
  };

  const handleConfirmExport = () => {
    if (selectedClasses.length === 0) {
      toast.error('Veuillez sÃ©lectionner au moins une classe');
      return;
    }
    
    setShowClassModal(false);
    
    if (exportType === 'pdf') {
      handleExportStudentsPDF(selectedClasses);
    } else {
      handleExportStudentsCSV(selectedClasses);
    }
  };

  const loadReportData = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      let classesQuery = supabase
        .from('classes')
        .select('id', { count: 'exact' })
        .eq('school_id', user.school_id);

      if (selectedYearId) {
        classesQuery = classesQuery.eq('year_id', selectedYearId);
      }

      const classes = await classesQuery;
      const classIds = (classes.data || []).map((c: any) => c.id);

      let studentsQuery = supabase
        .from('students')
        .select('id', { count: 'exact' })
        .eq('school_id', user.school_id);

      if (selectedYearId) {
        if (classIds.length > 0) {
          studentsQuery = studentsQuery.in('class_id', classIds);
        } else {
          studentsQuery = studentsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const [students, teachers, invoices] = await Promise.all([
        studentsQuery,
        supabase
          .from('users')
          .select('id', { count: 'exact' })
          .eq('school_id', user.school_id)
          .eq('role', 'TEACHER'),
        supabase
          .from('invoices')
          .select('total, status')
          .eq('school_id', user.school_id)
          .gte('created_at', selectedYear?.start_date || '1900-01-01')
          .lte('created_at', selectedYear?.end_date || '2999-12-31'),
      ]);

      const invoiceList = invoices.data || [];
      const totalRevenue = invoiceList.reduce((sum, i) => sum + (i.total || 0), 0);
      const paidCount = invoiceList.filter(i => i.status === 'PAID').length;
      const paidRevenue = invoiceList
        .filter(i => i.status === 'PAID')
        .reduce((sum, i) => sum + (i.total || 0), 0);
      
      // Calculer le taux de recouvrement (montant payÃ© / montant total)
      const recoveryRate = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0;

      setStats({
        totalStudents: students.count || 0,
        totalClasses: classes.count || 0,
        totalTeachers: teachers.count || 0,
        totalRevenue,
        paidRevenue,
        totalInvoices: invoiceList.length,
        paidInvoices: paidCount,
        recoveryRate,
      });
    } catch (error) {
      toast.error('Erreur lors du chargement des rapports');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      // PrÃ©parer les donnÃ©es pour l'export
      const reportData = [
        { MÃ©trique: 'Total Ã©lÃ¨ves', Valeur: stats.totalStudents },
        { MÃ©trique: 'Total classes', Valeur: stats.totalClasses },
        { MÃ©trique: 'Total enseignants', Valeur: stats.totalTeachers },
        { MÃ©trique: 'Total collectÃ©', Valeur: formatCurrency(stats.totalRevenue) },
        { MÃ©trique: 'Total factures', Valeur: stats.totalInvoices },
        { MÃ©trique: 'Factures payÃ©es', Valeur: stats.paidInvoices },
      ];

      const headers = ['MÃ©trique', 'Valeur'];
      const rows = reportData.map(d => [d.MÃ©trique, String(d.Valeur)]);

      await exportToPDFTable(
        'Rapport GÃ©nÃ©ral de l\'Ã‰cole',
        headers,
        rows,
        `rapport_general_${new Date().toISOString().split('T')[0]}`
      );
      toast.success('PDF gÃ©nÃ©rÃ© et tÃ©lÃ©chargÃ©');
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration du PDF');
      console.error(error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const reportData = [
        { MÃ©trique: 'Total Ã©lÃ¨ves', Valeur: stats.totalStudents },
        { MÃ©trique: 'Total classes', Valeur: stats.totalClasses },
        { MÃ©trique: 'Total enseignants', Valeur: stats.totalTeachers },
        { MÃ©trique: 'Total collectÃ©', Valeur: formatCurrency(stats.totalRevenue) },
        { MÃ©trique: 'Total factures', Valeur: stats.totalInvoices },
        { MÃ©trique: 'Factures payÃ©es', Valeur: stats.paidInvoices },
      ];

      await exportToExcel(
        reportData,
        `rapport_general_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      toast.success('Rapport en Excel tÃ©lÃ©chargÃ©');
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration du fichier Excel');
      console.error(error);
    }
  };

  // Export spÃ©cifique pour les Ã©lÃ¨ves
  const handleExportStudentsPDF = async (classIds: string[]) => {
    try {
      // RÃ©cupÃ©rer les informations de l'Ã©cole
      const { data: school } = await supabase
        .from('schools')
        .select('name, logo_url, address, phone')
        .eq('id', user?.school_id)
        .single();

      // RÃ©cupÃ©rer les Ã©lÃ¨ves filtrÃ©s par classes avec leurs parents
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule, status, class_id, gender, date_of_birth, place_of_birth')
        .eq('school_id', user?.school_id)
        .in('class_id', classIds);

      if (studentsError) {
        console.error('Erreur Supabase:', studentsError);
        throw studentsError;
      }

      if (!students || students.length === 0) {
        toast.info('Aucun Ã©lÃ¨ve trouvÃ©');
        return;
      }

      // RÃ©cupÃ©rer les numÃ©ros des parents pour chaque Ã©lÃ¨ve
      const studentIds = students.map(s => s.id);
      const { data: parentPhones } = await supabase
        .from('parents_students')
        .select('student_id, users!parents_students_parent_id_fkey(phone)')
        .in('student_id', studentIds)
        .eq('is_primary_contact', true);

      // CrÃ©er un map student_id -> parent_phone
      const parentPhoneMap = new Map(
        parentPhones?.map(pp => [pp.student_id, (pp.users as any)?.phone || 'N/A']) || []
      );

      // CrÃ©er un map des classes
      const classMap = new Map();
      if (classIds.length > 0) {
        const { data: classes } = await supabase
          .from('classes')
          .select('id, name')
          .in('id', classIds);
        classes?.forEach(c => classMap.set(c.id, c.name));
      }

      // Trier les Ã©lÃ¨ves par ordre alphabÃ©tique (nom puis prÃ©nom)
      const sortedStudents = [...students].sort((a, b) => {
        const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
        const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
        return nameA.localeCompare(nameB, 'fr');
      });

      // DÃ©terminer les en-tÃªtes et les lignes selon le nombre de classes
      let headers: string[];
      let rows: any[][];
      let subtitle: string | undefined;

      // Fonction pour formater le sexe
      const formatGender = (gender?: string | null) => {
        if (gender === 'M') return 'Masculin';
        if (gender === 'F') return 'FÃ©minin';
        return gender || 'N/A';
      };

      // Fonction pour formater la date
      const formatDate = (date?: string | null) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('fr-FR');
      };

      if (classIds.length === 1) {
        // Une seule classe : afficher le nom en sous-titre, pas de colonne classe
        const className = classMap.get(classIds[0]) || 'Classe';
        subtitle = `Classe: ${className}`;
        headers = ['Matricule', 'Nom complet', 'Sexe', 'Date naissance', 'Lieu naissance', 'NÂ° urgence', 'REMARQUE'];
        rows = sortedStudents.map(s => [
          s.matricule || 'N/A',
          `${s.last_name} ${s.first_name}`,
          formatGender(s.gender),
          formatDate(s.date_of_birth),
          s.place_of_birth || 'N/A',
          parentPhoneMap.get(s.id) || 'N/A',
          '' // REMARQUE vide
        ]);
      } else {
        // Plusieurs classes : ajouter la colonne classe
        headers = ['Matricule', 'Nom complet', 'Classe', 'Sexe', 'Date naissance', 'Lieu naissance', 'NÂ° urgence', 'REMARQUE'];
        rows = sortedStudents.map(s => [
          s.matricule || 'N/A',
          `${s.last_name} ${s.first_name}`,
          classMap.get(s.class_id) || 'Non assignÃ©',
          formatGender(s.gender),
          formatDate(s.date_of_birth),
          s.place_of_birth || 'N/A',
          parentPhoneMap.get(s.id) || 'N/A',
          '' // REMARQUE vide
        ]);
      }

      // Calculer les statistiques
      const totalStudents = sortedStudents.length;
      const boys = sortedStudents.filter(s => s.gender === 'M').length;
      const girls = sortedStudents.filter(s => s.gender === 'F').length;

      await exportToPDFTable(
        'FICHE Ã‰LÃˆVES',
        headers,
        rows,
        `etat_eleves_${new Date().toISOString().split('T')[0]}`,
        {
          schoolName: school?.name,
          schoolLogo: school?.logo_url,
          schoolAddress: school?.address,
          schoolPhone: school?.phone,
          subtitle,
          addNumbering: true,
          stats: { total: totalStudents, boys, girls }
        }
      );

      toast.success(`PDF des Ã©lÃ¨ves gÃ©nÃ©rÃ© (${students.length} Ã©lÃ¨ves)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error('Erreur complÃ¨te:', error);
    }
  };

  const handleExportStudentsCSV = async (classIds: string[]) => {
    try {
      // RÃ©cupÃ©rer les Ã©lÃ¨ves filtrÃ©s par classes avec leurs parents
      const { data: students, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule, date_of_birth, place_of_birth, gender, status, class_id')
        .eq('school_id', user?.school_id)
        .in('class_id', classIds);

      if (error) throw error;

      if (!students || students.length === 0) {
        toast.info('Aucun Ã©lÃ¨ve trouvÃ©');
        return;
      }

      // RÃ©cupÃ©rer les numÃ©ros des parents pour chaque Ã©lÃ¨ve
      const studentIds = students.map(s => s.id);
      const { data: parentPhones } = await supabase
        .from('parents_students')
        .select('student_id, users!parents_students_parent_id_fkey(phone)')
        .in('student_id', studentIds)
        .eq('is_primary_contact', true);

      // CrÃ©er un map student_id -> parent_phone
      const parentPhoneMap = new Map(
        parentPhones?.map(pp => [pp.student_id, (pp.users as any)?.phone || 'N/A']) || []
      );

      // RÃ©cupÃ©rer toutes les classes
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user?.school_id);

      const classMap = new Map(classes?.map(c => [c.id, c.name]) || []);

      // Trier par ordre alphabÃ©tique (nom puis prÃ©nom)
      const sortedStudents = [...students].sort((a, b) => {
        const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
        const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
        return nameA.localeCompare(nameB, 'fr');
      });

      // Fonction pour formater le sexe
      const formatGender = (gender?: string | null) => {
        if (gender === 'M') return 'Masculin';
        if (gender === 'F') return 'FÃ©minin';
        return gender || 'N/A';
      };

      // Fonction pour formater la date
      const formatDate = (date?: string | null) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('fr-FR');
      };

      const csvData = sortedStudents.map(s => ({
        Matricule: s.matricule || 'N/A',
        'Nom complet': `${s.last_name} ${s.first_name}`,
        Sexe: formatGender(s.gender),
        'Date naissance': formatDate(s.date_of_birth),
        'Lieu naissance': s.place_of_birth || 'N/A',
        'NÂ° urgence': parentPhoneMap.get(s.id) || 'N/A',
        Classe: classMap.get(s.class_id) || 'Non assignÃ©',
        REMARQUE: ''
      }));

      // Utiliser l'API serveur pour le tÃ©lÃ©chargement Excel (plus fiable sur Edge)
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: csvData,
          filename: `etat_eleves_${new Date().toISOString().split('T')[0]}.xlsx`,
          columns: ['Matricule', 'Nom complet', 'Sexe', 'Date naissance', 'Lieu naissance', 'NÂ° urgence', 'Classe', 'REMARQUE']
        })
      });

      if (!response.ok) throw new Error('Erreur tÃ©lÃ©chargement');

      // Obtenir le blob et dÃ©clencher le tÃ©lÃ©chargement
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `etat_eleves_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Excel des Ã©lÃ¨ves tÃ©lÃ©chargÃ© (${students.length} Ã©lÃ¨ves)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error(error);
    }
  };

  // Export spÃ©cifique pour les classes
  const handleExportClassesPDF = async () => {
    try {
      // RÃ©cupÃ©rer les informations de l'Ã©cole
      const { data: school } = await supabase
        .from('schools')
        .select('name, logo_url, address, phone')
        .eq('id', user?.school_id)
        .single();

      let classesQuery = supabase
        .from('classes')
        .select('id, name, year_id')
        .eq('school_id', user?.school_id);

      if (selectedYearId) {
        classesQuery = classesQuery.eq('year_id', selectedYearId);
      }

      const { data: classes, error } = await classesQuery;

      if (error) throw error;

      if (!classes || classes.length === 0) {
        toast.info('Aucune classe trouvÃ©e');
        return;
      }

      // RÃ©cupÃ©rer les annÃ©es scolaires  
      const { data: years } = await supabase
        .from('years')
        .select('id, name');

      const yearMap = new Map(years?.map(y => [y.id, y.name]) || []);

      // RÃ©cupÃ©rer les associations enseignant-classe
      const { data: teacherClasses } = await supabase
        .from('teacher_classes')
        .select('class_id, user_id:teacher_id(full_name)')
        .eq('is_main_teacher', true);

      const teacherMap = new Map();
      teacherClasses?.forEach((tc: any) => {
        const teacherName = tc.user_id?.full_name || 'Non assignÃ©';
        teacherMap.set(tc.class_id, teacherName);
      });

      // Compter les Ã©lÃ¨ves pour chaque classe
      const classesWithCounts = await Promise.all(
        classes.map(async (c) => {
          const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', c.id);
          return { ...c, studentCount: count || 0, teacherName: teacherMap.get(c.id) || 'Non assignÃ©', yearName: yearMap.get(c.year_id) || 'N/A' };
        })
      );

      // Trier par ordre alphabÃ©tique (nom de classe)
      const sortedClasses = classesWithCounts.sort((a, b) => 
        a.name.localeCompare(b.name, 'fr')
      );

      const headers = ['Classe', 'AnnÃ©e scolaire', 'Enseignant', 'Nb Ã©lÃ¨ves'];
      const rows = sortedClasses.map(c => [
        c.name,
        c.yearName,
        c.teacherName,
        String(c.studentCount)
      ]);

      await exportToPDFTable(
        'Ã‰tat des Classes',
        headers,
        rows,
        `etat_classes_${new Date().toISOString().split('T')[0]}`,
        {
          schoolName: school?.name,
          schoolLogo: school?.logo_url,
          schoolAddress: school?.address,
          schoolPhone: school?.phone,
          addNumbering: true
        }
      );

      toast.success(`PDF des classes gÃ©nÃ©rÃ© (${classes.length} classes)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error(error);
    }
  };

  const handleExportClassesCSV = async () => {
    try {
      let classesQuery = supabase
        .from('classes')
        .select('id, name, year_id')
        .eq('school_id', user?.school_id);

      if (selectedYearId) {
        classesQuery = classesQuery.eq('year_id', selectedYearId);
      }

      const { data: classes, error } = await classesQuery;

      if (error) throw error;

      if (!classes || classes.length === 0) {
        toast.info('Aucune classe trouvÃ©e');
        return;
      }

      // RÃ©cupÃ©rer les annÃ©es scolaires  
      const { data: years } = await supabase
        .from('years')
        .select('id, name');

      const yearMap = new Map(years?.map(y => [y.id, y.name]) || []);

      // RÃ©cupÃ©rer les associations enseignant-classe
      const { data: teacherClasses } = await supabase
        .from('teacher_classes')
        .select('class_id, user_id:teacher_id(full_name)')
        .eq('is_main_teacher', true);

      const teacherMap = new Map();
      teacherClasses?.forEach((tc: any) => {
        const teacherName = tc.user_id?.full_name || 'Non assignÃ©';
        teacherMap.set(tc.class_id, teacherName);
      });

      // Compter les Ã©lÃ¨ves pour chaque classe
      const classesWithCounts = await Promise.all(
        classes.map(async (c) => {
          const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', c.id);
          return { ...c, studentCount: count || 0, teacherName: teacherMap.get(c.id) || 'Non assignÃ©', yearName: yearMap.get(c.year_id) || 'N/A' };
        })
      );

      // Trier par ordre alphabÃ©tique (nom de classe)
      const sortedClasses = classesWithCounts.sort((a, b) => 
        a.name.localeCompare(b.name, 'fr')
      );

      const csvData = sortedClasses.map(c => ({
        Classe: c.name,
        'AnnÃ©e scolaire': c.yearName,
        Enseignant: c.teacherName,
        'Nombre d\'Ã©lÃ¨ves': c.studentCount
      }));

      // Utiliser l'API serveur pour le tÃ©lÃ©chargement
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: csvData,
          filename: `etat_classes_${new Date().toISOString().split('T')[0]}.xlsx`
        })
      });

      if (!response.ok) throw new Error('Erreur tÃ©lÃ©chargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `etat_classes_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Excel des classes tÃ©lÃ©chargÃ© (${classes.length} classes)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error(error);
    }
  };

  // Export spÃ©cifique pour les enseignants
  const handleExportTeachersPDF = async () => {
    try {
      // RÃ©cupÃ©rer les informations de l'Ã©cole
      const { data: school } = await supabase
        .from('schools')
        .select('name, logo_url, address, phone')
        .eq('id', user?.school_id)
        .single();

      const { data: teachers, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .eq('school_id', user?.school_id)
        .eq('role', 'TEACHER');

      if (error) throw error;

      if (!teachers || teachers.length === 0) {
        toast.info('Aucun enseignant trouvÃ©');
        return;
      }

      // RÃ©cupÃ©rer les classes pour chaque enseignant
      const teachersWithClasses = await Promise.all(
        teachers.map(async (t) => {
          const { data: teacherClasses } = await supabase
            .from('teacher_classes')
            .select('class_id:classes(name)')
            .eq('teacher_id', t.id);
          return { 
            ...t, 
            classes: teacherClasses?.map((tc: any) => tc.class_id) || [] 
          };
        })
      );

      // Trier par ordre alphabÃ©tique (nom complet)
      const sortedTeachers = teachersWithClasses.sort((a, b) => 
        a.full_name.localeCompare(b.full_name, 'fr')
      );

      const headers = ['Nom complet', 'Email', 'TÃ©lÃ©phone', 'Classes'];
      const rows = sortedTeachers.map(t => [
        t.full_name,
        t.email || 'N/A',
        t.phone || 'N/A',
        t.classes.map((c: any) => c.name).join(', ') || 'Aucune'
      ]);

      await exportToPDFTable(
        'Ã‰tat des Enseignants',
        headers,
        rows,
        `etat_enseignants_${new Date().toISOString().split('T')[0]}`,
        {
          schoolName: school?.name,
          schoolLogo: school?.logo_url,
          schoolAddress: school?.address,
          schoolPhone: school?.phone,
          addNumbering: true
        }
      );

      toast.success(`PDF des enseignants gÃ©nÃ©rÃ© (${teachers.length} enseignants)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error(error);
    }
  };

  const handleExportTeachersCSV = async () => {
    try {
      const { data: teachers, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .eq('school_id', user?.school_id)
        .eq('role', 'TEACHER');

      if (error) throw error;

      if (!teachers || teachers.length === 0) {
        toast.info('Aucun enseignant trouvÃ©');
        return;
      }

      // RÃ©cupÃ©rer les classes pour chaque enseignant
      const teachersWithClasses = await Promise.all(
        teachers.map(async (t) => {
          const { data: teacherClasses } = await supabase
            .from('teacher_classes')
            .select('class_id:classes(name)')
            .eq('teacher_id', t.id);
          const classes = teacherClasses?.map((tc: any) => tc.class_id).filter(Boolean) || [];
          return { ...t, classes };
        })
      );

      // Trier par ordre alphabÃ©tique (nom complet)
      const sortedTeachers = teachersWithClasses.sort((a, b) => 
        a.full_name.localeCompare(b.full_name, 'fr')
      );

      const csvData = sortedTeachers.map(t => ({
        'Nom complet': t.full_name,
        Email: t.email || 'N/A',
        TÃ©lÃ©phone: t.phone || 'N/A',
        Classes: t.classes.map((c: any) => c.name).join(', ') || 'Aucune'
      }));

      // Utiliser l'API serveur pour le tÃ©lÃ©chargement
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: csvData,
          filename: `etat_enseignants_${new Date().toISOString().split('T')[0]}.xlsx`
        })
      });

      if (!response.ok) throw new Error('Erreur tÃ©lÃ©chargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `etat_enseignants_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Excel des enseignants tÃ©lÃ©chargÃ© (${teachers.length} enseignants)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error(error);
    }
  };

  // Export spÃ©cifique pour le rapport financier
  const handleExportFinancialPDF = async () => {
    try {
      // RÃ©cupÃ©rer les informations de l'Ã©cole
      const { data: school } = await supabase
        .from('schools')
        .select('name, logo_url, address, phone')
        .eq('id', user?.school_id)
        .single();

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('invoice_number, total, status, due_date, student_id')
        .eq('school_id', user?.school_id)
        .gte('created_at', selectedYear?.start_date || '1900-01-01')
        .lte('created_at', selectedYear?.end_date || '2999-12-31')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        toast.info('Aucune facture trouvÃ©e');
        return;
      }

      // RÃ©cupÃ©rer les Ã©lÃ¨ves
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule')
        .eq('school_id', user?.school_id);

      const studentMap = new Map(students?.map(s => [s.id, s]) || []);

      // Trier les factures par numÃ©ro
      const sortedInvoices = [...invoices].sort((a, b) => {
        const numA = a.invoice_number || '';
        const numB = b.invoice_number || '';
        return numA.localeCompare(numB, 'fr');
      });

      const headers = ['NÂ° Facture', 'Matricule', 'Ã‰lÃ¨ve', 'Montant', 'Statut', 'Ã‰chÃ©ance'];
      const rows = sortedInvoices.map(i => {
        const student = studentMap.get(i.student_id);
        return [
          i.invoice_number || 'N/A',
          student?.matricule || 'N/A',
          student ? `${student.last_name} ${student.first_name}` : 'N/A',
          formatCurrency(i.total),
          i.status === 'PAID' ? 'PayÃ©e' : i.status === 'PENDING' ? 'En attente' : i.status,
          i.due_date ? new Date(i.due_date).toLocaleDateString('fr-FR') : 'N/A'
        ];
      });

      await exportToPDFTable(
        'Rapport Financier',
        headers,
        rows,
        `rapport_financier_${new Date().toISOString().split('T')[0]}`,
        {
          schoolName: school?.name,
          schoolLogo: school?.logo_url,
          schoolAddress: school?.address,
          schoolPhone: school?.phone,
          addNumbering: true
        }
      );

      toast.success(`PDF financier gÃ©nÃ©rÃ© (${invoices.length} factures)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error(error);
    }
  };

  const handleExportFinancialCSV = async () => {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('invoice_number, total, status, due_date, updated_at, student_id')
        .eq('school_id', user?.school_id)
        .gte('created_at', selectedYear?.start_date || '1900-01-01')
        .lte('created_at', selectedYear?.end_date || '2999-12-31')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        toast.info('Aucune facture trouvÃ©e');
        return;
      }

      // RÃ©cupÃ©rer les Ã©lÃ¨ves
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule')
        .eq('school_id', user?.school_id);

      const studentMap = new Map(students?.map(s => [s.id, s]) || []);

      const csvData = invoices.map(i => {
        const student = studentMap.get(i.student_id);
        return {
          'NÂ° Facture': i.invoice_number || 'N/A',
          Matricule: student?.matricule || 'N/A',
          Ã‰lÃ¨ve: student ? `${student.first_name} ${student.last_name}` : 'N/A',
          Montant: i.total,
          Statut: i.status === 'PAID' ? 'PayÃ©e' : i.status === 'PENDING' ? 'En attente' : i.status,
          Ã‰chÃ©ance: i.due_date ? new Date(i.due_date).toLocaleDateString('fr-FR') : 'N/A',
          'Date statut': i.updated_at ? new Date(i.updated_at).toLocaleDateString('fr-FR') : 'N/A'
        };
      });

      // Utiliser l'API serveur pour le tÃ©lÃ©chargement
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: csvData,
          filename: `rapport_financier_${new Date().toISOString().split('T')[0]}.xlsx`
        })
      });

      if (!response.ok) throw new Error('Erreur tÃ©lÃ©chargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport_financier_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Excel financier tÃ©lÃ©chargÃ© (${invoices.length} factures)`);
    } catch (error) {
      toast.error('Erreur lors de la gÃ©nÃ©ration');
      console.error(error);
    }
  };

  const reports: Report[] = [
    {
      title: 'Ã‰tat des Ã©lÃ¨ves',
      description: `Total d'Ã©lÃ¨ves: ${stats.totalStudents}`,
      icon: 'Student',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Ã‰tat des classes',
      description: `Total de classes: ${stats.totalClasses}`,
      icon: 'BookOpen',
      color: 'bg-green-100 text-green-700',
    },
    {
      title: 'Ã‰tat des enseignants',
      description: `Total d'enseignants: ${stats.totalTeachers}`,
      icon: 'Users',
      color: 'bg-purple-100 text-purple-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Rapports</h1>
        <p className="text-sm text-neutral-600 mt-1">
          GÃ©nÃ©rez et consultez les rapports de votre Ã©cole
          {selectedYear?.name ? ` - AnnÃ©e: ${selectedYear.name}` : ''}
        </p>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border border-neutral-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-neutral-600 mb-1">Ã‰lÃ¨ves</p>
              <p className="text-3xl font-bold text-neutral-900">{stats.totalStudents}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Icons.Student className="w-6 h-6 text-blue-700" />
            </div>
          </div>
        </Card>

        <Card className="border border-neutral-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-neutral-600 mb-1">Classes</p>
              <p className="text-3xl font-bold text-neutral-900">{stats.totalClasses}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Icons.BookOpen className="w-6 h-6 text-green-700" />
            </div>
          </div>
        </Card>

        <Card className="border border-neutral-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-neutral-600 mb-1">Enseignants</p>
              <p className="text-3xl font-bold text-neutral-900">{stats.totalTeachers}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Icons.Users className="w-6 h-6 text-purple-700" />
            </div>
          </div>
        </Card>
      </div>

      {/* Rapports disponibles */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Rapports disponibles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reports.map((report, idx) => {
            const Icon = Icons[report.icon];
            return (
              <Card key={idx} className="border border-neutral-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${report.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">{report.title}</h3>
                <p className="text-sm text-neutral-600 mb-4">{report.description}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (report.title === 'Ã‰tat des Ã©lÃ¨ves') handleOpenClassModal('pdf');
                      else if (report.title === 'Ã‰tat des classes') handleExportClassesPDF();
                      else if (report.title === 'Ã‰tat des enseignants') handleExportTeachersPDF();
                    }}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      if (report.title === 'Ã‰tat des Ã©lÃ¨ves') handleOpenClassModal('csv');
                      else if (report.title === 'Ã‰tat des classes') handleExportClassesCSV();
                      else if (report.title === 'Ã‰tat des enseignants') handleExportTeachersCSV();
                    }}
                    className="flex-1 px-4 py-2 border border-neutral-300 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    Excel
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modal de sÃ©lection de classes */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">
                  SÃ©lectionner les classes
                </h3>
                <button
                  onClick={() => setShowClassModal(false)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-neutral-600 mt-2">
                Choisissez les classes Ã  inclure dans l'export {exportType === 'csv' ? 'EXCEL' : exportType.toUpperCase()}
              </p>
            </div>

            {/* Body - Liste des classes */}
            <div className="flex-1 overflow-y-auto p-6">
              {availableClasses.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">
                  Aucune classe disponible
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Option "Toutes les classes" */}
                  <label className="flex items-center p-3 rounded-lg border-2 border-primary-200 bg-primary-50 hover:bg-primary-100 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedClasses.length === availableClasses.length}
                      onChange={handleToggleAllClasses}
                      className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm font-semibold text-primary-900">
                      Toutes les classes ({availableClasses.length})
                    </span>
                  </label>

                  <div className="h-px bg-neutral-200 my-2" />

                  {/* Liste des classes individuelles */}
                  {availableClasses.map((classOption) => (
                    <label
                      key={classOption.id}
                      className="flex items-center p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(classOption.id)}
                        onChange={() => handleToggleClass(classOption.id)}
                        className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="ml-3 text-sm text-neutral-900">
                        {classOption.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-neutral-600">
                  {selectedClasses.length} classe{selectedClasses.length > 1 ? 's' : ''} sÃ©lectionnÃ©e{selectedClasses.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClassModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmExport}
                  disabled={selectedClasses.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Exporter {exportType.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

