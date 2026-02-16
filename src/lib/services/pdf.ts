import PDFDocument from 'pdfkit'
import { Buffer } from 'buffer'

function formatXof(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
    .format(amount)
    .replace(/[\u202F\u00A0]/g, ' ') + ' F CFA'
}

export interface BulletinData {
  studentName: string
  studentMatricule: string
  className: string
  academicYear: string
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolLogo?: string
  grades: Array<{
    subject: string
    grade: number
    maxGrade: number
    percentage: number
    appreciation?: string
  }>
  average: number
  averagePercentage: number
  teacherAppreciation?: string
  principalSignature?: string
  generatedAt: Date
}

export interface CertificateData {
  studentName: string
  studentMatricule: string
  className: string
  academicYear: string
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolLogo?: string
  studentPhotoUrl?: string
  studentPhotoBuffer?: Buffer
  certificateType: 'scolarite' | 'reussite' | 'assiduite'
  generatedAt: Date
}

export interface InvoiceData {
  invoiceNumber: string
  studentName: string
  studentMatricule: string
  className: string
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolLogo?: string
  tuitionFee: number
  items: Array<{
    description: string
    amount: number
    status?: string
  }>
  totalAmount: number
  amountPaid: number
  amountDue: number
  dueDate: Date
  paymentStatus: 'paid' | 'partial' | 'overdue'
  issueDate: Date
  generatedAt: Date
}

/**
 * Generate Bulletin PDF
 * Creates a professional school bulletin with grades and appreciation
 */
export async function generateBulletinPDF(
  bulletinData: BulletinData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      })

      const buffers: Buffer[] = []

      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => {
        resolve(Buffer.concat(buffers))
      })
      doc.on('error', reject)

      // Header
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text("REPUBLIQUE DE CÔTE D'IVOIRE", { align: 'center' })

      doc
        .fontSize(9)
        .font('Helvetica')
        .text('Union – Discipline – Travail', { align: 'center' })

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(bulletinData.schoolName, { align: 'center' })

      doc.fontSize(9).font('Helvetica')
      if (bulletinData.schoolAddress) {
        doc.text(bulletinData.schoolAddress, { align: 'center' })
      }
      if (bulletinData.schoolPhone) {
        doc.text(`Tél: ${bulletinData.schoolPhone}`, { align: 'center' })
      }
      doc.moveDown(0.3)

      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Bulletin de Scolarité - Année Académique ' + bulletinData.academicYear, {
          align: 'center'
        })
        .moveDown(0.5)

      // Divider
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.5)

      // Student Information
      doc.fontSize(11).font('Helvetica-Bold').text('Informations Élève')
      doc.fontSize(10).font('Helvetica')
      doc.text(`Nom: ${bulletinData.studentName}`, { width: 250 })
      doc.text(`Matricule: ${bulletinData.studentMatricule}`, { width: 250 })
      doc.text(`Classe: ${bulletinData.className}`, { width: 250 })
      doc.moveDown(0.5)

      // Divider
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.5)

      // Grades Table
      doc.fontSize(11).font('Helvetica-Bold').text('Résultats')
      doc.moveDown(0.3)

      // Table header
      const tableTop = doc.y
      const col1 = 40
      const col2 = 300
      const col3 = 420
      const col4 = 500
      const rowHeight = 25

      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Matière', col1, tableTop, { width: 250 })
      doc.text('Note/Max', col2, tableTop, { width: 100 })
      doc.text('Pct', col3, tableTop, { width: 60 })
      doc.text('Appréciation', col4, tableTop, { width: 55 })

      doc.moveTo(40, tableTop + 20).lineTo(555, tableTop + 20).stroke()

      // Table rows
      doc.font('Helvetica').fontSize(9)
      let tableY = tableTop + 25

      bulletinData.grades.forEach((grade) => {
        doc.text(grade.subject, col1, tableY, { width: 250 })
        doc.text(`${grade.grade}/${grade.maxGrade}`, col2, tableY, { width: 100 })
        doc.text(`${grade.percentage}%`, col3, tableY, { width: 60 })
        doc.text(grade.appreciation || '-', col4, tableY, { width: 55 })
        tableY += rowHeight
      })

      doc.moveTo(40, tableY).lineTo(555, tableY).stroke()

      // Summary
      tableY += 15
      doc.fontSize(10).font('Helvetica-Bold')
      doc.text(`Moyenne Générale: ${bulletinData.average.toFixed(2)}/20 (${bulletinData.averagePercentage}%)`, {
        align: 'right',
        width: 515
      })

      doc.moveDown(0.5)

      // Teacher Appreciation
      if (bulletinData.teacherAppreciation) {
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
        doc.moveDown(0.3)
        doc.fontSize(10).font('Helvetica-Bold').text("Appréciation de l'Enseignant")
        doc.fontSize(9).font('Helvetica')
        doc.text(bulletinData.teacherAppreciation, { align: 'justify' })
      }

      doc.moveDown(1)

      // Footer
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.3)
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(`Généré le: ${bulletinData.generatedAt.toLocaleDateString('fr-FR')}`, {
          align: 'right'
        })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Generate Certificate PDF
 * Creates a professional school certificate
 */
export async function generateCertificatePDF(
  certificateData: CertificateData
): Promise<Buffer> {
  try {
    // Use photo buffer if provided directly
    const studentPhotoBuffer = certificateData.studentPhotoBuffer || null

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      })

      const buffers: Buffer[] = []

      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => {
        resolve(Buffer.concat(buffers))
      })
      doc.on('error', reject)

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text("REPUBLIQUE DE CÔTE D'IVOIRE", { align: 'center' })

      doc
        .fontSize(9)
        .font('Helvetica')
        .text('Union – Discipline – Travail', { align: 'center' })

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(certificateData.schoolName, { align: 'center' })

      doc.fontSize(9).font('Helvetica')
      if (certificateData.schoolAddress) {
        doc.text(certificateData.schoolAddress, { align: 'center' })
      }
      if (certificateData.schoolPhone) {
        doc.text(`Tél: ${certificateData.schoolPhone}`, { align: 'center' })
      }
      doc.moveDown(0.5)

      // Add student photo in top right if available
      if (studentPhotoBuffer) {
        console.log('Ajout de la photo au PDF...')
        const photoX = doc.page.width - 130 // 130px from right edge
        const photoY = 40 // 40px from top
        const photoWidth = 80
        const photoHeight = 80

        try {
          doc.image(studentPhotoBuffer, photoX, photoY, {
            width: photoWidth,
            height: photoHeight,
            fit: [photoWidth, photoHeight],
            align: 'center',
            valign: 'center'
          })
          console.log('Photo ajoutée avec succès au PDF')
        } catch (err) {
          console.error('Erreur lors de l\'ajout de la photo au PDF:', err)
          // Continue without photo
        }
      } else {
        console.log('Pas de photo buffer, certificat sans photo')
      }

      // Title
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('CERTIFICAT', { align: 'center' })

      doc.moveDown(0.3)

      // Certificate type
      let certificateLabel = 'de Scolarité'
      if (certificateData.certificateType === 'reussite') {
        certificateLabel = 'de Réussite'
      } else if (certificateData.certificateType === 'assiduite') {
        certificateLabel = "d'Assiduité"
      }

      doc
        .fontSize(14)
        .font('Helvetica')
        .text(`${certificateLabel}`, { align: 'center' })

      doc.moveDown(1)

      // Certificate body
      doc
        .fontSize(11)
        .font('Helvetica')
        .text(`L'établissement ${certificateData.schoolName}, par la présente, certifie que :`, {
          align: 'justify'
        })

      doc.moveDown(1)

      // Student information in certificate body
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(certificateData.studentName.toUpperCase(), { align: 'center' })

      doc.moveDown(0.3)

      doc
        .fontSize(11)
        .font('Helvetica')
        .text(`Matricule: ${certificateData.studentMatricule}`, { align: 'center' })

      doc.moveDown(0.5)

      // Certificate statement
      doc.fontSize(11).font('Helvetica')

      if (certificateData.certificateType === 'scolarite') {
        doc.text(
          `est dûment inscrit(e) et poursuit sa scolarité en classe de ${certificateData.className} pour l'année académique ${certificateData.academicYear}.`,
          { align: 'justify' }
        )
      } else if (certificateData.certificateType === 'reussite') {
        doc.text(
          `a satisfait aux conditions requises et a réussi son année scolaire en classe de ${certificateData.className} pour l'année académique ${certificateData.academicYear}.`,
          { align: 'justify' }
        )
      } else if (certificateData.certificateType === 'assiduite') {
        doc.text(
          `s'est distingué(e) par son assiduité et sa régularité en classe de ${certificateData.className} pendant l'année académique ${certificateData.academicYear}.`,
          { align: 'justify' }
        )
      }

      doc.moveDown(2)

      // Signature section
      doc.fontSize(10).font('Helvetica')
      doc.text('Fait à: ' + certificateData.schoolName, { align: 'left' })
      doc.text(
        'Le: ' + certificateData.generatedAt.toLocaleDateString('fr-FR'),
        { align: 'left' }
      )

      doc.moveDown(1.5)

      // Signature line
      doc
        .moveTo(100, doc.y)
        .lineTo(200, doc.y)
        .stroke()

      doc
        .fontSize(9)
        .font('Helvetica')
        .text('Le Directeur', 95, doc.y + 5, { align: 'center' })

      doc.end()
    })
  } catch (error) {
    console.error('Error generating certificate PDF:', error)
    throw error
  }
}

/**
 * Generate Invoice PDF
 * Creates a professional school invoice
 */
export async function generateInvoicePDF(
  invoiceData: InvoiceData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      })

      const buffers: Buffer[] = []

      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => {
        resolve(Buffer.concat(buffers))
      })
      doc.on('error', reject)

      // Header
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text("REPUBLIQUE DE CÔTE D'IVOIRE", { align: 'center' })

      doc
        .fontSize(9)
        .font('Helvetica')
        .text('Union – Discipline – Travail', { align: 'center' })

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(invoiceData.schoolName, { align: 'center' })

      doc.fontSize(9).font('Helvetica')
      if (invoiceData.schoolAddress) {
        doc.text(invoiceData.schoolAddress, { align: 'center' })
      }
      if (invoiceData.schoolPhone) {
        doc.text(`Tél: ${invoiceData.schoolPhone}`, { align: 'center' })
      }

      doc
        .fontSize(10)
        .font('Helvetica')
        .text('FACTURE - FRAIS DE SCOLARITÉ', { align: 'center' })
        .moveDown(0.5)

      // Divider
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.5)

      // Invoice number and date
      doc.fontSize(10).font('Helvetica')
      doc.text(`Facture N°: ${invoiceData.invoiceNumber}`, { width: 250 })
      doc.text(`Date: ${invoiceData.issueDate.toLocaleDateString('fr-FR')}`, { width: 250 })
      doc.text(`Échéance: ${invoiceData.dueDate.toLocaleDateString('fr-FR')}`, { width: 250 })
      doc.moveDown(0.5)

      // Student information
      doc.fontSize(11).font('Helvetica-Bold').text('Informations Élève')
      doc.fontSize(10).font('Helvetica')
      doc.text(`Nom: ${invoiceData.studentName}`, { width: 250 })
      doc.text(`Matricule: ${invoiceData.studentMatricule}`, { width: 250 })
      doc.text(`Classe: ${invoiceData.className}`, { width: 250 })
      doc.moveDown(0.5)

      // Divider
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.5)

      // Items table
      doc.fontSize(11).font('Helvetica-Bold').text('Détails')
      doc.moveDown(0.3)

      // Table header
      const tableTop = doc.y
      const col1 = 40
      const col2 = 350
      const col3 = 450
      const rowHeight = 25

      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Description', col1, tableTop, { width: 300 })
      doc.text('Montant', col2, tableTop, { width: 100 })
      doc.text('Statut', col3, tableTop, { width: 100 })

      doc.moveTo(40, tableTop + 20).lineTo(555, tableTop + 20).stroke()

      // Table rows
      doc.font('Helvetica').fontSize(9)
      let tableY = tableTop + 25

      invoiceData.items.forEach((item) => {
        doc.text(item.description, col1, tableY, { width: 300 })
        doc.text(formatXof(item.amount), col2, tableY, { width: 100 })
        doc.text(item.status || '-', col3, tableY, { width: 100 })
        tableY += rowHeight
      })

      doc.moveTo(40, tableY).lineTo(555, tableY).stroke()

      // Summary
      tableY += 15
      doc.fontSize(10).font('Helvetica-Bold')

      doc.text('Montant Total:', 350, tableY, { width: 100 })
      doc.text(formatXof(invoiceData.totalAmount), 450, tableY, { width: 100 })

      tableY += 20
      doc.text('Montant Payé:', 350, tableY, { width: 100 })
      doc.text(formatXof(invoiceData.amountPaid), 450, tableY, { width: 100 })

      tableY += 20
      const statusColor =
        invoiceData.paymentStatus === 'paid'
          ? '#10b981'
          : invoiceData.paymentStatus === 'partial'
            ? '#f59e0b'
            : '#ef4444'
      doc.fillColor(statusColor)
      doc.text('Montant Dû:', 350, tableY, { width: 100 })
      doc.text(formatXof(invoiceData.amountDue), 450, tableY, { width: 100 })
      doc.fillColor('black')

      doc.moveDown(2)

      // Payment status
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.3)

      const paymentStatusText =
        invoiceData.paymentStatus === 'paid'
          ? 'FACTURE PAYÉE'
          : invoiceData.paymentStatus === 'partial'
            ? 'PAIEMENT PARTIEL'
            : 'FACTURE IMPAYÉE'

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(statusColor)
        .text(`Statut: ${paymentStatusText}`, { align: 'right', width: 515 })
        .fillColor('black')

      doc.moveDown(0.5)

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(`Généré le: ${invoiceData.generatedAt.toLocaleDateString('fr-FR')}`, {
          align: 'right'
        })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

