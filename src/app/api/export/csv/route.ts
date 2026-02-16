import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { data, filename, columns } = await request.json();

    if (!data || !Array.isArray(data) || !filename) {
      return NextResponse.json(
        { error: 'Données ou nom de fichier manquants' },
        { status: 400 }
      );
    }

    // Déterminer les colonnes à utiliser - respecter l'ordre exact fourni
    let headerOrder = columns;
    if (!headerOrder && data.length > 0) {
      headerOrder = Object.keys(data[0]);
    }

    if (!headerOrder || headerOrder.length === 0) {
      return NextResponse.json(
        { error: 'Impossible de déterminer les colonnes' },
        { status: 400 }
      );
    }

    // Créer les lignes CSV avec point-virgule comme séparateur (locale France)
    const csvLines: string[] = [];

    // En-têtes
    csvLines.push(headerOrder.map((col: string) => quoteCSVField(col)).join(';'));

    // Données - traiter chaque ligne dans l'ordre des colonnes
    for (const row of data) {
      const values = headerOrder.map((col: string) => {
        const value = row[col];
        const strValue = value === null || value === undefined ? '' : String(value).trim();
        return quoteCSVField(strValue);
      });
      csvLines.push(values.join(';'));
    }

    // Joindre les lignes avec \r\n (standard Windows/Universal)
    const csvContent = csvLines.join('\r\n');
    
    // Convertir en Buffer UTF-8 avec BOM
    const bom = Buffer.from([0xef, 0xbb, 0xbf]); // BOM UTF-8 en bytes
    const content = Buffer.from(csvContent, 'utf-8');
    const finalBuffer = Buffer.concat([bom, content]);

    // Retourner la réponse avec les bons headers
    return new NextResponse(finalBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': finalBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Erreur export CSV:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du CSV: ' + String(error) },
      { status: 500 }
    );
  }
}

/**
 * Quote et échappe un champ CSV si nécessaire
 * Respecte la norme RFC 4180 pour CSV avec point-virgule comme séparateur
 */
function quoteCSVField(field: string): string {
  if (!field || field.length === 0) return '';
  
  const str = String(field);
  
  // Si le champ contient un point-virgule, des guillemets, des sauts de ligne, retour à la ligne
  // il doit être enrobé de guillemets
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Échapper les guillemets en les doublant
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}
