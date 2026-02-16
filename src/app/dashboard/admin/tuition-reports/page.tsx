'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { exportToExcel, exportToPDFTable } from '@/utils/exportUtils';
import {
  DollarSign,
  TrendingUp,
  Users,
  Percent,
  Download,
  Filter,
  BarChart3,
} from 'lucide-react';

interface ClassStats {
  classId: string;
  className: string;
  studentCount: number;
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
  paidCount: number;
  percentagePaid: number;
}

interface StudentDetail {
  id: string;
  name: string;
  matricule: string;
  className: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  paymentStatus: string;
  lastPaymentDate: string | null;
}

interface GlobalStats {
  totalStudents: number;
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
  studentsPaid: number;
  studentsPartial: number;
  studentsUnpaid: number;
  collectionRate: number;
  classStats: ClassStats[];
}

export default function AdminTuitionReportsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [studentDetails, setStudentDetails] = useState<StudentDetail[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<'overview' | 'classes' | 'students'>('overview');
  const [filterClass, setFilterClass] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  
  // Modal d'export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'csv'>('pdf');
  const [selectedExportData, setSelectedExportData] = useState<'global' | 'classes' | 'students'>('global');

  // Subscription en temps réel pour les classes
  useRealtimeSubscription({
    table: 'classes',
    filter: user?.school_id ? `school_id=eq.${user.school_id}` : undefined,
    onUpdate: () => {
      loadReportData();
    }
  });

  useEffect(() => {
    if (user?.school_id) {
      loadReportData();
    }
  }, [user]);

  useEffect(() => {
    filterStudents();
  }, [searchTerm, filterClass, studentDetails]);

  const loadReportData = async () => {
    if (!user?.school_id) return;

    setIsLoading(true);
    try {
      // Récupérer les classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .order('name');

      setClasses(classesData || []);

      // Récupérer tous les élèves avec leurs infos
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule, class_id, classes(name)')
        .eq('school_id', user.school_id)
        .is('deleted_at', null);

      if (!studentsData) {
        setIsLoading(false);
        return;
      }

      // Pour chaque élève, calculer les stats
      const studentsWithStats: StudentDetail[] = await Promise.all(
        (studentsData || []).map(async (student: any) => {
          // Frais
          const { data: feeData } = await supabase
            .from('tuition_fees')
            .select('*')
            .eq('class_id', student.class_id)
            .eq('school_id', user.school_id)
            .order('academic_year', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Paiements
          const { data: paymentsData } = await supabase
            .from('tuition_payments')
            .select('amount, payment_date')
            .eq('student_id', student.id)
            .order('payment_date', { ascending: false });

          const totalDue = feeData
            ? feeData.total_amount + feeData.registration_fee + feeData.other_fees
            : 0;
          const totalPaid = (paymentsData || []).reduce((sum, p) => sum + p.amount, 0);
          const balance = totalDue - totalPaid;
          const lastPayment = paymentsData?.[0]?.payment_date || null;

          let paymentStatus = 'Impayé';
          if (balance === 0 && totalDue > 0) paymentStatus = 'Soldé';
          else if (totalPaid > 0 && balance > 0) paymentStatus = 'Partiel';

          return {
            id: student.id,
            name: `${student.first_name} ${student.last_name}`,
            matricule: student.matricule,
            className: student.classes?.name || 'N/A',
            totalDue,
            totalPaid,
            balance,
            paymentStatus,
            lastPaymentDate: lastPayment,
          };
        })
      );

      setStudentDetails(studentsWithStats);

      // Calculer les stats globales par classe
      const classStatsMap = new Map<string, ClassStats>();

      for (const student of studentsWithStats) {
        if (!classStatsMap.has(student.className)) {
          classStatsMap.set(student.className, {
            classId: '',
            className: student.className,
            studentCount: 0,
            totalDue: 0,
            totalPaid: 0,
            totalBalance: 0,
            paidCount: 0,
            percentagePaid: 0,
          });
        }

        const classStats = classStatsMap.get(student.className)!;
        classStats.studentCount++;
        classStats.totalDue += student.totalDue;
        classStats.totalPaid += student.totalPaid;
        classStats.totalBalance += student.balance;

        if (student.paymentStatus === 'Soldé') {
          classStats.paidCount++;
        }
      }

      const classStats = Array.from(classStatsMap.values()).map((cs) => ({
        ...cs,
        percentagePaid: cs.totalDue > 0 ? Math.round((cs.totalPaid / cs.totalDue) * 100) : 0,
      }));

      // Stats globales
      const totalDue = studentsWithStats.reduce((sum, s) => sum + s.totalDue, 0);
      const totalPaid = studentsWithStats.reduce((sum, s) => sum + s.totalPaid, 0);
      const totalBalance = studentsWithStats.reduce((sum, s) => sum + s.balance, 0);

      const globalStats: GlobalStats = {
        totalStudents: studentsWithStats.length,
        totalDue,
        totalPaid,
        totalBalance,
        studentsPaid: studentsWithStats.filter((s) => s.paymentStatus === 'Soldé').length,
        studentsPartial: studentsWithStats.filter((s) => s.paymentStatus === 'Partiel').length,
        studentsUnpaid: studentsWithStats.filter((s) => s.paymentStatus === 'Impayé').length,
        collectionRate: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0,
        classStats,
      };

      setStats(globalStats);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = studentDetails;

    if (filterClass !== 'ALL') {
      filtered = filtered.filter((s) => s.className === filterClass);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.matricule.toLowerCase().includes(term)
      );
    }

    setFilteredStudents(filtered);
  };

  const handleExportReportPDF = async (dataType: 'global' | 'classes' | 'students') => {
    if (!stats) return;

    // Récupérer les infos de l'école
    const { data: school } = await supabase
      .from('schools')
      .select('name, logo_url, address, phone')
      .eq('id', user?.school_id)
      .single();

    let title = 'Rapport de Collecte';
    let headers: string[] = [];
    let rows: any[][] = [];

    if (dataType === 'global') {
      title = 'Rapport de Collecte - Résumé Global';
      headers = ['Métrique', 'Valeur'];
      rows = [
        ['Total attendu', `${Math.round(stats.totalDue)} F CFA`],
        ['Total encaissé', `${Math.round(stats.totalPaid)} F CFA`],
        ['Solde restant', `${Math.round(stats.totalBalance)} F CFA`],
        ['Taux de recouvrement', `${stats.collectionRate}%`],
      ];
    } else if (dataType === 'classes') {
      title = 'Rapport de Collecte - Par Classes';
      headers = ['Classe', 'Élèves', 'Total dû', 'Total payé', 'Reste', '% Payé'];
      rows = stats.classStats.map(cs => [
        cs.className,
        String(cs.studentCount),
        `${Math.round(cs.totalDue)} F CFA`,
        `${Math.round(cs.totalPaid)} F CFA`,
        `${Math.round(cs.totalBalance)} F CFA`,
        `${cs.percentagePaid}%`,
      ]);
      
      // Ajouter ligne de totaux
      const totalEleves = stats.classStats.reduce((sum, cs) => sum + cs.studentCount, 0);
      const totalDue = stats.classStats.reduce((sum, cs) => sum + cs.totalDue, 0);
      const totalPaid = stats.classStats.reduce((sum, cs) => sum + cs.totalPaid, 0);
      const totalBalance = stats.classStats.reduce((sum, cs) => sum + cs.totalBalance, 0);
      rows.push(['TOTAL', String(totalEleves), `${Math.round(totalDue)} F CFA`, `${Math.round(totalPaid)} F CFA`, `${Math.round(totalBalance)} F CFA`, '']);
    } else {
      title = 'Rapport de Collecte - Détail des Élèves';
      headers = ['Nom', 'Matricule', 'Classe', 'Total dû', 'Payé', 'Reste', 'Statut'];
      rows = filteredStudents.map(s => [
        s.name,
        s.matricule,
        s.className,
        `${Math.round(s.totalDue)} F CFA`,
        `${Math.round(s.totalPaid)} F CFA`,
        `${Math.round(s.balance)} F CFA`,
        s.paymentStatus,
      ]);
      
      // Ajouter ligne de totaux
      const totalDue = filteredStudents.reduce((sum, s) => sum + s.totalDue, 0);
      const totalPaid = filteredStudents.reduce((sum, s) => sum + s.totalPaid, 0);
      const totalBalance = filteredStudents.reduce((sum, s) => sum + s.balance, 0);
      rows.push(['TOTAL', '', '', `${Math.round(totalDue)} F CFA`, `${Math.round(totalPaid)} F CFA`, `${Math.round(totalBalance)} F CFA`, '']);
    }

    await exportToPDFTable(
      title,
      headers,
      rows,
      `rapport-collecte-${dataType}-${new Date().toISOString().split('T')[0]}`,
      {
        schoolName: school?.name,
        schoolLogo: school?.logo_url,
        schoolAddress: school?.address,
        schoolPhone: school?.phone,
        addNumbering: true,
      }
    );

    toast.success('Rapport PDF exporté');
  };

  const handleExportReportCSV = async (dataType: 'global' | 'classes' | 'students') => {
    if (!stats) return;

    let title = 'Rapport de Collecte';
    let data: any[] = [];

    if (dataType === 'global') {
      data = [
        { Métrique: 'Total attendu', Valeur: `${Math.round(stats.totalDue)} F CFA` },
        { Métrique: 'Total encaissé', Valeur: `${Math.round(stats.totalPaid)} F CFA` },
        { Métrique: 'Solde restant', Valeur: `${Math.round(stats.totalBalance)} F CFA` },
        { Métrique: 'Taux de recouvrement', Valeur: `${stats.collectionRate}%` },
      ];
    } else if (dataType === 'classes') {
      data = stats.classStats.map(cs => ({
        Classe: cs.className,
        Élèves: cs.studentCount,
        'Total dû': `${Math.round(cs.totalDue)} F CFA`,
        'Total payé': `${Math.round(cs.totalPaid)} F CFA`,
        Reste: `${Math.round(cs.totalBalance)} F CFA`,
        '% Payé': `${cs.percentagePaid}%`,
      }));

      // Ajouter la ligne de totaux
      const totalEleves = stats.classStats.reduce((sum, cs) => sum + cs.studentCount, 0);
      const totalDue = stats.classStats.reduce((sum, cs) => sum + cs.totalDue, 0);
      const totalPaid = stats.classStats.reduce((sum, cs) => sum + cs.totalPaid, 0);
      const totalBalance = stats.classStats.reduce((sum, cs) => sum + cs.totalBalance, 0);
      
      data.push({
        Classe: 'TOTAL',
        Élèves: totalEleves,
        'Total dû': `${Math.round(totalDue)} F CFA`,
        'Total payé': `${Math.round(totalPaid)} F CFA`,
        Reste: `${Math.round(totalBalance)} F CFA`,
        '% Payé': '',
      });
    } else {
      data = filteredStudents.map(s => ({
        Nom: s.name,
        Matricule: s.matricule,
        Classe: s.className,
        'Total dû': `${Math.round(s.totalDue)} F CFA`,
        Payé: `${Math.round(s.totalPaid)} F CFA`,
        Reste: `${Math.round(s.balance)} F CFA`,
        Statut: s.paymentStatus,
      }));

      // Ajouter la ligne de totaux
      const totalDue = filteredStudents.reduce((sum, s) => sum + s.totalDue, 0);
      const totalPaid = filteredStudents.reduce((sum, s) => sum + s.totalPaid, 0);
      const totalBalance = filteredStudents.reduce((sum, s) => sum + s.balance, 0);
      
      data.push({
        Nom: 'TOTAL',
        Matricule: '',
        Classe: '',
        'Total dû': `${Math.round(totalDue)} F CFA`,
        Payé: `${Math.round(totalPaid)} F CFA`,
        Reste: `${Math.round(totalBalance)} F CFA`,
        Statut: '',
      });
    }

    await exportToExcel(
      data,
      `rapport-collecte-${dataType}-${new Date().toISOString().split('T')[0]}.xlsx`
    );
    toast.success('Rapport Excel téléchargé');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-primary-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Génération du rapport...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapports de collecte</h1>
          <p className="text-gray-600 mt-2">Suivi global des paiements des frais de scolarité</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setExportType('pdf');
              setShowExportModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => {
              setExportType('csv');
              setShowExportModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Total attendu</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalDue)}</p>
          <p className="text-xs text-gray-500 mt-2">{stats.totalStudents} élèves</p>
        </Card>

        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Encaissé</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
          <p className="text-xs text-green-600 mt-2">{stats.studentsPaid} élèves soldés</p>
        </Card>

        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Solde restant</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalBalance)}</p>
          <p className="text-xs text-red-600 mt-2">{stats.studentsUnpaid + stats.studentsPartial} en attente</p>
        </Card>

        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Taux de collecte</p>
          <p className="text-2xl font-bold text-primary-600">{stats.collectionRate}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-primary-600 h-2 rounded-full"
              style={{ width: `${stats.collectionRate}%` }}
            />
          </div>
        </Card>

        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">État</p>
          <div className="space-y-1 mt-2">
            <p className="text-xs">
              <span className="font-semibold text-green-600">{stats.studentsPaid}</span> Soldés
            </p>
            <p className="text-xs">
              <span className="font-semibold text-yellow-600">{stats.studentsPartial}</span> Partiels
            </p>
            <p className="text-xs">
              <span className="font-semibold text-red-600">{stats.studentsUnpaid}</span> Impayés
            </p>
          </div>
        </Card>
      </div>

      {/* Onglets de vue */}
      <Card className="border border-gray-200 p-4">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setViewType('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewType === 'overview'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setViewType('classes')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewType === 'classes'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Par classe
          </button>
          <button
            onClick={() => setViewType('students')}
            className={`px-4 py-2 font-medium transition-colors ${
              viewType === 'students'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Par élève
          </button>
        </div>
      </Card>

      {/* Vue d'ensemble */}
      {viewType === 'overview' && (
        <div className="space-y-6">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Collecte par classe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.classStats.map((cs) => (
                  <div key={cs.className} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900">{cs.className}</p>
                        <p className="text-sm text-gray-600">
                          {cs.paidCount} / {cs.studentCount} élèves soldés
                        </p>
                      </div>
                      <p className="text-lg font-bold text-primary-600">{cs.percentagePaid}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-primary-600 h-3 rounded-full transition-all"
                        style={{ width: `${cs.percentagePaid}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Dû: {formatCurrency(cs.totalDue)}</span>
                      <span>Payé: {formatCurrency(cs.totalPaid)}</span>
                      <span>Reste: {formatCurrency(cs.totalBalance)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Par classe */}
      {viewType === 'classes' && (
        <Card className="border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Classe</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Élèves</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total dû</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Encaissé</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Reste</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">% Collecte</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Soldés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.classStats.map((cs) => (
                  <tr key={cs.className} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{cs.className}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{cs.studentCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(cs.totalDue)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {formatCurrency(cs.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {formatCurrency(cs.totalBalance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${cs.percentagePaid}%` }}
                          />
                        </div>
                        <span className="font-bold text-primary-600 w-12 text-right">
                          {cs.percentagePaid}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          cs.paidCount === cs.studentCount
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {cs.paidCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Par élève */}
      {viewType === 'students' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Rechercher un élève..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
            </div>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="ALL">Toutes les classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <Card className="border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Élève</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Classe</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total dû</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Payé</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Reste</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Dernier paiement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Aucun élève trouvé
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs font-mono text-primary-600">{student.matricule}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.className}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(student.totalDue)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          {formatCurrency(student.totalPaid)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {formatCurrency(student.balance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              student.paymentStatus === 'Soldé'
                                ? 'bg-green-100 text-green-800'
                                : student.paymentStatus === 'Partiel'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {student.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {student.lastPaymentDate
                            ? new Date(student.lastPaymentDate).toLocaleDateString('fr-FR')
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Modal d'export */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Que voulez-vous exporter? ({exportType === 'csv' ? 'EXCEL' : exportType.toUpperCase()})
            </h3>

            <div className="space-y-3 mb-6">
              <label className="flex items-center p-3 rounded-lg border-2 border-primary-200 bg-primary-50 hover:bg-primary-100 cursor-pointer transition-colors"
                onClick={() => setSelectedExportData('global')}>
                <input
                  type="radio"
                  name="exportData"
                  checked={selectedExportData === 'global'}
                  onChange={() => setSelectedExportData('global')}
                  className="w-4 h-4"
                />
                <span className="ml-3">
                  <strong>Résumé global</strong>
                  <p className="text-sm text-gray-600">Statistiques globales de collecte</p>
                </span>
              </label>

              <label className="flex items-center p-3 rounded-lg border-2 border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedExportData('classes')}>
                <input
                  type="radio"
                  name="exportData"
                  checked={selectedExportData === 'classes'}
                  onChange={() => setSelectedExportData('classes')}
                  className="w-4 h-4"
                />
                <span className="ml-3">
                  <strong>Par classes</strong>
                  <p className="text-sm text-gray-600">Détail de la collecte par classe</p>
                </span>
              </label>

              <label className="flex items-center p-3 rounded-lg border-2 border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedExportData('students')}>
                <input
                  type="radio"
                  name="exportData"
                  checked={selectedExportData === 'students'}
                  onChange={() => setSelectedExportData('students')}
                  className="w-4 h-4"
                />
                <span className="ml-3">
                  <strong>Détail des élèves</strong>
                  <p className="text-sm text-gray-600">Paiements individuels de tous les élèves</p>
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (exportType === 'pdf') {
                    handleExportReportPDF(selectedExportData);
                  } else {
                    handleExportReportCSV(selectedExportData);
                  }
                  setShowExportModal(false);
                }}
                className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
              >
                Exporter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
