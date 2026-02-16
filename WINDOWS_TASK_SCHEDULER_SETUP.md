# Configuration Windows Task Scheduler - Guide complet

## Étape 1 : Ouvrir le Planificateur de tâches

1. Appuyez sur `Windows + R`
2. Tapez `taskschd.msc`
3. Appuyez sur Entrée

## Étape 2 : Créer une nouvelle tâche

1. Dans le menu de droite, cliquez sur **"Créer une tâche de base..."**
2. **Nom** : `Daily Payment Check`
3. **Description** : `Vérification automatique des retards de paiement`
4. Cliquez **Suivant**

## Étape 3 : Définir le déclencheur

1. Sélectionnez **"Tous les jours"**
2. Cliquez **Suivant**
3. **Heure de début** : `08:00:00` (8h du matin)
4. **Répéter tous les** : `1` jour
5. Cliquez **Suivant**

## Étape 4 : Définir l'action

1. Sélectionnez **"Démarrer un programme"**
2. Cliquez **Suivant**
3. **Programme/script** : `powershell.exe`
4. **Ajouter des arguments** :
   ```
   -ExecutionPolicy Bypass -File "C:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE\trigger-payment-check.ps1"
   ```
5. **Démarrer dans** : 
   ```
   C:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE
   ```
6. Cliquez **Suivant**

## Étape 5 : Terminer

1. Cochez **"Ouvrir la boîte de dialogue Propriétés"**
2. Cliquez **Terminer**

## Étape 6 : Configuration avancée

Dans la fenêtre Propriétés qui s'ouvre :

### Onglet "Général"
- ✅ Cochez **"Exécuter même si l'utilisateur n'est pas connecté"**
- ✅ Cochez **"Exécuter avec les autorisations maximales"**

### Onglet "Déclencheurs"
- Vérifiez que le déclencheur quotidien à 8h00 est bien configuré

### Onglet "Conditions"
- ❌ Décochez **"Démarrer la tâche uniquement si l'ordinateur est connecté au secteur"**
- ❌ Décochez **"Arrêter si l'ordinateur fonctionne sur batterie"**

### Onglet "Paramètres"
- ✅ Cochez **"Si la tâche échoue, recommencer"**
- **Recommencer toutes les** : `15 minutes`
- **Tentatives** : `3`

Cliquez **OK**

## Étape 7 : Tester immédiatement

1. Dans la liste des tâches, trouvez **"Daily Payment Check"**
2. Clic droit → **Exécuter**
3. Vérifiez le fichier de log :
   ```powershell
   Get-Content "C:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE\payment-check.log" -Tail 10
   ```

## Vérifier l'historique

```powershell
# Voir les dernières exécutions
Get-ScheduledTask -TaskName "Daily Payment Check" | Get-ScheduledTaskInfo

# Voir le log détaillé
Get-Content "C:\Users\AA\OneDrive - PIGIER CÔTE D'IVOIRE\Bureau\ECOLE\payment-check.log"
```

## Désactiver/Supprimer la tâche

```powershell
# Désactiver
Disable-ScheduledTask -TaskName "Daily Payment Check"

# Réactiver
Enable-ScheduledTask -TaskName "Daily Payment Check"

# Supprimer
Unregister-ScheduledTask -TaskName "Daily Payment Check" -Confirm:$false
```

---

## ✅ Avantages Windows Task Scheduler

- ✅ 100% local (pas de dépendance externe)
- ✅ Gratuit et fiable
- ✅ Fonctionne même si votre PC est en veille (avec les bons paramètres)
- ✅ Logs détaillés dans payment-check.log
- ✅ Peut relancer automatiquement en cas d'échec

## ⚠️ Inconvénient

- ❌ Nécessite que votre PC Windows soit allumé à 8h00 tous les jours
- Solution : Utilisez GitHub Actions ou pg_cron à la place si votre PC n'est pas toujours allumé
