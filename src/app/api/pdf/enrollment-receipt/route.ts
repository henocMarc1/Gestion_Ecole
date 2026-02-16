import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PaymentItem = {
  type: string
  amount: number
  method: string
  reference: string
  paymentDate: string
}

type ReceiptPayload = {
  schoolId?: string
  studentName: string
  studentMatricule: string
  studentPhotoUrl?: string | null
  className: string
  parentName: string
  payments: PaymentItem[]
  totalAmount: number
  totalDue?: number
  balance?: number
  academicYear?: string
  recordedBy?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: ReceiptPayload = await req.json()

    if (!body.studentName || !body.studentMatricule || !body.payments || body.payments.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let school: { name?: string; address?: string; phone?: string; email?: string } | null = null

    if (body.schoolId) {
      const { data } = await supabase
        .from('schools')
        .select('name, address, phone, email')
        .eq('id', body.schoolId)
        .maybeSingle()

      school = data
    }

    let pdfBytes: Uint8Array
    try {
      pdfBytes = await generateReceiptPdfLib(body, school)
    } catch (err) {
      console.error('pdf-lib error (enrollment-receipt), falling back:', err)
      pdfBytes = await generateReceiptPdfFallback(body, school)
    }

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Recu_Inscription_${body.studentMatricule}.pdf"`,
      }
    })
  } catch (error) {
    console.error('Error generating enrollment receipt:', error)
    return NextResponse.json({ error: 'Failed to generate receipt', details: String(error) }, { status: 500 })
  }
}

function formatXof(amount: number) {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0
  }).format(amount)
  // pdf-lib (WinAnsi) ne supporte pas U+202F (narrow no-break space)
  return formatted.replace(/\u202F/g, ' ')
}

async function generateReceiptPdfLib(
  data: ReceiptPayload,
  school: { name?: string; address?: string; phone?: string; email?: string } | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28

  const defaultSchool = {
    name: 'Groupe Scolaire Gnamien-Assa',
    address: 'Bingerville (Cefal après Adjamé-Bingerville)',
    phone: '+225 0707905958'
  }

  const logoBytes = await getLogoBytes()
  if (logoBytes) {
    try {
      console.log('Tentative d\'embedding du logo, taille:', logoBytes.length, 'bytes')
      let logoImg
      try {
        logoImg = await pdfDoc.embedJpg(logoBytes)
        console.log('Logo embarqué en JPG')
      } catch {
        logoImg = await pdfDoc.embedPng(logoBytes)
        console.log('Logo embarqué en PNG')
      }
      const logoSize = 80
      page.drawImage(logoImg, { x: 50, y: 740, width: logoSize, height: logoSize })
      console.log('Logo dessiné dans le PDF à (50, 740) avec dimensions:', logoSize, 'x', logoSize)
    } catch (err) {
      console.error('Erreur embedding logo:', err)
    }
  } else {
    console.log('Pas de logo à embarquer')
  }

  // Add student photo in top right if available
  if (data.studentPhotoUrl) {
    try {
      const photoResponse = await fetch(data.studentPhotoUrl)
      if (photoResponse.ok) {
        const photoArrayBuffer = await photoResponse.arrayBuffer()
        const photoBytes = Buffer.from(photoArrayBuffer)
        let photoImg
        try {
          photoImg = await pdfDoc.embedPng(photoBytes)
        } catch {
          photoImg = await pdfDoc.embedJpg(photoBytes)
        }
        const photoSize = 80
        const photoX = 595.28 - 40 - photoSize
        const photoY = 740
        page.drawImage(photoImg, {
          x: photoX,
          y: photoY,
          width: photoSize,
          height: photoSize
        })
      }
    } catch (err) {
      console.error('Erreur ajout photo élève:', err)
    }
  }

  const schoolName = school?.name || defaultSchool.name
  const schoolAddress = school?.address || defaultSchool.address
  const schoolPhone = school?.phone || defaultSchool.phone
  const schoolEmail = school?.email

  const republicText = "REPUBLIQUE DE CÔTE D'IVOIRE"
  const republicWidth = fontBold.widthOfTextAtSize(republicText, 10)
  page.drawText(republicText, { x: (pageWidth - republicWidth) / 2, y: 795, size: 10, font: fontBold })

  const mottoText = 'Union – Discipline – Travail'
  const mottoWidth = fontRegular.widthOfTextAtSize(mottoText, 9)
  page.drawText(mottoText, { x: (pageWidth - mottoWidth) / 2, y: 781, size: 9, font: fontRegular })

  const schoolNameWidth = fontBold.widthOfTextAtSize(schoolName, 12)
  page.drawText(schoolName, { x: (pageWidth - schoolNameWidth) / 2, y: 758, size: 12, font: fontBold })

  let schoolInfoY = 744
  if (schoolAddress) {
    const addressWidth = fontRegular.widthOfTextAtSize(schoolAddress, 9)
    page.drawText(schoolAddress, { x: (pageWidth - addressWidth) / 2, y: schoolInfoY, size: 9, font: fontRegular })
    schoolInfoY -= 12
  }
  if (schoolPhone) {
    const phoneText = `Tél: ${schoolPhone}`
    const phoneWidth = fontRegular.widthOfTextAtSize(phoneText, 9)
    page.drawText(phoneText, { x: (pageWidth - phoneWidth) / 2, y: schoolInfoY, size: 9, font: fontRegular })
    schoolInfoY -= 12
  }
  if (schoolEmail) {
    const emailWidth = fontRegular.widthOfTextAtSize(schoolEmail, 9)
    page.drawText(schoolEmail, { x: (pageWidth - emailWidth) / 2, y: schoolInfoY, size: 9, font: fontRegular })
    schoolInfoY -= 12
  }

  let y = schoolInfoY - 10
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0,0,0) })

  y -= 24
  const titleText = "REÇU D'INSCRIPTION"
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 16)
  page.drawText(titleText, { x: (pageWidth - titleWidth) / 2, y, size: 16, font: fontBold, color: rgb(0, 0, 0) })

  y -= 12
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0,0,0) })

  const today = new Date()
  y -= 20
  page.drawText(`Date: ${today.toLocaleDateString('fr-FR')}`, { x: 30, y, size: 10, font: fontBold })
  if (data.academicYear) { page.drawText(`Année académique: ${data.academicYear}`, { x: 350, y, size: 10, font: fontRegular }) }

  y -= 12
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0,0,0) })

  y -= 22
  page.drawText('INFORMATIONS ÉLÈVE', { x: 30, y, size: 12, font: fontBold })
  y -= 18
  page.drawText(`Nom: ${data.studentName}`, { x: 30, y, size: 10, font: fontRegular })
  y -= 14
  page.drawText(`Matricule: ${data.studentMatricule}`, { x: 30, y, size: 10, font: fontRegular })
  y -= 14
  page.drawText(`Classe: ${data.className}`, { x: 30, y, size: 10, font: fontRegular })
  y -= 14
  page.drawText(`Parent / Tuteur: ${data.parentName}`, { x: 30, y, size: 10, font: fontRegular })

  y -= 12
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0,0,0) })

  y -= 22
  page.drawText('PAIEMENTS EFFECTUÉS', { x: 30, y, size: 12, font: fontBold })
  y -= 18
  page.drawText('Type de paiement', { x: 30, y, size: 9, font: fontBold })
  page.drawText('Méthode', { x: 220, y, size: 9, font: fontBold })
  page.drawText('Référence', { x: 330, y, size: 9, font: fontBold })
  page.drawText('Montant', { x: 465, y, size: 9, font: fontBold })
  y -= 10
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 0.5, color: rgb(0,0,0) })

  y -= 14
  data.payments.forEach((p) => {
    page.drawText(p.type || '', { x: 30, y, size: 9, font: fontRegular })
    page.drawText(p.method || '', { x: 220, y, size: 9, font: fontRegular })
    page.drawText(p.reference || '', { x: 330, y, size: 9, font: fontRegular })
    page.drawText(formatXof(p.amount), { x: 465, y, size: 9, font: fontRegular })
    y -= 14
  })

  y -= 6
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 0.5, color: rgb(0,0,0) })
  y -= 16
  page.drawText(`MONTANT TOTAL ENCAISSÉ: ${formatXof(data.totalAmount)}`, { x: 350, y, size: 11, font: fontBold })
  
  if (data.totalDue && data.balance !== undefined) {
    y -= 14
    page.drawText(`MONTANT TOTAL DÛ: ${formatXof(data.totalDue)}`, { x: 350, y, size: 10, font: fontRegular })
    y -= 14
    page.drawText(`RESTE À PAYER: ${formatXof(data.balance)}`, { x: 350, y, size: 11, font: fontBold, color: data.balance > 0 ? rgb(0.8, 0, 0) : rgb(0, 0.5, 0) })
  }

  y -= 24
  page.drawText('Cet élève a effectué tous les paiements obligatoires pour son inscription :', { x: 30, y, size: 9, font: fontRegular })
  y -= 12
  page.drawText('[X] Frais d\'inscription', { x: 30, y, size: 9, font: fontRegular })
  y -= 12
  page.drawText('[X] 1er versement de l\'année', { x: 30, y, size: 9, font: fontRegular })
  y -= 14
  if (data.recordedBy) page.drawText(`Enregistré par: ${data.recordedBy}`, { x: 30, y, size: 9, font: fontRegular })

  y -= 24
  page.drawText('Signature et cachet', { x: 30, y, size: 8, font: fontRegular })
  y -= 8
  page.drawLine({ start: { x: 30, y }, end: { x: 200, y }, thickness: 1, color: rgb(0,0,0) })

  return await pdfDoc.save()
}

async function getLogoBytes(): Promise<Uint8Array | null> {
  try {
    const envPath = process.env.SCHOOL_LOGO_PATH
    if (envPath && fs.existsSync(envPath)) {
      console.log('Logo trouvé via SCHOOL_LOGO_PATH:', envPath)
      return new Uint8Array(fs.readFileSync(envPath))
    }
    const localPathPng = path.join(process.cwd(), 'public', 'school-logo.png')
    if (fs.existsSync(localPathPng)) {
      console.log('Logo PNG trouvé:', localPathPng)
      return new Uint8Array(fs.readFileSync(localPathPng))
    }
    const localPathJpg = path.join(process.cwd(), 'public', 'school-logo.jpg')
    if (fs.existsSync(localPathJpg)) {
      console.log('Logo JPG trouvé:', localPathJpg)
      return new Uint8Array(fs.readFileSync(localPathJpg))
    }
    const url = process.env.SCHOOL_LOGO_URL
    if (url) {
      console.log('Logo via URL:', url)
      const res = await fetch(url)
      const ab = await res.arrayBuffer()
      return new Uint8Array(ab)
    }
    console.log('Aucun logo trouvé')
  } catch (err) {
    console.error('Erreur chargement logo:', err)
  }
  return null
}

async function generateReceiptPdfFallback(
  data: ReceiptPayload,
  school: { name?: string; address?: string; phone?: string; email?: string } | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const defaultSchool = {
    name: 'Groupe Scolaire Gnamien-Assa',
    address: 'Bingerville (Cefal après Adjamé-Bingerville)',
    phone: '+225 0707905958'
  }

  let y = 800
  page.drawText("REÇU D'INSCRIPTION", { x: 200, y, size: 16, font })
  y -= 24
  page.drawText(school?.name || defaultSchool.name, { x: 200, y, size: 11, font })
  y -= 14
  page.drawText(school?.address || defaultSchool.address, { x: 200, y, size: 11, font })
  y -= 14
  page.drawText(`Tél: ${school?.phone || defaultSchool.phone}`, { x: 200, y, size: 11, font })
  if (school?.email) { y -= 14; page.drawText(school.email, { x: 200, y, size: 11, font }) }

  y -= 24
  const today = new Date()
  page.drawText(`Date: ${today.toLocaleDateString('fr-FR')}`, { x: 30, y, size: 10, font })
  if (data.academicYear) { page.drawText(`Année académique: ${data.academicYear}`, { x: 350, y, size: 10, font }) }

  y -= 24
  page.drawText(`Nom: ${data.studentName}`, { x: 30, y, size: 10, font })
  y -= 14
  page.drawText(`Matricule: ${data.studentMatricule}`, { x: 30, y, size: 10, font })
  y -= 14
  page.drawText(`Classe: ${data.className}`, { x: 30, y, size: 10, font })
  y -= 14
  page.drawText(`Parent / Tuteur: ${data.parentName}`, { x: 30, y, size: 10, font })

  y -= 24
  data.payments.forEach((p) => {
    page.drawText(`${p.type} • ${p.method} • ${p.reference} • ${formatXof(p.amount)}`, { x: 30, y, size: 9, font })
    y -= 12
  })

  y -= 18
  page.drawText(`MONTANT TOTAL ENCAISSÉ: ${formatXof(data.totalAmount)}`, { x: 350, y, size: 11, font })
  
  if (data.totalDue && data.balance !== undefined) {
    y -= 14
    page.drawText(`MONTANT TOTAL DÛ: ${formatXof(data.totalDue)}`, { x: 350, y, size: 10, font })
    y -= 14
    page.drawText(`RESTE À PAYER: ${formatXof(data.balance)}`, { x: 350, y, size: 11, font })
  }

  return await pdfDoc.save()
}

// Remplacé par pdf-lib
