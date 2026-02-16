import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

interface TuitionPaymentReceiptData {
  student_name: string;
  student_matricule: string;
  student_photo_url?: string | null;
  class_name: string;
  parent_name?: string;
  payment_amount: number;
  payment_date: string;
  payment_method: string;
  payment_reference: string;
  registration_fee: number;
  tuition_fee: number;
  other_fees: number;
  total_due: number;
  total_paid: number;
  balance: number;
  all_payments: Array<{ amount: number; payment_date: string; payment_method: string; reference: string }>;
  payment_schedules: Array<{ installment_number: number; due_month: number; amount: number; description: string }>;
  school_name: string;
  school_address: string;
  school_phone: string;
  academic_year: string;
  recorded_by?: string;
}

async function getLogoBytes(): Promise<Buffer | null> {
  const logoPath = process.env.SCHOOL_LOGO_PATH || path.join(process.cwd(), 'public', 'school-logo.png');
  
  if (process.env.SCHOOL_LOGO_PATH && fs.existsSync(process.env.SCHOOL_LOGO_PATH)) {
    console.log('Logo trouvé (SCHOOL_LOGO_PATH):', process.env.SCHOOL_LOGO_PATH);
    return fs.readFileSync(process.env.SCHOOL_LOGO_PATH);
  }

  if (fs.existsSync(logoPath)) {
    console.log('Logo PNG trouvé:', logoPath);
    return fs.readFileSync(logoPath);
  }

  const logoJpgPath = path.join(process.cwd(), 'public', 'school-logo.jpg');
  if (fs.existsSync(logoJpgPath)) {
    console.log('Logo JPG trouvé:', logoJpgPath);
    return fs.readFileSync(logoJpgPath);
  }

  if (process.env.SCHOOL_LOGO_URL) {
    console.log('Tentative de chargement du logo depuis URL:', process.env.SCHOOL_LOGO_URL);
    try {
      const response = await fetch(process.env.SCHOOL_LOGO_URL);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log('Logo chargé depuis URL');
        return Buffer.from(buffer);
      }
    } catch (err) {
      console.error('Erreur chargement logo URL:', err);
    }
  }

  console.log('Pas de logo trouvé');
  return null;
}

function formatXof(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace(/\u202F/g, ' ') + ' F CFA';
}

async function generatePaymentReceiptPdf(data: TuitionPaymentReceiptData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let yPosition = 780;
  const lineHeight = 15;
  const marginLeft = 50;
  const pageWidth = 595;

  // Logo à gauche
  const logoBytes = await getLogoBytes();
  let logoWidth = 0;
  if (logoBytes) {
    try {
      console.log('Tentative d\'embedding du logo, taille:', logoBytes.length, 'bytes');
      let logoImg;
      try {
        logoImg = await pdfDoc.embedJpg(logoBytes);
        console.log('Logo embarqué en JPG');
      } catch {
        logoImg = await pdfDoc.embedPng(logoBytes);
        console.log('Logo embarqué en PNG');
      }
      
      // Dimensions du logo
      const logoSize = 80;
      page.drawImage(logoImg, { x: 50, y: 740, width: logoSize, height: logoSize });
      console.log('Logo dessiné dans le PDF à (50, 740) avec dimensions:', logoSize, 'x', logoSize);
    } catch (err) {
      console.error('Erreur embedding logo:', err);
    }
  } else {
    console.log('Pas de logo à embarquer');
  }

  // Add student photo in top right if available
  if (data.student_photo_url) {
    try {
      const photoResponse = await fetch(data.student_photo_url);
      if (photoResponse.ok) {
        const photoArrayBuffer = await photoResponse.arrayBuffer();
        const photoBytes = Buffer.from(photoArrayBuffer);
        let photoImg;
        try {
          photoImg = await pdfDoc.embedPng(photoBytes);
        } catch {
          photoImg = await pdfDoc.embedJpg(photoBytes);
        }
        const photoSize = 80;
        const photoX = 595 - 40 - photoSize;
        const photoY = 740;
        page.drawImage(photoImg, {
          x: photoX,
          y: photoY,
          width: photoSize,
          height: photoSize
        });
      }
    } catch (err) {
      console.error('Erreur ajout photo élève:', err);
    }
  }

  const republicText = "REPUBLIQUE DE CÔTE D'IVOIRE";
  const republicWidth = helveticaBold.widthOfTextAtSize(republicText, 10);
  page.drawText(republicText, { x: (pageWidth - republicWidth) / 2, y: 795, size: 10, font: helveticaBold });

  const mottoText = 'Union – Discipline – Travail';
  const mottoWidth = helvetica.widthOfTextAtSize(mottoText, 9);
  page.drawText(mottoText, { x: (pageWidth - mottoWidth) / 2, y: 781, size: 9, font: helvetica });

  const schoolNameWidth = helveticaBold.widthOfTextAtSize(data.school_name, 12);
  page.drawText(data.school_name, { x: (pageWidth - schoolNameWidth) / 2, y: 758, size: 12, font: helveticaBold });

  let schoolInfoY = 744;
  if (data.school_address) {
    const addressWidth = helvetica.widthOfTextAtSize(data.school_address, 9);
    page.drawText(data.school_address, { x: (pageWidth - addressWidth) / 2, y: schoolInfoY, size: 9, font: helvetica });
    schoolInfoY -= 12;
  }
  if (data.school_phone) {
    const phoneText = `Tél: ${data.school_phone}`;
    const phoneWidth = helvetica.widthOfTextAtSize(phoneText, 9);
    page.drawText(phoneText, { x: (pageWidth - phoneWidth) / 2, y: schoolInfoY, size: 9, font: helvetica });
    schoolInfoY -= 12;
  }

  let y = schoolInfoY - 10;
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0, 0, 0) });

  y -= 24;
  const titleText = 'RECU PAIEMENT';
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 16);
  page.drawText(titleText, { x: (pageWidth - titleWidth) / 2, y, size: 16, font: helveticaBold, color: rgb(0, 0, 0) });

  y -= 12;
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0, 0, 0) });

  // Date du jour + année académique (alignement avec reçu d'inscription)
  const today = new Date();
  y -= 20;
  page.drawText(`Date: ${today.toLocaleDateString('fr-FR')}`, { x: 30, y, size: 10, font: helveticaBold });
  if (data.academic_year) {
    page.drawText(`Année académique: ${data.academic_year}`, { x: 350, y, size: 10, font: helvetica });
  }

  y -= 12;
  page.drawLine({ start: { x: 30, y }, end: { x: 565, y }, thickness: 1, color: rgb(0, 0, 0) });

  // Espace réduit avant le bloc suivant
  yPosition = y - 22;

  // Bloc infos élève + paiement
  const infoBoxHeight = 150;
  const infoBoxTop = yPosition;
  page.drawRectangle({ x: marginLeft, y: infoBoxTop - infoBoxHeight, width: pageWidth - 2 * marginLeft, height: infoBoxHeight, borderWidth: 1, borderColor: rgb(0, 0, 0), color: undefined });
  const infoFields = [
    { label: 'Matricule', value: data.student_matricule },
    { label: 'Nom et prénom', value: data.student_name },
    { label: 'Classe', value: data.class_name },
    { label: 'Année académique', value: data.academic_year },
    { label: 'Mode de paiement', value: data.payment_method },
    { label: 'Référence', value: data.payment_reference || 'N/A' },
    { label: 'Date de règlement', value: new Date(data.payment_date).toLocaleDateString('fr-FR') },
  ];

  let infoY = infoBoxTop - 25;
  const infoLabelWidth = 120;
  infoFields.forEach(({ label, value }) => {
    page.drawText(`${label} :`, { x: marginLeft + 10, y: infoY, font: helveticaBold, size: 9 });
    page.drawText(String(value), { x: marginLeft + 10 + infoLabelWidth, y: infoY, font: helvetica, size: 9 });
    infoY -= lineHeight;
  });

  yPosition = infoBoxTop - infoBoxHeight - 20;

  // Tableau récapitulatif
  const tableX = marginLeft;
  const tableY = yPosition - 20;
  const tableWidth = pageWidth - 2 * marginLeft; // 495
  const rowHeight = 22;
  const columns = [
    { width: 165, title: 'Nature', align: 'left' as const },
    { width: 110, title: 'Montant dû', align: 'right' as const },
    { width: 110, title: 'Payé', align: 'right' as const },
    { width: 110, title: 'Solde', align: 'right' as const },
  ];

  // En-tête du tableau
  let colX = tableX;
  columns.forEach((col) => {
    page.drawRectangle({ x: colX, y: tableY, width: col.width, height: rowHeight, borderWidth: 1, borderColor: rgb(0, 0, 0), color: undefined });
    const titleX = col.align === 'right' ? colX + col.width - helveticaBold.widthOfTextAtSize(col.title, 9) - 8 : colX + 8;
    page.drawText(col.title, { x: titleX, y: tableY + 6, font: helveticaBold, size: 9 });
    colX += col.width;
  });

  // Lignes - Afficher les frais et paiements avec échelonnement
  const rows: Array<{ nature: string; due: string; paid: string; balance: string }> = [];
  
  const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  
  // Calculer les paiements par type de frais
  // Logique : frais d'inscription + frais annexes sont payés à l'inscription
  // Donc si total_paid >= (registration_fee + other_fees), ils sont complètement payés
  let registrationPaid = 0;
  let otherPaid = 0;
  let tuitionPaid = 0;
  
  const totalNonScolarityFees = data.registration_fee + data.other_fees;
  
  if (data.all_payments && data.all_payments.length > 0) {
    // Si on a payé au moins les frais d'inscription + annexes
    if (data.total_paid >= totalNonScolarityFees) {
      // Frais d'inscription et annexes sont complètement payés
      registrationPaid = data.registration_fee;
      otherPaid = data.other_fees;
      
      // Le reste va à la scolarité
      tuitionPaid = data.total_paid - totalNonScolarityFees;
    } else {
      // Pas assez payé, distribuer proportionnellement
      let totalPaymentProcessed = 0;
      const firstPaymentAmount = data.all_payments[0]?.amount || 0;
      
      // Frais d'inscription en premier
      registrationPaid = Math.min(firstPaymentAmount - totalPaymentProcessed, data.registration_fee);
      totalPaymentProcessed += registrationPaid;
      
      // Frais annexes en deuxième
      otherPaid = Math.min(firstPaymentAmount - totalPaymentProcessed, data.other_fees);
      totalPaymentProcessed += otherPaid;
      
      // Le reste va à la scolarité
      tuitionPaid = data.total_paid - totalPaymentProcessed;
    }
  }
  
  // Ligne: Frais d'inscription
  if (data.registration_fee > 0) {
    rows.push({
      nature: 'Frais d\'inscription',
      due: formatXof(data.registration_fee),
      paid: formatXof(registrationPaid),
      balance: formatXof(data.registration_fee - registrationPaid)
    });
  }
  
  // Ligne: Frais annexe
  if (data.other_fees > 0) {
    rows.push({
      nature: 'Frais annexe',
      due: formatXof(data.other_fees),
      paid: formatXof(otherPaid),
      balance: formatXof(data.other_fees - otherPaid)
    });
  }
  
  // Ligne: Frais de scolarité (ligne principale)
  if (data.tuition_fee > 0) {
    rows.push({
      nature: 'Frais de scolarité',
      due: formatXof(data.tuition_fee),
      paid: '',
      balance: ''
    });
    
    // Afficher chaque échéance avec son statut de paiement
    if (data.payment_schedules && data.payment_schedules.length > 0) {
      let schedulePaid = tuitionPaid;
      
      data.payment_schedules.forEach((schedule) => {
        const monthName = MONTHS[schedule.due_month - 1] || `Mois ${schedule.due_month}`;
        const paidForThisSchedule = Math.min(schedulePaid, schedule.amount);
        const balanceForSchedule = schedule.amount - paidForThisSchedule;
        schedulePaid -= paidForThisSchedule;
        
        rows.push({
          nature: `  • Versement ${schedule.installment_number} (${monthName})`,
          due: formatXof(schedule.amount),
          paid: formatXof(paidForThisSchedule),
          balance: formatXof(balanceForSchedule)
        });
      });
    }
  }
  
  // Ligne de total
  rows.push({
    nature: 'TOTAL',
    due: formatXof(data.total_due),
    paid: formatXof(data.total_paid),
    balance: formatXof(data.balance)
  });

  let rowY = tableY - rowHeight;
  rows.forEach((row, idx) => {
    colX = tableX;
    const isTotal = row.nature === 'TOTAL PAYÉ';
    const font = isTotal ? helveticaBold : helvetica;
    
    [row.nature, row.due, row.paid, row.balance].forEach((text, colIdx) => {
      const col = columns[colIdx];
      page.drawRectangle({ x: colX, y: rowY, width: col.width, height: rowHeight, borderWidth: 1, borderColor: rgb(0, 0, 0), color: undefined });
      if (text) {
        const textWidth = font.widthOfTextAtSize(text, 9);
        const xPos = col.align === 'right' ? colX + col.width - textWidth - 8 : colX + 8;
        page.drawText(text, { x: xPos, y: rowY + 6, font: font, size: 9 });
      }
      colX += col.width;
    });
    rowY -= rowHeight;
  });

  // Totaux
  page.drawText(`TOTAL PAYÉ : ${formatXof(data.total_paid)}`, { x: marginLeft, y: rowY - 15, font: helveticaBold, size: 10 });
  page.drawText(`RESTE À PAYER : ${formatXof(data.balance)}`, { x: marginLeft, y: rowY - 30, font: helveticaBold, size: 10 });

  // Cadre signature
  const sigY = rowY - 65;
  page.drawRectangle({ x: marginLeft, y: sigY - 50, width: pageWidth - 2 * marginLeft, height: 50, borderWidth: 1, borderColor: rgb(0, 0, 0), color: undefined });
  page.drawText('Visa parent', { x: marginLeft + 20, y: sigY - 35, font: helvetica, size: 8 });
  page.drawText('Cachet de l\'école', { x: pageWidth - marginLeft - 140, y: sigY - 35, font: helvetica, size: 8 });

  // Footer
  page.drawText('Important : Aucun remboursement n\'est possible en cas d\'annulation de l\'inscription.', { x: marginLeft, y: 40, font: helvetica, size: 8 });

  return Buffer.from(await pdfDoc.save());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TuitionPaymentReceiptData;

    if (!body.student_name || !body.payment_amount) {
      return NextResponse.json(
        { error: 'Données manquantes' },
        { status: 400 }
      );
    }

    const pdfBuffer = await generatePaymentReceiptPdf(body);

    const filename = `receipt-${body.student_matricule}-${new Date().getTime()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating payment receipt:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du reçu' },
      { status: 500 }
    );
  }
}
