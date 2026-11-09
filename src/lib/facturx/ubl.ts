import { detectProfile } from './codes';
import { at, kids, txt, type ParsedXml } from './parse';
import type { Address, Invoice, InvoiceLine, Note, Party, TaxBreakdown } from './types';

/*
 * Lecture d'une facture UBL 2.1 (syntaxe UBL de la norme EN 16931), l'un des trois
 * formats de la réforme française avec CII et Factur-X. La facture est convertie dans
 * le même modèle que le CII, ce qui permet d'appliquer les mêmes contrôles.
 */

const num = (el: Element | null | undefined, ...path: string[]) => {
  const v = txt(el, ...path);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Les dates UBL sont déjà au format AAAA-MM-JJ. */
const date = (el: Element | null | undefined, ...path: string[]) => txt(el, ...path)?.slice(0, 10);

/** BT-8 : UBL utilise la liste UNTDID 2005 (3, 35, 432), CII la liste 2475 (5, 29, 72). */
const DUE_DATE_UBL_TO_CII: Record<string, string> = { '3': '5', '35': '29', '432': '72' };

function address(a: Element | null): Address {
  return {
    line1: txt(a, 'StreetName'),
    line2: txt(a, 'AdditionalStreetName'),
    line3: txt(a, 'AddressLine', 'Line'),
    postcode: txt(a, 'PostalZone'),
    city: txt(a, 'CityName'),
    country: txt(a, 'Country', 'IdentificationCode'),
  };
}

function party(p: Element | null): Party {
  const legal = at(p, 'PartyLegalEntity', 'CompanyID');
  const taxSchemes = kids(p, 'PartyTaxScheme');
  const vat = taxSchemes.find((t) => (txt(t, 'TaxScheme', 'ID') ?? '').toUpperCase() === 'VAT');
  const other = taxSchemes.find((t) => t !== vat);
  return {
    name: txt(p, 'PartyLegalEntity', 'RegistrationName') ?? txt(p, 'PartyName', 'Name'),
    legalId: legal?.textContent?.trim() || undefined,
    legalIdScheme: legal?.getAttribute('schemeID') ?? undefined,
    vatId: txt(vat, 'CompanyID'),
    taxRegistration: txt(other, 'CompanyID'),
    email: txt(p, 'Contact', 'ElectronicMail') ?? txt(p, 'EndpointID'),
    address: address(at(p, 'PostalAddress')),
  };
}

/** Notes UBL : la convention EN 16931 place le code sujet en tête, sous la forme « #PMT#texte ». */
function note(text: string): Note {
  const m = /^#([A-Z]{3})#([\s\S]*)$/.exec(text.trim());
  return m ? { subject: m[1], content: m[2].trim() } : { content: text.trim() };
}

export function readUbl(parsed: ParsedXml): Invoice {
  const r = parsed.root;
  const credit = r.localName === 'CreditNote';
  const lineTag = credit ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyTag = credit ? 'CreditedQuantity' : 'InvoicedQuantity';
  const currency = txt(r, 'DocumentCurrencyCode');
  const guidelineId = txt(r, 'CustomizationID');
  const sum = at(r, 'LegalMonetaryTotal');
  const means = at(r, 'PaymentMeans');
  const delivery = at(r, 'Delivery');
  const shipAddress = at(delivery, 'DeliveryLocation', 'Address');

  // TaxTotal peut apparaître deux fois : en devise de facture (avec ventilation) et en devise de TVA.
  const taxTotals = kids(r, 'TaxTotal');
  const mainTax =
    taxTotals.find((t) => at(t, 'TaxAmount')?.getAttribute('currencyID') === currency) ?? taxTotals.find((t) => kids(t, 'TaxSubtotal').length) ?? taxTotals[0];
  const dueCode = txt(r, 'InvoicePeriod', 'DescriptionCode');

  const taxes: TaxBreakdown[] = kids(mainTax, 'TaxSubtotal').map((s) => ({
    category: txt(s, 'TaxCategory', 'ID'),
    rate: num(s, 'TaxCategory', 'Percent'),
    basis: num(s, 'TaxableAmount'),
    amount: num(s, 'TaxAmount'),
    exemptionReason: txt(s, 'TaxCategory', 'TaxExemptionReason'),
    exemptionReasonCode: txt(s, 'TaxCategory', 'TaxExemptionReasonCode'),
    dueDateTypeCode: dueCode ? DUE_DATE_UBL_TO_CII[dueCode] ?? dueCode : undefined,
  }));

  const lines: InvoiceLine[] = kids(r, lineTag).map((l) => {
    const q = at(l, qtyTag);
    const price = num(l, 'Price', 'PriceAmount');
    const base = num(l, 'Price', 'BaseQuantity');
    return {
      id: txt(l, 'ID'),
      name: txt(l, 'Item', 'Name'),
      description: txt(l, 'Item', 'Description'),
      quantity: q?.textContent ? Number(q.textContent.trim()) : undefined,
      unitCode: q?.getAttribute('unitCode') ?? undefined,
      unitPrice: price !== undefined && base ? price / base : price,
      netAmount: num(l, 'LineExtensionAmount'),
      vatCategory: txt(l, 'Item', 'ClassifiedTaxCategory', 'ID'),
      vatRate: num(l, 'Item', 'ClassifiedTaxCategory', 'Percent'),
    };
  });

  const shipName = txt(delivery, 'DeliveryParty', 'PartyName', 'Name');
  return {
    profile: detectProfile(guidelineId),
    guidelineId,
    businessProcess: txt(r, 'ProfileID'),
    number: txt(r, 'ID'),
    typeCode: txt(r, credit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode') ?? (credit ? '381' : '380'),
    issueDate: date(r, 'IssueDate'),
    currency,
    buyerReference: txt(r, 'BuyerReference'),
    orderReference: txt(r, 'OrderReference', 'ID'),
    deliveryDate: date(delivery, 'ActualDeliveryDate'),
    seller: party(at(r, 'AccountingSupplierParty', 'Party')),
    buyer: party(at(r, 'AccountingCustomerParty', 'Party')),
    shipTo: shipAddress || shipName ? { name: shipName, address: address(shipAddress) } : undefined,
    notes: kids(r, 'Note').map((n) => note(n.textContent ?? '')).filter((n) => n.content),
    lines,
    taxes,
    totals: {
      lineTotal: num(sum, 'LineExtensionAmount'),
      chargeTotal: num(sum, 'ChargeTotalAmount'),
      allowanceTotal: num(sum, 'AllowanceTotalAmount'),
      taxBasis: num(sum, 'TaxExclusiveAmount'),
      taxTotal: num(mainTax, 'TaxAmount'),
      rounding: num(sum, 'PayableRoundingAmount'),
      grandTotal: num(sum, 'TaxInclusiveAmount'),
      prepaid: num(sum, 'PrepaidAmount'),
      duePayable: num(sum, 'PayableAmount'),
    },
    dueDate: date(r, 'DueDate') ?? date(means, 'PaymentDueDate'),
    paymentTerms: txt(r, 'PaymentTerms', 'Note'),
    paymentMeansCode: txt(means, 'PaymentMeansCode'),
    iban: txt(means, 'PayeeFinancialAccount', 'ID'),
    bic: txt(means, 'PayeeFinancialAccount', 'FinancialInstitutionBranch', 'ID'),
    paymentReference: txt(means, 'PaymentID'),
  };
}
