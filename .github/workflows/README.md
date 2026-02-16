# 🤖 GitHub Actions - Automatisation des Rappels de Paiement

Cette solution utilise **GitHub Actions** pour exécuter automatiquement la vérification des paiements chaque jour à 8h00.

## ✅ Avantages

- 🆓 **Gratuit** : 2000 minutes/mois pour les repos privés
- ⚡ **Simple** : Configuration en 5 minutes
- 📊 **Logs intégrés** : Voir l'historique de chaque exécution
- 🔄 **Déclenchement manuel** : Possibilité de lancer manuellement
- 🔔 **Notifications** : Alertes en cas d'erreur
- ☁️ **Serveur cloud** : Pas besoin d'infrastructure

## 🚀 Installation (5 minutes)

### Étape 1 : Initialiser Git (si pas déjà fait)

```powershell
# Dans le dossier ECOLE
cd "c:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE"

# Initialiser Git
git init

# Créer .gitignore
@"
node_modules/
.env
.env.local
*.log
.DS_Store
.next/
out/
build/
dist/
"@ | Out-File -FilePath .gitignore -Encoding UTF8

# Premier commit
git add .
git commit -m "Initial commit with GitHub Actions"
```

### Étape 2 : Créer un repo GitHub

1. Allez sur https://github.com/new
2. Remplissez :
   - **Repository name** : `ecole-management`
   - **Visibility** : Private (recommandé)
3. **NE PAS** initialiser avec README
4. Cliquez sur **Create repository**

### Étape 3 : Pousser le code vers GitHub

```powershell
# Remplacer YOUR-USERNAME par votre nom d'utilisateur GitHub
git remote add origin https://github.com/YOUR-USERNAME/ecole-management.git

# Pousser le code
git branch -M main
git push -u origin main
```

### Étape 4 : Configurer les secrets

1. Allez sur votre repo : `https://github.com/YOUR-USERNAME/ecole-management`
2. Cliquez sur **Settings** (onglet en haut)
3. Dans le menu de gauche : **Secrets and variables** > **Actions**
4. Cliquez sur **New repository secret**

**Créer 2 secrets :**

#### Secret 1 : SUPABASE_URL
- **Name** : `SUPABASE_URL`
- **Value** : `https://YOUR-PROJECT-REF.supabase.co`
- Cliquez sur **Add secret**

#### Secret 2 : SUPABASE_ANON_KEY
- **Name** : `SUPABASE_ANON_KEY`
- **Value** : Votre clé anon (depuis Supabase Dashboard > Settings > API)
- Cliquez sur **Add secret**

**Pour trouver ces valeurs :**
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings** > **API**
4. Copiez :
   - **Project URL** → SUPABASE_URL
   - **anon public** → SUPABASE_ANON_KEY

### Étape 5 : Activer GitHub Actions

1. Sur votre repo GitHub, allez dans l'onglet **Actions**
2. Si demandé, cliquez sur "**I understand my workflows, go ahead and enable them**"
3. Vous devriez voir le workflow "**Daily Payment Check**"

### Étape 6 : Tester manuellement

1. Dans l'onglet **Actions**
2. Cliquez sur "**Daily Payment Check**" dans la liste de gauche
3. Cliquez sur le bouton "**Run workflow**" (à droite)
4. Cliquez sur "**Run workflow**" (bouton vert)
5. Attendez quelques secondes et rafraîchissez
6. Cliquez sur l'exécution pour voir les logs

✅ **Vous devriez voir** :
```
🚀 Starting daily payment check...
📊 Response:
{
  "success": true,
  "timestamp": "2026-02-11T08:00:00.000Z",
  "remindersCreated": 5,
  "studentsExcluded": 0
}
✅ Success!
📝 Reminders created: 5
🚫 Students excluded: 0
```

---

## ⏰ Planning d'exécution

Le workflow s'exécute automatiquement **tous les jours à 8h00 (UTC+0)**.

Pour la **Côte d'Ivoire** (UTC+0), c'est parfait : **8h00 locale**.

### Changer l'heure

Éditez le fichier [.github/workflows/daily-payment-check.yml](.github/workflows/daily-payment-check.yml) :

```yaml
on:
  schedule:
    # Pour 6h00 au lieu de 8h00
    - cron: '0 6 * * *'
    
    # Pour 8h00 ET 18h00 (deux fois par jour)
    - cron: '0 8 * * *'
    - cron: '0 18 * * *'
    
    # Tous les jours ouvrables à 8h00 (lundi à vendredi)
    - cron: '0 8 * * 1-5'
```

**Format du cron** :
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── weekday (0 - 6, dimanche = 0)
│ │ │ │ │
* * * * *
```

---

## 📊 Monitoring

### Voir l'historique des exécutions

1. Allez sur votre repo GitHub
2. Onglet **Actions**
3. Cliquez sur "**Daily Payment Check**"
4. Vous verrez toutes les exécutions passées

### Voir les détails d'une exécution

1. Cliquez sur une exécution
2. Cliquez sur "**check-payments**"
3. Déroulez les étapes pour voir les logs

### Recevoir des notifications en cas d'erreur

1. Allez dans votre repo > **Settings** > **Notifications**
2. Ou configurez dans votre profil GitHub : **Settings** > **Notifications**
3. Activez "**Actions**" pour recevoir des emails en cas d'échec

---

## 🔧 Fonctionnalités avancées

### Ajouter l'envoi de notifications

Modifiez le fichier `.github/workflows/daily-payment-check.yml` :

```yaml
      - name: 📧 Send email notification if exclusions
        if: success()
        run: |
          # Récupérer le nombre d'exclusions
          RESPONSE=$(curl -s -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/daily-payment-check" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}")
          
          EXCLUDED=$(echo "$RESPONSE" | jq -r '.studentsExcluded')
          
          if [ "$EXCLUDED" -gt 0 ]; then
            # Envoyer un email via une API (SendGrid, Resend, etc.)
            curl -X POST https://api.sendgrid.com/v3/mail/send \
              -H "Authorization: Bearer ${{ secrets.SENDGRID_API_KEY }}" \
              -H "Content-Type: application/json" \
              -d '{
                "personalizations": [{
                  "to": [{"email": "admin@ecole.com"}]
                }],
                "from": {"email": "noreply@ecole.com"},
                "subject": "⚠️ Exclusions automatiques: '"$EXCLUDED"' élève(s)",
                "content": [{
                  "type": "text/plain",
                  "value": "'"$EXCLUDED"' élève(s) ont été exclus pour retard de paiement de 30+ jours."
                }]
              }'
          fi
```

### Ajouter Slack notification

```yaml
      - name: 📱 Send Slack notification
        if: success()
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
            -H "Content-Type: application/json" \
            -d '{
              "text": "✅ Vérification quotidienne des paiements terminée",
              "attachments": [{
                "color": "good",
                "fields": [
                  {
                    "title": "Rappels créés",
                    "value": "'"$REMINDERS"'",
                    "short": true
                  },
                  {
                    "title": "Élèves exclus",
                    "value": "'"$EXCLUDED"'",
                    "short": true
                  }
                ]
              }]
            }'
```

### Logger dans Supabase

```yaml
      - name: 📝 Log execution in database
        if: always()
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/rest/v1/payment_cron_logs" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "executed_at": "'"$(date -Iseconds)"'",
              "reminders_created": '"$REMINDERS"',
              "students_excluded": '"$EXCLUDED"',
              "success": true
            }'
```

---

## 🐛 Dépannage

### Le workflow ne s'exécute pas

**Vérifier :**
1. Le fichier est bien dans `.github/workflows/`
2. Le fichier se termine par `.yml`
3. GitHub Actions est activé dans Settings > Actions

**Note** : Le premier cron peut prendre jusqu'à 24h pour s'exécuter après le push

### Erreur : "Request failed"

**Vérifier :**
1. Les secrets sont bien configurés
2. La fonction Edge est bien déployée
3. L'URL Supabase est correcte

**Tester les secrets** :
```yaml
- name: Test secrets
  run: |
    echo "URL: ${{ secrets.SUPABASE_URL }}"
    echo "Key: ${SUPABASE_ANON_KEY:0:10}..." # Masqué
```

### Le cron ne se déclenche pas à l'heure

GitHub Actions peut avoir un délai de **5-15 minutes** pendant les heures de pointe.

**Solution** : Décaler l'heure (ex: 7h45 au lieu de 8h00)
```yaml
- cron: '45 7 * * *'
```

---

## 🆚 Comparaison avec pg_cron

| Critère | GitHub Actions | pg_cron |
|---------|---------------|---------|
| **Prix** | Gratuit | Gratuit |
| **Configuration** | 5 min | 2 min |
| **Infrastructure** | Cloud GitHub | Supabase |
| **Précision** | ±5-15 min | ±1 min |
| **Logs** | Interface graphique | SQL queries |
| **Notifications** | Intégrées | À configurer |
| **Déclenchement manuel** | ✅ Bouton | SQL query |
| **Dépendance externe** | GitHub | Aucune |

**Recommandation** : 
- ✅ **GitHub Actions** si vous avez déjà un repo GitHub
- ✅ **pg_cron** si précision critique et pas de repo GitHub

---

## 📚 Ressources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cron Syntax](https://crontab.guru/)
- [GitHub Actions Limits](https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration)

---

## ✅ Checklist

- [ ] Git initialisé
- [ ] Repo GitHub créé
- [ ] Code poussé vers GitHub
- [ ] Secrets configurés (SUPABASE_URL, SUPABASE_ANON_KEY)
- [ ] GitHub Actions activé
- [ ] Workflow testé manuellement
- [ ] Première exécution automatique vérifiée (lendemain)
- [ ] Notifications configurées (optionnel)

---

**Dernière mise à jour** : 11 février 2026
