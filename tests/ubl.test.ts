// @vitest-environment happy-dom
import { writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildUbl, buildXml, readInvoice, validateInvoice } from '../src/lib/facturx';
import { sample } from './sample';

describe('UBL', () => {
  const ubl = buildUbl(sample);
  const inv = readInvoice(ubl);
  const cii = readInvoice(buildXml(sample));
  it('se lit comme la même facture que le CII', () => {
    expect(inv.syntax).toBe('UBL');
    expect(inv.profile).toBe('EN 16931');
    expect(inv.businessProcess).toBe('S1');
    for (const k of ['number', 'issueDate', 'currency', 'dueDate', 'iban', 'bic', 'orderReference', 'deliveryDate'] as const) expect(inv[k]).toBe(cii[k]);
    expect(inv.seller).toMatchObject({ name: cii.seller.name, legalId: cii.seller.legalId, vatId: cii.seller.vatId });
    expect(inv.buyer.legalId).toBe('732829320');
    expect(inv.lines.map((l) => [l.name, l.quantity, l.unitPrice, l.netAmount, l.vatRate])).toEqual(cii.lines.map((l) => [l.name, l.quantity, l.unitPrice, l.netAmount, l.vatRate]));
    expect(inv.totals).toMatchObject({ lineTotal: cii.totals.lineTotal, taxBasis: cii.totals.taxBasis, taxTotal: cii.totals.taxTotal, grandTotal: cii.totals.grandTotal, duePayable: cii.totals.duePayable });
    expect(inv.notes.map((n) => n.subject)).toEqual(['PMT', 'PMD', 'AAB']);
  });
  it('passe les mêmes contrôles', () => {
    expect(validateInvoice(inv).filter((r) => !r.passed)).toEqual([]);
  });
  it('avoir (CreditNote) et franchise en base', () => {
    const cn = readInvoice(buildUbl({ ...sample, typeCode: '381', vatRegime: 'franchise', seller: { ...sample.seller, vatId: undefined } }));
    expect(cn.typeCode).toBe('381');
    expect(cn.dueDate).toBe(sample.dueDate);
    expect(cn.taxes[0]).toMatchObject({ category: 'E', rate: 0, amount: 0 });
    expect(cn.seller.taxRegistration).toBe('552100554');
    expect(validateInvoice(cn).filter((r) => !r.passed && r.severity === 'error')).toEqual([]);
  });
  it('TVA sur les débits : code UBL 3 converti en code CII 5', () => {
    const d = readInvoice(buildUbl({ ...sample, vatOnDebits: true }));
    expect(d.taxes[0].dueDateTypeCode).toBe('5');
  });
  it('accepte une facture Peppol BIS 3', () => {
    const peppol = ubl.replace('<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>', '<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>');
    expect(readInvoice(peppol).profile).toBe('EN 16931');
    mkdirSync('tests/out', { recursive: true });
    writeFileSync('tests/out/sample-ubl.xml', ubl);
  });
});
