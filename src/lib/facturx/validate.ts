import { BUSINESS_PROCESS_FR, DOCUMENT_TYPES } from './codes';
import { round2 } from './build';
import type { CheckResult, Invoice, Party, Severity } from './types';
import { PROFILE_RANK } from './types';

/*
 * Contrôles de cohérence inspirés des règles métier de la norme EN 16931
 * (BR-xx, BR-CO-xx…) et des attentes françaises de la réforme 2026.
 *
 * Ce n'est PAS la validation Schematron officielle : c'est un sous-ensemble
 * de règles, choisies parce qu'elles expliquent la majorité des rejets que
 * l'on rencontre en pratique. Chaque résultat indique la règle d'origine.
 */

type Group = CheckResult['group'];

class Checks {
  results: CheckResult[] = [];
  add(group: Group, id: string, severity: Severity, passed: boolean, message: string) {
    this.results.push({ group, id, severity, passed, message });
  }
}

const eq = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && Math.abs(round2(a) - round2(b)) < 0.005;

const fmt = (n: number | undefined) =>
  n === undefined ? '—' : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function sirenValid(s: string): boolean {
  const v = s.replace(/\s/g, '');
  if (!/^\d{9}$/.test(v)) return false;
  // Clé de Luhn
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(v[8 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function hasSiren(p: Party): boolean {
  return !!p.legalId && (p.legalIdScheme === '0002' || p.legalIdScheme === undefined);
}

export function validateInvoice(inv: Invoice): CheckResult[] {
  const c = new Checks();
  const rank = PROFILE_RANK[inv.profile];
  const atLeast = (p: keyof typeof PROFILE_RANK) => rank >= PROFILE_RANK[p];
  const D: Group = 'Données obligatoires';
  const K: Group = 'Calculs';
  const S: Group = 'Structure XML';
  const F: Group = 'Réforme française';

  // --- Profil -------------------------------------------------------------------
  c.add(
    S,
    'BR-01',
    'error',
    !!inv.guidelineId,
    inv.guidelineId
      ? `Identifiant de spécification présent (BT-24) : ${inv.guidelineId}`
      : 'L’identifiant de spécification (BT-24, GuidelineSpecifiedDocumentContextParameter) est absent.',
  );
  c.add(
    S,
    'FX-PROFIL',
    'error',
    inv.profile !== 'INCONNU',
    inv.profile !== 'INCONNU'
      ? `Profil détecté : ${inv.profile}.`
      : 'Profil Factur-X non reconnu. Vérifiez la valeur de BT-24.',
  );
  if (inv.profile === 'MINIMUM' || inv.profile === 'BASIC WL') {
    c.add(
      F,
      'FR-PROFIL',
      'warning',
      false,
      `Le profil ${inv.profile} ne contient pas le détail des lignes : il n’est pas accepté comme facture électronique par la réforme française. Utilisez BASIC, EN 16931 ou EXTENDED.`,
    );
  }

  // --- En-tête --------------------------------------------------------------------
  c.add(D, 'BR-02', 'error', !!inv.number, inv.number ? `Numéro de facture : ${inv.number}` : 'Le numéro de facture (BT-1) est absent.');
  const dateOk = !!inv.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate) && !isNaN(Date.parse(inv.issueDate));
  c.add(D, 'BR-03', 'error', dateOk, dateOk ? `Date d’émission : ${inv.issueDate}` : 'La date d’émission (BT-2) est absente ou invalide (format attendu : AAAAMMJJ, format="102").');
  c.add(
    D,
    'BR-04',
    'error',
    !!inv.typeCode && inv.typeCode in DOCUMENT_TYPES,
    inv.typeCode
      ? inv.typeCode in DOCUMENT_TYPES
        ? `Type de document : ${inv.typeCode} (${DOCUMENT_TYPES[inv.typeCode]})`
        : `Code de type de document inhabituel : ${inv.typeCode}.`
      : 'Le type de document (BT-3) est absent.',
  );
  c.add(D, 'BR-05', 'error', !!inv.currency, inv.currency ? `Devise : ${inv.currency}` : 'La devise de facturation (BT-5) est absente.');
  c.add(D, 'BR-06', 'error', !!inv.seller.name, inv.seller.name ? `Vendeur : ${inv.seller.name}` : 'Le nom du vendeur (BT-27) est absent.');
  c.add(D, 'BR-07', 'error', !!inv.buyer.name, inv.buyer.name ? `Acheteur : ${inv.buyer.name}` : 'Le nom de l’acheteur (BT-44) est absent.');
  c.add(D, 'BR-09', 'error', !!inv.seller.address.country, inv.seller.address.country ? `Pays du vendeur : ${inv.seller.address.country}` : 'Le code pays du vendeur (BT-40) est absent.');
  if (atLeast('BASIC WL')) {
    c.add(D, 'BR-11', 'error', !!inv.buyer.address.country, inv.buyer.address.country ? `Pays de l’acheteur : ${inv.buyer.address.country}` : 'Le code pays de l’acheteur (BT-55) est absent.');
  }
  c.add(
    D,
    'BR-CO-26',
    'error',
    !!(inv.seller.legalId || inv.seller.vatId),
    inv.seller.legalId || inv.seller.vatId
      ? 'Le vendeur est identifiable (SIREN ou numéro de TVA).'
      : 'Le vendeur n’a ni identifiant légal (BT-30) ni numéro de TVA (BT-31).',
  );

  // --- Lignes ------------------------------------------------------------------------
  if (atLeast('BASIC')) {
    c.add(D, 'BR-16', 'error', inv.lines.length > 0, inv.lines.length > 0 ? `${inv.lines.length} ligne(s) de facture.` : 'La facture ne contient aucune ligne (BG-25).');
    inv.lines.forEach((l, i) => {
      const n = l.id ?? String(i + 1);
      const missing: string[] = [];
      if (!l.id) missing.push('identifiant (BT-126)');
      if (l.quantity === undefined) missing.push('quantité (BT-129)');
      if (!l.unitCode) missing.push('unité (BT-130)');
      if (l.netAmount === undefined) missing.push('montant net (BT-131)');
      if (l.unitPrice === undefined) missing.push('prix net (BT-146)');
      if (!l.name) missing.push('désignation (BT-153)');
      if (!l.vatCategory) missing.push('catégorie de TVA (BT-151)');
      c.add(D, 'BR-21…26', 'error', missing.length === 0, missing.length === 0 ? `Ligne ${n} complète.` : `Ligne ${n} : il manque ${missing.join(', ')}.`);
      if (l.quantity !== undefined && l.unitPrice !== undefined && l.netAmount !== undefined) {
        const expected = round2(l.quantity * l.unitPrice);
        // Remises et charges de ligne non lues ici : simple avertissement.
        if (!eq(expected, l.netAmount)) {
          c.add(K, 'LIGNE-CALC', 'warning', false, `Ligne ${n} : quantité × prix = ${fmt(expected)}, mais le montant net déclaré est ${fmt(l.netAmount)} (remise ou charge de ligne ?).`);
        }
      }
    });
  }

  // --- Totaux ------------------------------------------------------------------------
  const t = inv.totals;
  c.add(K, 'BR-12…15', 'error', t.taxBasis !== undefined && t.grandTotal !== undefined && t.duePayable !== undefined,
    t.taxBasis !== undefined && t.grandTotal !== undefined && t.duePayable !== undefined
      ? 'Totaux présents (HT, TTC, net à payer).'
      : 'Il manque un total obligatoire : total HT (BT-109), total TTC (BT-112) ou net à payer (BT-115).');

  if (atLeast('BASIC') && inv.lines.length) {
    const sumLines = round2(inv.lines.reduce((s, l) => s + (l.netAmount ?? 0), 0));
    c.add(K, 'BR-CO-10', 'error', eq(sumLines, t.lineTotal),
      eq(sumLines, t.lineTotal)
        ? `Somme des lignes = total des lignes (${fmt(sumLines)}).`
        : `Somme des lignes (${fmt(sumLines)}) ≠ total des lignes déclaré BT-106 (${fmt(t.lineTotal)}).`);
  }
  if (atLeast('BASIC WL') && t.lineTotal !== undefined && t.taxBasis !== undefined) {
    const expected = round2(t.lineTotal - (t.allowanceTotal ?? 0) + (t.chargeTotal ?? 0));
    c.add(K, 'BR-CO-13', 'error', eq(expected, t.taxBasis),
      eq(expected, t.taxBasis)
        ? `Total HT cohérent (${fmt(t.taxBasis)}).`
        : `Total HT attendu ${fmt(expected)} (lignes − remises + charges), déclaré ${fmt(t.taxBasis)}.`);
  }
  if (atLeast('BASIC WL')) {
    c.add(K, 'BR-CO-18', 'error', inv.taxes.length > 0, inv.taxes.length > 0 ? `${inv.taxes.length} ventilation(s) de TVA.` : 'Aucune ventilation de TVA (BG-23).');
    const sumTax = round2(inv.taxes.reduce((s, x) => s + (x.amount ?? 0), 0));
    if (inv.taxes.length) {
      c.add(K, 'BR-CO-14', 'error', eq(sumTax, t.taxTotal ?? 0),
        eq(sumTax, t.taxTotal ?? 0)
          ? `Total TVA = somme des ventilations (${fmt(sumTax)}).`
          : `Somme des ventilations de TVA (${fmt(sumTax)}) ≠ total TVA déclaré BT-110 (${fmt(t.taxTotal)}).`);
    }
    inv.taxes.forEach((x) => {
      if (x.basis === undefined || x.amount === undefined || x.rate === undefined) return;
      const expected = round2((x.basis * x.rate) / 100);
      c.add(K, 'BR-CO-17', 'error', eq(expected, x.amount),
        eq(expected, x.amount)
          ? `TVA ${x.category} ${x.rate} % : ${fmt(x.basis)} × ${x.rate} % = ${fmt(x.amount)}.`
          : `TVA ${x.category} ${x.rate} % : ${fmt(x.basis)} × ${x.rate} % = ${fmt(expected)}, déclaré ${fmt(x.amount)}.`);
      if (atLeast('BASIC') && inv.lines.length) {
        const lineBasis = round2(
          inv.lines.filter((l) => l.vatCategory === x.category && (l.vatRate ?? 0) === x.rate).reduce((s, l) => s + (l.netAmount ?? 0), 0),
        );
        const hasDocLevel = (t.allowanceTotal ?? 0) !== 0 || (t.chargeTotal ?? 0) !== 0;
        if (!hasDocLevel) {
          c.add(K, 'BR-S-08', 'error', eq(lineBasis, x.basis),
            eq(lineBasis, x.basis)
              ? `Base ${x.category} ${x.rate} % = somme des lignes concernées.`
              : `Base ${x.category} ${x.rate} % déclarée ${fmt(x.basis)}, somme des lignes concernées ${fmt(lineBasis)}.`);
        }
      }
      if (x.category === 'E' || x.category === 'AE' || x.category === 'K' || x.category === 'G' || x.category === 'O') {
        c.add(D, `BR-${x.category}-10`, 'error', !!(x.exemptionReason || x.exemptionReasonCode),
          x.exemptionReason || x.exemptionReasonCode
            ? `Motif d’exonération indiqué : ${x.exemptionReason ?? x.exemptionReasonCode}`
            : `Catégorie ${x.category} sans motif d’exonération (BT-120 ou BT-121). En franchise en base, indiquez « TVA non applicable, art. 293 B du CGI ».`);
      }
    });
  }
  if (t.taxBasis !== undefined && t.grandTotal !== undefined) {
    const expected = round2(t.taxBasis + (t.taxTotal ?? 0));
    c.add(K, 'BR-CO-15', 'error', eq(expected, t.grandTotal),
      eq(expected, t.grandTotal)
        ? `Total TTC = HT + TVA (${fmt(t.grandTotal)}).`
        : `Total TTC attendu ${fmt(expected)} (HT + TVA), déclaré ${fmt(t.grandTotal)}.`);
  }
  if (t.grandTotal !== undefined && t.duePayable !== undefined) {
    const expected = round2(t.grandTotal - (t.prepaid ?? 0) + (t.rounding ?? 0));
    c.add(K, 'BR-CO-16', 'error', eq(expected, t.duePayable),
      eq(expected, t.duePayable)
        ? `Net à payer cohérent (${fmt(t.duePayable)}).`
        : `Net à payer attendu ${fmt(expected)} (TTC − acomptes + arrondi), déclaré ${fmt(t.duePayable)}.`);
  }
  if (atLeast('BASIC WL') && (t.duePayable ?? 0) > 0) {
    c.add(D, 'BR-CO-25', 'error', !!(inv.dueDate || inv.paymentTerms),
      inv.dueDate || inv.paymentTerms
        ? `Échéance ou conditions de paiement indiquées${inv.dueDate ? ` (échéance ${inv.dueDate})` : ''}.`
        : 'Montant à payer positif mais ni date d’échéance (BT-9) ni conditions de paiement (BT-20).');
  }

  // --- Identifiants TVA selon la catégorie ---------------------------------------------
  const cats = new Set([...inv.lines.map((l) => l.vatCategory), ...inv.taxes.map((x) => x.category)]);
  if (cats.has('S') || cats.has('Z') || cats.has('AE') || cats.has('K')) {
    c.add(D, 'BR-S-02', 'error', !!inv.seller.vatId,
      inv.seller.vatId
        ? `Numéro de TVA du vendeur : ${inv.seller.vatId}`
        : 'Des lignes sont soumises à TVA mais le numéro de TVA du vendeur (BT-31) est absent.');
  }
  if (cats.has('E')) {
    c.add(D, 'BR-E-02', 'error', !!(inv.seller.vatId || inv.seller.taxRegistration),
      inv.seller.vatId || inv.seller.taxRegistration
        ? 'Identifiant fiscal du vendeur présent pour les lignes exonérées.'
        : 'Lignes exonérées (E) : la norme exige le numéro de TVA (BT-31) ou un identifiant fiscal local (BT-32, schemeID="FC").');
  }

  // --- Réforme française -------------------------------------------------------------------
  const sellerFr = (inv.seller.address.country ?? '').toUpperCase() === 'FR';
  const buyerFr = (inv.buyer.address.country ?? '').toUpperCase() === 'FR';
  if (sellerFr) {
    const ok = hasSiren(inv.seller) && sirenValid(inv.seller.legalId!);
    c.add(F, 'FR-SIREN-VENDEUR', 'warning', ok,
      ok ? `SIREN du vendeur valide : ${inv.seller.legalId}` :
      inv.seller.legalId ? `L’identifiant légal du vendeur (${inv.seller.legalId}) n’est pas un SIREN valide (9 chiffres, clé de Luhn).` :
      'SIREN du vendeur absent (BT-30, schemeID="0002").');
  }
  if (buyerFr) {
    const ok = hasSiren(inv.buyer) && sirenValid(inv.buyer.legalId!);
    c.add(F, 'FR-SIREN-ACHETEUR', 'warning', ok,
      ok ? `SIREN de l’acheteur valide : ${inv.buyer.legalId}` :
      inv.buyer.legalId ? `L’identifiant légal de l’acheteur (${inv.buyer.legalId}) n’est pas un SIREN valide.` :
      'SIREN de l’acheteur absent (BT-47). C’est une mention obligatoire depuis le 1er septembre 2026.');
  }
  if (sellerFr) {
    const bp = inv.businessProcess;
    c.add(F, 'FR-CADRE', 'warning', !!bp && bp in BUSINESS_PROCESS_FR,
      bp ? (bp in BUSINESS_PROCESS_FR ? `Cadre de facturation (BT-23) : ${bp}, ${BUSINESS_PROCESS_FR[bp]}.` : `Cadre de facturation (BT-23) inhabituel : ${bp}.`)
         : 'Cadre de facturation (BT-23) absent : il indique notamment la catégorie d’opération (S1 services, B1 biens, M1 mixte).');
    const subjects = new Set(inv.notes.map((n) => n.subject));
    for (const [code, label] of [['PMT', 'indemnité forfaitaire de 40 €'], ['PMD', 'pénalités de retard'], ['AAB', 'conditions d’escompte']] as const) {
      c.add(F, `FR-NOTE-${code}`, 'warning', subjects.has(code),
        subjects.has(code) ? `Mention « ${label} » présente (note ${code}).` : `Mention « ${label} » absente (note avec SubjectCode ${code}).`);
    }
  }

  return c.results;
}

export interface Summary {
  errors: number;
  warnings: number;
  passed: number;
}

export function summarize(results: CheckResult[]): Summary {
  return {
    errors: results.filter((r) => !r.passed && r.severity === 'error').length,
    warnings: results.filter((r) => !r.passed && r.severity === 'warning').length,
    passed: results.filter((r) => r.passed).length,
  };
}
