-- Migration: Amélioration du système de notifications
-- Ajout du suivi de lecture détaillé

-- 1. Ajouter une colonne pour tracker combien ont lu
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS read_count INTEGER DEFAULT 0;

-- 2. Ajouter des colonnes metadata pour notification_recipients
-- Note: read_at existe déjà dans la table
ALTER TABLE notification_recipients
ADD COLUMN IF NOT EXISTS read_from_device VARCHAR(50),
ADD COLUMN IF NOT EXISTS read_ip_address VARCHAR(45);

-- 3. Fonction pour mettre à jour le compteur de lecture
CREATE OR REPLACE FUNCTION update_notification_read_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour le compteur de lecture de la notification
    UPDATE notifications
    SET read_count = (
        SELECT COUNT(*)
        FROM notification_recipients
        WHERE notification_id = NEW.notification_id
        AND status = 'read'
    )
    WHERE id = NEW.notification_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Créer le trigger pour auto-update du read_count
DROP TRIGGER IF EXISTS trigger_update_read_count ON notification_recipients;
CREATE TRIGGER trigger_update_read_count
    AFTER UPDATE OF status ON notification_recipients
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'read')
    EXECUTE FUNCTION update_notification_read_count();

-- 5. Vue pour les statistiques de lecture par notification
CREATE OR REPLACE VIEW notification_read_stats AS
SELECT 
    n.id as notification_id,
    n.title,
    n.sent_at,
    COUNT(nr.id) as total_recipients,
    COUNT(CASE WHEN nr.status = 'read' THEN 1 END) as read_count,
    COUNT(CASE WHEN nr.status != 'read' THEN 1 END) as unread_count,
    ROUND(
        (COUNT(CASE WHEN nr.status = 'read' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(nr.id), 0) * 100), 
        2
    ) as read_percentage,
    MIN(nr.read_at) as first_read_at,
    MAX(nr.read_at) as last_read_at
FROM notifications n
LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.status = 'sent'
GROUP BY n.id, n.title, n.sent_at;

-- 6. Vue détaillée des lecteurs par notification
CREATE OR REPLACE VIEW notification_readers_detail AS
SELECT 
    n.id as notification_id,
    n.title as notification_title,
    n.sent_at,
    u.id as user_id,
    u.full_name,
    u.email,
    u.role,
    CASE WHEN nr.status = 'read' THEN true ELSE false END as is_read,
    nr.read_at,
    nr.read_from_device,
    CASE 
        WHEN nr.status = 'read' THEN 'Lu'
        WHEN nr.read_at IS NULL AND n.sent_at < NOW() - INTERVAL '24 hours' THEN 'Non lu (24h+)'
        WHEN nr.read_at IS NULL THEN 'Non lu'
        ELSE 'Inconnu'
    END as read_status,
    CASE 
        WHEN nr.read_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (nr.read_at - n.sent_at))/60
        ELSE NULL
    END as minutes_to_read
FROM notifications n
INNER JOIN notification_recipients nr ON n.id = nr.notification_id
INNER JOIN users u ON nr.user_id = u.id
WHERE n.status = 'sent'
ORDER BY n.sent_at DESC, nr.read_at DESC NULLS LAST;

-- 7. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_notification_recipients_read 
ON notification_recipients(notification_id, status, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_read_count 
ON notifications(read_count) WHERE status = 'sent';

-- 8. Politique RLS pour les vues (si nécessaire)
-- Les vues héritent des permissions des tables sous-jacentes

-- 9. Mettre à jour les read_count existants
UPDATE notifications
SET read_count = (
    SELECT COUNT(*)
    FROM notification_recipients
    WHERE notification_id = notifications.id
    AND status = 'read'
)
WHERE status = 'sent';

COMMENT ON COLUMN notifications.read_count IS 'Nombre de destinataires ayant lu la notification';
COMMENT ON COLUMN notification_recipients.read_from_device IS 'Type d''appareil utilisé pour lire';
COMMENT ON COLUMN notification_recipients.read_ip_address IS 'Adresse IP de lecture';
COMMENT ON VIEW notification_read_stats IS 'Statistiques de lecture agrégées par notification';
COMMENT ON VIEW notification_readers_detail IS 'Détails des lecteurs pour chaque notification';
