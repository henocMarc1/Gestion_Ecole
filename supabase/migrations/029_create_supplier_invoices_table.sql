-- =====================================================
-- MIGRATION 029: Create expenses and supplier_invoices tables
-- =====================================================
-- Dépendances: Crée d'abord la table expenses (nécessaire pour le trigger)
-- Puis crée les factures des fournisseurs (CIE, SODECI, WiFi, etc.)

-- =====================================================
-- PART 1: Create expenses table
-- =====================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- FACTURE, SALARY, UTILITIES, etc.
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (type IN ('EXPENSE', 'FIXED', 'VARIABLE')),
  supplier_name TEXT,
  date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'OVERDUE')),
  proof_document_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_school_id ON expenses(school_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_school_date ON expenses(school_id, date DESC);

-- Enable RLS for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing expenses policies if they exist
DROP POLICY IF EXISTS "Users can view expenses from their school" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses for their school" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses in their school" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses from their school" ON expenses;

-- Create RLS policies for expenses
CREATE POLICY "Users can view expenses from their school" 
  ON expenses FOR SELECT 
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert expenses for their school" 
  ON expenses FOR INSERT 
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update expenses in their school" 
  ON expenses FOR UPDATE 
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete expenses from their school" 
  ON expenses FOR DELETE 
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp for expenses
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_expenses_updated_at ON expenses;

CREATE TRIGGER trigger_update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

-- =====================================================
-- PART 2: Create supplier_invoices table
-- =====================================================

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_type TEXT NOT NULL CHECK (supplier_type IN ('CIE', 'SODECI', 'WIFI', 'OTHER')),
  date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE')),
  proof_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_invoice_per_school UNIQUE(school_id, invoice_number)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_school_id ON supplier_invoices(school_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON supplier_invoices(date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_school_date ON supplier_invoices(school_id, date DESC);

-- Enable RLS
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view supplier invoices from their school" ON supplier_invoices;
DROP POLICY IF EXISTS "Users can insert supplier invoices for their school" ON supplier_invoices;
DROP POLICY IF EXISTS "Users can update supplier invoices in their school" ON supplier_invoices;
DROP POLICY IF EXISTS "Users can delete supplier invoices from their school" ON supplier_invoices;

-- Create RLS policies
-- Allow authenticated users to view supplier invoices from their school
CREATE POLICY "Users can view supplier invoices from their school" 
  ON supplier_invoices FOR SELECT 
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to insert supplier invoices if they belong to that school
CREATE POLICY "Users can insert supplier invoices for their school" 
  ON supplier_invoices FOR INSERT 
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to update supplier invoices if they belong to that school
CREATE POLICY "Users can update supplier invoices in their school" 
  ON supplier_invoices FOR UPDATE 
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to delete supplier invoices if they belong to that school
CREATE POLICY "Users can delete supplier invoices from their school" 
  ON supplier_invoices FOR DELETE 
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supplier_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_supplier_invoices_updated_at ON supplier_invoices;

CREATE TRIGGER trigger_update_supplier_invoices_updated_at
  BEFORE UPDATE ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_invoices_updated_at();

-- Trigger to create expense when invoice is marked as PAID
CREATE OR REPLACE FUNCTION create_expense_on_supplier_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  expense_description TEXT;
  v_expense_id UUID;
BEGIN
  -- Only create expense if status changed to PAID
  IF NEW.status = 'PAID' AND (OLD.status IS NULL OR OLD.status != 'PAID') THEN
    expense_description := 'Paiement facture: ' || NEW.supplier_name || ' (' || NEW.supplier_type || ') - N°' || NEW.invoice_number;
    
    -- Insert into treasury transaction FIRST (has less strict constraints)
    BEGIN
      INSERT INTO treasury_transactions (
        school_id,
        type,
        category,
        amount,
        description,
        date,
        payment_method,
        reference
      ) VALUES (
        NEW.school_id,
        'OUTFLOW',
        'FACTURE_' || NEW.supplier_type, -- Category: FACTURE_CIE, FACTURE_SODECI, etc.
        NEW.amount,
        expense_description,
        NEW.date,
        'CASH',
        NEW.invoice_number
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error inserting treasury transaction: %', SQLERRM;
    END;

    -- Then insert into expenses table
    BEGIN
      INSERT INTO expenses (
        school_id,
        description,
        category,
        amount,
        type,
        supplier_name,
        date,
        payment_status,
        proof_document_url
      ) VALUES (
        NEW.school_id,
        expense_description,
        'FACTURE', -- Mark category as FACTURE for detailed expense reports
        NEW.amount,
        'EXPENSE', -- Type is EXPENSE
        NEW.supplier_name,
        NEW.date,
        'PAID', -- Status is PAID since we're marking invoice as paid
        NEW.proof_document_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error inserting expense: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_expense_on_supplier_invoice_paid ON supplier_invoices;

CREATE TRIGGER trigger_create_expense_on_supplier_invoice_paid
  AFTER UPDATE ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_expense_on_supplier_invoice_paid();
