-- =====================================================
-- MIGRATION 026: Table treasury_transactions
-- =====================================================
-- Crée la table pour gérer les transactions de trésorerie

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('INFLOW', 'OUTFLOW')),
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
  reference VARCHAR(100),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- INDEX pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_treasury_school_id ON treasury_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_type ON treasury_transactions(type);
CREATE INDEX IF NOT EXISTS idx_treasury_school_date ON treasury_transactions(school_id, date DESC);

-- Activer RLS
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "treasury_select_all" ON treasury_transactions;
DROP POLICY IF EXISTS "treasury_insert_all" ON treasury_transactions;
DROP POLICY IF EXISTS "treasury_update_all" ON treasury_transactions;
DROP POLICY IF EXISTS "treasury_delete_all" ON treasury_transactions;

-- Politiques RLS simplifiées pour treasury_transactions
-- Tout utilisateur authentifié peut voir, créer, modifier et supprimer les transactions
CREATE POLICY "treasury_select_all"
  ON treasury_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "treasury_insert_all"
  ON treasury_transactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "treasury_update_all"
  ON treasury_transactions FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "treasury_delete_all"
  ON treasury_transactions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_treasury_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS treasury_updated_at_trigger ON treasury_transactions;
CREATE TRIGGER treasury_updated_at_trigger
  BEFORE UPDATE ON treasury_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_treasury_updated_at();

-- Commentaires pour documentation
COMMENT ON TABLE treasury_transactions IS 'Transactions de trésorerie (entrées et sorties)';
COMMENT ON COLUMN treasury_transactions.type IS 'Type de transaction: INFLOW (entrée) ou OUTFLOW (sortie)';
COMMENT ON COLUMN treasury_transactions.category IS 'Catégorie: Salaires, Électricité, Eau, Frais scolarité, etc.';
COMMENT ON COLUMN treasury_transactions.payment_method IS 'Méthode de paiement: CASH, CHECK, TRANSFER, MOBILE_MONEY, etc.';

-- =====================================================
-- VÉRIFICATION
-- =====================================================
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'treasury_transactions'
ORDER BY cmd;
