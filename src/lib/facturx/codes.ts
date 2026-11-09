import type { ProfileId } from './types';

export const NS = {
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
  qdt: 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
} as const;

/** Identifiants de guideline (BT-24) par profil, tels que définis par Factur-X 1.0x. */
export const GUIDELINE_IDS: Record<Exclude<ProfileId, 'INCONNU' | 'XRECHNUNG'>, string> = {
  MINIMUM: 'urn:factur-x.eu:1p0:minimum',
  'BASIC WL': 'urn:factur-x.eu:1p0:basicwl',
  BASIC: 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
  'EN 16931': 'urn:cen.eu:en16931:2017',
  EXTENDED: 'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended',
};

export function detectProfile(guidelineId: string | undefined): ProfileId {
  if (!guidelineId) return 'INCONNU';
  const id = guidelineId.trim().toLowerCase();
  if (id.includes('xrechnung')) return 'XRECHNUNG';
  if (id.includes('1p0:minimum')) return 'MINIMUM';
  if (id.includes('1p0:basicwl')) return 'BASIC WL';
  if (id.includes('1p0:basic')) return 'BASIC';
  if (id.includes('1p0:extended') || id.includes('zugferd.de:2p0:extended') || id.includes(':extended'))
    return 'EXTENDED';
  if (id.startsWith('urn:cen.eu:en16931:2017')) return 'EN 16931';
  return 'INCONNU';
}

/** UNTDID 1001 : types de documents les plus courants. */
export const DOCUMENT_TYPES: Record<string, string> = {
  '380': 'Facture',
  '381': 'Avoir',
  '384': 'Facture rectificative',
  '386': "Facture d'acompte",
  '389': 'Autofacture',
  '261': 'Autofacture d’avoir',
  '262': 'Avoir global',
  '383': 'Note de débit',
  '393': 'Facture d’affacturage',
  '396': 'Avoir d’affacturage',
  '751': 'Information de facture (comptabilité)',
};

/** UNTDID 5305 : catégories de TVA. */
export const VAT_CATEGORIES: Record<string, string> = {
  S: 'Taux normal',
  Z: 'Taux zéro',
  E: 'Exonéré',
  AE: 'Autoliquidation',
  K: 'Livraison intracommunautaire',
  G: 'Exportation hors UE',
  O: 'Hors champ de la TVA',
  L: 'Canaries (IGIC)',
  M: 'Ceuta et Melilla (IPSI)',
};

/** UN/ECE Rec. 20 : unités usuelles. */
export const UNIT_CODES: Record<string, string> = {
  C62: 'unité',
  H87: 'pièce',
  HUR: 'heure',
  DAY: 'jour',
  MON: 'mois',
  ANN: 'an',
  MIN: 'minute',
  KGM: 'kg',
  MTR: 'mètre',
  MTK: 'm²',
  LTR: 'litre',
  KWH: 'kWh',
  LS: 'forfait',
  XPP: 'pièce',
};

/** UNTDID 4461 : moyens de paiement usuels. */
export const PAYMENT_MEANS: Record<string, string> = {
  '10': 'Espèces',
  '20': 'Chèque',
  '30': 'Virement',
  '42': 'Paiement sur compte bancaire',
  '48': 'Carte bancaire',
  '49': 'Prélèvement',
  '57': 'Ordre permanent',
  '58': 'Virement SEPA',
  '59': 'Prélèvement SEPA',
  '97': 'Compensation',
};

/** BT-23 « cadre de facturation » (réforme française). Liste partielle : les cas les plus fréquents. */
export const BUSINESS_PROCESS_FR: Record<string, string> = {
  B1: 'Dépôt d’une facture de biens',
  S1: 'Dépôt d’une facture de services',
  M1: 'Dépôt d’une facture mixte (biens et services)',
  B2: 'Dépôt d’une facture de biens déjà payée',
  S2: 'Dépôt d’une facture de services déjà payée',
  M2: 'Dépôt d’une facture mixte déjà payée',
  S3: 'Dépôt d’une facture de sous-traitance',
  B4: 'Dépôt d’une facture définitive de biens après acompte',
  S4: 'Dépôt d’une facture définitive de services après acompte',
  M4: 'Dépôt d’une facture définitive mixte après acompte',
  S5: 'Dépôt d’une facture par un sous-traitant',
  S6: 'Dépôt d’une facture par un cotraitant',
  B7: 'Dépôt d’une facture de biens déjà soumise à l’e-reporting',
  S7: 'Dépôt d’une facture de services déjà soumise à l’e-reporting',
};

/** UNTDID 2475 tel qu'utilisé par CII pour BT-8 (exigibilité de la TVA). */
export const VAT_DUE_DATE_CODES: Record<string, string> = {
  '5': 'Date de facture (option pour la TVA sur les débits)',
  '29': 'Date de livraison',
  '72': 'Date de paiement (encaissement)',
};

/** Codes de sujet des notes (UNTDID 4451) imposés par la pratique française. */
export const NOTE_SUBJECTS: Record<string, string> = {
  PMT: 'Indemnité forfaitaire de recouvrement',
  PMD: 'Pénalités de retard',
  AAB: 'Escompte',
  REG: 'Informations réglementaires',
  ABL: 'Informations légales',
  TXD: 'Information fiscale',
  AAI: 'Information générale',
  SUR: 'Remarques du fournisseur',
};

/** Noms de pièces jointes XML reconnus (comparés en minuscules). */
export const XML_ATTACHMENT_NAMES = ['factur-x.xml', 'zugferd-invoice.xml', 'xrechnung.xml'];
