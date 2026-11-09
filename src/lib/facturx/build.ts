import { GUIDELINE_IDS } from './codes';

/*
 * Génération d'un XML CII au profil EN 16931 (« COMFORT » en ZUGFeRD).
 * L'ordre des éléments suit strictement le schéma XSD Factur-X : un élément
 * mal placé suffit à rendre le fichier invalide.
 */

export interface PartyInput {
  name: string;
  /** SIREN (9 chiffres) pour une entreprise française. */
  siren?: string;
  vatId?: string;
  email?: string;
  line1?: string;
  line2?: string;
  postcode?: string;
  city?: string;
  country: string;
}

export interface LineInput {
  name: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  /** Taux de TVA en % (ignoré en franchise en base). */
  vatRate: number;
}

export interface GeneratorInput {
  number: string;
  issueDate: string; // AAAA-MM-JJ
  typeCode: '380' | '381' | '384' | '386';
  currency: string;
  /** BT-23 : S1, B1, M1… */
  businessProcess?: string;
  seller: PartyInput;
  buyer: PartyInput;
  buyerReference?: string;
  orderReference?: string;
  deliveryDate?: string;
  shipTo?: { name?: string; line1?: string; line2?: string; postcode?: string; city?: string; country: string };
  /** « franchise » = TVA non applicable, art. 293 B du CGI. */
  vatRegime: 'normal' | 'franchise';
  vatOnDebits?: boolean;
  lines: LineInput[];
  dueDate?: string;
  paymentTerms?: string;
  iban?: string;
  bic?: string;
  paymentReference?: string;
  notes?: { subject: string; content: string }[];
}

export interface ComputedLine extends LineInput {
  netAmount: number;
  category: string;
  rate: number;
}

export interface ComputedTax {
  category: string;
  rate: number;
  basis: number;
  amount: number;
  exemptionReason?: string;
}

export interface Computed {
  lines: ComputedLine[];
  taxes: ComputedTax[];
  lineTotal: number;
  taxBasis: number;
  taxTotal: number;
  grandTotal: number;
  duePayable: number;
}

export const FRANCHISE_REASON = 'TVA non applicable, art. 293 B du CGI';

/** Arrondi commercial à 2 décimales, robuste aux erreurs binaires (1.005 → 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100 || 0;
}

export function compute(input: Pick<GeneratorInput, 'lines' | 'vatRegime'>): Computed {
  const franchise = input.vatRegime === 'franchise';
  const lines: ComputedLine[] = input.lines.map((l) => ({
    ...l,
    netAmount: round2(l.quantity * l.unitPrice),
    category: franchise ? 'E' : l.vatRate === 0 ? 'Z' : 'S',
    rate: franchise ? 0 : l.vatRate,
  }));
  const groups = new Map<string, ComputedTax>();
  for (const l of lines) {
    const key = `${l.category}|${l.rate}`;
    const g = groups.get(key) ?? {
      category: l.category,
      rate: l.rate,
      basis: 0,
      amount: 0,
      exemptionReason: l.category === 'E' ? FRANCHISE_REASON : undefined,
    };
    g.basis = round2(g.basis + l.netAmount);
    groups.set(key, g);
  }
  const taxes = [...groups.values()].map((g) => ({ ...g, amount: round2((g.basis * g.rate) / 100) }));
  const lineTotal = round2(lines.reduce((s, l) => s + l.netAmount, 0));
  const taxTotal = round2(taxes.reduce((s, t) => s + t.amount, 0));
  const grandTotal = round2(lineTotal + taxTotal);
  return { lines, taxes, lineTotal, taxBasis: lineTotal, taxTotal, grandTotal, duePayable: grandTotal };
}

// --- Sérialisation ---------------------------------------------------------------

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const amt = (n: number) => n.toFixed(2);

/** Quantités et prix unitaires : jusqu'à 4 décimales, sans zéros inutiles. */
function dec(n: number): string {
  return String(Number(n.toFixed(4)));
}

const d102 = (iso: string) => `<udt:DateTimeString format="102">${iso.replace(/-/g, '')}</udt:DateTimeString>`;

function el(tag: string, value: string | undefined, attrs = ''): string {
  if (value === undefined || value === '') return '';
  return `<${tag}${attrs}>${esc(value)}</${tag}>`;
}

function address(p: { line1?: string; line2?: string; postcode?: string; city?: string; country: string }): string {
  return (
    '<ram:PostalTradeAddress>' +
    el('ram:PostcodeCode', p.postcode) +
    el('ram:LineOne', p.line1) +
    el('ram:LineTwo', p.line2) +
    el('ram:CityName', p.city) +
    el('ram:CountryID', p.country.toUpperCase()) +
    '</ram:PostalTradeAddress>'
  );
}

function party(tag: string, p: PartyInput, opts: { fcFallback?: boolean } = {}): string {
  const siren = p.siren?.replace(/\s/g, '');
  const vat = p.vatId?.replace(/\s/g, '').toUpperCase();
  let taxReg = '';
  if (vat) taxReg = `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(vat)}</ram:ID></ram:SpecifiedTaxRegistration>`;
  else if (opts.fcFallback && siren)
    taxReg = `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(siren)}</ram:ID></ram:SpecifiedTaxRegistration>`;
  return (
    `<${tag}>` +
    el('ram:Name', p.name) +
    (siren
      ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(siren)}</ram:ID></ram:SpecifiedLegalOrganization>`
      : '') +
    address(p) +
    (p.email
      ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email)}</ram:URIID></ram:URIUniversalCommunication>`
      : '') +
    taxReg +
    `</${tag}>`
  );
}

/** Construit le XML CII (profil EN 16931) à embarquer sous le nom factur-x.xml. */
export function buildXml(input: GeneratorInput): string {
  const c = compute(input);
  const cur = input.currency || 'EUR';
  const franchise = input.vatRegime === 'franchise';

  const notes = (input.notes ?? [])
    .filter((n) => n.content.trim())
    .map(
      (n) =>
        `<ram:IncludedNote><ram:Content>${esc(n.content.trim())}</ram:Content>${el('ram:SubjectCode', n.subject)}</ram:IncludedNote>`,
    )
    .join('');

  const lines = c.lines
    .map(
      (l, i) =>
        '<ram:IncludedSupplyChainTradeLineItem>' +
        `<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>` +
        `<ram:SpecifiedTradeProduct>${el('ram:Name', l.name)}</ram:SpecifiedTradeProduct>` +
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${dec(l.unitPrice)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>` +
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${esc(l.unitCode)}">${dec(l.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
        '<ram:SpecifiedLineTradeSettlement>' +
        `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${l.category}</ram:CategoryCode><ram:RateApplicablePercent>${dec(l.rate)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amt(l.netAmount)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>` +
        '</ram:SpecifiedLineTradeSettlement>' +
        '</ram:IncludedSupplyChainTradeLineItem>',
    )
    .join('');

  const taxes = c.taxes
    .map(
      (t) =>
        '<ram:ApplicableTradeTax>' +
        `<ram:CalculatedAmount>${amt(t.amount)}</ram:CalculatedAmount>` +
        '<ram:TypeCode>VAT</ram:TypeCode>' +
        el('ram:ExemptionReason', t.exemptionReason) +
        `<ram:BasisAmount>${amt(t.basis)}</ram:BasisAmount>` +
        `<ram:CategoryCode>${t.category}</ram:CategoryCode>` +
        (input.vatOnDebits && t.category === 'S' ? '<ram:DueDateTypeCode>5</ram:DueDateTypeCode>' : '') +
        `<ram:RateApplicablePercent>${dec(t.rate)}</ram:RateApplicablePercent>` +
        '</ram:ApplicableTradeTax>',
    )
    .join('');

  const iban = input.iban?.replace(/\s/g, '').toUpperCase();
  const bic = input.bic?.replace(/\s/g, '').toUpperCase();
  const paymentMeans = iban
    ? '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode>' +
      `<ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>` +
      (bic
        ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`
        : '') +
      '</ram:SpecifiedTradeSettlementPaymentMeans>'
    : '';

  const terms =
    input.paymentTerms || input.dueDate
      ? '<ram:SpecifiedTradePaymentTerms>' +
        el('ram:Description', input.paymentTerms) +
        (input.dueDate ? `<ram:DueDateDateTime>${d102(input.dueDate)}</ram:DueDateDateTime>` : '') +
        '</ram:SpecifiedTradePaymentTerms>'
      : '';

  const shipTo = input.shipTo
    ? '<ram:ShipToTradeParty>' + el('ram:Name', input.shipTo.name) + address(input.shipTo) + '</ram:ShipToTradeParty>'
    : '';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:xs="http://www.w3.org/2001/XMLSchema">' +
    '<rsm:ExchangedDocumentContext>' +
    (input.businessProcess
      ? `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${esc(input.businessProcess)}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>`
      : '') +
    `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${GUIDELINE_IDS['EN 16931']}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>` +
    '</rsm:ExchangedDocumentContext>' +
    '<rsm:ExchangedDocument>' +
    el('ram:ID', input.number) +
    `<ram:TypeCode>${input.typeCode}</ram:TypeCode>` +
    `<ram:IssueDateTime>${d102(input.issueDate)}</ram:IssueDateTime>` +
    notes +
    '</rsm:ExchangedDocument>' +
    '<rsm:SupplyChainTradeTransaction>' +
    lines +
    '<ram:ApplicableHeaderTradeAgreement>' +
    el('ram:BuyerReference', input.buyerReference) +
    party('ram:SellerTradeParty', input.seller, { fcFallback: franchise }) +
    party('ram:BuyerTradeParty', input.buyer) +
    (input.orderReference
      ? `<ram:BuyerOrderReferencedDocument><ram:IssuerAssignedID>${esc(input.orderReference)}</ram:IssuerAssignedID></ram:BuyerOrderReferencedDocument>`
      : '') +
    '</ram:ApplicableHeaderTradeAgreement>' +
    '<ram:ApplicableHeaderTradeDelivery>' +
    shipTo +
    (input.deliveryDate
      ? `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>${d102(input.deliveryDate)}</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`
      : '') +
    '</ram:ApplicableHeaderTradeDelivery>' +
    '<ram:ApplicableHeaderTradeSettlement>' +
    el('ram:PaymentReference', input.paymentReference) +
    `<ram:InvoiceCurrencyCode>${esc(cur)}</ram:InvoiceCurrencyCode>` +
    paymentMeans +
    taxes +
    terms +
    '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>' +
    `<ram:LineTotalAmount>${amt(c.lineTotal)}</ram:LineTotalAmount>` +
    `<ram:TaxBasisTotalAmount>${amt(c.taxBasis)}</ram:TaxBasisTotalAmount>` +
    `<ram:TaxTotalAmount currencyID="${esc(cur)}">${amt(c.taxTotal)}</ram:TaxTotalAmount>` +
    `<ram:GrandTotalAmount>${amt(c.grandTotal)}</ram:GrandTotalAmount>` +
    `<ram:DuePayableAmount>${amt(c.duePayable)}</ram:DuePayableAmount>` +
    '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>' +
    '</ram:ApplicableHeaderTradeSettlement>' +
    '</rsm:SupplyChainTradeTransaction>' +
    '</rsm:CrossIndustryInvoice>\n'
  );
}

/** Notes recommandées par la pratique française (CIUS FR) : PMT, PMD, AAB. */
export function defaultFrenchNotes(): { subject: string; content: string }[] {
  return [
    { subject: 'PMT', content: 'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.' },
    {
      subject: 'PMD',
      content:
        'En cas de retard de paiement, pénalités au taux égal à trois fois le taux d’intérêt légal.',
    },
    { subject: 'AAB', content: 'Pas d’escompte pour paiement anticipé.' },
  ];
}
