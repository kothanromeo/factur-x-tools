/** Profils Factur-X (identiques aux profils ZUGFeRD 2.x). */
export type ProfileId =
  | 'MINIMUM'
  | 'BASIC WL'
  | 'BASIC'
  | 'EN 16931'
  | 'EXTENDED'
  | 'XRECHNUNG'
  | 'INCONNU';

/** Ordre des profils : chaque profil contient le précédent. */
export const PROFILE_RANK: Record<ProfileId, number> = {
  MINIMUM: 1,
  'BASIC WL': 2,
  BASIC: 3,
  'EN 16931': 4,
  XRECHNUNG: 4,
  EXTENDED: 5,
  INCONNU: 0,
};

export interface Address {
  line1?: string;
  line2?: string;
  line3?: string;
  postcode?: string;
  city?: string;
  country?: string;
}

export interface Party {
  name?: string;
  /** SIREN ou autre identifiant légal (BT-30 / BT-47). */
  legalId?: string;
  legalIdScheme?: string;
  /** Numéro de TVA intracommunautaire (BT-31 / BT-48). */
  vatId?: string;
  /** Identifiant fiscal local (BT-32), schemeID="FC". */
  taxRegistration?: string;
  email?: string;
  address: Address;
}

export interface InvoiceLine {
  id?: string;
  name?: string;
  description?: string;
  quantity?: number;
  unitCode?: string;
  unitPrice?: number;
  netAmount?: number;
  vatCategory?: string;
  vatRate?: number;
}

export interface TaxBreakdown {
  category?: string;
  rate?: number;
  basis?: number;
  amount?: number;
  exemptionReason?: string;
  exemptionReasonCode?: string;
  dueDateTypeCode?: string;
}

export interface Note {
  subject?: string;
  content: string;
}

export interface Totals {
  lineTotal?: number;
  chargeTotal?: number;
  allowanceTotal?: number;
  taxBasis?: number;
  taxTotal?: number;
  rounding?: number;
  grandTotal?: number;
  prepaid?: number;
  duePayable?: number;
}

/** Représentation lisible d'une facture CII (Factur-X / ZUGFeRD). */
export interface Invoice {
  /** Syntaxe XML de la facture. */
  syntax?: 'CII' | 'UBL';
  profile: ProfileId;
  guidelineId?: string;
  /** BT-23, « cadre de facturation » en France (S1, B1, M1…). */
  businessProcess?: string;
  number?: string;
  typeCode?: string;
  issueDate?: string;
  currency?: string;
  buyerReference?: string;
  orderReference?: string;
  deliveryDate?: string;
  seller: Party;
  buyer: Party;
  shipTo?: Party;
  notes: Note[];
  lines: InvoiceLine[];
  taxes: TaxBreakdown[];
  totals: Totals;
  dueDate?: string;
  paymentTerms?: string;
  paymentMeansCode?: string;
  iban?: string;
  bic?: string;
  paymentReference?: string;
}

export type Severity = 'error' | 'warning' | 'info';

export interface CheckResult {
  /** Identifiant de règle (BR-xx de la norme EN 16931, ou règle maison). */
  id: string;
  severity: Severity;
  passed: boolean;
  message: string;
  /** Groupe d'affichage. */
  group: 'Fichier PDF' | 'Structure XML' | 'Données obligatoires' | 'Calculs' | 'Réforme française';
}
