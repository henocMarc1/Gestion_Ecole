import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ReceiptPayload = {
  schoolId?: string
  studentName: string
  studentMatricule: string
  className: string
  parentName: string
  amount: number
  paymentMethod: string
  paymentDate: string
  receiptNumber: string
  academicYear?: string
  recordedBy?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: ReceiptPayload = await req.json()

    if (!body.studentName || !body.studentMatricule || !body.amount || !body.paymentDate || !body.receiptNumber) {
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

    const pdfBytes = await generateRegistrationReceiptPdfLib(body, school)

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Recu_Inscription_${body.studentMatricule}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generating registration receipt:', error)
    return NextResponse.json({ error: 'Failed to generate receipt' }, { status: 500 })
  }
}

function formatXof(amount: number) {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0
  }).format(amount)
  return formatted.replace(/\u202F/g, ' ')
}

async function generateRegistrationReceiptPdfLib(
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
  const titleText = "REÇU FRAIS D'INSCRIPTION"
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 16)
  page.drawText(titleText, { x: (pageWidth - titleWidth) / 2, y, size: 16, font: fontBold, color: rgb(0,0,0) })

  y -= 12
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0,0,0) })

  y -= 20
  page.drawText(`Reçu N°: ${data.receiptNumber}`, { x: 30, y, size: 10, font: fontBold })
  page.drawText(`Date de paiement: ${new Date(data.paymentDate).toLocaleDateString('fr-FR')}`, { x: 250, y, size: 10, font: fontRegular })
  y -= 14
  if (data.academicYear) page.drawText(`Année académique: ${data.academicYear}`, { x: 30, y, size: 10, font: fontRegular })

  y -= 12
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0,0,0) })

  y -= 22
  page.drawText('Informations élève', { x: 30, y, size: 12, font: fontBold })
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
  page.drawText("Paiement des frais d'inscription", { x: 30, y, size: 12, font: fontBold })
  y -= 18
  page.drawText(`Montant payé: ${formatXof(data.amount)}`, { x: 30, y, size: 10, font: fontRegular })
  y -= 14
  page.drawText(`Méthode: ${data.paymentMethod}`, { x: 30, y, size: 10, font: fontRegular })
  y -= 14
  if (data.recordedBy) page.drawText(`Enregistré par: ${data.recordedBy}`, { x: 30, y, size: 10, font: fontRegular })

  y -= 20
  page.drawText("Ce reçu atteste le paiement complet des frais obligatoires d'inscription.", { x: 30, y, size: 9, font: fontRegular })

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
