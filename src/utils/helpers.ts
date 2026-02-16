import { format, parseISO, formatDistance, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Formater une date en format français
 */
export function formatDate(date: string | Date, pattern: string = 'dd/MM/yyyy'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return format(dateObj, pattern, { locale: fr });
  } catch {
    return '';
  }
}

/**
 * Formater une date avec l'heure
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd/MM/yyyy à HH:mm');
}

/**
 * Formater une date relative (il y a X jours)
 */
export function formatRelativeDate(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return formatDistance(dateObj, new Date(), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

/**
 * Formater un montant en FCFA
 */
export function formatCurrency(amount: number, currency: string = 'XOF'): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/[\u202F\u00A0]/g, ' ');

  if (currency === 'XOF') {
    return `${formatted} F CFA`;
  }

  return `${formatted} ${currency}`;
}

/**
 * Formater un nombre
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Calculer l'âge à partir d'une date de naissance
 */
export function calculateAge(dateOfBirth: string | Date): number {
  const today = new Date();
  const birthDate = typeof dateOfBirth === 'string' ? parseISO(dateOfBirth) : dateOfBirth;
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Tronquer un texte
 */
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Capitaliser la première lettre
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Obtenir les initiales d'un nom
 */
export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Générer une couleur à partir d'une chaîne
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    '#f0701d', // primary
    '#0ea5e9', // secondary
    '#d946ef', // accent
    '#22c55e', // success
    '#f59e0b', // warning
    '#ef4444', // danger
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Valider un email
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Valider un numéro de téléphone ivoirien
 */
export function isValidIvoryCoastPhone(phone: string): boolean {
  // Format: +225 XX XX XX XX XX ou 0X XX XX XX XX
  const re = /^(\+225|0)[0-9]{10}$/;
  return re.test(phone.replace(/\s/g, ''));
}

/**
 * Formater un numéro de téléphone
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  
  if (cleaned.startsWith('+225')) {
    const num = cleaned.substring(4);
    return `+225 ${num.substring(0, 2)} ${num.substring(2, 4)} ${num.substring(4, 6)} ${num.substring(6, 8)} ${num.substring(8, 10)}`;
  }
  
  if (cleaned.startsWith('0')) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}`;
  }
  
  return phone;
}

/**
 * Générer un slug à partir d'un texte
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Vérifier si une date est dans la fenêtre de 48h
 */
export function isWithin48Hours(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return diffInHours <= 48;
}

/**
 * Obtenir le nom du mois en français
 */
export function getMonthName(monthIndex: number): string {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return months[monthIndex];
}

/**
 * Obtenir l'année scolaire actuelle
 */
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Si on est avant septembre, on est dans l'année N-1 / N
  if (month < 8) {
    return `${year - 1}-${year}`;
  }
  
  // Sinon, on est dans l'année N / N+1
  return `${year}-${year + 1}`;
}

/**
 * Exporter des données en CSV
 */
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Échapper les valeurs contenant des virgules ou des guillemets
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Combiner des classes CSS (helper pour clsx)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
