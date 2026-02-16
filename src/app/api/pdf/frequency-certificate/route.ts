import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

interface FrequencyCertificatePayload {
  school_name: string;
  school_address?: string;
  school_phone?: string;
  student_name: string;
  student_matricule?: string;
  student_photo_url?: string;
  date_of_birth?: string;
  place_of_birth?: string;
  gender?: string;
  class_name?: string;
  class_level?: string;
  program?: string;
  enrollment_date?: string;
  academic_year?: string;
  issue_date?: string;
  issue_place?: string;
  signatory_title?: string;
  signatory_name?: string;
}

async function getLogoBytes(): Promise<Buffer | null> {
  const logoPath = process.env.SCHOOL_LOGO_PATH || path.join(process.cwd(), 'public', 'school-logo.png');

  if (process.env.SCHOOL_LOGO_PATH && fs.existsSync(process.env.SCHOOL_LOGO_PATH)) {
    return fs.readFileSync(process.env.SCHOOL_LOGO_PATH);
  }

  if (fs.existsSync(logoPath)) {
    return fs.readFileSync(logoPath);
  }

  const logoJpgPath = path.join(process.cwd(), 'public', 'school-logo.jpg');
  if (fs.existsSync(logoJpgPath)) {
    return fs.readFileSync(logoJpgPath);
  }

  if (process.env.SCHOOL_LOGO_URL) {
    try {
      const response = await fetch(process.env.SCHOOL_LOGO_URL);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
      }
    } catch {
      return null;
    }
  }

  return null;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('fr-FR');
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FrequencyCertificatePayload;

    console.log('===== CERTIFICAT FREQUENTATION DEBUG =====')
    console.log('Student name:', body.student_name)
    console.log('Photo URL:', body.student_photo_url)

    if (!body.school_name || !body.student_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Download student photo if available
    let studentPhotoBytes: Buffer | null = null
    if (body.student_photo_url) {
      console.log('Téléchargement de la photo...')
      try {
        const photoResponse = await fetch(body.student_photo_url)
        console.log('Photo response status:', photoResponse.status)
        if (photoResponse.ok) {
          const arrayBuffer = await photoResponse.arrayBuffer()
          studentPhotoBytes = Buffer.from(arrayBuffer)
          console.log('Photo téléchargée, taille:', studentPhotoBytes.length, 'bytes')
        }
      } catch (error) {
        console.error('Erreur téléchargement photo:', error)
      }
    } else {
      console.log('Aucune photo URL fournie')
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    const pageWidth = 595;
    let y = 800;

    let logoWidth = 0;
    let logoHeight = 0;
    const logoBytes = await getLogoBytes();
    if (logoBytes) {
      try {
        let logoImg;
        try {
          logoImg = await pdfDoc.embedPng(logoBytes);
        } catch {
          logoImg = await pdfDoc.embedJpg(logoBytes);
        }
        const logoSize = 80;
        page.drawImage(logoImg, { x: margin, y: 735, width: logoSize, height: logoSize });
        logoWidth = logoSize;
        logoHeight = logoSize;
      } catch {
        // ignore logo errors
      }
    }

    // Add student photo in top right if available
    if (studentPhotoBytes) {
      console.log('Ajout de la photo au PDF...')
      try {
        let photoImg
        try {
          photoImg = await pdfDoc.embedPng(studentPhotoBytes)
        } catch {
          photoImg = await pdfDoc.embedJpg(studentPhotoBytes)
        }
        const photoSize = 80
        const photoX = pageWidth - margin - photoSize
        const photoY = 735
        page.drawImage(photoImg, {
          x: photoX,
          y: photoY,
          width: photoSize,
          height: photoSize
        })
        console.log('Photo ajoutée au PDF avec succès')
      } catch (error) {
        console.error('Erreur ajout photo au PDF:', error)
      }
    } else {
      console.log('Pas de photo à ajouter')
    }
    console.log('=========================================\n')

    // Textes centrés en haut
    page.drawText('REPUBLIQUE DE CÔTE D\'IVOIRE', {
      x: pageWidth / 2 - 100,
      y: 795,
      size: 10,
      font: fontBold,
    });
    
    page.drawText('Union – Discipline – Travail', {
      x: pageWidth / 2 - 85,
      y: 781,
      size: 9,
      font,
    });

    // Nom de l'école et coordonnées centrés
    const schoolNameWidth = fontBold.widthOfTextAtSize(body.school_name.toUpperCase(), 12);
    page.drawText(body.school_name.toUpperCase(), { 
      x: (pageWidth - schoolNameWidth) / 2, 
      y: 758, 
      size: 12, 
      font: fontBold 
    });
    
    let schoolInfoY = 744;
    if (body.school_address) {
      const addressWidth = font.widthOfTextAtSize(body.school_address, 9);
      page.drawText(body.school_address, { 
        x: (pageWidth - addressWidth) / 2, 
        y: schoolInfoY, 
        size: 9, 
        font 
      });
      schoolInfoY -= 12;
    }
    if (body.school_phone) {
      const phoneText = `Tél: ${body.school_phone}`;
      const phoneWidth = font.widthOfTextAtSize(phoneText, 9);
      page.drawText(phoneText, { 
        x: (pageWidth - phoneWidth) / 2, 
        y: schoolInfoY, 
        size: 9, 
        font 
      });
      schoolInfoY -= 12;
    }

    y = schoolInfoY - 10;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0, 0, 0) });

    y -= 30;
    page.drawRectangle({ x: 140, y: y - 8, width: 315, height: 30, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    page.drawText('CERTIFICAT DE FREQUENTATION', {
      x: 165,
      y: y,
      size: 12,
      font: fontBold,
    });

    y -= 50;
    page.drawText(`Je soussigné ${body.signatory_title || 'Le Directeur'},`, { x: margin, y, size: 10, font });
    y -= 16;
    page.drawText(`certifie que l'élève :`, { x: margin, y, size: 10, font });

    y -= 26;
    const labelX = margin + 10;
    const valueX = margin + 130;
    const lineHeight = 16;

    const nameParts = body.student_name.split(' ');
    const lastName = nameParts.shift() || '';
    const firstNames = nameParts.join(' ');

    page.drawText('Nom :', { x: labelX, y, size: 10, font: fontBold });
    page.drawText(lastName || body.student_name, { x: valueX, y, size: 10, font });
    y -= lineHeight;

    page.drawText('Prénoms :', { x: labelX, y, size: 10, font: fontBold });
    page.drawText(firstNames || body.student_name, { x: valueX, y, size: 10, font });
    y -= lineHeight;

    page.drawText('Né(e) le :', { x: labelX, y, size: 10, font: fontBold });
    const birthLine = [formatDate(body.date_of_birth), body.place_of_birth ? `à ${body.place_of_birth}` : ''].filter(Boolean).join(' ');
    page.drawText(birthLine || 'N/A', { x: valueX, y, size: 10, font });
    y -= lineHeight;

    page.drawText('Matricule :', { x: labelX, y, size: 10, font: fontBold });
    page.drawText(body.student_matricule || 'N/A', { x: valueX, y, size: 10, font });
    y -= lineHeight;

    page.drawText('Sexe :', { x: labelX, y, size: 10, font: fontBold });
    page.drawText(body.gender || 'N/A', { x: valueX, y, size: 10, font });
    y -= lineHeight;

    page.drawText('Classe :', { x: labelX, y, size: 10, font: fontBold });
    page.drawText(body.class_name || 'N/A', { x: valueX, y, size: 10, font });
    y -= lineHeight;

    if (body.program) {
      page.drawText('Filière :', { x: labelX, y, size: 10, font: fontBold });
      page.drawText(body.program, { x: valueX, y, size: 10, font });
      y -= lineHeight;
    }

    y -= 10;
    const enrollmentLine = body.enrollment_date ? `depuis le ${formatDate(body.enrollment_date)}` : 'depuis le début de l\'année scolaire';
    const academicLine = body.academic_year ? `année scolaire ${body.academic_year}` : '';

    const statement = `est régulièrement inscrit(e) et suit sa formation au sein de l'établissement ${body.school_name} ${enrollmentLine} ${academicLine}.`;
    page.drawText(statement, { x: margin, y, size: 10, font, maxWidth: pageWidth - 2 * margin, lineHeight: 14 });

    y -= 60;
    page.drawText(`Fait à ${body.issue_place || body.school_name}, le ${formatDate(body.issue_date) || new Date().toLocaleDateString('fr-FR')}`, {
      x: margin,
      y,
      size: 10,
      font,
    });

    y -= 40;
    page.drawText('P/Le Directeur', { x: 360, y, size: 10, font });
    y -= 14;
    page.drawText(body.signatory_name || '', { x: 360, y, size: 10, font });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Certificat_Frequentation_${body.student_matricule || 'eleve'}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating frequency certificate:', error);
    return NextResponse.json({ error: 'Failed to generate certificate PDF' }, { status: 500 });
  }
}
