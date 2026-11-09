import { compute, esc, type GeneratorInput, type PartyInput } from './build';
import { GUIDELINE_IDS } from './codes';

/*
 * Génération d'une facture UBL 2.1 (syntaxe UBL de la norme EN 16931) à partir des
 * mêmes données que le générateur Factur-X. L'ordre des éléments suit le schéma UBL.
 */

const amt = (n: number) => n.toFixed(2);
const dec = (n: number) => String(Number(n.toFixed(4)));
const el = (tag: string, v: string | undefined, attrs = '') => (v === undefined || v === '' ? '' : `<${tag}${attrs}>${esc(v)}</${tag}>`);

function address(p: { line1?: string; line2?: string; postcode?: string; city?: string; country: string }) {
  return (
    '<cac:PostalAddress>' +
    el('cbc:StreetName', p.line1) +
    el('cbc:AdditionalStreetName', p.line2) +
    el('cbc:CityName', p.city) +
    el('cbc:PostalZone', p.postcode) +
    `<cac:Country><cbc:IdentificationCode>${esc(p.country.toUpperCase())}</cbc:IdentificationCode></cac:Country>` +
    '</cac:PostalAddress>'
  );
}

function party(tag: string, p: PartyInput, fcFallback = false) {
  const siren = p.siren?.replace(/\s/g, '');
  const vat = p.vatId?.replace(/\s/g, '').toUpperCase();
  return (
    `<cac:${tag}><cac:Party>` +
    (siren ? `<cbc:EndpointID schemeID="0002">${esc(siren)}</cbc:EndpointID>` : p.email ? `<cbc:EndpointID schemeID="EM">${esc(p.email)}</cbc:EndpointID>` : '') +
    `<cac:PartyName><cbc:Name>${esc(p.name)}</cbc:Name></cac:PartyName>` +
    address(p) +
    (vat ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(vat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : '') +
    (!vat && fcFallback && siren ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(siren)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : '') +
    `<cac:PartyLegalEntity><cbc:RegistrationName>${esc(p.name)}</cbc:RegistrationName>${siren ? `<cbc:CompanyID schemeID="0002">${esc(siren)}</cbc:CompanyID>` : ''}</cac:PartyLegalEntity>` +
    (p.email ? `<cac:Contact><cbc:ElectronicMail>${esc(p.email)}</cbc:ElectronicMail></cac:Contact>` : '') +
    `</cac:Party></cac:${tag}>`
  );
}

export function buildUbl(input: GeneratorInput): string {
  const c = compute(input);
  const cur = input.currency || 'EUR';
  const ca = ` currencyID="${esc(cur)}"`;
  const creditNote = input.typeCode === '381';
  const root = creditNote ? 'CreditNote' : 'Invoice';
  const lineTag = creditNote ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyTag = creditNote ? 'CreditedQuantity' : 'InvoicedQuantity';
  const franchise = input.vatRegime === 'franchise';
  const iban = input.iban?.replace(/\s/g, '').toUpperCase();
  const bic = input.bic?.replace(/\s/g, '').toUpperCase();

  const notes = (input.notes ?? []).filter((n) => n.content.trim()).map((n) => `<cbc:Note>#${esc(n.subject)}#${esc(n.content.trim())}</cbc:Note>`).join('');

  const taxSubtotals = c.taxes
    .map(
      (t) =>
        `<cac:TaxSubtotal><cbc:TaxableAmount${ca}>${amt(t.basis)}</cbc:TaxableAmount><cbc:TaxAmount${ca}>${amt(t.amount)}</cbc:TaxAmount>` +
        `<cac:TaxCategory><cbc:ID>${t.category}</cbc:ID><cbc:Percent>${dec(t.rate)}</cbc:Percent>${el('cbc:TaxExemptionReason', t.exemptionReason)}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`,
    )
    .join('');

  const lines = c.lines
    .map(
      (l, i) =>
        `<cac:${lineTag}><cbc:ID>${i + 1}</cbc:ID><cbc:${qtyTag} unitCode="${esc(l.unitCode)}">${dec(l.quantity)}</cbc:${qtyTag}>` +
        `<cbc:LineExtensionAmount${ca}>${amt(l.netAmount)}</cbc:LineExtensionAmount>` +
        `<cac:Item><cbc:Name>${esc(l.name)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${l.category}</cbc:ID><cbc:Percent>${dec(l.rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>` +
        `<cac:Price><cbc:PriceAmount${ca}>${dec(l.unitPrice)}</cbc:PriceAmount></cac:Price></cac:${lineTag}>`,
    )
    .join('');

  const ns =
    `xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" ` +
    'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" ' +
    'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<${root} ${ns}>` +
    `<cbc:CustomizationID>${GUIDELINE_IDS['EN 16931']}</cbc:CustomizationID>` +
    el('cbc:ProfileID', input.businessProcess) +
    el('cbc:ID', input.number) +
    `<cbc:IssueDate>${input.issueDate}</cbc:IssueDate>` +
    (!creditNote ? el('cbc:DueDate', input.dueDate) : '') +
    `<cbc:${creditNote ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>${input.typeCode}</cbc:${creditNote ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>` +
    notes +
    `<cbc:DocumentCurrencyCode>${esc(cur)}</cbc:DocumentCurrencyCode>` +
    el('cbc:BuyerReference', input.buyerReference) +
    (input.vatOnDebits && !franchise ? '<cac:InvoicePeriod><cbc:DescriptionCode>3</cbc:DescriptionCode></cac:InvoicePeriod>' : '') +
    (input.orderReference ? `<cac:OrderReference><cbc:ID>${esc(input.orderReference)}</cbc:ID></cac:OrderReference>` : '') +
    party('AccountingSupplierParty', input.seller, franchise) +
    party('AccountingCustomerParty', input.buyer) +
    (input.deliveryDate || input.shipTo
      ? '<cac:Delivery>' +
        el('cbc:ActualDeliveryDate', input.deliveryDate) +
        (input.shipTo ? `<cac:DeliveryLocation><cac:Address>${address(input.shipTo).replace(/<\/?cac:PostalAddress>/g, '')}</cac:Address></cac:DeliveryLocation>` : '') +
        (input.shipTo?.name ? `<cac:DeliveryParty><cac:PartyName><cbc:Name>${esc(input.shipTo.name)}</cbc:Name></cac:PartyName></cac:DeliveryParty>` : '') +
        '</cac:Delivery>'
      : '') +
    (iban
      ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>${creditNote ? el('cbc:PaymentDueDate', input.dueDate) : ''}${el('cbc:PaymentID', input.paymentReference)}` +
        `<cac:PayeeFinancialAccount><cbc:ID>${esc(iban)}</cbc:ID>${bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${esc(bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ''}</cac:PayeeFinancialAccount></cac:PaymentMeans>`
      : '') +
    (input.paymentTerms ? `<cac:PaymentTerms><cbc:Note>${esc(input.paymentTerms)}</cbc:Note></cac:PaymentTerms>` : '') +
    `<cac:TaxTotal><cbc:TaxAmount${ca}>${amt(c.taxTotal)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal>` +
    '<cac:LegalMonetaryTotal>' +
    `<cbc:LineExtensionAmount${ca}>${amt(c.lineTotal)}</cbc:LineExtensionAmount>` +
    `<cbc:TaxExclusiveAmount${ca}>${amt(c.taxBasis)}</cbc:TaxExclusiveAmount>` +
    `<cbc:TaxInclusiveAmount${ca}>${amt(c.grandTotal)}</cbc:TaxInclusiveAmount>` +
    `<cbc:PayableAmount${ca}>${amt(c.duePayable)}</cbc:PayableAmount>` +
    '</cac:LegalMonetaryTotal>' +
    lines +
    `</${root}>\n`
  );
}
