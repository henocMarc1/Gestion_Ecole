import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/utils/helpers';

/**
 * API pour générer un reçu de paiement en PDF
 * POST /api/invoices/generate-receipt
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Récupérer les données du paiement avec toutes les relations
    const supabaseAdmin = getSupabaseAdmin();
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        invoice:invoices (
          *,
          student:students (
            *,
            class:classes (*)
          ),
          items:invoice_items (*)
        ),
        school:schools (*)
      `)
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Créer le PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // En-tête
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('REÇU DE PAIEMENT', pageWidth / 2, 20, { align: 'center' });

    // Informations de l'école
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(payment.school.name, 20, 35);
    if (payment.school.address) {
      doc.text(payment.school.address, 20, 40);
    }
    if (payment.school.phone) {
      doc.text(`Tél: ${payment.school.phone}`, 20, 45);
    }

    // Numéro de reçu
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`N° ${payment.payment_number}`, pageWidth - 20, 35, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Date: ${formatDate(payment.payment_date)}`, pageWidth - 20, 40, { align: 'right' });

    // Ligne de séparation
    doc.line(20, 50, pageWidth - 20, 50);

    // Informations de l'élève
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS ÉLÈVE', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const student = payment.invoice.student;
    doc.text(`Nom: ${student.first_name} ${student.last_name}`, 20, 68);
    doc.text(`Matricule: ${student.registration_number || 'N/A'}`, 20, 74);
    doc.text(`Classe: ${student.class?.name || 'N/A'}`, 20, 80);

    // Détails du paiement
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DÉTAILS DU PAIEMENT', 20, 95);

    // Tableau des items de la facture
    const tableData = payment.invoice.items.map((item: any) => [
      item.description,
      item.quantity.toString(),
      formatCurrency(item.unit_price),
      formatCurrency(item.total),
    ]);

    autoTable(doc, {
      startY: 100,
      head: [['Description', 'Quantité', 'Prix unitaire', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [240, 112, 29] }, // primary color
      margin: { left: 20, right: 20 },
    });

    // Totaux
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(10);
    doc.text('Sous-total:', pageWidth - 80, finalY);
    doc.text(formatCurrency(payment.invoice.subtotal), pageWidth - 20, finalY, { align: 'right' });

    if (payment.invoice.discount > 0) {
      doc.text('Remise:', pageWidth - 80, finalY + 6);
      doc.text(`-${formatCurrency(payment.invoice.discount)}`, pageWidth - 20, finalY + 6, { align: 'right' });
    }

    if (payment.invoice.tax > 0) {
      doc.text('Taxes:', pageWidth - 80, finalY + 12);
      doc.text(formatCurrency(payment.invoice.tax), pageWidth - 20, finalY + 12, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL PAYÉ:', pageWidth - 80, finalY + 20);
    doc.text(formatCurrency(payment.amount), pageWidth - 20, finalY + 20, { align: 'right' });

    // Méthode de paiement
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Méthode de paiement: ${payment.payment_method}`, 20, finalY + 35);
    if (payment.transaction_id) {
      doc.text(`Transaction ID: ${payment.transaction_id}`, 20, finalY + 41);
    }

    // Pied de page
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      'Ce document est un reçu officiel de paiement. Conservez-le précieusement.',
      pageWidth / 2,
      280,
      { align: 'center' }
    );

    // Générer le PDF en base64
    const pdfBase64 = doc.output('dataurlstring');

    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      filename: `recept_${payment.payment_number}.pdf`,
    });
  } catch (error: any) {
    console.error('Error generating receipt:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt', details: error.message },
      { status: 500 }
    );
  }
}
