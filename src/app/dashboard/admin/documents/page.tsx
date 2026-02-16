'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Download, Loader, AlertCircle, CheckCircle } from 'lucide-react'

interface Student {
  id: string
  first_name: string
  last_name: string
  matricule: string
  class_id: string
  classes?: {
    id: string
    name: string
  }[]
}

interface AcademicYear {
  id: string
  start_year: number
  end_year: number
  is_current: boolean
}

type DocumentType = 'bulletin' | 'certificate_scolarite' | 'certificate_reussite' | 'certificate_assiduite' | 'invoice'

export default function DocumentDownloadPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('bulletin')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<{
    type: 'loading' | 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return

    // Get user's school_id
    const { data: userData } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single()

    const schoolId = userData?.school_id

    // Fetch students
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, first_name, last_name, matricule, class_id, classes(*)')
      .eq('school_id', schoolId)
      .order('first_name')

    // Fetch academic years
    const { data: yearsData } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_year', { ascending: false })

    setStudents(studentsData || [])
    setAcademicYears(yearsData || [])

    // Set default selections
    if (studentsData && studentsData.length > 0) {
      setSelectedStudent(studentsData[0].id)
    }
    if (yearsData && yearsData.length > 0) {
      const currentYear = yearsData.find((y) => y.is_current)
      setSelectedYear(currentYear?.id || yearsData[0].id)
    }

    setIsLoading(false)
  }

  async function generateDocument() {
    if (!selectedStudent || !selectedYear) {
      setGenerationStatus({
        type: 'error',
        message: 'Veuillez sélectionner un élève et une année académique'
      })
      return
    }

    setIsGenerating(true)
    setGenerationStatus({
      type: 'loading',
      message: 'Génération du document en cours...'
    })

    try {
      let endpoint = ''
      let body: any = {
        studentId: selectedStudent,
        academicYearId: selectedYear
      }

      if (selectedDocType === 'bulletin') {
        endpoint = '/api/pdf/bulletin'
      } else if (selectedDocType.startsWith('certificate_')) {
        endpoint = '/api/pdf/certificate'
        const certType = selectedDocType.replace('certificate_', '')
        body.certificateType = certType
      } else if (selectedDocType === 'invoice') {
        // For invoice, we need invoice ID, not just student ID
        // Get the first invoice for this student
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id')
          .eq('student_id', selectedStudent)
          .limit(1)

        if (!invoices || invoices.length === 0) {
          setGenerationStatus({
            type: 'error',
            message: "Aucune facture trouvée pour cet élève"
          })
          setIsGenerating(false)
          return
        }

        endpoint = '/api/pdf/invoice'
        body = { invoiceId: invoices[0].id }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF')
      }

      // Get filename from Content-Disposition header or create one
      const contentDisposition = response.headers.get('content-disposition')
      let filename = 'document.pdf'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/)
        if (match) filename = match[1]
      }

      // Download PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setGenerationStatus({
        type: 'success',
        message: `${filename} téléchargé avec succès`
      })

      setTimeout(() => {
        setGenerationStatus(null)
      }, 3000)
    } catch (error) {
      console.error('Error generating document:', error)
      setGenerationStatus({
        type: 'error',
        message: 'Erreur lors de la génération du document. Veuillez réessayer.'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const documentTypes = [
    { value: 'bulletin', label: 'Bulletin de Scolarité' },
    { value: 'certificate_scolarite', label: 'Certificat de Scolarité' },
    { value: 'certificate_reussite', label: 'Certificat de Réussite' },
    { value: 'certificate_assiduite', label: "Certificat d'Assiduité" },
    { value: 'invoice', label: 'Facture' }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Génération de Documents</h1>
        <p className="text-gray-600 mt-1">
          Générez et téléchargez bulletins, certificats et factures en PDF
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Student Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Élève
          </label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sélectionner un élève</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name} ({student.matricule}) - {student.classes?.[0]?.name || 'N/A'}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Year Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Année Académique
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sélectionner une année</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.start_year}/{year.end_year}
                {year.is_current && ' (Actuelle)'}
              </option>
            ))}
          </select>
        </div>

        {/* Document Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Type de Document
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {documentTypes.map((type) => (
              <label
                key={type.value}
                className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition ${
                  selectedDocType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="docType"
                  value={type.value}
                  checked={selectedDocType === type.value}
                  onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status Message */}
        {generationStatus && (
          <div
            className={`flex items-center gap-3 p-4 rounded-lg ${
              generationStatus.type === 'success'
                ? 'bg-green-50 text-green-800'
                : generationStatus.type === 'error'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-blue-50 text-blue-800'
            }`}
          >
            {generationStatus.type === 'loading' && (
              <Loader className="h-5 w-5 animate-spin" />
            )}
            {generationStatus.type === 'success' && <CheckCircle className="h-5 w-5" />}
            {generationStatus.type === 'error' && <AlertCircle className="h-5 w-5" />}
            <span>{generationStatus.message}</span>
          </div>
        )}

        {/* Generate Button */}
        <div className="pt-4 border-t">
          <button
            onClick={generateDocument}
            disabled={isGenerating || !selectedStudent || !selectedYear}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isGenerating ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Générer et Télécharger
              </>
            )}
          </button>
        </div>
      </div>

      {/* Information Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Information</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Les bulletins incluent les notes et appréciations de chaque matière</li>
          <li>• Les certificats sont générés automatiquement et signés numériquement</li>
          <li>• Les factures affichent le détail des frais et le statut de paiement</li>
          <li>• Les documents peuvent être imprimés ou enregistrés en PDF</li>
        </ul>
      </div>
    </div>
  )
}
