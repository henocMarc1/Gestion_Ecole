import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateCertificatePDF, CertificateData } from '@/lib/services/pdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { studentId, academicYearId, certificateType = 'scolarite' } = await req.json()

    if (!studentId || !academicYearId) {
      return NextResponse.json(
        { error: 'Missing studentId or academicYearId' },
        { status: 400 }
      )
    }

    if (!['scolarite', 'reussite', 'assiduite'].includes(certificateType)) {
      return NextResponse.json(
        { error: 'Invalid certificateType' },
        { status: 400 }
      )
    }

    // Get student information
    const { data: student } = await supabase
      .from('students')
      .select('id, first_name, last_name, matricule, photo_url, class_id, classes(*)')
      .eq('id', studentId)
      .single()

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      )
    }

    console.log('===== CERTIFICAT PHOTO DEBUG =====')
    console.log('Student name:', student.first_name, student.last_name)
    console.log('Photo URL:', student.photo_url)

    // Get school information
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', student.classes[0]?.school_id)
      .single()

    // Get academic year
    const { data: academicYear } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', academicYearId)
      .single()

    // Download student photo if available
    let studentPhotoBuffer: Buffer | undefined = undefined
    if (student.photo_url) {
      console.log('Tentative de téléchargement de la photo...')
      try {
        const photoResponse = await fetch(student.photo_url)
        console.log('Photo response status:', photoResponse.status)
        if (photoResponse.ok) {
          const arrayBuffer = await photoResponse.arrayBuffer()
          studentPhotoBuffer = Buffer.from(arrayBuffer)
          console.log('Photo téléchargée avec succès, taille:', studentPhotoBuffer.length, 'bytes')
        } else {
          console.error('Échec du téléchargement de la photo, status:', photoResponse.status)
        }
      } catch (error) {
        console.error('Erreur lors du téléchargement de la photo:', error)
      }
    } else {
      console.log('Aucune photo_url trouvée pour cet élève')
    }

    const certificateData: CertificateData = {
      studentName: `${student.first_name} ${student.last_name}`,
      studentMatricule: student.matricule,
      className: student.classes[0]?.name || 'N/A',
      academicYear: `${academicYear.start_year}/${academicYear.end_year}`,
      schoolName: school?.name || 'Établissement',
      schoolAddress: school?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
      schoolPhone: school?.phone || '+225 0707905958',
      studentPhotoBuffer: studentPhotoBuffer,
      certificateType: certificateType,
      generatedAt: new Date()
    }

    console.log('Photo buffer présent:', !!studentPhotoBuffer)
    if (studentPhotoBuffer) {
      console.log('Photo buffer size:', studentPhotoBuffer.length, 'bytes')
    }
    console.log('===================================\n')

    // Generate PDF
    const pdfBuffer = await generateCertificatePDF(certificateData)

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Certificate_${student.matricule}_${certificateType}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating certificate:', error)
    return NextResponse.json(
      { error: 'Failed to generate certificate PDF' },
      { status: 500 }
    )
  }
}
