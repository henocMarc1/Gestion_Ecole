# Guide d'Utilisation - Système de Gestion Scolaire

## Table des matières
1. [Connexion et Inscription](#connexion-et-inscription)
2. [Rôles et Permissions](#rôles-et-permissions)
3. [Guide par Rôle](#guide-par-rôle)
4. [Fonctionnalités Communes](#fonctionnalités-communes)

---

## Connexion et Inscription

### Première Connexion
1. Accédez à l'URL de l'application
2. Cliquez sur **"Connexion"**
3. Entrez vos identifiants :
   - Email professionnel
   - Mot de passe

### Inscription d'une École (Super Admin uniquement)
1. Le Super Admin crée l'école depuis son tableau de bord
2. Lors de la création, un compte administrateur est automatiquement créé pour l'école
3. Les identifiants sont fournis à l'administrateur de l'école

### Changement de Mot de Passe Obligatoire
- Les nouveaux comptes (parents, enseignants) doivent changer leur mot de passe à la première connexion
- Le mot de passe par défaut pour les parents est : **`Parent123!`**
- Suivez les instructions à l'écran pour définir un nouveau mot de passe sécurisé

---

## Rôles et Permissions

### 🔴 Super Administrateur (SUPER_ADMIN)
- Gestion globale de toutes les écoles
- Création et configuration des écoles
- Gestion de tous les comptes utilisateurs
- Accès aux statistiques globales

### 🟠 Administrateur d'École (ADMIN)
- Gestion complète de son école
- Gestion des élèves, classes et années scolaires
- Gestion du personnel (enseignants, secrétaires, comptables, RH)
- Accès aux rapports et statistiques de l'école

### 🟢 Enseignant (TEACHER)
- Consultation de ses classes assignées
- Gestion des présences
- Saisie des notes et évaluations
- Consultation de l'emploi du temps
- Communication avec les parents

### 🔵 Parent (PARENT)
- Suivi de la scolarité de ses enfants
- Consultation des notes et bulletins
- Consultation et paiement des factures
- Communication avec les enseignants et l'administration
- Accès à l'emploi du temps

### 🟡 Secrétaire (SECRETARY)
- Gestion des inscriptions
- Création et envoi des factures
- Gestion des documents administratifs
- Communication avec les parents

### 🟣 Comptable (ACCOUNTANT)
- Gestion des factures et paiements
- Enregistrement des règlements
- Envoi de rappels de paiement
- Génération de rapports financiers

### 🟤 Ressources Humaines (HR)
- Gestion du personnel
- Affectation des enseignants aux classes
- Suivi des présences du personnel
- Génération de rapports RH

---

## Guide par Rôle

## 👨‍💼 ADMINISTRATEUR D'ÉCOLE

### Tableau de Bord
Le tableau de bord affiche :
- Nombre total d'élèves, classes, enseignants et utilisateurs
- Actions rapides pour accéder aux fonctionnalités principales

### 📚 Gestion des Années Scolaires
**Navigation :** Menu > Années Scolaires

1. **Créer une année scolaire**
   - Cliquez sur **"+ Nouvelle année"**
   - Renseignez : Nom, Date de début, Date de fin
   - Cochez **"Année active"** si c'est l'année en cours
   - Validez

2. **Gérer les années**
   - Une seule année peut être active à la fois
   - Les années passées restent accessibles en consultation

### 👥 Gestion des Élèves
**Navigation :** Menu > Élèves

1. **Inscrire un élève**
   - Cliquez sur **"+ Nouvel élève"**
   - Renseignez les informations de l'élève :
     * Prénom, Nom
     * Date de naissance
     * Genre
     * Classe
   - Renseignez les informations du parent/tuteur :
     * Prénom, Nom
     * Email (obligatoire)
     * Téléphone
   - Validez

   **Important :** 
   - Si le parent existe déjà dans le système (même email), l'élève sera lié au parent existant
   - Si le parent n'existe pas, un compte sera automatiquement créé avec :
     * Email : celui fourni
     * Mot de passe : `Parent123!`
     * Le parent devra changer ce mot de passe à sa première connexion
   - Un matricule unique est généré automatiquement

2. **Consulter les détails d'un élève**
   - Cliquez sur un élève dans la liste
   - Consultez : informations personnelles, classe, parents
   - Changez la classe si nécessaire

3. **Rechercher des élèves**
   - Utilisez la barre de recherche pour filtrer par nom
   - Filtrez par classe avec le menu déroulant

### 🏫 Gestion des Classes
**Navigation :** Menu > Classes

1. **Créer une classe**
   - Cliquez sur **"+ Nouvelle classe"**
   - Renseignez : Nom, Niveau, Capacité max
   - Assignez l'année scolaire
   - Validez

2. **Gérer les classes**
   - Modifiez les informations
   - Désactivez les classes obsolètes

### 👨‍🏫 Gestion du Personnel
**Navigation :** Menu > Utilisateurs

1. **Ajouter un membre du personnel**
   - Cliquez sur **"+ Nouvel utilisateur"**
   - Choisissez le rôle : Enseignant, Secrétaire, Comptable, RH
   - Renseignez : Nom complet, Email, Téléphone
   - Le système génère un mot de passe temporaire
   - Envoyez les identifiants au nouveau membre

2. **Affecter un enseignant à une classe**
   - Allez dans la section RH ou Classes
   - Sélectionnez la classe
   - Assignez l'enseignant principal et/ou les intervenants

### 📊 Rapports et Statistiques
**Navigation :** Menu > Rapports

- Consultez les statistiques de l'école
- Exportez des listes (élèves, personnel)
- Générez des rapports PDF

---

## 👨‍🏫 ENSEIGNANT

### Tableau de Bord
- Visualisez vos classes et le nombre d'élèves
- Accédez rapidement aux présences et à la liste des élèves

### ✅ Gestion des Présences
**Navigation :** Menu > Présences

1. **Marquer les présences**
   - Sélectionnez la classe
   - Sélectionnez la date (aujourd'hui par défaut)
   - Cochez **Présent** ou **Absent** pour chaque élève
   - Ajoutez des commentaires si nécessaire
   - Enregistrez

2. **Consulter l'historique**
   - Filtrez par date et classe
   - Exportez les rapports de présence

### 📝 Gestion des Notes
**Navigation :** Menu > Notes

1. **Saisir les notes**
   - Sélectionnez la classe
   - Sélectionnez la matière
   - Sélectionnez le type d'évaluation (Devoir, Composition, etc.)
   - Saisissez la note pour chaque élève (sur 20)
   - Ajoutez des appréciations
   - Enregistrez

2. **Consulter les bulletins**
   - Visualisez les moyennes par matière
   - Exportez les bulletins en PDF

### 👥 Consultation des Élèves
**Navigation :** Menu > Mes Élèves

- Consultez la liste de vos élèves
- Accédez aux informations de contact des parents
- Consultez l'historique de présence

### 📅 Emploi du Temps
**Navigation :** Menu > Emploi du Temps

- Consultez votre emploi du temps hebdomadaire
- Visualisez vos cours et salles assignées

---

## 👨‍👩‍👧 PARENT

### Tableau de Bord
- Visualisez vos enfants et leurs classes
- Consultez les factures en attente
- Accédez aux derniers paiements

### 👶 Suivi des Enfants
**Navigation :** Tableau de bord > Carte enfant

- Consultez les informations de chaque enfant
- Visualisez leur classe et statut

### 📊 Consultation des Notes
**Navigation :** Menu > Notes & Bulletins

1. **Consulter les notes**
   - Sélectionnez votre enfant
   - Visualisez les notes par matière
   - Consultez les appréciations des enseignants

2. **Télécharger les bulletins**
   - Sélectionnez le trimestre/semestre
   - Téléchargez le bulletin en PDF

### ✅ Consultation des Présences
**Navigation :** Menu > Présences

- Consultez l'historique des présences
- Visualisez le taux de présence
- Filtrez par période

### 💰 Gestion des Factures et Paiements
**Navigation :** Menu > Factures

1. **Consulter les factures**
   - Visualisez toutes les factures (payées, en attente, en retard)
   - Consultez les détails de chaque facture
   - Téléchargez les factures en PDF

2. **Suivre les paiements**
   - Consultez l'historique des paiements
   - Téléchargez les reçus

**Important :** Les paiements sont enregistrés par le secrétariat ou la comptabilité. Contactez l'école pour effectuer un paiement.

### 📅 Emploi du Temps
**Navigation :** Menu > Planning

- Consultez l'emploi du temps de votre enfant
- Visualisez les cours par jour

### 💬 Messages
**Navigation :** Menu > Messages

- Envoyez des messages à l'administration
- Communiquez avec les enseignants
- Consultez l'historique des échanges

### 🔐 Changement de Mot de Passe
**Première connexion obligatoire**

1. À la première connexion, une fenêtre s'affiche automatiquement
2. Entrez le nouveau mot de passe (minimum 6 caractères)
3. Confirmez le nouveau mot de passe
4. Validez
5. Vous êtes redirigé vers votre tableau de bord

---

## 👔 SECRÉTAIRE

### Tableau de Bord
- Nombre d'élèves inscrits
- Factures en attente
- Messages et documents

### 📝 Gestion des Inscriptions
**Navigation :** Menu > Élèves

- Inscrivez les nouveaux élèves (même processus que l'admin)
- Gérez les dossiers administratifs
- Mettez à jour les informations

### 💰 Gestion des Factures
**Navigation :** Menu > Factures

1. **Créer une facture**
   - Sélectionnez l'élève
   - Choisissez le type de facture (Scolarité, Cantine, etc.)
   - Renseignez le montant
   - Définissez la date d'échéance
   - Envoyez la facture (email automatique au parent)

2. **Relancer les factures**
   - Filtrez les factures en retard
   - Envoyez des rappels automatiques par email

### 💬 Communication
**Navigation :** Menu > Messages

- Répondez aux messages des parents
- Envoyez des communications générales
- Gérez les demandes d'informations

---

## 💼 COMPTABLE

### Tableau de Bord
- Total des factures et montants
- Factures payées vs en attente
- Revenus totaux

### 💰 Gestion des Paiements
**Navigation :** Menu > Paiements

1. **Enregistrer un paiement**
   - Sélectionnez la facture
   - Renseignez le montant reçu
   - Choisissez le mode de paiement (Espèces, Virement, Chèque, Mobile Money)
   - Ajoutez une référence
   - Enregistrez

2. **Générer un reçu**
   - Le reçu est généré automatiquement
   - Téléchargez et imprimez le reçu
   - Envoyez le reçu par email au parent

### 📊 Rapports Financiers
**Navigation :** Menu > Rapports

- Consultez les statistiques financières
- Exportez les rapports comptables
- Visualisez les graphiques de revenus

### 💳 Suivi des Factures
**Navigation :** Menu > Factures

- Consultez toutes les factures
- Filtrez par statut (Payée, En attente, En retard)
- Envoyez des rappels de paiement

---

## 👥 RESSOURCES HUMAINES (RH)

### Tableau de Bord
- Personnel total et par rôle
- Enseignants et classes actives
- Présences du jour

### 👨‍💼 Gestion du Personnel
**Navigation :** Menu > Personnel (onglet Personnel)

1. **Consulter le personnel**
   - Visualisez tous les membres du personnel
   - Filtrez par rôle
   - Recherchez par nom

2. **Gérer le statut**
   - Activez/Désactivez des comptes
   - Supprimez des membres (soft delete)

### 📚 Affectation des Classes
**Navigation :** Menu > Personnel (onglet Affectations)

1. **Assigner un enseignant**
   - Visualisez toutes les affectations
   - Définissez l'enseignant principal de chaque classe
   - Ajoutez des intervenants pour des matières spécifiques

2. **Gérer les affectations**
   - Modifiez les assignments
   - Supprimez les affectations obsolètes

### 📊 Rapports RH
**Navigation :** Menu > Personnel (onglet Rapports)

- Générez des rapports du personnel
- Exportez des listes en PDF/Excel
- Consultez les statistiques détaillées

---

## 🔴 SUPER ADMINISTRATEUR

### Tableau de Bord Global
- Total des écoles actives
- Total des utilisateurs et élèves
- Statut du système

### 🏫 Gestion des Écoles
**Navigation :** Menu > Écoles

1. **Créer une école**
   - Cliquez sur **"+ Nouvelle école"**
   - Renseignez :
     * Nom de l'école
     * Adresse complète
     * Téléphone, Email
     * Cochez **"École active"**
   - Lors de la création, un compte ADMIN est créé automatiquement
   - Notez les identifiants de connexion pour les transmettre à l'école

2. **Gérer les écoles**
   - Activez/Désactivez des écoles
   - Modifiez les informations
   - Consultez les statistiques par école

### 👥 Gestion Globale des Comptes
**Navigation :** Menu > Tous les Comptes

- Consultez tous les utilisateurs de toutes les écoles
- Filtrez par école et par rôle
- Gérez les accès et permissions

### 🔧 Configuration Système
**Navigation :** Menu > Paramètres

- Configurez les paramètres globaux
- Gérez les sauvegardes
- Consultez les logs système

---

## Fonctionnalités Communes

### 🔔 Notifications
- Recevez des notifications en temps réel
- Consultez vos notifications dans le menu en haut à droite
- Les notifications incluent : nouveaux messages, factures, rappels

### 👤 Profil Utilisateur
**Navigation :** Menu > Profil

1. **Mettre à jour vos informations**
   - Modifiez votre nom, téléphone
   - Mettez à jour votre email

2. **Changer votre mot de passe**
   - Entrez l'ancien mot de passe
   - Définissez le nouveau mot de passe
   - Confirmez et enregistrez

### 🌐 Navigation
- **Menu latéral** : Accédez à toutes les fonctionnalités
- **Fil d'Ariane** : Visualisez votre position dans l'application
- **Bouton Retour** : Revenez à la page précédente

### 🔍 Recherche et Filtres
- Utilisez les barres de recherche pour trouver rapidement
- Appliquez des filtres pour affiner les résultats
- Exportez les données filtrées

### 📱 Version Mobile
- L'application est responsive et fonctionne sur mobile
- Toutes les fonctionnalités sont accessibles
- Interface optimisée pour les petits écrans

---

## Bonnes Pratiques

### Sécurité
✅ Changez votre mot de passe régulièrement
✅ Ne partagez jamais vos identifiants
✅ Déconnectez-vous après chaque session
✅ Vérifiez toujours l'URL de l'application

### Saisie des Données
✅ Vérifiez les informations avant de valider
✅ Utilisez des emails valides pour recevoir les notifications
✅ Renseignez les numéros de téléphone au format international
✅ Enregistrez régulièrement vos modifications

### Communication
✅ Soyez professionnel dans vos messages
✅ Répondez rapidement aux demandes
✅ Utilisez les canaux appropriés (messages, email)
✅ Gardez une trace écrite des échanges importants

---

## Support et Assistance

### Besoin d'Aide ?
- Contactez votre administrateur d'école
- Consultez ce guide d'utilisation
- Envoyez un message via l'application

### Problèmes Techniques
- Vérifiez votre connexion internet
- Actualisez la page (F5)
- Videz le cache de votre navigateur
- Contactez le support technique si le problème persiste

### Suggestions d'Amélioration
- Vos retours sont importants !
- Contactez l'administration pour partager vos idées
- Signalez les bugs ou comportements anormaux

---

**Dernière mise à jour :** Janvier 2026
**Version :** 1.0.0
