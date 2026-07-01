import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const STAMP_PATH = path.resolve("uploads", "Image1.jpg");

export async function overlaySignatureOnPdf(
  pdfBuffer: Buffer,
  _signatureDataUrl: string,
  signedDate: string,
  signataireName: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const existingPages = pdfDoc.getPages();
  const page = existingPages[existingPages.length - 1];
  const { width } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let stampImage: Awaited<ReturnType<typeof pdfDoc.embedJpg>> | null = null;
  try {
    stampImage = await pdfDoc.embedJpg(fs.readFileSync(STAMP_PATH));
  } catch { /* image absente */ }

  // Tampon LVO compact, ancré en bas à droite de la dernière page du document
  // (on n'ajoute pas de page : le client a demande un document signe sur une seule page)
  const stampSize = 90;
  const marginX = 40;
  const marginY = 50;
  const stampX = width - marginX - stampSize;
  const stampY = marginY + 30;

  if (stampImage) {
    page.drawImage(stampImage, { x: stampX, y: stampY, width: stampSize, height: stampSize });
  }

  const dateStr = new Date(signedDate).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const textX = stampX - 170;
  page.drawText("Valide et signe le " + dateStr, {
    x: textX, y: stampY + 50, size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15),
  });
  page.drawText("par " + signataireName, {
    x: textX, y: stampY + 36, size: 8, font: fontReg, color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText("Document signe electroniquement - LVO Ingenierie", {
    x: textX, y: stampY + 22, size: 7, font: fontReg, color: rgb(0.55, 0.55, 0.55),
  });

  return pdfDoc.save();
}
