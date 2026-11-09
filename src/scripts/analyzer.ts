import { parseXml, readInvoice, XmlParseError } from '../lib/facturx/parse';
import { summarize, validateInvoice } from '../lib/facturx/validate';
import type { CheckResult, Invoice } from '../lib/facturx/types';
import { download, esc, prettyXml, renderChecks, renderInvoice } from './view';
import { bindThanks, thanksCard, waitCard } from './creator';

type Tab = 'facture' | 'controles' | 'xml';

interface Analysis {
  fileName: string;
  invoice?: Invoice;
  xml?: string;
  xmlName?: string;
  checks: CheckResult[];
  fatal?: string;
  pdfBytes?: Uint8Array;
  attachments?: string[];
}

const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

/** Recherche « %PDF » dans le premier kilo-octet (certains fichiers ont des octets parasites au début). */
function looksLikePdf(b: Uint8Array): boolean {
  if (isPdf(b)) return true;
  const head = new TextDecoder('latin1').decode(b.subarray(0, 1024));
  return head.includes('%PDF-');
}

export async function analyzeBytes(bytes: Uint8Array, fileName: string): Promise<Analysis> {
  const a: Analysis = { fileName, checks: [] };
  if (looksLikePdf(bytes)) {
    a.pdfBytes = bytes;
    const { inspectPdf, checkPdf } = await import('../lib/facturx/pdf');
    let insp;
    try {
      insp = await inspectPdf(bytes);
    } catch (e) {
      a.fatal = e instanceof Error ? e.message : String(e);
      return a;
    }
    a.attachments = insp.attachments.map((x) => x.name);
    if (insp.invoiceXml) {
      a.xml = insp.invoiceXml.xml;
      a.xmlName = insp.invoiceXml.name;
    }
    let profile: string | undefined;
    if (a.xml) {
      try {
        a.invoice = readInvoice(a.xml);
        profile = a.invoice.profile;
      } catch (e) {
        a.fatal = e instanceof Error ? e.message : String(e);
      }
    }
    a.checks.push(...checkPdf(insp, profile));
  } else {
    const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
    if (!text.trimStart().startsWith('<')) {
      a.fatal = 'Ce fichier n’est ni un PDF ni un XML.';
      return a;
    }
    a.xml = text;
    a.xmlName = fileName;
    try {
      a.invoice = readInvoice(parseXml(text));
    } catch (e) {
      a.fatal = e instanceof XmlParseError ? e.message : 'Lecture du XML impossible : ' + String(e);
    }
  }
  if (a.invoice) a.checks.push(...validateInvoice(a.invoice));
  return a;
}

function banner(a: Analysis): string {
  const s = summarize(a.checks);
  if (a.fatal && !a.invoice) {
    return `<div class="banner err"><div><strong>Lecture impossible</strong><p>${esc(a.fatal)}</p></div></div>`;
  }
  if (!a.invoice) {
    return `<div class="banner err"><div><strong>Ce PDF n’est pas une facture Factur-X</strong><p>Il ne contient pas de fichier XML de facture. C’est un PDF classique : il n’a pas de valeur de facture électronique au sens de la réforme.${a.attachments?.length ? ` Pièces jointes trouvées : ${esc(a.attachments.join(', '))}.` : ''}</p></div></div>`;
  }
  const title = `${esc(a.invoice.number ?? 'Facture')} · ${a.invoice.syntax === 'UBL' ? 'UBL · ' : ''}profil ${esc(a.invoice.profile)}`;
  if (s.errors) {
    return `<div class="banner err"><div><strong>${s.errors} erreur${s.errors > 1 ? 's' : ''}, ${s.warnings} avertissement${s.warnings > 1 ? 's' : ''}</strong><p>${title}. Le fichier sera probablement rejeté par une plateforme agréée. Le détail est dans l’onglet « Contrôles ».</p></div></div>`;
  }
  if (s.warnings) {
    return `<div class="banner warn"><div><strong>Structure correcte, ${s.warnings} point${s.warnings > 1 ? 's' : ''} à vérifier</strong><p>${title}. ${s.passed} contrôles réussis, aucune erreur bloquante.</p></div></div>`;
  }
  return `<div class="banner ok"><div><strong>Aucune anomalie détectée</strong><p>${title}. ${s.passed} contrôles réussis.</p></div></div>`;
}

export function renderAnalysis(root: HTMLElement, a: Analysis, focus: Tab, opts: { thanks?: boolean } = {}) {
  const out = root.querySelector<HTMLElement>('[data-result]')!;
  const s = summarize(a.checks);
  const tabs: { id: Tab; label: string; enabled: boolean }[] = [
    { id: 'facture', label: 'Facture', enabled: !!a.invoice },
    { id: 'controles', label: `Contrôles${s.errors + s.warnings ? ` (${s.errors + s.warnings})` : ''}`, enabled: a.checks.length > 0 },
    { id: 'xml', label: 'XML', enabled: !!a.xml },
  ];
  const available = tabs.filter((t) => t.enabled);
  const active = available.find((t) => t.id === focus)?.id ?? available[0]?.id;
  const uid = Math.random().toString(36).slice(2, 8);

  out.innerHTML =
    banner(a) +
    (available.length
      ? `<div class="tabs" role="tablist">${available
          .map((t) => `<button type="button" role="tab" id="tab-${uid}-${t.id}" aria-controls="panel-${uid}-${t.id}" aria-selected="${t.id === active}" data-tab="${t.id}">${t.label}</button>`)
          .join('')}</div>` +
        (a.invoice ? `<div class="panel card" role="tabpanel" id="panel-${uid}-facture" aria-labelledby="tab-${uid}-facture" data-panel="facture">${renderInvoice(a.invoice)}</div>` : '') +
        (a.checks.length
          ? `<div class="panel card" role="tabpanel" id="panel-${uid}-controles" aria-labelledby="tab-${uid}-controles" data-panel="controles">
              <p class="hint">Contrôles basés sur les règles de la norme EN 16931 (BR-xx) et sur les attentes de la réforme française. Ce n’est pas la validation Schematron officielle complète.</p>
              <label class="choice toggle-pass"><input type="checkbox" data-show-pass> Afficher aussi les ${s.passed} contrôles réussis</label>
              <div data-checks>${renderChecks(a.checks, false)}</div></div>`
          : '') +
        (a.xml
          ? `<div class="panel card" role="tabpanel" id="panel-${uid}-xml" aria-labelledby="tab-${uid}-xml" data-panel="xml">
              <div class="btn-row" style="margin-bottom:.8rem">
                <button type="button" class="btn" data-dl-xml>Télécharger ${esc(a.xmlName ?? 'factur-x.xml')}</button>
                <button type="button" class="btn ghost" data-copy-xml>Copier</button>
              </div>
              <pre class="xml-view"><code>${esc(prettyXml(a.xml))}</code></pre></div>`
          : '')
      : '') +
    `<div class="btn-row" style="margin-top:1rem">
      ${a.pdfBytes ? '<button type="button" class="btn ghost" data-open-pdf>Ouvrir le PDF</button>' : ''}
      <button type="button" class="btn ghost" data-reset>Analyser un autre fichier</button>
    </div>` +
    (a.invoice && opts.thanks !== false ? thanksCard('analyse') : '');
  out.hidden = false;
  bindThanks(out);

  const select = (id: string) => {
    out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    out.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== id));
  };
  if (active) select(active);
  out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => select(b.dataset.tab!)));
  out.querySelector<HTMLInputElement>('[data-show-pass]')?.addEventListener('change', (e) => {
    out.querySelector<HTMLElement>('[data-checks]')!.innerHTML = renderChecks(a.checks, (e.target as HTMLInputElement).checked);
  });
  out.querySelector('[data-dl-xml]')?.addEventListener('click', () => download(a.xml!, a.xmlName ?? 'factur-x.xml', 'application/xml'));
  out.querySelector('[data-copy-xml]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(a.xml!);
      btn.textContent = 'Copié ✓';
    } catch {
      btn.textContent = 'Copie impossible';
    }
  });
  out.querySelector('[data-open-pdf]')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([a.pdfBytes as BlobPart], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
  out.querySelector('[data-reset]')?.addEventListener('click', () => {
    out.hidden = true;
    out.innerHTML = '';
    root.querySelector<HTMLElement>('[data-drop]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function sampleInput() {
  const { defaultFrenchNotes } = await import('../lib/facturx/build');
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const input = {
    number: 'EX-2026-001',
    issueDate: today,
    typeCode: '380' as const,
    currency: 'EUR',
    businessProcess: 'S1',
    seller: { name: 'Studio Exemple SAS', siren: '552100554', vatId: 'FR40552100554', line1: '8 rue de l’Exemple', postcode: '75011', city: 'Paris', country: 'FR', email: 'compta@exemple.fr' },
    buyer: { name: 'Client Démo SARL', siren: '732829320', line1: '3 avenue du Test', postcode: '33000', city: 'Bordeaux', country: 'FR' },
    vatRegime: 'normal' as const,
    lines: [
      { name: 'Développement d’un module de facturation', quantity: 4, unitCode: 'DAY', unitPrice: 550, vatRate: 20 },
      { name: 'Hébergement annuel', quantity: 1, unitCode: 'ANN', unitPrice: 240, vatRate: 20 },
    ],
    dueDate: due,
    paymentTerms: 'Paiement à 30 jours.',
    iban: 'FR7630006000011234567890189',
    notes: defaultFrenchNotes(),
  };
  return input;
}

/** Facture UBL d'exemple (même contenu que l'exemple Factur-X). */
export async function makeSampleUbl(): Promise<Uint8Array> {
  const [{ buildUbl }, input] = await Promise.all([import('../lib/facturx/ubl-build'), sampleInput()]);
  return new TextEncoder().encode(buildUbl(input));
}

export async function makeSamplePdf(): Promise<Uint8Array> {
  const [{ buildXml }, { renderInvoicePdf }, { embedFacturX }, { loadFonts }, input] = await Promise.all([
    import('../lib/facturx/build'),
    import('../lib/facturx/render'),
    import('../lib/facturx/pdf'),
    import('./fonts'),
    sampleInput(),
  ]);
  const pdf = await renderInvoicePdf(input, await loadFonts());
  const { bytes } = await embedFacturX(pdf, buildXml(input), { conformanceLevel: 'EN 16931', generated: true });
  return bytes;
}

export function mountAnalyzer(root: HTMLElement) {
  const focus = (root.dataset.focus as Tab) ?? 'facture';
  const drop = root.querySelector<HTMLElement>('[data-drop]')!;
  const input = root.querySelector<HTMLInputElement>('[data-file]')!;
  const sample = root.querySelector<HTMLButtonElement>('[data-sample]');

  const out = root.querySelector<HTMLElement>('[data-result]')!;
  /** Affiche l'encart d'attente seulement si l'opération dure (pas de délai artificiel). */
  const showWait = (label: string) =>
    setTimeout(() => {
      out.innerHTML = waitCard(label);
      out.hidden = false;
    }, 150);

  const run = async (bytes: Uint8Array | (() => Promise<Uint8Array>), name: string, label = 'Lecture de la facture…') => {
    drop.setAttribute('aria-busy', 'true');
    const timer = showWait(label);
    try {
      const data = typeof bytes === 'function' ? await bytes() : bytes;
      const analysis = await analyzeBytes(data, name);
      clearTimeout(timer);
      renderAnalysis(root, analysis, focus);
    } catch (e) {
      clearTimeout(timer);
      out.innerHTML = `<div class="banner err"><div><strong>Erreur inattendue</strong><p>${esc(e instanceof Error ? e.message : e)}</p></div></div>`;
      out.hidden = false;
    } finally {
      drop.removeAttribute('aria-busy');
    }
  };
  const handle = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('Fichier trop volumineux (50 Mo maximum).');
      return;
    }
    await run(new Uint8Array(await file.arrayBuffer()), file.name);
  };

  input.addEventListener('change', () => {
    handle(input.files?.[0]);
    input.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    handle(e.dataTransfer?.files[0]);
  });
  sample?.addEventListener('click', async () => {
    sample.disabled = true;
    const old = sample.textContent;
    sample.textContent = 'Génération…';
    try {
      if (root.dataset.sampleKind === 'ubl') await run(makeSampleUbl, 'exemple-facture-ubl.xml', 'Création d’une facture UBL d’exemple…');
      else await run(makeSamplePdf, 'exemple-factur-x.pdf', 'Création d’une facture d’exemple…');
    } finally {
      sample.disabled = false;
      sample.textContent = old;
    }
  });
}
