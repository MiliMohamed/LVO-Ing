/** Conversion DOCX → PDF via le conteneur Gotenberg (LibreOffice headless). */

const GOTENBERG_URL = process.env.GOTENBERG_URL ?? "http://localhost:3010";

export async function convertDocxToPdf(docx: Buffer, filename: string): Promise<Buffer> {
  const form = new FormData();
  form.append(
    "files",
    new Blob([new Uint8Array(docx)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    filename,
  );

  const res = await fetch(`${GOTENBERG_URL}/forms/libreoffice/convert`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Conversion PDF (Gotenberg) échouée : ${res.status} ${res.statusText} ${text}`.trim());
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
