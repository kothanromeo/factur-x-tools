// @vitest-environment happy-dom
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildXml, compute, readInvoice, summarize, validateInvoice, inspectPdf, checkPdf, embedFacturX } from '../src/lib/facturx';
import { renderInvoicePdf } from '../src/lib/facturx/render';
import { buildSrgbIcc } from '../src/lib/facturx/icc';
import { sample } from './sample';

const fonts = {
  regular: readFileSync('node_modules/@fontsource/inter/files/inter-latin-400-normal.woff'),
  bold: readFileSync('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff'),
};

describe('calculs', () => {
  it('ventile la TVA par taux', () => {
    const c = compute(sample);
    expect(c.lineTotal).toBe(2704.7);
    expect(c.taxes).toEqual([
      expect.objectContaining({ category: 'S', rate: 20, basis: 2630, amount: 526 }),
      expect.objectContaining({ category: 'S', rate: 5.5, basis: 74.7, amount: 4.11 }),
    ]);
    expect(c.grandTotal).toBe(3234.81);
  });
  it('franchise en base : catégorie E, TVA nulle', () => {
    const c = compute({ ...sample, vatRegime: 'franchise' });
    expect(c.taxes).toHaveLength(1);
    expect(c.taxes[0]).toMatchObject({ category: 'E', rate: 0, amount: 0 });
    expect(c.grandTotal).toBe(c.lineTotal);
  });
});

describe('XML CII', () => {
  const xml = buildXml(sample);
  it('se relit à l’identique', () => {
    const inv = readInvoice(xml);
    expect(inv.profile).toBe('EN 16931');
    expect(inv.number).toBe('F-2026-0042');
    expect(inv.issueDate).toBe('2026-11-09');
    expect(inv.seller.legalId).toBe('552100554');
    expect(inv.buyer.legalId).toBe('732829320');
    expect(inv.lines).toHaveLength(3);
    expect(inv.totals.duePayable).toBe(3234.81);
    expect(inv.iban).toBe('FR7630006000011234567890189');
    expect(inv.businessProcess).toBe('S1');
  });
  it('passe tous les contrôles', () => {
    const res = validateInvoice(readInvoice(xml));
    const failed = res.filter((r) => !r.passed);
    expect(failed).toEqual([]);
    expect(summarize(res).errors).toBe(0);
  });
  it('détecte un total faux', () => {
    const bad = xml.replace('<ram:GrandTotalAmount>3234.81', '<ram:GrandTotalAmount>3234.80');
    const res = validateInvoice(readInvoice(bad));
    expect(res.find((r) => r.id === 'BR-CO-15')?.passed).toBe(false);
  });
  it('franchise : motif d’exonération et identifiant FC', () => {
    const inv = readInvoice(buildXml({ ...sample, vatRegime: 'franchise', seller: { ...sample.seller, vatId: undefined } }));
    expect(inv.taxes[0].exemptionReason).toMatch(/293 B/);
    expect(inv.seller.taxRegistration).toBe('552100554');
    expect(validateInvoice(inv).filter((r) => !r.passed && r.severity === 'error')).toEqual([]);
  });
  it('échappe les caractères spéciaux', () => {
    expect(xml).toContain('Boulangerie Martin &amp; Fils');
  });
});

describe('PDF', () => {
  it('produit un ICC valide en apparence', () => {
    const icc = buildSrgbIcc();
    const view = new DataView(icc.buffer);
    expect(view.getUint32(0)).toBe(icc.length);
    expect(String.fromCharCode(...icc.subarray(36, 40))).toBe('acsp');
  });
  it('génère, embarque et relit un Factur-X', async () => {
    const xml = buildXml(sample);
    const visual = await renderInvoicePdf(sample, fonts);
    const { bytes, warnings } = await embedFacturX(visual, xml, { conformanceLevel: 'EN 16931', generated: true });
    expect(warnings).toEqual([]);
    mkdirSync('tests/out', { recursive: true });
    writeFileSync('tests/out/sample-facturx.pdf', bytes);
    writeFileSync('tests/out/sample-facturx.xml', xml);
    const p = await inspectPdf(bytes);
    expect(p.invoiceXml?.name).toBe('factur-x.xml');
    expect(p.invoiceXml?.xml).toBe(xml);
    expect(p.invoiceXml?.afRelationship).toBe('Alternative');
    expect(p.xmp?.pdfaPart).toBe('3');
    expect(p.xmp?.fxConformanceLevel).toBe('EN 16931');
    expect(p.hasOutputIntent).toBe(true);
    expect(checkPdf(p, 'EN 16931').filter((r) => !r.passed)).toEqual([]);
  });
  it('remplace un XML déjà présent au lieu de le dupliquer', async () => {
    const visual = await renderInvoicePdf(sample, fonts);
    const once = await embedFacturX(visual, buildXml(sample), { conformanceLevel: 'EN 16931', generated: true });
    const twice = await embedFacturX(once.bytes, buildXml({ ...sample, number: 'F-2' }), { conformanceLevel: 'EN 16931' });
    const p = await inspectPdf(twice.bytes);
    expect(p.attachments.filter((a) => a.name === 'factur-x.xml')).toHaveLength(1);
    expect(readInvoice(p.invoiceXml!.xml).number).toBe('F-2');
  });
  it('signale un PDF sans pièce jointe', async () => {
    const visual = await renderInvoicePdf(sample, fonts);
    const p = await inspectPdf(visual);
    expect(p.invoiceXml).toBeUndefined();
    expect(checkPdf(p).find((r) => r.id === 'FX-XML')?.passed).toBe(false);
  });
});
