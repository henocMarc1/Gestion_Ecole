# 📦 Installation des Dépendances - Génération PDF

## À faire pour activer la génération de PDF

### 1. Installer PDFKit

```bash
npm install pdfkit
npm install --save-dev @types/pdfkit
```

Ou avec yarn:
```bash
yarn add pdfkit
yarn add -D @types/pdfkit
```

### 2. Vérifier les dépendances

Après installation, votre `package.json` devrait contenir:
```json
{
  "dependencies": {
    "pdfkit": "^0.13.0",
    ...
  },
  "devDependencies": {
    "@types/pdfkit": "^0.12.0",
    ...
  }
}
```

### 3. Variables d'environnement

Assurez-vous que `.env.local` contient:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Fichiers créés

✅ **Service PDF:** `src/lib/services/pdf.ts`
- `generateBulletinPDF()` - Bulletins de scolarité
- `generateCertificatePDF()` - Certificats (scolarité, réussite, assiduité)
- `generateInvoicePDF()` - Factures

✅ **API Routes:**
- `src/app/api/pdf/bulletin/route.ts` - Endpoint bulletins
- `src/app/api/pdf/certificate/route.ts` - Endpoint certificats
- `src/app/api/pdf/invoice/route.ts` - Endpoint factures

✅ **Page Admin:**
- `src/app/dashboard/admin/documents/page.tsx` - Interface génération documents

✅ **Navigation:**
- AppShell mise à jour avec lien "Documents"

---

## 🚀 Utilisation

### Pour les administrateurs
1. Accédez à `/dashboard/admin/documents`
2. Sélectionnez un élève
3. Sélectionnez l'année académique
4. Choisissez le type de document
5. Cliquez "Générer et Télécharger"

### Via API (pour intégration personnalisée)

#### Générer un bulletin
```bash
curl -X POST http://localhost:3000/api/pdf/bulletin \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "uuid-here",
    "academicYearId": "uuid-here"
  }' \
  -o bulletin.pdf
```

#### Générer un certificat
```bash
curl -X POST http://localhost:3000/api/pdf/certificate \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "uuid-here",
    "academicYearId": "uuid-here",
    "certificateType": "scolarite"
  }' \
  -o certificate.pdf
```

Types de certificats:
- `scolarite` - Certificat de scolarité
- `reussite` - Certificat de réussite
- `assiduite` - Certificat d'assiduité

#### Générer une facture
```bash
curl -X POST http://localhost:3000/api/pdf/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "uuid-here"
  }' \
  -o invoice.pdf
```

---

## 📋 Validation des données

Avant de générer les documents, assurez-vous que:
- ✅ L'élève existe dans la base de données
- ✅ L'année académique est configurée
- ✅ Les grades sont enregistrés pour les bulletins
- ✅ La facture existe pour les factures

---

## 🎨 Personnalisation

### Modifier les templates

Pour personnaliser l'apparence des PDFs, éditez `src/lib/services/pdf.ts`:

#### Couleurs
```typescript
doc.fillColor('#your-color')
```

#### Fonts
```typescript
doc.font('Helvetica-Bold')
doc.font('Times-Roman')
```

#### Layouts
Modifiez les positions `x`, `y` et `width` dans les commandes `text()` et `moveTo()`

---

## ⚠️ Troubleshooting

### Erreur: "pdfkit is not defined"
- Vérifiez l'installation: `npm list pdfkit`
- Réinstallez si nécessaire: `npm install pdfkit`

### Erreur: "Cannot find module '@types/pdfkit'"
- Installez les types: `npm install --save-dev @types/pdfkit`

### PDFs générés mais vides
- Vérifiez que les données existent en base de données
- Consultez les logs serveur pour erreurs

### Erreurs de génération de bulletins
- Vérifiez que la table `grades` contient des données
- Vérifiez les références foreign key (student_id, academic_year_id)

---

## 📊 Fonctionnalités supportées

### Bulletins
- ✅ Notes par matière avec max_grade
- ✅ Calcul automatique des appréciations
- ✅ Moyenne générale
- ✅ Appréciations enseignant
- ✅ En-têtes école
- ✅ Formatage professionnel

### Certificats
- ✅ 3 types (scolarité, réussite, assiduité)
- ✅ Textes dynamiques basés sur type
- ✅ Infos élève complètes
- ✅ Signature directeur
- ✅ Date de génération

### Factures
- ✅ Numéro de facture
- ✅ Détail des frais
- ✅ Statut paiement (Payée, Partiel, Impayée)
- ✅ Montants colorés par statut
- ✅ Informations école et élève
- ✅ Format professionnel

---

## 🔮 Futures améliorations

- [ ] Templates personnalisables par école
- [ ] Logo école en image (actuellement texte)
- [ ] Génération batch (tous bulletins d'une classe)
- [ ] Stockage des PDFs générés
- [ ] Envoi automatique par email
- [ ] Chiffrement des PDFs
- [ ] Digital signatures

---

**Créé le:** 17 janvier 2026  
**Service PDF:** Prêt pour production
