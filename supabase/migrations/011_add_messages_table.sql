-- =====================================================
-- MIGRATION: Ajouter indexes et policies pour messagerie
-- =====================================================
-- La table messages est créée en 001_initial_schema.sql
-- Cette migration ajoute les indexes optimisés et les RLS policies

-- Index pour optimiser les requêtes de conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_is_read 
  ON messages(is_read, recipient_id) WHERE deleted_at IS NULL;

-- Commentaires (mise à jour pour clarifier le schéma 001)
COMMENT ON TABLE messages IS 'Messages de communication entre parents et enseignants, enseignants et staff. Schéma créé en 001_initial_schema.sql';
COMMENT ON COLUMN messages.sender_id IS 'Utilisateur qui envoie le message';
COMMENT ON COLUMN messages.recipient_id IS 'Utilisateur qui reçoit le message';
COMMENT ON COLUMN messages.body IS 'Contenu du message';
COMMENT ON COLUMN messages.status IS 'Statut: DRAFT, SENT, ARCHIVED, DELETED';
COMMENT ON COLUMN messages.subject IS 'Sujet du message';

-- =====================================================
-- Politiques RLS pour messages
-- =====================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs voient leurs propres messages (envoyés et reçus)
CREATE POLICY "messages_own_select"
  ON messages FOR SELECT
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = recipient_id
    OR (auth.same_school(school_id) AND auth.is_school_admin())
  );

-- Policy: Les utilisateurs peuvent envoyer des messages
CREATE POLICY "messages_insert_user"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND auth.same_school(school_id)
  );

-- Policy: Les utilisateurs peuvent marquer leurs messages reçus comme lus / envoyer
CREATE POLICY "messages_update_user"
  ON messages FOR UPDATE
  USING (
    auth.uid() = recipient_id
    OR auth.uid() = sender_id
    OR (auth.same_school(school_id) AND auth.is_school_admin())
  )
  WITH CHECK (
    auth.uid() = recipient_id
    OR auth.uid() = sender_id
    OR (auth.same_school(school_id) AND auth.is_school_admin())
  );

-- =====================================================
-- TRIGGER: Mettre à jour read_at et updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_message_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SENT' AND (OLD.status IS NULL OR OLD.status != 'SENT') THEN
    NEW.read_at = NOW();
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_read_at_trigger ON messages;
CREATE TRIGGER messages_read_at_trigger
BEFORE UPDATE ON messages
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION update_message_read_at();

DROP TRIGGER IF EXISTS messages_updated_at_trigger ON messages;
CREATE TRIGGER messages_updated_at_trigger
BEFORE UPDATE ON messages
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION update_messages_updated_at();
