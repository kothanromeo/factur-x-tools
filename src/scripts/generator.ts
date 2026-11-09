import { buildXml, compute, type GeneratorInput, type LineInput } from '../lib/facturx/build';
import { analyzeBytes, renderAnalysis } from './analyzer';
import { download, esc, money } from './view';
import { bindThanks, thanksCard, waitCard } from './creator';

const STORE_KEY = 'fxt:vendeur:v1';
const REMEMBERED = ['s.name', 's.siren', 's.vatId', 's.email', 's.line1', 's.postcode', 's.city', 's.country', 'iban', 'bic', 'paymentTerms', 'vatRegime'];

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const clean = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '') || undefined;
const num = (v: string) => Number(v.replace(',', '.'));

function readLines(form: HTMLFormElement): LineInput[] {
  return [...form.querySelectorAll<HTMLElement>('.line-row')]
    .map((row) => {
      const get = (n: string) => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="l.${n}"]`)!.value;
      return {
        name: get('name').trim(),
        quantity: num(get('quantity') || '0'),
        unitCode: get('unitCode'),
        unitPrice: num(get('unitPrice') || '0'),
        vatRate: num(get('vatRate') || '0'),
      };
    })
    .filter((l) => l.name || l.unitPrice);
}

function readForm(form: HTMLFormElement): GeneratorInput {
  const fd = new FormData(form);
  const g = (k: string) => clean(fd.get(k));
  const party = (p: string) => ({
    name: g(`${p}.name`) ?? '',
    siren: g(`${p}.siren`)?.replace(/\s/g, ''),
    vatId: g(`${p}.vatId`),
    email: g(`${p}.email`),
    line1: g(`${p}.line1`),
    postcode: g(`${p}.postcode`),
    city: g(`${p}.city`),
    country: (g(`${p}.country`) ?? 'FR').toUpperCase(),
  });
  const buyer = party('b');
  return {
    number: g('number') ?? '',
    issueDate: g('issueDate') ?? today(),
    typeCode: (g('typeCode') ?? '380') as GeneratorInput['typeCode'],
    currency: 'EUR',
    businessProcess: g('businessProcess'),
    seller: party('s'),
    buyer,
    shipTo: fd.get('hasShipTo')
      ? { name: buyer.name, line1: g('d.line1'), postcode: g('d.postcode'), city: g('d.city'), country: (g('d.country') ?? 'FR').toUpperCase() }
      : undefined,
    buyerReference: g('buyerReference'),
    orderReference: g('orderReference'),
    deliveryDate: g('deliveryDate'),
    vatRegime: g('vatRegime') === 'franchise' ? 'franchise' : 'normal',
    vatOnDebits: !!fd.get('vatOnDebits') && g('vatRegime') !== 'franchise',
    lines: readLines(form),
    dueDate: g('dueDate'),
    paymentTerms: g('paymentTerms'),
    iban: g('iban'),
    bic: g('bic'),
    paymentReference: g('number'),
    notes: (['PMT', 'PMD', 'AAB'] as const).map((s) => ({ subject: s, content: g(`n.${s}`) ?? '' })).filter((n) => n.content),
  };
}

function save(form: HTMLFormElement) {
  const fd = new FormData(form);
  try {
    if (!fd.get('remember')) {
      localStorage.removeItem(STORE_KEY);
      return;
    }
    const data: Record<string, string> = {};
    for (const k of REMEMBERED) data[k] = String(fd.get(k) ?? '');
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    /* stockage indisponible (navigation privée) : sans conséquence */
  }
}

function restore(form: HTMLFormElement) {
  let data: Record<string, string> | null = null;
  try {
    data = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
  } catch {
    return;
  }
  if (!data) return;
  for (const [k, v] of Object.entries(data)) {
    const fields = form.querySelectorAll<HTMLInputElement>(`[name="${k}"]`);
    fields.forEach((f) => {
      if (f.type === 'radio') f.checked = f.value === v;
      else if (v) f.value = v;
    });
  }
}

export function mountGenerator(form: HTMLFormElement) {
  const linesBox = form.querySelector<HTMLElement>('[data-lines]')!;
  const tpl = form.querySelector<HTMLTemplateElement>('[data-line-template]')!;
  const totals = form.querySelector<HTMLElement>('[data-totals]')!;
  const out = form.querySelector<HTMLElement>('[data-gen-result]')!;
  const ownPdf = form.querySelector<HTMLInputElement>('[data-own-pdf]')!;

  const addLine = () => {
    const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    row.querySelector('[data-remove]')!.addEventListener('click', () => {
      if (linesBox.children.length > 1) row.remove();
      refresh();
    });
    linesBox.append(row);
    refresh();
    return row;
  };

  const refresh = () => {
    const franchise = (form.elements.namedItem('vatRegime') as RadioNodeList).value === 'franchise';
    form.querySelectorAll<HTMLElement>('[data-rate]').forEach((el) => (el.hidden = franchise));
    form.querySelector<HTMLElement>('[data-debits]')!.hidden = franchise;
    form.querySelector<HTMLElement>('[data-section="shipto"]')!.hidden = !(form.elements.namedItem('hasShipTo') as HTMLInputElement).checked;
    form.querySelector<HTMLElement>('[data-section="own"]')!.hidden = (form.elements.namedItem('pdfMode') as RadioNodeList).value !== 'own';
    const c = compute({ lines: readLines(form), vatRegime: franchise ? 'franchise' : 'normal' });
    totals.innerHTML = franchise
      ? `Total à payer <strong>${money(c.grandTotal)}</strong>`
      : `HT ${money(c.lineTotal)} · TVA ${money(c.taxTotal)} · <strong>${money(c.grandTotal)} TTC</strong>`;
  };

  // Valeurs initiales
  (form.elements.namedItem('issueDate') as HTMLInputElement).value = today();
  (form.elements.namedItem('dueDate') as HTMLInputElement).value = plusDays(30);
  restore(form);
  addLine();
  form.querySelector('[data-add-line]')!.addEventListener('click', () => addLine().querySelector('input')?.focus());
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);

  const check = (): GeneratorInput | null => {
    if (!form.reportValidity()) return null;
    const input = readForm(form);
    if (!input.lines.length) {
      alert('Ajoutez au moins une ligne avec une désignation et un prix.');
      return null;
    }
    if (input.vatRegime === 'normal' && !input.seller.vatId) {
      if (!confirm('Vous facturez la TVA sans numéro de TVA intracommunautaire. La norme EN 16931 l’exige (règle BR-S-02). Continuer quand même ?')) return null;
    }
    return input;
  };

  form.querySelector('[data-xml-only]')!.addEventListener('click', () => {
    const input = check();
    if (!input) return;
    save(form);
    download(buildXml(input), 'factur-x.xml', 'application/xml');
  });

  form.querySelector('[data-ubl-only]')!.addEventListener('click', async () => {
    const input = check();
    if (!input) return;
    save(form);
    const { buildUbl } = await import('../lib/facturx/ubl-build');
    download(buildUbl(input), `facture-${input.number.replace(/[^\w.-]+/g, '_')}-ubl.xml`, 'application/xml');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = check();
    if (!input) return;
    const mode = (form.elements.namedItem('pdfMode') as RadioNodeList).value;
    const file = ownPdf.files?.[0];
    if (mode === 'own' && !file) {
      alert('Choisissez le PDF de votre facture, ou laissez l’outil le générer.');
      ownPdf.focus();
      return;
    }
    save(form);
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true;
    btn.textContent = 'Génération…';
    out.innerHTML = waitCard('Génération de votre facture Factur-X…');
    out.hidden = false;
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      const [{ embedFacturX }, xml] = await Promise.all([import('../lib/facturx/pdf'), Promise.resolve(buildXml(input))]);
      let source: Uint8Array;
      if (mode === 'own' && file) source = new Uint8Array(await file.arrayBuffer());
      else {
        const [{ renderInvoicePdf }, { loadFonts }] = await Promise.all([import('../lib/facturx/render'), import('./fonts')]);
        source = await renderInvoicePdf(input, await loadFonts());
      }
      const { bytes, warnings } = await embedFacturX(source, xml, {
        conformanceLevel: 'EN 16931',
        title: `Facture ${input.number}`,
        author: input.seller.name,
        generated: mode !== 'own',
      });
      const name = `facture-${input.number.replace(/[^\w.-]+/g, '_')}-factur-x.pdf`;
      out.innerHTML = `<div class="banner ok"><div><strong>Votre facture Factur-X est prête</strong>
          <p>${esc(name)} · ${(bytes.length / 1024).toFixed(0)} Ko · profil EN 16931</p>
          <div class="btn-row" style="margin-top:.7rem"><button type="button" class="btn" data-dl>Télécharger le PDF</button></div></div></div>
        ${thanksCard('generation')}
        ${warnings.map((w) => `<p class="notice">${esc(w)}</p>`).join('')}
        <h3>Vérification automatique du fichier généré</h3>
        <div data-result hidden></div>`;
      out.hidden = false;
      out.querySelector('[data-dl]')!.addEventListener('click', () => download(bytes, name, 'application/pdf'));
      bindThanks(out);
      renderAnalysis(out, await analyzeBytes(bytes, name), 'controles', { thanks: false });
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      out.innerHTML = `<div class="banner err"><div><strong>La génération a échoué</strong><p>${esc(err instanceof Error ? err.message : err)}</p></div></div>`;
      out.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Générer la facture Factur-X';
    }
  });
}
