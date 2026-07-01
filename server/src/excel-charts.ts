import sharp from "sharp";

export type ChartSlice = { label: string; value: number; color?: string };

const PALETTE = [
  "#2563eb", "#f97316", "#16a34a", "#dc2626", "#7c3aed",
  "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#65a30d",
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function pieChartSvg(title: string, data: ChartSlice[]): string {
  const width = 640;
  const height = 380;
  const cx = 210;
  const cy = 200;
  const radius = 150;
  const total = data.reduce((s, d) => s + d.value, 0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  svg += `<text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#1e293b">${esc(title)}</text>`;

  if (total <= 0) {
    svg += `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Arial" font-size="13" fill="#94a3b8">Aucune donnée</text></svg>`;
    return svg;
  }

  let angle = 0;
  data.forEach((d, i) => {
    const color = d.color ?? PALETTE[i % PALETTE.length];
    const span = (d.value / total) * 360;
    const [x1, y1] = polar(cx, cy, radius, angle);
    const [x2, y2] = polar(cx, cy, radius, angle + span);
    const largeArc = span > 180 ? 1 : 0;
    if (data.length === 1) {
      svg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" />`;
    } else {
      svg += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${radius},${radius} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>`;
    }
    angle += span;
  });

  // Légende
  let legendY = 60;
  data.forEach((d, i) => {
    const color = d.color ?? PALETTE[i % PALETTE.length];
    const pct = total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0;
    svg += `<rect x="450" y="${legendY}" width="12" height="12" fill="${color}" rx="2"/>`;
    svg += `<text x="468" y="${legendY + 10}" font-family="Arial, sans-serif" font-size="12" fill="#334155">${esc(d.label)} — ${d.value} (${pct}%)</text>`;
    legendY += 22;
  });

  svg += `</svg>`;
  return svg;
}

export function barChartSvg(title: string, data: ChartSlice[], valueLabel = ""): string {
  const width = 640;
  const height = Math.max(300, 70 + data.length * 34);
  const marginLeft = 190;
  const marginRight = 60;
  const barAreaWidth = width - marginLeft - marginRight;
  const max = Math.max(1, ...data.map((d) => d.value));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  svg += `<text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#1e293b">${esc(title)}</text>`;

  if (data.length === 0) {
    svg += `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Arial" font-size="13" fill="#94a3b8">Aucune donnée</text></svg>`;
    return svg;
  }

  const barHeight = 20;
  let y = 55;
  data.forEach((d, i) => {
    const color = d.color ?? PALETTE[i % PALETTE.length];
    const w = (d.value / max) * barAreaWidth;
    svg += `<text x="${marginLeft - 10}" y="${y + barHeight - 5}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#334155">${esc(d.label.length > 22 ? d.label.slice(0, 21) + "…" : d.label)}</text>`;
    svg += `<rect x="${marginLeft}" y="${y}" width="${Math.max(1, w)}" height="${barHeight}" fill="${color}" rx="3"/>`;
    const valTxt = valueLabel ? `${d.value.toLocaleString("fr-FR")} ${valueLabel}` : d.value.toLocaleString("fr-FR");
    svg += `<text x="${marginLeft + w + 8}" y="${y + barHeight - 5}" font-family="Arial, sans-serif" font-size="11" fill="#475569">${esc(valTxt)}</text>`;
    y += barHeight + 14;
  });

  svg += `</svg>`;
  return svg;
}

export async function svgToPngBuffer(svg: string): Promise<{ buffer: Buffer; width: number; height: number }> {
  const widthMatch = /width="(\d+)"/.exec(svg);
  const heightMatch = /height="(\d+)"/.exec(svg);
  const width = widthMatch ? Number(widthMatch[1]) : 640;
  const height = heightMatch ? Number(heightMatch[1]) : 380;
  const buffer = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
  return { buffer, width, height };
}
