/**
 * Lecture Excel via SheetJS (xlsx) — gère .xls (OLE2) et .xlsx (ZIP).
 * Convertit en .xlsx moderne avant envoi à l'API Python (openpyxl).
 */
import * as XLSX from "xlsx";

function nomXlsx(nomOriginal: string): string {
  const base = nomOriginal.replace(/\.(xls|xlsm|xlsx)$/i, "") || "classeur";
  return `${base}.xlsx`;
}

/** True si le fichier est déjà un .xlsx / .xlsm ZIP valide. */
async function estXlsxZip(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b;
}

/**
 * Ouvre le classeur avec SheetJS et le ré-enregistre en .xlsx.
 * Les .xls Excel 97-2003 (ex. Q1 SCI CADJEE.xls) sont ainsi lisibles.
 */
export async function normaliserClasseurExcel(file: File): Promise<File> {
  const lower = file.name.toLowerCase();
  if ((lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) && (await estXlsxZip(file))) {
    return file;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, {
      type: "array",
      cellDates: true,
      raw: false,
    });
  } catch {
    throw new Error(
      `Impossible de lire « ${file.name} ». Utilisez un classeur Excel .xls ou .xlsx du prestataire.`,
    );
  }

  if (!workbook.SheetNames.length) {
    throw new Error(`Le fichier « ${file.name} » ne contient aucune feuille.`);
  }

  const xlsxBytes = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    cellDates: true,
  });

  return new File([xlsxBytes], nomXlsx(file.name), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    lastModified: file.lastModified,
  });
}
