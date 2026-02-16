'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { UserPlus, DollarSign, BookOpen, Users, Calendar, Check } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  level: string;
}

interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface TuitionFee {
  id: string;
  total_amount: number;
  registration_fee: number;
  other_fees: number;
  academic_year: string;
  description: string;
}

interface PaymentSchedule {
  installment_number: number;
  due_month: number;
  amount: number;
  description: string;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'BANK_TRANSFER', label: 'Virement bancaire' },
  { value: 'CHECK', label: 'Chèque' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

export default function RegisterStudentPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [tuitionFee, setTuitionFee] = useState<TuitionFee | null>(null);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [isLoadingFees, setIsLoadingFees] = useState(false);
  const [collectRegistrationFee, setCollectRegistrationFee] = useState(true);
  const [registrationPaymentMethod, setRegistrationPaymentMethod] = useState('CASH');
  const [collectFirstInstallment, setCollectFirstInstallment] = useState(true);
  const [firstInstallmentMethod, setFirstInstallmentMethod] = useState('CASH');
  
  // États pour l'autocomplétion et création de parent
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [filteredParents, setFilteredParents] = useState<Parent[]>([]);
  const [showParentSuggestions, setShowParentSuggestions] = useState(false);
  const [showCreateParentModal, setShowCreateParentModal] = useState(false);
  const [isCreatingParent, setIsCreatingParent] = useState(false);
  const [isSearchingParents, setIsSearchingParents] = useState(false);
  const [newParentData, setNewParentData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Stockage des données du dernier reçu généré pour régénération
  const [lastReceiptData, setLastReceiptData] = useState<{
    schoolId?: string;
    studentName: string;
    studentMatricule: string;
    className: string;
    parentName: string;
    payments: Array<{ type: string; amount: number; method: string; reference: string; paymentDate: string }>;
    totalAmount: number;
    academicYear?: string;
    recordedBy?: string;
  } | null>(null);

  // Données de l'élève
  const [studentData, setStudentData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    placeOfBirth: '',
    gender: 'M',
    email: '',
    phone: '',
    classId: '',
    parentId: '',
    relationship: 'parent',
    isPrimaryContact: true,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user?.school_id) {
      loadClasses();
      loadParents();
    }
  }, [user]);

  // Recherche côté base au fur et à mesure
  useEffect(() => {
    const query = parentSearchQuery.trim();
    const selectedParent = parents.find((p) => p.id === studentData.parentId);

    if (!query) {
      setFilteredParents([]);
      setShowParentSuggestions(false);
      return;
    }

    if (selectedParent && selectedParent.full_name.toLowerCase() === query.toLowerCase()) {
      return;
    }

    const timer = setTimeout(() => {
      searchParents(query);
    }, 250);

    return () => clearTimeout(timer);
  }, [parentSearchQuery, user?.school_id, studentData.parentId, parents]);

  // Charger les frais quand une classe est sélectionnée
  useEffect(() => {
    if (studentData.classId) {
      loadTuitionFees(studentData.classId);
    } else {
      setTuitionFee(null);
      setPaymentSchedules([]);
    }
  }, [studentData.classId]);

  useRealtimeSubscription({
    table: 'tuition_fees',
    event: '*',
    onData: () => {
      if (studentData.classId) {
        loadTuitionFees(studentData.classId);
      }
    },
    enabled: !!studentData.classId,
  });

  useRealtimeSubscription({
    table: 'payment_schedules',
    event: '*',
    onData: () => {
      if (studentData.classId) {
        loadTuitionFees(studentData.classId);
      }
    },
    enabled: !!studentData.classId,
  });

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', user?.school_id)
        .is('deleted_at', null)
        .order('level, name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Erreur lors du chargement des classes');
    }
  };

  const loadParents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .eq('school_id', user?.school_id)
        .eq('role', 'PARENT')
        .is('deleted_at', null)
        .order('full_name');

      if (error) throw error;
      setParents(data || []);
    } catch (error) {
      console.error('Error loading parents:', error);
      toast.error('Erreur lors du chargement des parents');
    }
  };

  const searchParents = async (query: string) => {
    if (!user?.school_id) return;
    setIsSearchingParents(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .eq('school_id', user.school_id)
        .eq('role', 'PARENT')
        .is('deleted_at', null)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('full_name')
        .limit(10);

      if (error) throw error;
      setFilteredParents(data || []);
      setShowParentSuggestions(true);
    } catch (error) {
      console.error('Error searching parents:', error);
      toast.error('Erreur lors de la recherche de parents');
    } finally {
      setIsSearchingParents(false);
    }
  };

  const loadTuitionFees = async (classId: string) => {
    setIsLoadingFees(true);
    try {
      // Charger les frais de scolarité pour cette classe
      const { data: feesData, error: feesError } = await supabase
        .from('tuition_fees')
        .select('*')
        .eq('class_id', classId)
        .eq('school_id', user?.school_id)
        .order('academic_year', { ascending: false })
        .limit(1)
        .single();

      if (feesError && feesError.code !== 'PGRST116') throw feesError;

      if (feesData) {
        setTuitionFee(feesData);

        // Charger les échéanciers de paiement
        const { data: schedulesData, error: schedulesError } = await supabase
          .from('payment_schedules')
          .select('*')
          .eq('tuition_fee_id', feesData.id)
          .order('installment_number');

        if (schedulesError) throw schedulesError;
        setPaymentSchedules(schedulesData || []);
      } else {
        setTuitionFee(null);
        setPaymentSchedules([]);
        toast.info('Aucun frais de scolarité défini pour cette classe');
      }
    } catch (error) {
      console.error('Error loading tuition fees:', error);
      toast.error('Erreur lors du chargement des frais');
    } finally {
      setIsLoadingFees(false);
    }
  };

  const handleCreateParent = async () => {
    if (!user?.school_id) {
      toast.error('Impossible de créer le parent : école non trouvée');
      return;
    }

    if (!newParentData.fullName || !newParentData.email || !newParentData.phone) {
      toast.error('Veuillez renseigner le nom, l\'email et le numéro du parent');
      return;
    }

    setIsCreatingParent(true);
    try {
      const response = await fetch('/api/create-parent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: newParentData.fullName,
          email: newParentData.email,
          phone: newParentData.phone,
          address: newParentData.address,
          schoolId: user?.school_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création du parent');
      }

      // Ajouter le nouveau parent à la liste
      const newParent: Parent = {
        id: result.parent.id,
        full_name: result.parent.full_name,
        email: result.parent.email,
        phone: result.parent.phone || '',
      };
      setParents([...parents, newParent]);

      // Sélectionner automatiquement ce parent
      setStudentData({ ...studentData, parentId: newParent.id });
      setParentSearchQuery(newParent.full_name);

      toast.success(`Parent créé avec succès !`);

      // Afficher le mot de passe dans une modale
      setGeneratedPassword(result.defaultPassword);
      setShowPasswordModal(true);
      setCopiedPassword(false);

      // Réinitialiser et fermer la modal de création
      setNewParentData({ fullName: '', email: '', phone: '', address: '' });
      setShowCreateParentModal(false);
      setShowParentSuggestions(false);
    } catch (error: any) {
      console.error('Error creating parent:', error);
      toast.error(error.message || 'Erreur lors de la création du parent');
    } finally {
      setIsCreatingParent(false);
    }
  };

  const handleSelectParent = (parent: Parent) => {
    if (!parents.find((p) => p.id === parent.id)) {
      setParents([...parents, parent]);
    }
    setStudentData({ ...studentData, parentId: parent.id });
    setParentSearchQuery(parent.full_name);
    setShowParentSuggestions(false);
  };

  const handleSubmit = async () => {
    // Validation
    if (!studentData.firstName || !studentData.lastName || !studentData.dateOfBirth || !studentData.placeOfBirth) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!studentData.classId) {
      toast.error('Veuillez sélectionner une classe');
      return;
    }

    if (!studentData.parentId) {
      toast.error('Veuillez sélectionner un parent');
      return;
    }

    // Vérifier que les échéanciers sont définis
    if (!paymentSchedules || paymentSchedules.length === 0) {
      toast.error('Les échéanciers de paiement doivent être configurés par le directeur avant l\'inscription');
      return;
    }

    // Vérifier qu'il y a au moins un premier versement
    const firstInstallment = paymentSchedules.find((s) => s.installment_number === 1);
    if (!firstInstallment || firstInstallment.amount <= 0) {
      toast.error('Le premier versement doit être défini dans les échéanciers de paiement');
      return;
    }

    setIsLoading(true);
    try {
      // Générer un matricule unique
      const matricule = `STU${Date.now()}`;

      let photoUrl: string | null = null;
      if (photoFile) {
        setIsUploadingPhoto(true);
        photoUrl = await uploadStudentPhoto(photoFile);
      }

      // Créer l'élève
      const { data: studentRecord, error: studentError } = await supabase
        .from('students')
        .insert({
          school_id: user?.school_id,
          first_name: studentData.firstName,
          last_name: studentData.lastName,
          date_of_birth: studentData.dateOfBirth,
          place_of_birth: studentData.placeOfBirth,
          gender: studentData.gender,
          class_id: studentData.classId,
          matricule: matricule,
          enrollment_date: new Date().toISOString(),
          photo_url: photoUrl,
        })
        .select()
        .single();

      if (studentError) throw studentError;

      // Assigner le parent à l'élève
      const { error: parentError } = await supabase
        .from('parents_students')
        .insert({
          parent_id: studentData.parentId,
          student_id: studentRecord.id,
          relationship: studentData.relationship,
          is_primary_contact: studentData.isPrimaryContact,
        });

      if (parentError) throw parentError;

      // Préparer les paiements
      const payments: Array<{ type: string; amount: number; method: string; reference: string; paymentDate: string }> = [];
      const paymentDate = new Date().toISOString();
      const parent = parents.find((p) => p.id === studentData.parentId);
      const cls = classes.find((c) => c.id === studentData.classId);
      const firstInstallment = paymentSchedules.find((s) => s.installment_number === 1);

      // Encaisser les frais d'inscription (OBLIGATOIRE)
      if (tuitionFee && tuitionFee.registration_fee > 0) {
        const registrationRef = `INS-${Date.now()}`;
        const { data: regPayment, error: regError } = await supabase
          .from('tuition_payments')
          .insert({
            school_id: user?.school_id,
            student_id: studentRecord.id,
            tuition_fee_id: tuitionFee.id,
            amount: tuitionFee.registration_fee,
            payment_date: paymentDate,
            payment_method: registrationPaymentMethod,
            reference: registrationRef,
            notes: "Frais d'inscription encaissés à l'inscription",
            recorded_by: user?.id,
          })
          .select()
          .single();
        if (regError) throw regError;
        payments.push({
          type: "Frais d'inscription",
          amount: tuitionFee.registration_fee,
          method: registrationPaymentMethod,
          reference: registrationRef,
          paymentDate: regPayment.payment_date,
        });
      }

      // Encaisser les frais annexes (OBLIGATOIRE avec inscription)
      if (tuitionFee && tuitionFee.other_fees > 0) {
        const otherRef = `OTHER-${Date.now()}`;
        const { data: otherPayment, error: otherError } = await supabase
          .from('tuition_payments')
          .insert({
            school_id: user?.school_id,
            student_id: studentRecord.id,
            tuition_fee_id: tuitionFee.id,
            amount: tuitionFee.other_fees,
            payment_date: paymentDate,
            payment_method: registrationPaymentMethod,
            reference: otherRef,
            notes: "Frais annexes encaissés à l'inscription",
            recorded_by: user?.id,
          })
          .select()
          .single();
        if (otherError) throw otherError;
        payments.push({
          type: "Frais annexes",
          amount: tuitionFee.other_fees,
          method: registrationPaymentMethod,
          reference: otherRef,
          paymentDate: otherPayment.payment_date,
        });
      }

      // Encaisser le 1er versement (OBLIGATOIRE)
      if (firstInstallment && firstInstallment.amount > 0) {
        const installmentRef = `INST-${Date.now()}`;
        const { data: instPayment, error: instError } = await supabase
          .from('tuition_payments')
          .insert({
            school_id: user?.school_id,
            student_id: studentRecord.id,
            tuition_fee_id: tuitionFee?.id,
            amount: firstInstallment.amount,
            payment_date: paymentDate,
            payment_method: firstInstallmentMethod,
            reference: installmentRef,
            notes: `1er versement (${MONTHS[firstInstallment.due_month - 1]}) encaissé à l'inscription`,
            recorded_by: user?.id,
          })
          .select()
          .single();
        if (instError) throw instError;
        payments.push({
          type: `1er versement (${MONTHS[firstInstallment.due_month - 1]})`,
          amount: firstInstallment.amount,
          method: firstInstallmentMethod,
          reference: installmentRef,
          paymentDate: instPayment.payment_date,
        });
      } else {
        // Ceci ne devrait jamais arriver grâce aux validations précédentes
        throw new Error('Premier versement manquant ou invalide');
      }

      // Générer un reçu combiné si paiements effectués
      if (payments.length > 0) {
        try {
          const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
          const totalDue = (tuitionFee?.registration_fee || 0) + (tuitionFee?.other_fees || 0) + (tuitionFee?.total_amount || 0);
          const balance = totalDue - totalPaid;
          
          const receiptPayload = {
            schoolId: user?.school_id,
            studentName: `${studentData.firstName} ${studentData.lastName}`,
            studentMatricule: studentRecord.matricule,
            studentPhotoUrl: studentRecord.photo_url,
            className: cls?.name || 'Classe',
            parentName: parent?.full_name || 'Parent',
            payments: payments,
            totalAmount: totalPaid,
            totalDue: totalDue,
            balance: balance,
            academicYear: tuitionFee?.academic_year,
            recordedBy: user?.full_name || 'Secrétariat',
          };
          
          // Stocker pour régénération ultérieure
          setLastReceiptData(receiptPayload);
          
          await generateEnrollmentReceipt(receiptPayload);
          toast.success('Reçu d\'inscription généré avec succès');
        } catch (pdfError) {
          console.error('Error generating enrollment receipt:', pdfError);
          toast.warning('Inscription validée mais échec de génération du reçu');
        }
      }

      toast.success('Élève inscrit avec succès !');
      
      // Passer à l'étape de confirmation
      setStep(4);

    } catch (error: any) {
      console.error('Error registering student:', error);
      toast.error(error.message || 'Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
      setIsUploadingPhoto(false);
    }
  };

  const handleReset = () => {
    setStudentData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      placeOfBirth: '',
      gender: 'M',
      email: '',
      phone: '',
      classId: '',
      parentId: '',
      relationship: 'parent',
      isPrimaryContact: true,
    });
    setStep(1);
    setTuitionFee(null);
    setPaymentSchedules([]);
    setCollectRegistrationFee(true);
    setRegistrationPaymentMethod('CASH');
    setCollectFirstInstallment(true);
    setFirstInstallmentMethod('CASH');
    setParentSearchQuery('');
    setFilteredParents([]);
    setShowParentSuggestions(false);
    setLastReceiptData(null);
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview('');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format invalide. Utilisez JPG ou PNG.');
      event.target.value = '';
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.info('La photo sera compressee automatiquement.');
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadStudentPhoto = async (file: File) => {
    const maxSize = 2 * 1024 * 1024;
    const needsCompression = file.size > maxSize;
    const transformation = needsCompression
      ? 'c_limit,w_1600,q_auto:good,f_auto'
      : undefined;

    const signatureResponse = await fetch('/api/cloudinary-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'students', transformation }),
    });

    if (!signatureResponse.ok) {
      throw new Error('Erreur lors de la signature Cloudinary');
    }

    const { signature, timestamp, apiKey, cloudName, folder, transformation: signedTransform } =
      await signatureResponse.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);
    if (signedTransform) {
      formData.append('transformation', signedTransform);
    }

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Erreur lors de l\'upload de la photo');
    }

    const result = await uploadResponse.json();
    return result.secure_url as string;
  };

  const handleDownloadReceipt = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!lastReceiptData) {
      toast.error('Aucun reçu disponible');
      return;
    }

    try {
      await generateEnrollmentReceipt(lastReceiptData);
      toast.success('Reçu téléchargé avec succès');
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Erreur lors du téléchargement du reçu');
    }
  };

  const generateRegistrationReceipt = async (payload: {
    schoolId?: string;
    studentName: string;
    studentMatricule: string;
    className: string;
    parentName: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    receiptNumber: string;
    academicYear?: string;
    recordedBy?: string;
  }) => {
    const response = await fetch('/api/pdf/registration-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la génération du reçu');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recu_Inscription_${payload.studentMatricule}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const generateEnrollmentReceipt = async (payload: {
    schoolId?: string;
    studentName: string;
    studentMatricule: string;
    studentPhotoUrl?: string | null;
    className: string;
    parentName: string;
    payments: Array<{ type: string; amount: number; method: string; reference: string; paymentDate: string }>;
    totalAmount: number;
    academicYear?: string;
    recordedBy?: string;
  }) => {
    const response = await fetch('/api/pdf/enrollment-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la génération du reçu');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recu_Inscription_${payload.studentMatricule}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const canProceedToStep2 = () => {
    return studentData.firstName && studentData.lastName && studentData.dateOfBirth && studentData.gender;
  };

  const canProceedToStep3 = () => {
    return studentData.classId && studentData.parentId;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inscription d'un élève</h1>
        <p className="text-gray-600 mt-2">Enregistrer un nouvel élève et l'assigner à un parent</p>
      </div>

      {/* Indicateur de progression */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Informations élève', icon: UserPlus },
              { num: 2, label: 'Classe et parent', icon: BookOpen },
              { num: 3, label: 'Frais de scolarité', icon: DollarSign },
              { num: 4, label: 'Confirmation', icon: Check },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <React.Fragment key={item.num}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        step >= item.num
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <p className="text-xs mt-2 text-center">{item.label}</p>
                  </div>
                  {idx < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        step > item.num ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Étape 1: Informations de l'élève */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Informations de l'élève
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Jean"
                  value={studentData.firstName}
                  onChange={(e) => setStudentData({ ...studentData, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Kouassi"
                  value={studentData.lastName}
                  onChange={(e) => setStudentData({ ...studentData, lastName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de naissance *
                </label>
                <Input
                  type="date"
                  value={studentData.dateOfBirth}
                  onChange={(e) => setStudentData({ ...studentData, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lieu de naissance *
                </label>
                <Input
                  type="text"
                  placeholder="Ex: Abidjan, Yamoussoukro"
                  value={studentData.placeOfBirth}
                  onChange={(e) => setStudentData({ ...studentData, placeOfBirth: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Genre *
                </label>
                <select
                  value={studentData.gender}
                  onChange={(e) => setStudentData({ ...studentData, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (optionnel)
                </label>
                <Input
                  type="email"
                  placeholder="exemple@email.com"
                  value={studentData.email}
                  onChange={(e) => setStudentData({ ...studentData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone (optionnel)
                </label>
                <Input
                  type="tel"
                  placeholder="+225 XX XX XX XX XX"
                  value={studentData.phone}
                  onChange={(e) => setStudentData({ ...studentData, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photo de l&apos;eleve (JPG/PNG, compression auto &gt; 2 MB)
                </label>
                <div className="flex flex-col gap-3">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoChange}
                    disabled={isUploadingPhoto}
                  />
                  {photoPreview && (
                    <div className="flex items-center gap-4">
                      <img
                        src={photoPreview}
                        alt="Apercu photo eleve"
                        className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview('');
                        }}
                      >
                        Retirer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2()}
                className="bg-primary-600 hover:bg-primary-700"
              >
                Suivant
                <Icons.ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 2: Classe et parent */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Classe et parent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classe *
                </label>
                <select
                  value={studentData.classId}
                  onChange={(e) => setStudentData({ ...studentData, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  <option value="">Sélectionner une classe</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.level}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent / Tuteur *
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Rechercher un parent par nom, email ou téléphone..."
                    value={parentSearchQuery}
                    onChange={(e) => setParentSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (parentSearchQuery.trim()) {
                        setShowParentSuggestions(true);
                      }
                    }}
                    className="w-full"
                  />
                  
                  {/* Suggestions d'autocomplétion */}
                  {showParentSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {isSearchingParents ? (
                        <div className="px-4 py-4 text-sm text-gray-600 flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
                          Recherche...
                        </div>
                      ) : filteredParents.length > 0 ? (
                        <>
                          {filteredParents.map((parent) => (
                            <div
                              key={parent.id}
                              onClick={() => handleSelectParent(parent)}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{parent.full_name}</div>
                              <div className="text-sm text-gray-600">{parent.email}</div>
                              {parent.phone && (
                                <div className="text-sm text-gray-500">{parent.phone}</div>
                              )}
                            </div>
                          ))}
                          <div
                            onClick={() => {
                              setShowCreateParentModal(true);
                              setShowParentSuggestions(false);
                            }}
                            className="px-4 py-3 bg-primary-50 hover:bg-primary-100 cursor-pointer text-primary-700 font-medium flex items-center gap-2"
                          >
                            <UserPlus className="w-4 h-4" />
                            Créer un nouveau parent
                          </div>
                        </>
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <p className="text-gray-500 mb-3">Aucun parent trouvé</p>
                          <Button
                            onClick={() => {
                              setShowCreateParentModal(true);
                              setShowParentSuggestions(false);
                            }}
                            className="bg-primary-600 hover:bg-primary-700"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Créer ce parent
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Affichage du parent sélectionné */}
                  {studentData.parentId && !showParentSuggestions && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {parents.find((p) => p.id === studentData.parentId)?.full_name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {parents.find((p) => p.id === studentData.parentId)?.email}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStudentData({ ...studentData, parentId: '' });
                          setParentSearchQuery('');
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Changer
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relation *
                </label>
                <select
                  value={studentData.relationship}
                  onChange={(e) => setStudentData({ ...studentData, relationship: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  <option value="parent">Parent</option>
                  <option value="père">Père</option>
                  <option value="mère">Mère</option>
                  <option value="tuteur">Tuteur</option>
                  <option value="tutrice">Tutrice</option>
                </select>
              </div>

              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  id="isPrimaryContact"
                  checked={studentData.isPrimaryContact}
                  onChange={(e) =>
                    setStudentData({ ...studentData, isPrimaryContact: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isPrimaryContact" className="ml-2 text-sm text-gray-700">
                  Contact principal
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <Icons.ChevronLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedToStep3()}
                className="bg-primary-600 hover:bg-primary-700"
              >
                Suivant
                <Icons.ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 3: Frais de scolarité */}
      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Frais de scolarité de la classe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFees ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                  <p className="text-gray-600 mt-4">Chargement des frais...</p>
                </div>
              ) : !tuitionFee ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Aucun frais de scolarité défini pour cette classe.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Le comptable ou le directeur doit définir les frais avant l'inscription.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Résumé des frais */}
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Frais annuels</p>
                        <p className="text-2xl font-bold text-primary-600">
                          {formatCurrency(tuitionFee.total_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Frais d'inscription</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatCurrency(tuitionFee.registration_fee)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Autres frais</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatCurrency(tuitionFee.other_fees)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-primary-300">
                      <p className="text-sm text-gray-700">
                        <strong>Année scolaire :</strong> {tuitionFee.academic_year}
                      </p>
                      {tuitionFee.description && (
                        <p className="text-sm text-gray-700 mt-1">
                          <strong>Description :</strong> {tuitionFee.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {tuitionFee.registration_fee > 0 && (
                    <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            💰 Frais d'inscription (OBLIGATOIRE)
                          </h4>
                          <p className="text-sm text-gray-700 mt-1">
                            Montant à encaisser : <strong>{formatCurrency(tuitionFee.registration_fee)}</strong>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            ✓ Un reçu PDF sera généré automatiquement
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-3 rounded-lg">
                        <label className="text-sm font-medium text-gray-700">Méthode de paiement *</label>
                        <select
                          value={registrationPaymentMethod}
                          onChange={(e) => setRegistrationPaymentMethod(e.target.value)}
                          className="flex-1 sm:flex-initial sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method.value} value={method.value}>{method.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Échéanciers de paiement */}
                  {paymentSchedules.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Échéanciers de paiement
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {paymentSchedules.map((schedule, idx) => {
                          const isFirstInstallment = schedule.installment_number === 1;
                          return (
                            <div
                              key={idx}
                              className={`rounded-lg p-4 flex justify-between items-center ${
                                isFirstInstallment
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'bg-white border border-gray-200'
                              }`}
                            >
                              <div>
                                <p className={`font-medium ${isFirstInstallment ? 'text-blue-900' : 'text-gray-900'}`}>
                                  {schedule.description || `Tranche ${schedule.installment_number}`}
                                  {isFirstInstallment && ' ⭐'}
                                </p>
                                <p className={`text-sm ${isFirstInstallment ? 'text-blue-700' : 'text-gray-600'}`}>
                                  {MONTHS[schedule.due_month - 1]}
                                </p>
                              </div>
                              <p className={`text-lg font-bold ${isFirstInstallment ? 'text-blue-600' : 'text-primary-600'}`}>
                                {formatCurrency(schedule.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Total échelonné :</span>
                        <span className="text-xl font-bold text-primary-600">
                          {formatCurrency(
                            paymentSchedules.reduce((sum, s) => sum + s.amount, 0)
                          )}
                        </span>
                      </div>

                      {paymentSchedules.length > 0 && paymentSchedules[0]?.amount > 0 && (
                        <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4">
                          <div className="flex items-start gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">
                                ⭐ Premier versement (OBLIGATOIRE)
                              </h4>
                              <p className="text-sm text-gray-700 mt-1">
                                Montant à encaisser : <strong>{formatCurrency(paymentSchedules[0].amount)}</strong> ({MONTHS[paymentSchedules[0].due_month - 1]})
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                ✓ Requis pour finaliser l'inscription
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-3 rounded-lg">
                            <label className="text-sm font-medium text-gray-700">Méthode de paiement *</label>
                            <select
                              value={firstInstallmentMethod}
                              onChange={(e) => setFirstInstallmentMethod(e.target.value)}
                              className="flex-1 sm:flex-initial sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {PAYMENT_METHODS.map((method) => (
                                <option key={method.value} value={method.value}>{method.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-red-300 bg-red-50 rounded-lg p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <Icons.AlertTriangle className="w-8 h-8 text-red-600" />
                      </div>
                      <h4 className="font-semibold text-red-900 mb-2 text-lg">
                        ❌ Inscription impossible
                      </h4>
                      <p className="text-sm text-gray-700 mb-4">
                        Le directeur ou le comptable n'a pas encore configuré les échéanciers de paiement pour cette classe.
                      </p>
                      <p className="text-sm font-bold text-red-800 mb-3">
                        ⚠️ Les échéanciers de paiement sont OBLIGATOIRES pour inscrire un élève.
                      </p>
                      <div className="bg-white border border-red-200 rounded-lg p-4 mt-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          📋 Action requise :
                        </p>
                        <p className="text-sm text-gray-700">
                          Demandez au directeur de se connecter et de configurer les frais de scolarité avec les échéanciers de paiement dans <strong>Admin → Frais de scolarité</strong>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <Icons.ChevronLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !tuitionFee || paymentSchedules.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              title={paymentSchedules.length === 0 ? "Échéanciers de paiement requis" : ""}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Inscription en cours...
                </>
              ) : paymentSchedules.length === 0 ? (
                <>
                  <Icons.X className="w-4 h-4 mr-2" />
                  Échéanciers requis
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmer l'inscription
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Étape 4: Confirmation */}
      {step === 4 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Inscription réussie !</h2>
            <p className="text-gray-600 mb-6">
              L'élève <strong>{studentData.firstName} {studentData.lastName}</strong> a été inscrit avec succès.
            </p>
            <div className="flex gap-4 justify-center">
              {lastReceiptData && (
                <Button 
                  variant="outline" 
                  onClick={handleDownloadReceipt}
                  className="border-primary-600 text-primary-600 hover:bg-primary-50"
                >
                  <Icons.Download className="w-4 h-4 mr-2" />
                  Télécharger le reçu
                </Button>
              )}
              <Button variant="outline" onClick={handleReset}>
                Inscrire un autre élève
              </Button>
              <Button
                onClick={() => window.location.href = '/dashboard/secretary/students'}
                className="bg-primary-600 hover:bg-primary-700"
              >
                Voir la liste des élèves
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de création de parent */}
      {showCreateParentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary-600" />
                  Créer un nouveau parent
                </h3>
                <button
                  onClick={() => {
                    setShowCreateParentModal(false);
                    setNewParentData({ fullName: '', email: '', phone: '', address: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet *
                  </label>
                  <Input
                    type="text"
                    placeholder="Ex: Kouassi Jean"
                    value={newParentData.fullName}
                    onChange={(e) =>
                      setNewParentData({ ...newParentData, fullName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="parent@exemple.com"
                    value={newParentData.email}
                    onChange={(e) =>
                      setNewParentData({ ...newParentData, email: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Un mot de passe sera généré automatiquement
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone du parent *
                  </label>
                  <Input
                    type="tel"
                    placeholder="+225 XX XX XX XX XX"
                    value={newParentData.phone}
                    onChange={(e) =>
                      setNewParentData({ ...newParentData, phone: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieu d'habitation
                  </label>
                  <Input
                    type="text"
                    placeholder="Quartier, commune..."
                    value={newParentData.address}
                    onChange={(e) =>
                      setNewParentData({ ...newParentData, address: e.target.value })
                    }
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Un mot de passe par défaut sera généré et affiché.
                    Le parent devra le changer à la première connexion.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateParentModal(false);
                    setNewParentData({ fullName: '', email: '', phone: '', address: '' });
                  }}
                  className="flex-1"
                  disabled={isCreatingParent}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreateParent}
                  disabled={isCreatingParent || !newParentData.fullName || !newParentData.email}
                  className="flex-1 bg-primary-600 hover:bg-primary-700"
                >
                  {isCreatingParent ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Création...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Créer le parent
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'affichage du mot de passe généré */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Parent créé avec succès</h2>
              <p className="text-gray-600">Voici le mot de passe par défaut à transmettre au parent :</p>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-2 font-semibold">MOT DE PASSE</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-lg font-mono font-bold text-gray-900 break-all">
                    {generatedPassword}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      setCopiedPassword(true);
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-medium transition-colors"
                  >
                    {copiedPassword ? 'Copié !' : 'Copier'}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Le parent devra changer ce mot de passe à la première connexion.
                </p>
              </div>

              <Button
                onClick={() => setShowPasswordModal(false)}
                className="w-full bg-primary-600 hover:bg-primary-700"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
