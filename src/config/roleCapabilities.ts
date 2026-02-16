export type RoleId =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SECRETARY'
  | 'ACCOUNTANT'
  | 'TEACHER'
  | 'PARENT';

export interface CapabilityGroup {
  title: string;
  items: string[];
}

export interface RoleCapabilities {
  role: RoleId;
  label: string;
  missions: string[];
  capabilities: CapabilityGroup[];
  restrictions: string[];
}

export const ROLE_CAPABILITIES: RoleCapabilities[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    missions: [
      'Gouvernance technique et sécurité',
      'Gestion centrale des comptes et rôles',
      'Supervision complète des données',
    ],
    capabilities: [
      {
        title: 'Comptes & sécurité',
        items: [
          'Créer / modifier / désactiver tous les comptes',
          'Réinitialiser mots de passe et forcer le changement',
          'Définir les rôles et activer/désactiver l’accès',
        ],
      },
      {
        title: 'Paramétrage global',
        items: [
          "Définir l'année scolaire active",
          'Créer niveaux (PS, MS, GS, CP, CE1…)',
          'Configurer types de frais et modèles de factures/reçus',
          'Configurer les moyens de paiement',
        ],
      },
      {
        title: 'Supervision',
        items: [
          'Accès à toutes les données',
          'Dashboard global (effectif, présence, encaissé/impayés)',
          'Accès aux logs et audit',
        ],
      },
    ],
    restrictions: ['Pas de saisie pédagogique quotidienne (sauf dépannage)'],
  },
  {
    role: 'ADMIN',
    label: 'Admin / Directeur',
    missions: [
      'Pilotage académique et organisation',
      'Supervision pédagogique et administrative',
      'Validation et communication globale',
    ],
    capabilities: [
      {
        title: 'Gestion académique',
        items: [
          'Créer / modifier classes et affecter enseignants',
          'Gérer calendrier scolaire',
          'Gérer examens et évaluations',
          'Suivre performances par classe',
        ],
      },
      {
        title: 'Gestion élèves',
        items: [
          'Valider inscriptions et transferts',
          'Suivre discipline / incidents',
          'Consulter dossiers complets élèves',
        ],
      },
      {
        title: 'Rapports & communication',
        items: [
          'Rapports présences (quotidien / mensuel)',
          'Rapports pédagogiques et synthèses hebdomadaires',
          'Statistiques par niveau',
          'Messages globaux et annonces officielles',
        ],
      },
    ],
    restrictions: ['Pas de gestion directe des paiements'],
  },
  {
    role: 'SECRETARY',
    label: 'Secrétariat',
    missions: [
      'Gestion administrative quotidienne',
      'Inscriptions et dossiers élèves',
      'Communication parents',
    ],
    capabilities: [
      {
        title: 'Admissions & scolarité',
        items: [
          'Enregistrer inscriptions et dossiers',
          'Ajouter pièces justificatives',
          'Affecter élèves aux classes et gérer changements',
        ],
      },
      {
        title: 'Documents',
        items: [
          'Générer certificats (scolarité, présence)',
          'Générer attestations et export PDF',
        ],
      },
      {
        title: 'Communication',
        items: [
          'Messages ciblés aux parents',
          'Notifications administratives',
          'Relances dossiers incomplets',
        ],
      },
    ],
    restrictions: ['Lecture seule sur paiements', 'Aucune modification financière'],
  },
  {
    role: 'ACCOUNTANT',
    label: 'Comptable',
    missions: ['Facturation', 'Paiements', 'Reporting financier'],
    capabilities: [
      {
        title: 'Facturation',
        items: [
          'Créer frais et générer factures (individuelles/groupées)',
          'Appliquer remises',
          'Gérer échéanciers',
        ],
      },
      {
        title: 'Paiements',
        items: [
          'Enregistrer paiements et générer reçus PDF',
          'Gérer annulations avec motif',
          'Suivre impayés',
        ],
      },
      {
        title: 'Rapports',
        items: [
          'Recettes par période',
          'État des impayés',
          'Export comptable (CSV / Excel)',
        ],
      },
    ],
    restrictions: ['Pas d’accès pédagogique', 'Pas de modification dossiers élèves'],
  },
  {
    role: 'TEACHER',
    label: 'Enseignant',
    missions: [
      'Suivi quotidien des élèves',
      'Présence et observations pédagogiques',
      'Communication avec les parents de ses classes',
    ],
    capabilities: [
      {
        title: 'Classes',
        items: [
          'Voir uniquement ses classes et leurs élèves',
          'Accès fiche élève (lecture pédagogique)',
        ],
      },
      {
        title: 'Présence',
        items: [
          'Marquer présence quotidienne',
          'Justifier absences, modifiable sous 48h',
        ],
      },
      {
        title: 'Pédagogie',
        items: [
          'Observations, devoirs, ressources',
          'Notes / évaluations',
          'Historique pédagogique',
        ],
      },
      {
        title: 'Communication',
        items: ['Messages aux parents de ses classes', 'Annonces de classe'],
      },
    ],
    restrictions: ['Pas d’accès financier', 'Pas d’accès aux autres classes'],
  },
  {
    role: 'PARENT',
    label: 'Parent',
    missions: ['Suivi de la scolarité', 'Régler les frais', 'Communication école'],
    capabilities: [
      {
        title: 'Enfants',
        items: [
          'Voir fiches enfants, classe, emploi du temps',
          'Suivre présence, notes et devoirs',
        ],
      },
      {
        title: 'Paiements',
        items: ['Consulter factures', 'Payer en ligne', 'Télécharger reçus'],
      },
      {
        title: 'Communication & autorisations',
        items: [
          'Messages enseignants / administration',
          'Notifications absences & échéances',
          'Signer autorisations, mettre à jour contacts d’urgence',
        ],
      },
    ],
    restrictions: ['Lecture seule sur données académiques', 'Aucun accès à d’autres élèves'],
  },
];
