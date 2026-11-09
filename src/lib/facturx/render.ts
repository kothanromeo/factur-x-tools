import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { compute, FRANCHISE_REASON, type GeneratorInput } from './build';
import { BUSINESS_PROCESS_FR, DOCUMENT_TYPES, UNIT_CODES } from './codes';

/*
 * Dessine une facture A4 sobre à partir des données du formulaire.
 * Les polices sont incorporées (Inter) : c'est une condition de PDF/A,
 * les 14 polices standard du PDF (Helvetica…) ne le sont pas.
 */

export interface Fonts {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
}

const A4: [number, number] = [595.28, 841.89];
const M = 48; // marge
const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.38, 0.42, 0.48);
const ACCENT = rgb(0.06, 0.36, 0.55);
const RULE = rgb(0.85, 0.87, 0.9);

const money = (n: number, cur: string) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: cur || 'EUR' }).replace(/ /g, ' ').replace(/ /g, ' ');

const qty = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 4 }).replace(/ | /g, ' ');

const frDate = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= width || !line) line = test;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function renderInvoicePdf(input: GeneratorInput, fonts: Fonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const R = await doc.embedFont(fonts.regular, { subset: true });
  const B = await doc.embedFont(fonts.bold, { subset: true });
  const c = compute(input);
  const cur = input.currency || 'EUR';
  const docLabel = DOCUMENT_TYPES[input.typeCode] ?? 'Facture';

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;

  const text = (s: string, x: number, yy: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) =>
    page.drawText(s, { x, y: yy, font: o.font ?? R, size: o.size ?? 9.5, color: o.color ?? INK });
  const right = (s: string, xr: number, yy: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const f = o.font ?? R;
    const sz = o.size ?? 9.5;
    text(s, xr - f.widthOfTextAtSize(s, sz), yy, o);
  };
  const newPageIfNeeded = (needed: number) => {
    if (y - needed < M + 40) {
      page = doc.addPage(A4);
      y = A4[1] - M;
    }
  };

  // En-tête
  text(input.seller.name, M, y, { font: B, size: 15 });
  right(docLabel.toUpperCase(), A4[0] - M, y, { font: B, size: 15, color: ACCENT });
  y -= 18;
  right(`N° ${input.number}`, A4[0] - M, y, { font: B, size: 10 });
  const sellerLines = [
    input.seller.line1,
    input.seller.line2,
    [input.seller.postcode, input.seller.city].filter(Boolean).join(' '),
    input.seller.siren ? `SIREN ${input.seller.siren}` : '',
    input.seller.vatId ? `TVA ${input.seller.vatId}` : '',
    input.seller.email,
  ].filter(Boolean) as string[];
  let sy = y;
  for (const l of sellerLines) {
    text(l, M, sy, { color: MUTED });
    sy -= 13;
  }
  const meta = [
    `Date : ${frDate(input.issueDate)}`,
    input.deliveryDate ? `Livraison / exécution : ${frDate(input.deliveryDate)}` : '',
    input.dueDate ? `Échéance : ${frDate(input.dueDate)}` : '',
    input.orderReference ? `Commande : ${input.orderReference}` : '',
    input.buyerReference ? `Réf. acheteur : ${input.buyerReference}` : '',
  ].filter(Boolean);
  let my = y - 14;
  for (const l of meta) {
    right(l, A4[0] - M, my, { color: MUTED });
    my -= 13;
  }
  y = Math.min(sy, my) - 18;

  // Client
  const boxX = A4[0] / 2 + 10;
  text('FACTURÉ À', boxX, y, { font: B, size: 8, color: MUTED });
  let by = y - 14;
  const buyerLines = [
    input.buyer.name,
    input.buyer.line1,
    input.buyer.line2,
    [input.buyer.postcode, input.buyer.city].filter(Boolean).join(' '),
    input.buyer.country && input.buyer.country !== 'FR' ? input.buyer.country : '',
    input.buyer.siren ? `SIREN ${input.buyer.siren}` : '',
    input.buyer.vatId ? `TVA ${input.buyer.vatId}` : '',
  ].filter(Boolean) as string[];
  buyerLines.forEach((l, i) => {
    text(l, boxX, by, { font: i === 0 ? B : R });
    by -= 13;
  });
  if (input.shipTo) {
    text('LIVRÉ À', M, y, { font: B, size: 8, color: MUTED });
    let ly = y - 14;
    for (const l of [input.shipTo.name, input.shipTo.line1, [input.shipTo.postcode, input.shipTo.city].filter(Boolean).join(' ')].filter(Boolean) as string[]) {
      text(l, M, ly);
      ly -= 13;
    }
    by = Math.min(by, ly);
  }
  y = by - 22;

  // Tableau des lignes
  // x = bord gauche (texte) ou bord droit (nombres alignés à droite)
  const cols = { desc: M, descWidth: 225, qtyR: 318, unit: 332, priceR: 462, total: A4[0] - M };
  const header = () => {
    page.drawRectangle({ x: M - 6, y: y - 6, width: A4[0] - 2 * M + 12, height: 20, color: rgb(0.95, 0.96, 0.97) });
    text('Désignation', cols.desc, y, { font: B, size: 8.5 });
    right('Qté', cols.qtyR, y, { font: B, size: 8.5 });
    text('Unité', cols.unit, y, { font: B, size: 8.5 });
    right('PU HT', cols.priceR, y, { font: B, size: 8.5 });
    right('Total HT', cols.total, y, { font: B, size: 8.5 });
    y -= 22;
  };
  header();
  for (const l of c.lines) {
    const rows = wrap(l.name, R, 9.5, cols.descWidth);
    const rowHeight = Math.max(rows.length * 12, input.vatRegime === 'normal' ? 22 : 12);
    newPageIfNeeded(rowHeight + 14);
    if (y > A4[1] - M - 5) header();
    rows.forEach((r, i) => text(r, cols.desc, y - i * 12));
    right(qty(l.quantity), cols.qtyR, y);
    text(UNIT_CODES[l.unitCode] ?? l.unitCode, cols.unit, y);
    right(money(l.unitPrice, cur), cols.priceR, y);
    right(money(l.netAmount, cur), cols.total, y);
    if (input.vatRegime === 'normal') text(`TVA ${qty(l.rate)} %`, cols.unit, y - 11, { size: 7.5, color: MUTED });
    const ruleY = y - rowHeight + 4;
    page.drawLine({ start: { x: M - 6, y: ruleY }, end: { x: A4[0] - M + 6, y: ruleY }, thickness: 0.5, color: RULE });
    y = ruleY - 14;
  }

  // Totaux
  newPageIfNeeded(110);
  y -= 8;
  const tx = 360;
  const totalRow = (label: string, value: string, bold = false) => {
    text(label, tx, y, { font: bold ? B : R, size: bold ? 11 : 9.5 });
    right(value, A4[0] - M, y, { font: bold ? B : R, size: bold ? 11 : 9.5 });
    y -= bold ? 18 : 14;
  };
  totalRow('Total HT', money(c.lineTotal, cur));
  for (const t of c.taxes) {
    if (t.category === 'E') continue;
    totalRow(`TVA ${qty(t.rate)} % sur ${money(t.basis, cur)}`, money(t.amount, cur));
  }
  page.drawLine({ start: { x: tx, y: y + 8 }, end: { x: A4[0] - M, y: y + 8 }, thickness: 0.8, color: INK });
  y -= 4;
  totalRow(input.vatRegime === 'franchise' ? 'Total à payer' : 'Total TTC', money(c.grandTotal, cur), true);
  y -= 10;

  // Mentions
  const mentions: string[] = [];
  if (input.vatRegime === 'franchise') mentions.push(FRANCHISE_REASON + '.');
  if (input.vatOnDebits) mentions.push('Option pour le paiement de la taxe d’après les débits.');
  if (input.businessProcess && BUSINESS_PROCESS_FR[input.businessProcess]) {
    const cat = input.businessProcess[0];
    mentions.push(`Catégorie de l’opération : ${cat === 'B' ? 'livraison de biens' : cat === 'S' ? 'prestation de services' : 'opération mixte'}.`);
  }
  if (input.paymentTerms) mentions.push(`Conditions de paiement : ${input.paymentTerms}`);
  if (input.iban) mentions.push(`Règlement par virement : IBAN ${input.iban}${input.bic ? ` · BIC ${input.bic}` : ''}${input.paymentReference ? ` · Référence ${input.paymentReference}` : ''}`);
  for (const n of input.notes ?? []) if (n.content.trim()) mentions.push(n.content.trim());

  for (const m of mentions) {
    const rows = wrap(m, R, 8.5, A4[0] - 2 * M);
    newPageIfNeeded(rows.length * 11 + 4);
    for (const r of rows) {
      text(r, M, y, { size: 8.5, color: MUTED });
      y -= 11;
    }
    y -= 3;
  }

  // Pied de page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = `${input.seller.name}${input.seller.siren ? ` · SIREN ${input.seller.siren}` : ''} · Facture électronique Factur-X (EN 16931)`;
    p.drawText(footer, { x: M, y: 28, size: 7, font: R, color: MUTED });
    const pg = `${i + 1}/${pages.length}`;
    p.drawText(pg, { x: A4[0] - M - R.widthOfTextAtSize(pg, 7), y: 28, size: 7, font: R, color: MUTED });
  });

  doc.setTitle(`${docLabel} ${input.number}`);
  doc.setAuthor(input.seller.name);
  doc.setLanguage('fr-FR');
  return doc.save({ useObjectStreams: false });
}
