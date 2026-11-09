import {
  BUSINESS_PROCESS_FR,
  DOCUMENT_TYPES,
  NOTE_SUBJECTS,
  PAYMENT_MEANS,
  UNIT_CODES,
  VAT_CATEGORIES,
  VAT_DUE_DATE_CODES,
} from '../lib/facturx/codes';
import type { CheckResult, Invoice, Party } from '../lib/facturx/types';

/* Rendu HTML des résultats. Toute donnée issue du fichier passe par esc(). */

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function money(n: number | undefined, cur = 'EUR'): string {
  if (n === undefined) return '—';
  try {
    return n.toLocaleString('fr-FR', { style: 'currency', currency: cur });
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

const date = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR') : '—');
const qty = (n?: number) => (n === undefined ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 4 }));

function party(p: Party): string {
  const a = p.address;
  const lines = [
    p.name && `<strong>${esc(p.name)}</strong>`,
    a.line1 && esc(a.line1),
    a.line2 && esc(a.line2),
    a.line3 && esc(a.line3),
    (a.postcode || a.city) && esc([a.postcode, a.city].filter(Boolean).join(' ')),
    a.country && esc(a.country),
    p.legalId && `${p.legalIdScheme === '0002' || !p.legalIdScheme ? 'SIREN' : 'ID'} ${esc(p.legalId)}`,
    p.vatId && `TVA ${esc(p.vatId)}`,
    p.taxRegistration && `Id. fiscal ${esc(p.taxRegistration)}`,
    p.email && esc(p.email),
  ].filter(Boolean);
  return `<p>${lines.join('<br>') || '—'}</p>`;
}

export function renderInvoice(inv: Invoice): string {
  const cur = inv.currency ?? 'EUR';
  const kind = inv.typeCode ? DOCUMENT_TYPES[inv.typeCode] ?? `Type ${inv.typeCode}` : 'Document';
  const meta: [string, string][] = [
    ['Type', `${esc(kind)}${inv.typeCode ? ` (${esc(inv.typeCode)})` : ''}`],
    ['Numéro', esc(inv.number ?? '—')],
    ['Date', date(inv.issueDate)],
    ['Profil', esc(inv.profile)],
  ];
  if (inv.businessProcess)
    meta.push(['Cadre', `${esc(inv.businessProcess)}${BUSINESS_PROCESS_FR[inv.businessProcess] ? ` · ${esc(BUSINESS_PROCESS_FR[inv.businessProcess])}` : ''}`]);
  if (inv.deliveryDate) meta.push(['Livraison', date(inv.deliveryDate)]);
  if (inv.dueDate) meta.push(['Échéance', date(inv.dueDate)]);
  if (inv.orderReference) meta.push(['Commande', esc(inv.orderReference)]);
  if (inv.buyerReference) meta.push(['Réf. acheteur', esc(inv.buyerReference)]);

  let html = `<div class="inv-head">
    <div><h3>Vendeur</h3>${party(inv.seller)}</div>
    <div><h3>Acheteur</h3>${party(inv.buyer)}</div>
    <div><h3>Document</h3><dl class="kv">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
  </div>`;
  if (inv.shipTo) html += `<div class="inv-head"><div><h3>Livré à</h3>${party(inv.shipTo)}</div></div>`;

  if (inv.lines.length) {
    html += `<div class="table-wrap"><table><thead><tr><th>#</th><th>Désignation</th><th class="num">Qté</th><th>Unité</th><th class="num">PU HT</th><th>TVA</th><th class="num">Total HT</th></tr></thead><tbody>`;
    for (const l of inv.lines) {
      html += `<tr><td>${esc(l.id ?? '')}</td><td>${esc(l.name ?? '—')}${l.description ? `<br><small>${esc(l.description)}</small>` : ''}</td>
        <td class="num">${qty(l.quantity)}</td><td>${esc(UNIT_CODES[l.unitCode ?? ''] ?? l.unitCode ?? '')}</td>
        <td class="num">${money(l.unitPrice, cur)}</td><td>${esc(l.vatCategory ?? '')} ${l.vatRate !== undefined ? qty(l.vatRate) + ' %' : ''}</td>
        <td class="num">${money(l.netAmount, cur)}</td></tr>`;
    }
    html += `</tbody></table></div>`;
  } else {
    html += `<p class="notice">Ce fichier ne contient pas de lignes détaillées (profil ${esc(inv.profile)}).</p>`;
  }

  if (inv.taxes.length) {
    html += `<h3>Ventilation de la TVA</h3><div class="table-wrap"><table><thead><tr><th>Catégorie</th><th class="num">Taux</th><th class="num">Base HT</th><th class="num">TVA</th><th>Détail</th></tr></thead><tbody>`;
    for (const t of inv.taxes) {
      const detail = [
        t.exemptionReason && esc(t.exemptionReason),
        t.exemptionReasonCode && esc(t.exemptionReasonCode),
        t.dueDateTypeCode && esc(VAT_DUE_DATE_CODES[t.dueDateTypeCode] ?? `Exigibilité ${t.dueDateTypeCode}`),
      ].filter(Boolean).join(' · ');
      html += `<tr><td>${esc(t.category ?? '')} · ${esc(VAT_CATEGORIES[t.category ?? ''] ?? '')}</td><td class="num">${qty(t.rate)} %</td>
        <td class="num">${money(t.basis, cur)}</td><td class="num">${money(t.amount, cur)}</td><td>${detail}</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  const t = inv.totals;
  const rows: [string, number | undefined, boolean?][] = [
    ['Total des lignes', t.lineTotal],
    ...(t.allowanceTotal ? [['Remises', -t.allowanceTotal] as [string, number]] : []),
    ...(t.chargeTotal ? [['Frais', t.chargeTotal] as [string, number]] : []),
    ['Total HT', t.taxBasis],
    ['TVA', t.taxTotal],
    ['Total TTC', t.grandTotal],
    ...(t.prepaid ? [['Déjà payé', -t.prepaid] as [string, number]] : []),
    ['Net à payer', t.duePayable, true],
  ];
  html += `<table class="totals"><tbody>${rows
    .filter(([, v]) => v !== undefined)
    .map(([k, v, g]) => `<tr${g ? ' class="grand"' : ''}><td>${k}</td><td class="num">${money(v, cur)}</td></tr>`)
    .join('')}</tbody></table>`;

  const pay: [string, string][] = [];
  if (inv.paymentMeansCode) pay.push(['Moyen', esc(PAYMENT_MEANS[inv.paymentMeansCode] ?? inv.paymentMeansCode)]);
  if (inv.iban) pay.push(['IBAN', esc(inv.iban.replace(/(.{4})/g, '$1 ').trim())]);
  if (inv.bic) pay.push(['BIC', esc(inv.bic)]);
  if (inv.paymentReference) pay.push(['Référence', esc(inv.paymentReference)]);
  if (inv.paymentTerms) pay.push(['Conditions', esc(inv.paymentTerms)]);
  if (pay.length) html += `<h3>Paiement</h3><dl class="kv">${pay.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

  if (inv.notes.length) {
    html += `<h3>Notes et mentions</h3><ul>${inv.notes
      .map((n) => `<li>${n.subject ? `<strong>${esc(NOTE_SUBJECTS[n.subject] ?? n.subject)} :</strong> ` : ''}${esc(n.content)}</li>`)
      .join('')}</ul>`;
  }
  return html;
}

export function renderChecks(results: CheckResult[], showPassed: boolean): string {
  const groups = new Map<string, CheckResult[]>();
  for (const r of results) {
    if (!showPassed && r.passed) continue;
    const g = groups.get(r.group) ?? [];
    g.push(r);
    groups.set(r.group, g);
  }
  if (!groups.size) return '<p>Aucun problème détecté.</p>';
  let html = '';
  for (const [group, items] of groups) {
    items.sort((a, b) => Number(a.passed) - Number(b.passed) || (a.severity === 'error' ? -1 : 1));
    html += `<h3 class="checks-group">${esc(group)}</h3><ul class="checks">${items
      .map((r) => {
        const cls = r.passed ? 'pass' : r.severity;
        const icon = r.passed ? '✓' : r.severity === 'error' ? '✕' : '!';
        const label = r.passed ? 'Conforme' : r.severity === 'error' ? 'Erreur' : 'Avertissement';
        return `<li class="${cls}"><span class="ic" aria-label="${label}">${icon}</span><span>${esc(r.message)}</span><span class="rule">${esc(r.id)}</span></li>`;
      })
      .join('')}</ul>`;
  }
  return html;
}

/** Indentation légère d'un XML pour l'affichage (ne modifie pas le fichier téléchargé). */
export function prettyXml(xml: string): string {
  if (/\n\s+</.test(xml)) return xml; // déjà indenté
  let depth = 0;
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => {
      if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
      const out = '  '.repeat(depth) + line;
      if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth++;
      return out;
    })
    .join('\n');
}

export function download(data: Uint8Array | string, name: string, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
