/**
 * Utilitaires pour exporter les données en PDF et CSV
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fonction pour charger le logo de l'école
async function loadSchoolLogo(): Promise<string | null> {
  try {
    // Essayer de charger le logo depuis /school-logo.png
    const response = await fetch('/school-logo.png');
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.log('Logo PNG non trouvé, essai JPG...');
  }

  try {
    // Essayer avec .jpg
    const response = await fetch('/school-logo.jpg');
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.log('Logo non trouvé');
  }

  return null;
}

/**
 * Exporte un tableau de données en CSV
 */
export function exportToCSV(
  data: any[],
  filename: string,
  columns?: string[]
) {
  if (data.length === 0) {
    console.warn('Aucune donnée à exporter');
    return;
  }

  // Déterminer les colonnes
  const cols = columns || Object.keys(data[0]);
  
  // Créer l'en-tête CSV
  const header = cols.map(col => `"${col}"`).join(',');
  
  // Créer les lignes CSV
  const rows = data.map(row =>
    cols.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      return `"${value}"`;
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  // Vérifier si le filename a déjà l'extension
  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  downloadFile(csv, finalFilename, 'text/csv');
}

export async function exportToExcel(
  data: any[],
  filename: string,
  columns?: string[]
) {
  if (data.length === 0) {
    console.warn('Aucune donnée à exporter');
    return;
  }

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const response = await fetch('/api/export/excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data,
      filename: finalFilename,
      columns,
    }),
  });

  if (!response.ok) {
    throw new Error('Erreur téléchargement Excel');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Exporte un tableau en PDF simple (texte)
 */
export function exportToPDF(
  data: any[],
  filename: string,
  title: string,
  columns?: string[]
) {
  if (data.length === 0) {
    console.warn('Aucune donnée à exporter');
    return;
  }

  const cols = columns || Object.keys(data[0]);
  
  // Créer le contenu PDF en texte simple
  let content = `%PDF-1.4\n`;
  content += `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  content += `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  content += `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n`;
  content += `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  
  // Créer le contenu du document
  let textContent = `BT\n/F1 12 Tf\n50 750 Td\n(${title}) Tj\nET\n`;
  textContent += `BT\n/F1 10 Tf\n50 730 Td\n`;
  
  // Ajouter le tableau
  let yPos = 710;
  textContent += `(${cols.join(' | ')}) Tj\nET\n`;
  
  data.forEach(row => {
    yPos -= 15;
    const rowText = cols.map(col => String(row[col] || '')).join(' | ');
    textContent += `BT\n/F1 9 Tf\n50 ${yPos} Td\n(${rowText}) Tj\nET\n`;
  });
  
  content += `5 0 obj\n<< /Length ${textContent.length} >>\nstream\n${textContent}\nendstream\nendobj\n`;
  content += `xref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000229 00000 n\n0000000318 00000 n\n`;
  content += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${content.length}\n%%EOF`;

  downloadFile(content, `${filename}.pdf`, 'application/pdf');
}

/**
 * Génère un PDF simple avec jsPDF si disponible
 */
export function generateSimplePDF(
  title: string,
  headers: string[],
  rows: any[][],
  filename: string
) {
  // Créer HTML pour impression
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background-color: #4CAF50; color: white; padding: 12px; text-align: left; }
        td { border: 1px solid #ddd; padding: 8px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', 'height=600,width=800');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  }
}

/**
 * Télécharge un fichier
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  try {
    // Pour CSV, ajouter BOM UTF-8
    let contentToDownload = content;
    if (mimeType === 'text/csv') {
      contentToDownload = '\ufeff' + content;
    }
    
    // Créer un Blob avec encodage correct
    const bytes = new TextEncoder().encode(contentToDownload);
    const blob = new Blob([bytes], { type: `${mimeType};charset=utf-8` });
    
    // Créer une URL blob
    const blobUrl = URL.createObjectURL(blob);
    
    // Créer un lien et déclencher le téléchargement
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    
    // Important: ajouter au DOM avant le click pour Edge
    document.body.appendChild(link);
    
    // Déclencher le clic
    link.click();
    
    // Nettoyer
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (error) {
    console.error('Erreur téléchargement:', error);
  }
}

/**
 * Exporte JSON
 */
export function exportToJSON(data: any[], filename: string) {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

/**
 * Génère un PDF professionnel avec jsPDF et autoTable
 */
export async function exportToPDFTable(
  title: string,
  headers: string[],
  rows: any[][],
  filename: string,
  options?: {
    schoolName?: string;
    schoolLogo?: string;
    schoolAddress?: string;
    schoolPhone?: string;
    subtitle?: string;
    addNumbering?: boolean;
    stats?: { total: number; boys: number; girls: number };
  }
) {
  const doc = new jsPDF('l', 'mm', 'a4'); // landscape, millimeters, A4
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let startY = 15;
  
  // Charger et dessiner le logo de l'école (design des reçus)
  try {
    const logoDataUrl = await loadSchoolLogo();
    if (logoDataUrl) {
      // Logo à gauche comme dans les reçus
      doc.addImage(logoDataUrl, 'PNG', 14, 10, 30, 30);
      console.log('Logo ajouté au PDF');
    }
  } catch (e) {
    console.log('Logo non chargé:', e);
  }
  
  // Statistiques à droite
  if (options?.stats) {
    const statsBoxX = pageWidth - 60; // à droite
    const statsBoxY = 10;
    const statsWidth = 50;
    
    // Boîte de statistiques
    doc.setDrawColor(37, 99, 235); // bleu
    doc.setLineWidth(0.8);
    doc.rect(statsBoxX, statsBoxY, statsWidth, 22);
    
    // Remplissage léger
    doc.setFillColor(240, 248, 255); // bleu ciel très clair
    doc.rect(statsBoxX, statsBoxY, statsWidth, 22, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // bleu
    doc.text(`Total: ${options.stats.total}`, statsBoxX + 2, statsBoxY + 5);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Garçons: ${options.stats.boys}`, statsBoxX + 2, statsBoxY + 11);
    doc.text(`Filles: ${options.stats.girls}`, statsBoxX + 2, statsBoxY + 15);
  }
  
  const schoolName = options?.schoolName || 'Groupe Scolaire Gnamien-Assa';
  const schoolAddress = options?.schoolAddress || 'Bingerville (Cefal après Adjamé-Bingerville)';
  const schoolPhone = options?.schoolPhone || '+225 0707905958';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("REPUBLIQUE DE CÔTE D'IVOIRE", pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Union – Discipline – Travail', pageWidth / 2, 21, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName, pageWidth / 2, 29, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (schoolAddress) {
    doc.text(schoolAddress, pageWidth / 2, 35, { align: 'center' });
  }
  if (schoolPhone) {
    doc.text(`Tél: ${schoolPhone}`, pageWidth / 2, 41, { align: 'center' });
  }

  // Ligne de séparation
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(10, 46, pageWidth - 10, 46);

  // Titre du document
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(title.toUpperCase(), pageWidth / 2, 56, { align: 'center' });

  doc.line(10, 62, pageWidth - 10, 62);

  startY = 68;
  
  // Date du jour à gauche (comme dans les reçus)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const today = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });
  doc.text(`Date: ${today}`, 10, startY);
  
  // Sous-titre à droite (classe sélectionnée)
  if (options?.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(options.subtitle, pageWidth / 2, startY, { align: 'center' });
  }
  
  startY += 4;

  // Ligne de séparation
  doc.line(10, startY, pageWidth - 10, startY);

  startY += 12;
  
  // Ajouter la numérotation si demandé
  let finalHeaders = headers;
  let finalRows = rows;
  
  if (options?.addNumbering) {
    finalHeaders = ['N°', ...headers];
    finalRows = rows.map((row, index) => [String(index + 1), ...row]);
  }
  
  // Tableau avec autoTable (style adapté aux reçus) - 100% noir et blanc
  autoTable(doc, {
    head: [finalHeaders],
    body: finalRows,
    startY: startY,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: 'linebreak',
      halign: 'left',
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left',
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0]
    },
    columnStyles: options?.addNumbering ? {
      0: { halign: 'center', cellWidth: 12 }
    } : {},
    willDrawCell: (data) => {
      // Mettre en gras la dernière ligne (TOTAL)
      if (data.row.index === finalRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240]; // léger fond gris
      }
    },
    margin: { top: startY, left: 10, right: 10 },
    didDrawPage: (data) => {
      // Pied de page avec numéro de page (style reçu)
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
      // Ligne au-dessus du pied de page
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
      
      doc.text(
        `Page ${data.pageNumber} / ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }
  });
  
  // Résumé en bas de la dernière page (style reçu)
  const finalY = (doc as any).lastAutoTable.finalY || startY;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`Total: ${rows.length} enregistrement${rows.length > 1 ? 's' : ''}`, 10, finalY + 8);
  
  // Télécharger le PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Génère un rapport HTML téléchargeable
 */
export function exportToHTML(
  title: string,
  headers: string[],
  rows: any[][],
  filename: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 20px; 
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 1200px; 
          margin: 0 auto; 
          background-color: white; 
          padding: 30px; 
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { 
          text-align: center; 
          color: #333; 
          margin-bottom: 10px;
        }
        .metadata {
          text-align: center;
          color: #666;
          font-size: 12px;
          margin-bottom: 20px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 20px; 
        }
        th { 
          background-color: #4CAF50; 
          color: white; 
          padding: 12px; 
          text-align: left;
          font-weight: 600;
        }
        td { 
          border: 1px solid #ddd; 
          padding: 10px; 
        }
        tr:nth-child(even) { 
          background-color: #f9f9f9; 
        }
        tr:hover {
          background-color: #f0f0f0;
        }
        .summary {
          margin-top: 20px;
          padding: 10px;
          background-color: #f9f9f9;
          border-left: 4px solid #4CAF50;
          font-size: 12px;
          color: #666;
        }
        @media print { 
          body { 
            margin: 0; 
            padding: 0;
            background-color: white;
          }
          .container {
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${title}</h1>
        <div class="metadata">
          Généré le: ${new Date().toLocaleDateString('fr-FR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="summary">
          Total enregistrements: ${rows.length}
        </div>
      </div>
    </body>
    </html>
  `;

  downloadFile(htmlContent, `${filename}.html`, 'text/html');
}
