#!/usr/bin/env node
/**
 * qr-pdf.mjs
 *
 * Print-ready, tabloid (11×17 in) PDF of the Biomuseo Xolotlcalli station QR
 * codes — one sheet, 8 cut-out cards (AA, AM1–AM5, AM Larvas, AD). Each card is
 * a composition: station number + scientific name + QR + "Escanea y conoce más",
 * keyed to the species' dedicated colour. Scanning opens the station / aquarium
 * detail on the water dashboard via its hash anchor.
 *
 * Encoding (qrcode) and anchors mirror src/components/QrSheet.astro — keep the
 * TARGETS list in sync if a station is added.
 *
 *   npm run qr:pdf   →   Site/public/xolotlcalli-qr-tabloid.pdf
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { createWriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const OUT = resolve(SITE_ROOT, 'public/xolotlcalli-qr-tabloid.pdf');

// Site origin the QR codes resolve to (matches astro.config.mjs `site`).
const SITE = 'https://axolodao.org';
const CAPTION = 'Escanea y conoce más';

// Species → dedicated accent (mirrors tanks.json accentColor / waterQuality theme).
const SPECIES_COLOR = {
  andersoni: '#B87333',
  mexicanum: '#2C5F7C',
  dumerilii: '#3E6B4A',
};

const TARGETS = [
  { anchor: 'AA', label: 'AA', species: 'andersoni', sci: 'Ambystoma andersoni' },
  { anchor: 'AM1', label: 'AM1', species: 'mexicanum', sci: 'Ambystoma mexicanum' },
  { anchor: 'AM2', label: 'AM2', species: 'mexicanum', sci: 'Ambystoma mexicanum' },
  { anchor: 'AM3', label: 'AM3', species: 'mexicanum', sci: 'Ambystoma mexicanum' },
  { anchor: 'AM4', label: 'AM4', species: 'mexicanum', sci: 'Ambystoma mexicanum' },
  { anchor: 'AM5', label: 'AM5', species: 'mexicanum', sci: 'Ambystoma mexicanum' },
  { anchor: 'AM-larvas', label: 'AM Larvas', species: 'mexicanum', sci: 'Ambystoma mexicanum' },
  { anchor: 'AD', label: 'AD', species: 'dumerilii', sci: 'Ambystoma dumerilii' },
];

// High-res QR PNGs (dark modules on white = best scannability) — one per target.
const qrBuffers = await Promise.all(
  TARGETS.map((t) =>
    QRCode.toBuffer(new URL(`/xolotlcalli#${t.anchor}`, SITE).href, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 600,
      color: { dark: '#11202A', light: '#FFFFFF' },
    }),
  ),
);

const doc = new PDFDocument({
  size: 'TABLOID', // 792 × 1224 pt = 11 × 17 in, portrait
  margin: 36,
  info: { Title: 'Biomuseo Xolotlcalli — Códigos QR de estaciones' },
});
const stream = createWriteStream(OUT);
doc.pipe(stream);

const PW = doc.page.width;
const PH = doc.page.height;
const M = 36;

// Sheet header (not a card — won't be cut out).
doc
  .font('Helvetica-Bold').fontSize(18).fillColor('#11202A')
  .text('Biomuseo Xolotlcalli · Códigos QR de estaciones', M, M, { width: PW - 2 * M });
doc
  .font('Helvetica').fontSize(10).fillColor('#555555')
  .text('Escanea para abrir la ficha de cada estación en axolodao.org · recorta por el borde de cada tarjeta', M, M + 23, { width: PW - 2 * M });

const top = M + 48;
const cols = 2;
const rows = 4;
const gutter = 14;
const gridW = PW - 2 * M;
const gridH = PH - top - M;
const cardW = (gridW - (cols - 1) * gutter) / cols;
const cardH = (gridH - (rows - 1) * gutter) / rows;
const p = 14;

TARGETS.forEach((t, i) => {
  const c = i % cols;
  const r = Math.floor(i / cols);
  const x = M + c * (cardW + gutter);
  const y = top + r * (cardH + gutter);
  const color = SPECIES_COLOR[t.species];

  // Card: white fill + species-colour border (doubles as cut line).
  doc.roundedRect(x, y, cardW, cardH, 10).fill('#FFFFFF');
  doc.roundedRect(x, y, cardW, cardH, 10).lineWidth(2).stroke(color);

  // Station number + scientific name + rule.
  doc.font('Helvetica-Bold').fontSize(24).fillColor(color)
    .text(t.label, x + p, y + p, { width: cardW - 2 * p, lineBreak: false });
  doc.font('Helvetica-Oblique').fontSize(9.5).fillColor('#555555')
    .text(t.sci, x + p, y + p + 27, { width: cardW - 2 * p, lineBreak: false });
  doc.moveTo(x + p, y + p + 44).lineTo(x + cardW - p, y + p + 44).lineWidth(1).stroke(color);

  // QR — centred, as large as the remaining card height allows.
  const qrTop = y + p + 52;
  const captionH = 28;
  const qr = Math.max(80, Math.min(cardW - 2 * p, y + cardH - qrTop - captionH));
  doc.image(qrBuffers[i], x + (cardW - qr) / 2, qrTop, { width: qr, height: qr });

  // Caption.
  doc.font('Helvetica-Bold').fontSize(11).fillColor(color)
    .text(CAPTION, x + p, y + cardH - 22, { width: cardW - 2 * p, align: 'center', lineBreak: false });
});

doc.end();
await new Promise((res, rej) => {
  stream.on('finish', res);
  stream.on('error', rej);
});
console.log(`[qr-pdf] wrote ${OUT} (${TARGETS.length} stations, TABLOID)`);
