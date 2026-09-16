/**
 * Convertit le HTML produit par l'éditeur riche PrimeReact/Quill (texte libre de la Mission
 * Spéciale) en `ContentBlock[]` consommables par le renderer docx — sans dépendance DOM/jsdom,
 * le HTML de sortie de Quill étant suffisamment prévisible (blocs h1-h3/p/li, runs inline
 * strong/b, em/i, br) pour un découpage par regex.
 */
import type { ContentBlock, RichRun } from "./offre-content.js";

const BLOCK_RE = /<(h1|h2|h3|p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseRuns(innerHtml: string): RichRun[] {
  const runs: RichRun[] = [];
  let bold = 0;
  let italic = 0;
  const tokenRe = /<(\/?)(strong|b|em|i|br)[^>]*>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(innerHtml))) {
    const [, closing, tag, text] = m;
    if (text != null) {
      const t = decodeEntities(text);
      if (t) runs.push({ text: t, bold: bold > 0, italic: italic > 0 });
      continue;
    }
    if (!tag) continue;
    const lower = tag.toLowerCase();
    if (lower === "br") {
      runs.push({ text: "\n", bold: bold > 0, italic: italic > 0 });
      continue;
    }
    const isBold = lower === "strong" || lower === "b";
    const isItalic = lower === "em" || lower === "i";
    if (closing) {
      if (isBold) bold = Math.max(0, bold - 1);
      if (isItalic) italic = Math.max(0, italic - 1);
    } else {
      if (isBold) bold++;
      if (isItalic) italic++;
    }
  }
  return runs;
}

function isBlank(runs: RichRun[]): boolean {
  return runs.every((r) => !r.text.trim());
}

export function htmlToBlocks(html: string | null | undefined): ContentBlock[] {
  if (!html || !html.trim()) return [];
  const blocks: ContentBlock[] = [];
  BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_RE.exec(html))) {
    const tag = match[1].toLowerCase();
    const runs = parseRuns(match[2]);
    if (isBlank(runs)) continue;
    if (tag === "h1" || tag === "h2") {
      blocks.push({ type: "heading", text: runs.map((r) => r.text).join("") });
    } else if (tag === "h3") {
      blocks.push({ type: "subheading", text: runs.map((r) => r.text).join("") });
    } else if (tag === "li") {
      blocks.push({ type: "bullet", text: runs.map((r) => r.text).join("") });
    } else {
      blocks.push({ type: "richParagraph", runs });
    }
  }
  return blocks;
}
