import ExcelJS from "exceljs";

import { svgToPngBuffer } from "../excel-charts.js";

export const NAVY = "FF1E3A5F";
export const ORANGE = "FFF97316";
export const LIGHT_BAND = "FFF1F5F9";
export const BORDER_COLOR = "FFCBD5E1";

export const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
};

export function styleHeaderRow(row: ExcelJS.Row, numCols: number) {
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle" };
    cell.border = THIN_BORDER;
  }
  row.height = 20;
}

export function zebraStripe(ws: ExcelJS.Worksheet, firstDataRow: number, lastDataRow: number, numCols: number) {
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    const row = ws.getRow(r);
    const banded = (r - firstDataRow) % 2 === 1;
    for (let c = 1; c <= numCols; c++) {
      const cell = row.getCell(c);
      if (banded) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BAND } };
      cell.border = THIN_BORDER;
    }
  }
}

/** En-tête de marque LVO Ingénierie : logo + titre + sous-titre sur les 3 premières lignes. */
export function addBrandBanner(ws: ExcelJS.Worksheet, logoImageId: number, title: string, subtitle: string, mergeToCol: string) {
  ws.getRow(1).height = 40;
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;

  ws.mergeCells(`B1:${mergeToCol}1`);
  const titleCell = ws.getCell("B1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 15, color: { argb: NAVY } };
  titleCell.alignment = { vertical: "middle" };

  ws.mergeCells(`B2:${mergeToCol}2`);
  const subtitleCell = ws.getCell("B2");
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  subtitleCell.alignment = { vertical: "middle" };

  ws.getRow(3).eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { bottom: { style: "medium", color: { argb: ORANGE } } };
  });

  // Logo source 466×234 px — ratio conservé pour éviter toute déformation
  ws.addImage(logoImageId, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 40 } });
}

export async function addImageFromSvg(workbook: ExcelJS.Workbook, ws: ExcelJS.Worksheet, svg: string, col: number, row: number) {
  const { buffer, width, height } = await svgToPngBuffer(svg);
  const imageId = workbook.addImage({ buffer: buffer as unknown as ExcelJS.Buffer, extension: "png" });
  ws.addImage(imageId, { tl: { col, row }, ext: { width, height } });
}
