import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateInvoicePDF, InvoiceData } from '@/lib/services/pdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json()

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Missing invoiceId' },
        { status: 400 }
      )
    }

    // Get invoice information
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, students(*, classes(*)), schools(*)')
      .eq('id', invoiceId)
      .single()

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Get tuition fees for this invoice
    const { data: tuitionFees } = await supabase
      .from('tuition_fees')
      .select('*')
      .eq('student_id', invoice.student_id)

    // Get payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)

    // Calculate amounts
    const totalAmount = tuitionFees?.reduce((sum: number, fee: any) => sum + fee.amount, 0) || 0
    const amountPaid = payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0
    const amountDue = Math.max(0, totalAmount - amountPaid)

    // Determine payment status
    let paymentStatus: 'paid' | 'partial' | 'overdue' = 'overdue'
    if (amountDue === 0) {
      paymentStatus = 'paid'
    } else if (amountPaid > 0) {
      paymentStatus = 'partial'
    }

    // Prepare items
    const items = tuitionFees?.map((fee: any) => ({
      description: fee.fee_name || 'Frais de scolarité',
      amount: fee.amount,
      status: amountPaid >= fee.amount ? 'Payé' : 'En attente'
    })) || [
      {
        description: 'Frais de scolarité',
        amount: totalAmount,
        status: amountPaid > 0 ? 'Partial' : 'Pending'
      }
    ]

    const schoolAddress = invoice?.schools?.address || 'Bingerville (Cefal après Adjamé-Bingerville)'
    const schoolPhone = invoice?.schools?.phone || '+225 0707905958'

    const invoiceData: InvoiceData = {
      invoiceNumber: invoice.invoice_number,
      studentName: `${invoice.students.first_name} ${invoice.students.last_name}`,
      studentMatricule: invoice.students.matricule,
      className: invoice.students.classes.name,
      schoolName: invoice?.schools?.name || 'Établissement',
      schoolAddress,
      schoolPhone,
      tuitionFee: totalAmount,
      items: items,
      totalAmount: totalAmount,
      amountPaid: amountPaid,
      amountDue: amountDue,
      dueDate: new Date(invoice.due_date),
      paymentStatus: paymentStatus,
      issueDate: new Date(invoice.created_at),
      generatedAt: new Date()
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData)

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice_${invoice.invoice_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF' },
      { status: 500 }
    )
  }
}
