import { test, expect } from '@playwright/test';

/**
 * Tests E2E pour le flow d'authentification et redirection
 */

test.describe('Authentication Flow', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should login as teacher and redirect to teacher dashboard', async ({ page }) => {
    await page.goto('/login');

    // Remplir le formulaire de connexion
    await page.fill('input[type="email"]', 'enseignant1@ecole-etoiles.ci');
    await page.fill('input[type="password"]', 'Test123456!');
    
    // Soumettre
    await page.click('button[type="submit"]');

    // Attendre la redirection
    await page.waitForURL(/\/dashboard\/teacher/, { timeout: 5000 });
    
    // Vérifier qu'on est bien sur le dashboard enseignant
    await expect(page).toHaveURL(/\/dashboard\/teacher/);
    await expect(page.locator('h1')).toContainText('Bonjour');
  });

  test('should login as parent and redirect to parent dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'parent.yao@gmail.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard\/parent/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard\/parent/);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Vérifier qu'on reste sur la page de login
    await expect(page).toHaveURL(/\/login/);
    
    // Vérifier qu'un message d'erreur apparaît (via toast)
    await expect(page.locator('text=Identifiants incorrects')).toBeVisible({ timeout: 3000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login d'abord
    await page.goto('/login');
    await page.fill('input[type="email"]', 'enseignant1@ecole-etoiles.ci');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Cliquer sur le bouton de déconnexion
    await page.click('button:has-text("Déconnexion")');

    // Vérifier la redirection vers login
    await page.waitForURL(/\/login/, { timeout: 3000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Teacher - Mark Attendance', () => {
  test.beforeEach(async ({ page }) => {
    // Login en tant qu'enseignant
    await page.goto('/login');
    await page.fill('input[type="email"]', 'enseignant1@ecole-etoiles.ci');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('should navigate to attendance page', async ({ page }) => {
    await page.click('text=Présences');
    await expect(page).toHaveURL(/\/dashboard\/attendance/);
  });

  test('should see only assigned classes', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    
    // Vérifier que la classe CP1 A est visible (classe de l'enseignant)
    await expect(page.locator('text=CP1 A')).toBeVisible();
    
    // Vérifier qu'on ne voit pas d'autres classes
    await expect(page.locator('text=CE2 B')).not.toBeVisible();
  });

  test('should mark attendance for today', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    
    // Sélectionner la classe
    await page.click('text=CP1 A');
    
    // Marquer un élève présent
    const firstStudent = page.locator('[data-testid="student-row"]').first();
    await firstStudent.locator('[data-status="present"]').click();
    
    // Sauvegarder
    await page.click('button:has-text("Enregistrer")');
    
    // Vérifier le message de succès
    await expect(page.locator('text=Présence enregistrée')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Parent - View Invoices', () => {
  test.beforeEach(async ({ page }) => {
    // Login en tant que parent
    await page.goto('/login');
    await page.fill('input[type="email"]', 'parent.yao@gmail.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('should see own children only', async ({ page }) => {
    await page.goto('/dashboard/parent');
    
    // Vérifier que les enfants du parent sont visibles
    await expect(page.locator('text=Kouadio Yao')).toBeVisible();
    await expect(page.locator('text=Amenan Yao')).toBeVisible();
  });

  test('should view pending invoices', async ({ page }) => {
    await page.goto('/dashboard/parent');
    
    // Vérifier la section des factures en attente
    await expect(page.locator('text=Factures en attente')).toBeVisible();
    
    // Vérifier qu'il y a au moins une facture (ou message "Aucune facture")
    const noPendingMessage = page.locator('text=Aucune facture en attente');
    const invoiceList = page.locator('[data-testid="pending-invoices"]');
    
    await expect(noPendingMessage.or(invoiceList)).toBeVisible();
  });

  test('should view payment history', async ({ page }) => {
    await page.goto('/dashboard/parent');
    
    await expect(page.locator('text=Paiements récents')).toBeVisible();
  });
});

test.describe('Accountant - Create Payment', () => {
  test.beforeEach(async ({ page }) => {
    // Login en tant que comptable
    await page.goto('/login');
    await page.fill('input[type="email"]', 'comptable@ecole-etoiles.ci');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('should navigate to payments page', async ({ page }) => {
    await page.click('text=Paiements');
    await expect(page).toHaveURL(/\/dashboard\/payments/);
  });

  test('should create a new payment', async ({ page }) => {
    await page.goto('/dashboard/payments');
    
    // Cliquer sur "Nouveau paiement"
    await page.click('button:has-text("Nouveau")');
    
    // Remplir le formulaire
    await page.fill('[name="amount"]', '50000');
    await page.selectOption('[name="payment_method"]', 'MOBILE_MONEY');
    
    // Soumettre
    await page.click('button:has-text("Enregistrer")');
    
    // Vérifier le succès
    await expect(page.locator('text=Paiement créé avec succès')).toBeVisible({ timeout: 3000 });
  });

  test('should generate receipt PDF', async ({ page }) => {
    await page.goto('/dashboard/payments');
    
    // Trouver un paiement existant
    const firstPayment = page.locator('[data-testid="payment-row"]').first();
    
    // Cliquer sur "Générer reçu"
    await firstPayment.locator('button:has-text("Reçu")').click();
    
    // Attendre le téléchargement ou l'affichage du PDF
    const downloadPromise = page.waitForEvent('download');
    
    // Vérifier que le téléchargement démarre
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/recept_.*\.pdf/);
  });
});

test.describe('Security - RLS Enforcement', () => {
  test('teacher should not access other classes data', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'enseignant1@ecole-etoiles.ci');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Aller sur la page des classes
    await page.goto('/dashboard/classes');
    
    // Vérifier que seule la classe assignée est visible
    await expect(page.locator('text=CP1 A')).toBeVisible();
    
    // Essayer d'accéder directement à une autre classe (pas assignée)
    // Devrait être refusé ou ne rien afficher
    const otherClassId = 'c2222222-2222-2222-2222-222222222222'; // CE2 B
    await page.goto(`/dashboard/classes/${otherClassId}`);
    
    // Devrait rediriger ou afficher une erreur
    await expect(
      page.locator('text=Non autorisé').or(page.locator('text=Classe non trouvée'))
    ).toBeVisible({ timeout: 3000 });
  });

  test('parent should not access other students data', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'parent.yao@gmail.com');
    await page.fill('input[type="password"]', 'Test123456!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Essayer d'accéder à un élève qui n'est pas le sien
    const otherStudentId = 's5555555-5555-5555-5555-555555555555'; // Élève d'un autre parent
    await page.goto(`/dashboard/students/${otherStudentId}`);
    
    // Devrait être refusé
    await expect(
      page.locator('text=Non autorisé').or(page.locator('text=Élève non trouvé'))
    ).toBeVisible({ timeout: 3000 });
  });
});
