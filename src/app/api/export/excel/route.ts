import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  try {
    const { data, filename, columns } = await request.json();

    if (!data || !Array.isArray(data) || !filename) {
      return NextResponse.json(
        { error: 'Données ou nom de fichier manquants' },
        { status: 400 }
      );
    }

    // Déterminer l'ordre des colonnes
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

    // Créer un nouveau classeur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Données');

    // Ajouter les en-têtes avec style
    const headerRow = worksheet.addRow(headerOrder);
    headerRow.height = 24;
    
    // Style des en-têtes : fond bleu, texte blanc, gras
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }, // Blanc
        size: 12,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }, // Bleu fonce
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });

    // Ajouter les données
    const dataRows: any[] = [];
    const isNumericValue = (value: unknown) =>
      typeof value === 'number' || (!Number.isNaN(Number(value)) && value !== '' && value !== null);

    const isDateValue = (value: unknown) => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      return /^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{2}\/\d{2}\/\d{4}/.test(trimmed);
    };

    for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
      const row = data[rowIndex];
      const values = headerOrder.map((col: string) => {
        const value = row[col];
        return value === null || value === undefined ? '' : value;
      });
      const dataRow = worksheet.addRow(values);
      dataRows.push(dataRow);
      dataRow.height = 18;

      const isEvenRow = rowIndex % 2 === 0;
      
      // Style des données : avec bordures + alternance
      dataRow.eachCell((cell, colNumber) => {
        const cellValue = cell.value;
        cell.alignment = {
          horizontal: isNumericValue(cellValue) ? 'right' : 'left',
          vertical: 'middle',
          wrapText: false,
        };
        if (isNumericValue(cellValue)) {
          cell.numFmt = '#,##0';
        } else if (isDateValue(cellValue)) {
          cell.numFmt = 'dd/mm/yyyy';
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEvenRow ? 'FFF8FAFC' : 'FFFFFFFF' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        };
      });
    }

    // Mettre en gras la dernière ligne (TOTAL)
    if (dataRows.length > 0) {
      const lastRow = dataRows[dataRows.length - 1];
      lastRow.eachCell((cell: ExcelJS.Cell) => {
        cell.font = {
          bold: true,
          size: 11,
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }, // Gris clair
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });
    }

    // Ajouter les filtres sur les en-têtes
    // Ajouter les filtres automatiques sur les en-têtes
    const lastColumn = String.fromCharCode(64 + headerOrder.length);
    worksheet.autoFilter = {
      from: 'A1',
      to: `${lastColumn}${data.length + 1}`
    };

    // Ajuster la largeur des colonnes
    (worksheet.columns || []).forEach((column) => {
      if (!column || !column.eachCell) return;
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
        const cellLength = cell.value?.toString().length || 0;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 12), 50);
    });

    // Geler la première lignes (en-têtes)
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Générer le buffer Excel
    const buffer = await workbook.xlsx.writeBuffer() as any;

    // Retourner le fichier Excel
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename.replace('.csv', '.xlsx'))}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Erreur export Excel:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du fichier Excel: ' + String(error) },
      { status: 500 }
    );
  }
}
