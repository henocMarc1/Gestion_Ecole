'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface StudentSuggestion {
  id: string;
  first_name: string;
  last_name: string;
  matricule?: string | null;
  photo_url?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  gender?: string | null;
  enrollment_date?: string | null;
  classes?: { name?: string | null; level?: string | null } | null;
}

interface SchoolInfo {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  logo_url?: string | null;
}

interface CertificateHistory {
  id: string;
  student_id: string;
  certificate_type: string;
  status: string;
  request_date: string;
  issue_date?: string | null;
  academic_year?: string | null;
  certificate_number?: string | null;
  students?: StudentSuggestion | null;
}

function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR');
}

function formatGender(gender?: string | null) {
  if (gender === 'M') return 'Masculin';
  if (gender === 'F') return 'Féminin';
  return 'N/A';
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSuggestion | null>(null);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [program, setProgram] = useState('');
  const [issuePlace, setIssuePlace] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [signatoryTitle, setSignatoryTitle] = useState('Le Directeur');
  const [signatoryName, setSignatoryName] = useState('');
  const [purpose, setPurpose] = useState('Attester la fréquentation scolaire.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<CertificateHistory[]>([]);

  useRealtimeSubscription({
    table: 'certificates',
    event: '*',
    onData: () => loadHistory(),
    enabled: !!user?.school_id,
  });

  useEffect(() => {
    if (user?.school_id) {
      loadSchool();
      loadHistory();
    }
  }, [user?.school_id]);

  useEffect(() => {
    if (!user?.school_id) return;
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const q = searchQuery.trim();
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule, photo_url, date_of_birth, place_of_birth, gender, enrollment_date, classes(name, level)')
        .eq('school_id', user.school_id)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,matricule.ilike.%${q}%`)
        .limit(10);

      if (error) {
        console.error('Erreur recherche élèves:', error);
        return;
      }

      setSuggestions((data as StudentSuggestion[]) || []);
      setShowSuggestions(true);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, user?.school_id]);

  const loadSchool = async () => {
    if (!user?.school_id) return;
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, address, phone')
      .eq('id', user.school_id)
      .single();

    if (error) {
      console.error('Erreur chargement école:', error);
      return;
    }

    setSchool(data as SchoolInfo);
    if (data?.address && !issuePlace) {
      setIssuePlace(data.address);
    }
  };

  const loadHistory = async () => {
    if (!user?.school_id) return;
    const { data, error } = await supabase
      .from('certificates')
      .select(`
        id,
        student_id,
        certificate_type,
        status,
        request_date,
        issue_date,
        academic_year,
        certificate_number,
        students(
          id,
          first_name,
          last_name,
          matricule,
          photo_url,
          date_of_birth,
          place_of_birth,
          gender,
          enrollment_date,
          classes(name, level)
        )
      `)
      .eq('school_id', user.school_id)
      .eq('certificate_type', 'FREQUENCY')
      .order('request_date', { ascending: false });

    if (error) {
      console.error('Erreur chargement certificats:', error);
      return;
    }

    setHistory((data as any) || []);
    setIsLoading(false);
  };

  const selectedStudentName = useMemo(() => {
    if (!selectedStudent) return '';
    return `${selectedStudent.first_name} ${selectedStudent.last_name}`;
  }, [selectedStudent]);

  const buildPayload = (student: StudentSuggestion) => ({
    school_name: school?.name || 'Établissement',
    school_address: school?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
    school_phone: school?.phone || '+225 0707905958',
    student_name: `${student.first_name} ${student.last_name}`,
    student_matricule: student.matricule || undefined,
    student_photo_url: student.photo_url || undefined,
    date_of_birth: student.date_of_birth || undefined,
    place_of_birth: student.place_of_birth || undefined,
    gender: formatGender(student.gender),
    class_name: student.classes?.name || undefined,
    class_level: student.classes?.level || undefined,
    program: program || student.classes?.level || undefined,
    enrollment_date: student.enrollment_date || undefined,
    academic_year: academicYear || undefined,
    issue_date: issueDate,
    issue_place: issuePlace || school?.name || undefined,
    signatory_title: signatoryTitle,
    signatory_name: signatoryName,
    purpose: purpose,
  });

  const fetchCertificatePdf = async (payload: ReturnType<typeof buildPayload>) => {
    const response = await fetch('/api/pdf/frequency-certificate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la génération du certificat');
    }

    return response.blob();
  };

  const downloadPdf = async (payload: ReturnType<typeof buildPayload>) => {
    const blob = await fetchCertificatePdf(payload);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Certificat_Frequentation_${payload.student_matricule || 'eleve'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const printCertificate = async (payload: ReturnType<typeof buildPayload>) => {
    const blob = await fetchCertificatePdf(payload);
    const url = window.URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
        window.URL.revokeObjectURL(url);
      }, 1000);
    };

    document.body.appendChild(iframe);
  };

  const saveCertificateRecord = async (student: StudentSuggestion) => {
    const certificateNumber = `CF-${Date.now()}`;
    const { error } = await supabase
      .from('certificates')
      .insert({
        school_id: user?.school_id,
        student_id: student.id,
        certificate_type: 'FREQUENCY',
        status: 'ISSUED',
        request_date: new Date().toISOString(),
        issue_date: new Date(issueDate).toISOString(),
        issued_by: user?.id,
        certificate_number: certificateNumber,
        academic_year: academicYear,
        purpose: purpose,
      });

    if (error) {
      console.error('Erreur enregistrement certificat:', error);
      toast.error('Erreur lors de l\'enregistrement du certificat');
      return false;
    }

    return true;
  };

  const handleGenerate = async (action: 'download' | 'print') => {
    if (!selectedStudent || !school) {
      toast.error('Sélectionnez un élève et vérifiez les informations école');
      return;
    }

    try {
      setIsGenerating(true);
      const saved = await saveCertificateRecord(selectedStudent);
      if (!saved) return;

      const payload = buildPayload(selectedStudent);

      if (action === 'download') {
        await downloadPdf(payload);
        toast.success('Certificat téléchargé');
      } else {
        await printCertificate(payload);
      }

      loadHistory();
    } catch (error) {
      console.error('Erreur génération certificat:', error);
      toast.error('Erreur lors de la génération');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Certificat de fréquentation</h1>
        <p className="text-gray-600 mt-2">Génération téléchargeable et imprimable</p>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Informations de l'élève</h2>
          <div className="relative">
            <Input
              placeholder="Rechercher un élève (nom, prénom ou matricule)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStudent(s);
                      setSearchQuery(`${s.first_name} ${s.last_name}`);
                      setShowSuggestions(false);
                      if (!program) {
                        setProgram(s.classes?.level || '');
                      }
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50"
                  >
                    <div className="text-sm font-medium">
                      {s.first_name} {s.last_name} {s.matricule ? `(${s.matricule})` : ''}
                    </div>
                    <div className="text-xs text-gray-500">{s.classes?.name || 'Classe inconnue'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Élève</p>
                <p className="font-medium">{selectedStudentName}</p>
              </div>
              <div>
                <p className="text-gray-500">Matricule</p>
                <p className="font-medium">{selectedStudent.matricule || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Date de naissance</p>
                <p className="font-medium">{formatDate(selectedStudent.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-gray-500">Classe</p>
                <p className="font-medium">{selectedStudent.classes?.name || 'N/A'}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Paramètres du certificat</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Année scolaire</label>
              <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Filière / Option</label>
              <Input value={program} onChange={(e) => setProgram(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Lieu de délivrance</label>
              <Input value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Date de délivrance</label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Titre signataire</label>
              <Input value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Nom du signataire</label>
              <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Objet du certificat</label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleGenerate('download')}
              disabled={isGenerating}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              Télécharger PDF
            </Button>
            <Button
              onClick={() => handleGenerate('print')}
              disabled={isGenerating}
              className="bg-neutral-800 hover:bg-neutral-900 text-white"
            >
              Imprimer
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique des certificats</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-600">Aucun certificat généré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Élève</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Matricule</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Année</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Émis le</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((cert) => (
                    <tr key={cert.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">
                        {cert.students ? `${cert.students.first_name} ${cert.students.last_name}` : 'N/A'}
                      </td>
                      <td className="px-4 py-2">{cert.students?.matricule || 'N/A'}</td>
                      <td className="px-4 py-2">{cert.academic_year || 'N/A'}</td>
                      <td className="px-4 py-2">{formatDate(cert.issue_date || cert.request_date)}</td>
                      <td className="px-4 py-2">
                        {cert.students && (
                          <div className="flex gap-2">
                            <Button
                              className="text-xs bg-primary-600 hover:bg-primary-700 text-white"
                              onClick={async () => {
                                const payload = buildPayload(cert.students as StudentSuggestion);
                                await downloadPdf(payload);
                              }}
                            >
                              Télécharger
                            </Button>
                            <Button
                              className="text-xs bg-neutral-700 hover:bg-neutral-900 text-white"
                              onClick={async () => {
                                const payload = buildPayload(cert.students as StudentSuggestion);
                                await printCertificate(payload);
                              }}
                            >
                              Imprimer
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
