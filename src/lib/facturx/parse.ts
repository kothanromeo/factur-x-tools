import { detectProfile } from './codes';
import type { Address, Invoice, InvoiceLine, Party, TaxBreakdown } from './types';

/*
 * Lecture d'un XML CII (Cross Industry Invoice D16B), le format embarqué dans
 * un PDF Factur-X / ZUGFeRD 2.x. On navigue par nom local pour ne pas dépendre
 * des préfixes choisis par le logiciel émetteur (rsm:, ram:, ns2:…).
 */

export class XmlParseError extends Error {}

export interface ParsedXml {
  doc: Document;
  root: Element;
  kind: 'CII' | 'ZUGFERD1' | 'UBL' | 'AUTRE';
}

export function parseXml(xml: string): ParsedXml {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err || !doc.documentElement) {
    throw new XmlParseError(
      'Le XML est mal formé : ' + (err?.textContent?.trim().split('\n')[0] ?? 'document vide'),
    );
  }
  const root = doc.documentElement;
  const name = root.localName;
  const kind =
    name === 'CrossIndustryInvoice'
      ? 'CII'
      : name === 'CrossIndustryDocument'
        ? 'ZUGFERD1'
        : name === 'Invoice' || name === 'CreditNote'
          ? 'UBL'
          : 'AUTRE';
  return { doc, root, kind };
}

// --- Navigation par nom local -------------------------------------------------

export function kids(el: Element | null | undefined, name?: string): Element[] {
  if (!el) return [];
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!name || (n as Element).localName === name)) out.push(n as Element);
  }
  return out;
}

export function at(el: Element | null | undefined, ...path: string[]): Element | null {
  let cur: Element | null | undefined = el;
  for (const p of path) {
    if (!cur) return null;
    cur = kids(cur, p)[0] ?? null;
  }
  return cur ?? null;
}

export function txt(el: Element | null | undefined, ...path: string[]): string | undefined {
  const node = at(el, ...path);
  const v = node?.textContent?.trim();
  return v ? v : undefined;
}

export function num(el: Element | null | undefined, ...path: string[]): number | undefined {
  const v = txt(el, ...path);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Convertit une date CII (format 102 = AAAAMMJJ) en AAAA-MM-JJ. */
export function cdate(el: Element | null | undefined, ...path: string[]): string | undefined {
  const node = at(el, ...path, 'DateTimeString') ?? at(el, ...path, 'DateString');
  const v = node?.textContent?.trim();
  if (!v) return undefined;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : v;
}

// --- Extraction -----------------------------------------------------------------

function address(el: Element | null): Address {
  const a = at(el, 'PostalTradeAddress');
  return {
    line1: txt(a, 'LineOne'),
    line2: txt(a, 'LineTwo'),
    line3: txt(a, 'LineThree'),
    postcode: txt(a, 'PostcodeCode'),
    city: txt(a, 'CityName'),
    country: txt(a, 'CountryID'),
  };
}

function party(el: Element | null): Party {
  const legal = at(el, 'SpecifiedLegalOrganization', 'ID');
  const regs = kids(el, 'SpecifiedTaxRegistration').map((r) => at(r, 'ID'));
  const vat = regs.find((r) => r?.getAttribute('schemeID') === 'VA');
  const fc = regs.find((r) => r?.getAttribute('schemeID') === 'FC');
  return {
    name: txt(el, 'Name'),
    legalId: legal?.textContent?.trim() || undefined,
    legalIdScheme: legal?.getAttribute('schemeID') ?? undefined,
    vatId: vat?.textContent?.trim() || undefined,
    taxRegistration: fc?.textContent?.trim() || undefined,
    email: txt(el, 'URIUniversalCommunication', 'URIID'),
    address: address(el),
  };
}

function line(el: Element): InvoiceLine {
  const agreement = at(el, 'SpecifiedLineTradeAgreement');
  const settlement = at(el, 'SpecifiedLineTradeSettlement');
  const qty = at(el, 'SpecifiedLineTradeDelivery', 'BilledQuantity');
  return {
    id: txt(el, 'AssociatedDocumentLineDocument', 'LineID'),
    name: txt(el, 'SpecifiedTradeProduct', 'Name'),
    description: txt(el, 'SpecifiedTradeProduct', 'Description'),
    quantity: qty?.textContent ? Number(qty.textContent.trim()) : undefined,
    unitCode: qty?.getAttribute('unitCode') ?? undefined,
    unitPrice: num(agreement, 'NetPriceProductTradePrice', 'ChargeAmount'),
    netAmount: num(settlement, 'SpecifiedTradeSettlementLineMonetarySummation', 'LineTotalAmount'),
    vatCategory: txt(settlement, 'ApplicableTradeTax', 'CategoryCode'),
    vatRate: num(settlement, 'ApplicableTradeTax', 'RateApplicablePercent'),
  };
}

function tax(el: Element): TaxBreakdown {
  return {
    category: txt(el, 'CategoryCode'),
    rate: num(el, 'RateApplicablePercent'),
    basis: num(el, 'BasisAmount'),
    amount: num(el, 'CalculatedAmount'),
    exemptionReason: txt(el, 'ExemptionReason'),
    exemptionReasonCode: txt(el, 'ExemptionReasonCode'),
    dueDateTypeCode: txt(el, 'DueDateTypeCode'),
  };
}

/** Transforme un XML CII en objet facture. Lève XmlParseError si ce n'est pas du CII. */
export function readInvoice(xml: string | ParsedXml): Invoice {
  const parsed = typeof xml === 'string' ? parseXml(xml) : xml;
  if (parsed.kind !== 'CII') {
    const why =
      parsed.kind === 'ZUGFERD1'
        ? 'Ce fichier est au format ZUGFeRD 1.0 (CrossIndustryDocument), un ancien format qui n’est plus accepté par la réforme française.'
        : parsed.kind === 'UBL'
          ? 'Ce fichier est une facture UBL, pas du CII. Factur-X utilise exclusivement la syntaxe CII.'
          : `Racine XML inattendue : <${parsed.root.localName}>. Une facture Factur-X commence par <rsm:CrossIndustryInvoice>.`;
    throw new XmlParseError(why);
  }
  const r = parsed.root;
  const ctx = at(r, 'ExchangedDocumentContext');
  const docEl = at(r, 'ExchangedDocument');
  const tx = at(r, 'SupplyChainTradeTransaction');
  const agreement = at(tx, 'ApplicableHeaderTradeAgreement');
  const delivery = at(tx, 'ApplicableHeaderTradeDelivery');
  const settlement = at(tx, 'ApplicableHeaderTradeSettlement');
  const sum = at(settlement, 'SpecifiedTradeSettlementHeaderMonetarySummation');
  const means = at(settlement, 'SpecifiedTradeSettlementPaymentMeans');
  const terms = at(settlement, 'SpecifiedTradePaymentTerms');
  const guidelineId = txt(ctx, 'GuidelineSpecifiedDocumentContextParameter', 'ID');
  const shipToEl = at(delivery, 'ShipToTradeParty');

  // TaxTotalAmount peut apparaître deux fois (devise de facture et devise de TVA).
  const currency = txt(settlement, 'InvoiceCurrencyCode');
  const taxTotals = kids(sum, 'TaxTotalAmount');
  const taxTotalEl = taxTotals.find((t) => !t.getAttribute('currencyID') || t.getAttribute('currencyID') === currency) ?? taxTotals[0];

  return {
    profile: detectProfile(guidelineId),
    guidelineId,
    businessProcess: txt(ctx, 'BusinessProcessSpecifiedDocumentContextParameter', 'ID'),
    number: txt(docEl, 'ID'),
    typeCode: txt(docEl, 'TypeCode'),
    issueDate: cdate(docEl, 'IssueDateTime'),
    currency,
    buyerReference: txt(agreement, 'BuyerReference'),
    orderReference: txt(agreement, 'BuyerOrderReferencedDocument', 'IssuerAssignedID'),
    deliveryDate: cdate(delivery, 'ActualDeliverySupplyChainEvent', 'OccurrenceDateTime'),
    seller: party(at(agreement, 'SellerTradeParty')),
    buyer: party(at(agreement, 'BuyerTradeParty')),
    shipTo: shipToEl ? party(shipToEl) : undefined,
    notes: kids(docEl, 'IncludedNote').map((n) => ({
      subject: txt(n, 'SubjectCode'),
      content: txt(n, 'Content') ?? '',
    })),
    lines: kids(tx, 'IncludedSupplyChainTradeLineItem').map(line),
    taxes: kids(settlement, 'ApplicableTradeTax').map(tax),
    totals: {
      lineTotal: num(sum, 'LineTotalAmount'),
      chargeTotal: num(sum, 'ChargeTotalAmount'),
      allowanceTotal: num(sum, 'AllowanceTotalAmount'),
      taxBasis: num(sum, 'TaxBasisTotalAmount'),
      taxTotal: taxTotalEl?.textContent ? Number(taxTotalEl.textContent.trim()) : undefined,
      rounding: num(sum, 'RoundingAmount'),
      grandTotal: num(sum, 'GrandTotalAmount'),
      prepaid: num(sum, 'TotalPrepaidAmount'),
      duePayable: num(sum, 'DuePayableAmount'),
    },
    dueDate: cdate(terms, 'DueDateDateTime'),
    paymentTerms: txt(terms, 'Description'),
    paymentMeansCode: txt(means, 'TypeCode'),
    iban: txt(means, 'PayeePartyCreditorFinancialAccount', 'IBANID'),
    bic: txt(means, 'PayeeSpecifiedCreditorFinancialInstitution', 'BICID'),
    paymentReference: txt(settlement, 'PaymentReference'),
  };
}
