import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateBulletinPDF, BulletinData } from '@/lib/services/pdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { studentId, academicYearId } = await req.json()

    if (!studentId || !academicYearId) {
      return NextResponse.json(
        { error: 'Missing studentId or academicYearId' },
        { status: 400 }
      )
    }

    // Get student information
    const { data: student } = await supabase
      .from('students')
      .select('id, first_name, last_name, matricule, class_id, classes(id, name, school_id)')
      .eq('id', studentId)
      .single()

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      )
    }

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

    // Get grades
    const { data: grades } = await supabase
      .from('grades')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)

    // Get bulletin appreciation
    const { data: bulletin } = await supabase
      .from('bulletins')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .single()

    // Calculate average and prepare grade data
    let totalPoints = 0
    let totalGrades = 0
    const gradesData = (grades || []).map((grade: any) => {
      const maxGrade = 20
      const percentage = (grade.grade / maxGrade) * 100
      totalPoints += grade.grade
      totalGrades += 1

      return {
        subject: grade.subject,
        grade: grade.grade,
        maxGrade: maxGrade,
        percentage: Math.round(percentage),
        appreciation: getAppreciation(percentage)
      }
    })

    const average = totalGrades > 0 ? totalPoints / totalGrades : 0
    const averagePercentage = Math.round((average / 20) * 100)

    const schoolAddress = school?.address || 'Bingerville (Cefal après Adjamé-Bingerville)'
    const schoolPhone = school?.phone || '+225 0707905958'

    const bulletinData: BulletinData = {
      studentName: `${student.first_name} ${student.last_name}`,
      studentMatricule: student.matricule,
      className: student.classes[0]?.name || 'N/A',
      academicYear: `${academicYear.start_year}/${academicYear.end_year}`,
      schoolName: school?.name || 'Établissement',
      schoolAddress,
      schoolPhone,
      grades: gradesData,
      average: average,
      averagePercentage: averagePercentage,
      teacherAppreciation: bulletin?.teacher_appreciation || undefined,
      generatedAt: new Date()
    }

    // Generate PDF
    const pdfBuffer = await generateBulletinPDF(bulletinData)

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Bulletin_${student.matricule}_${academicYearId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating bulletin:', error)
    return NextResponse.json(
      { error: 'Failed to generate bulletin PDF' },
      { status: 500 }
    )
  }
}

function getAppreciation(percentage: number): string {
  if (percentage >= 90) return 'Excellent'
  if (percentage >= 80) return 'Très Bien'
  if (percentage >= 70) return 'Bien'
  if (percentage >= 60) return 'Satisfaisant'
  if (percentage >= 50) return 'Passable'
  return 'À Revoir'
}
