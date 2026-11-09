import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  decodePDFRawStream,
  type PDFObject,
} from 'pdf-lib';
import { XML_ATTACHMENT_NAMES } from './codes';
import { buildSrgbIcc } from './icc';
import { buildXmp, readXmp } from './xmp';
import type { CheckResult } from './types';

/*
 * Lecture et écriture des parties « PDF » de Factur-X :
 *  - la pièce jointe XML (arbre /Names /EmbeddedFiles + tableau /AF) ;
 *  - les métadonnées XMP (pdfaid + extension fx:) ;
 *  - l'OutputIntent sRGB exigé par PDF/A.
 * Tout se fait en mémoire, dans le navigateur.
 */

export interface Attachment {
  name: string;
  data: Uint8Array;
  mimeType?: string;
  afRelationship?: string;
  description?: string;
}

export interface PdfInspection {
  attachments: Attachment[];
  /** Pièce jointe Factur-X / ZUGFeRD retenue, si trouvée. */
  invoiceXml?: { name: string; xml: string; afRelationship?: string };
  xmp?: ReturnType<typeof readXmp> & { raw: string };
  hasOutputIntent: boolean;
  isEncrypted: boolean;
  pageCount: number;
  pdfVersion?: string;
}

export class PdfError extends Error {}

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

function streamBytes(obj: PDFObject | undefined): Uint8Array | undefined {
  if (obj instanceof PDFRawStream) return decodePDFRawStream(obj).decode();
  if (obj instanceof PDFStream) return obj.getContents();
  return undefined;
}

function str(obj: PDFObject | undefined): string | undefined {
  if (obj instanceof PDFString || obj instanceof PDFHexString) return obj.decodeText();
  if (obj instanceof PDFName) return obj.decodeText();
  return undefined;
}

/** Parcourt un arbre de noms PDF (/Names ou /Kids) et renvoie les paires (nom, objet). */
function walkNameTree(doc: PDFDocument, node: PDFDict | undefined, out: [string, PDFObject][] = [], depth = 0) {
  if (!node || depth > 32) return out;
  const names = node.lookup(PDFName.of('Names'));
  if (names instanceof PDFArray) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      out.push([str(names.lookup(i)) ?? '', names.get(i + 1)]);
    }
  }
  const kids = node.lookup(PDFName.of('Kids'));
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) {
      const k = kids.lookup(i);
      if (k instanceof PDFDict) walkNameTree(doc, k, out, depth + 1);
    }
  }
  return out;
}

function embeddedFilesNode(doc: PDFDocument): PDFDict | undefined {
  const names = doc.catalog.lookup(PDFName.of('Names'));
  if (!(names instanceof PDFDict)) return undefined;
  const ef = names.lookup(PDFName.of('EmbeddedFiles'));
  return ef instanceof PDFDict ? ef : undefined;
}

function readFilespec(doc: PDFDocument, spec: PDFObject, fallbackName: string): Attachment | undefined {
  const dict = spec instanceof PDFRef ? doc.context.lookup(spec) : spec;
  if (!(dict instanceof PDFDict)) return undefined;
  const ef = dict.lookup(PDFName.of('EF'));
  if (!(ef instanceof PDFDict)) return undefined;
  const fileObj = ef.lookup(PDFName.of('UF')) ?? ef.lookup(PDFName.of('F'));
  const data = streamBytes(fileObj);
  if (!data) return undefined;
  const sub = fileObj instanceof PDFStream ? fileObj.dict.lookup(PDFName.of('Subtype')) : undefined;
  return {
    name: str(dict.lookup(PDFName.of('UF'))) ?? str(dict.lookup(PDFName.of('F'))) ?? fallbackName,
    data,
    mimeType: str(sub),
    afRelationship: str(dict.lookup(PDFName.of('AFRelationship'))),
    description: str(dict.lookup(PDFName.of('Desc'))),
  };
}

async function load(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  } catch (e) {
    throw new PdfError('Impossible de lire ce PDF : ' + (e instanceof Error ? e.message : String(e)));
  }
}

function pdfHeaderVersion(bytes: Uint8Array): string | undefined {
  const head = dec.decode(bytes.subarray(0, 16));
  return /%PDF-(\d\.\d)/.exec(head)?.[1];
}

export async function inspectPdf(input: Uint8Array | ArrayBuffer): Promise<PdfInspection> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const doc = await load(bytes);

  const attachments: Attachment[] = [];
  const seen = new Set<string>();
  for (const [name, spec] of walkNameTree(doc, embeddedFilesNode(doc))) {
    const a = readFilespec(doc, spec, name);
    if (a) {
      attachments.push(a);
      seen.add(a.name.toLowerCase());
    }
  }
  // Certains producteurs ne déclarent la pièce jointe que dans /AF.
  const af = doc.catalog.lookup(PDFName.of('AF'));
  if (af instanceof PDFArray) {
    for (let i = 0; i < af.size(); i++) {
      const a = readFilespec(doc, af.get(i), `piece-jointe-${i + 1}`);
      if (a && !seen.has(a.name.toLowerCase())) attachments.push(a);
    }
  }

  const invoice =
    attachments.find((a) => XML_ATTACHMENT_NAMES.includes(a.name.toLowerCase())) ??
    attachments.find((a) => a.name.toLowerCase().endsWith('.xml') && /CrossIndustry/.test(dec.decode(a.data.subarray(0, 4000))));

  let xmp: PdfInspection['xmp'];
  const meta = streamBytes(doc.catalog.lookup(PDFName.of('Metadata')));
  if (meta) {
    const raw = dec.decode(meta);
    xmp = { ...readXmp(raw), raw };
  }

  const oi = doc.catalog.lookup(PDFName.of('OutputIntents'));
  return {
    attachments,
    invoiceXml: invoice ? { name: invoice.name, xml: dec.decode(invoice.data).replace(/^﻿/, ''), afRelationship: invoice.afRelationship } : undefined,
    xmp,
    hasOutputIntent: oi instanceof PDFArray && oi.size() > 0,
    isEncrypted: doc.isEncrypted,
    pageCount: doc.getPageCount(),
    pdfVersion: pdfHeaderVersion(bytes),
  };
}

/** Contrôles propres au conteneur PDF (pièce jointe, XMP, PDF/A). */
export function checkPdf(p: PdfInspection, xmlProfile?: string): CheckResult[] {
  const out: CheckResult[] = [];
  const add = (id: string, severity: CheckResult['severity'], passed: boolean, message: string) =>
    out.push({ group: 'Fichier PDF', id, severity, passed, message });

  add('PDF-CHIFFRE', 'error', !p.isEncrypted, p.isEncrypted ? 'Le PDF est chiffré : PDF/A l’interdit.' : 'PDF non chiffré.');
  add(
    'FX-XML',
    'error',
    !!p.invoiceXml,
    p.invoiceXml
      ? `XML de facture trouvé en pièce jointe : ${p.invoiceXml.name}`
      : p.attachments.length
        ? `Aucun XML Factur-X parmi les pièces jointes (${p.attachments.map((a) => a.name).join(', ')}).`
        : 'Aucune pièce jointe : ce PDF n’est pas une facture Factur-X, c’est un PDF « image ».',
  );
  if (p.invoiceXml) {
    const n = p.invoiceXml.name.toLowerCase();
    add(
      'FX-NOM',
      'warning',
      n === 'factur-x.xml',
      n === 'factur-x.xml'
        ? 'Nom de pièce jointe conforme : factur-x.xml'
        : `La pièce jointe s’appelle « ${p.invoiceXml.name} ». Factur-X impose « factur-x.xml » (ZUGFeRD utilise zugferd-invoice.xml).`,
    );
    const rel = p.invoiceXml.afRelationship;
    add(
      'FX-AFREL',
      'warning',
      !!rel && ['Alternative', 'Data', 'Source'].includes(rel),
      rel ? `Relation de la pièce jointe (AFRelationship) : ${rel}` : 'La clé AFRelationship est absente de la pièce jointe (attendu : Alternative, Data ou Source).',
    );
  }
  add(
    'PDFA-XMP',
    'error',
    !!p.xmp,
    p.xmp ? 'Métadonnées XMP présentes.' : 'Pas de métadonnées XMP : impossible d’être PDF/A, donc pas Factur-X.',
  );
  if (p.xmp) {
    const part = p.xmp.pdfaPart;
    add(
      'PDFA-3',
      'error',
      part === '3',
      part === '3'
        ? `Déclaré PDF/A-3${p.xmp.pdfaConformance ?? ''}.`
        : part
          ? `Déclaré PDF/A-${part} : Factur-X exige PDF/A-3 (seule version qui autorise les pièces jointes XML).`
          : 'Le PDF ne se déclare pas PDF/A (pas de pdfaid:part dans le XMP).',
    );
    add(
      'FX-XMP',
      'error',
      !!p.xmp.fxConformanceLevel,
      p.xmp.fxConformanceLevel
        ? `Profil déclaré dans le XMP : ${p.xmp.fxConformanceLevel}`
        : 'Le XMP ne contient pas l’extension Factur-X (fx:ConformanceLevel).',
    );
    if (p.xmp.fxConformanceLevel && xmlProfile && xmlProfile !== 'INCONNU') {
      const a = p.xmp.fxConformanceLevel.toUpperCase().replace(/\s+/g, ' ');
      const b = xmlProfile.toUpperCase();
      const same = a === b || (b === 'EN 16931' && (a === 'COMFORT' || a === 'EN16931'));
      add(
        'FX-COHERENCE',
        'error',
        same,
        same ? 'Le profil du XMP correspond à celui du XML.' : `Profil incohérent : XMP « ${p.xmp.fxConformanceLevel} », XML « ${xmlProfile} ».`,
      );
    }
  }
  add(
    'PDFA-OI',
    'warning',
    p.hasOutputIntent,
    p.hasOutputIntent ? 'OutputIntent (profil de couleur) présent.' : 'Pas d’OutputIntent : un validateur PDF/A rejettera le fichier.',
  );
  return out;
}

// --- Écriture ---------------------------------------------------------------------------

export interface EmbedOptions {
  conformanceLevel: string;
  title?: string;
  author?: string;
  now?: Date;
  /** PDF produit par notre propre moteur de rendu (polices incorporées) : pas d'avertissement PDF/A. */
  generated?: boolean;
}

export interface EmbedResult {
  bytes: Uint8Array;
  warnings: string[];
}

function randomId(): Uint8Array {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return b;
}

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Transforme un PDF en Factur-X : ajoute factur-x.xml, les métadonnées XMP
 * PDF/A-3 et un OutputIntent sRGB s'il n'y en a pas.
 */
export async function embedFacturX(pdf: Uint8Array | ArrayBuffer, xml: string, opts: EmbedOptions): Promise<EmbedResult> {
  const doc = await load(pdf);
  if (doc.isEncrypted) throw new PdfError('Ce PDF est protégé (chiffré). Exportez-le à nouveau sans mot de passe.');
  const ctx = doc.context;
  const warnings: string[] = [];
  const now = opts.now ?? new Date();
  now.setMilliseconds(0);

  const previousXmp = streamBytes(doc.catalog.lookup(PDFName.of('Metadata')));
  const wasPdfA = previousXmp ? /pdfaid:part(>|=")\s*[23]/.test(dec.decode(previousXmp)) : false;
  if (!wasPdfA && !opts.generated) {
    warnings.push(
      'Le PDF d’origine n’était pas déclaré PDF/A. Le XML et les métadonnées sont corrects, mais si ce PDF utilise des polices non incorporées ou de la transparence, un validateur PDF/A strict pourra le refuser. Le plus sûr : exporter votre facture en « PDF/A » depuis Word ou LibreOffice avant de la convertir.',
    );
  }

  // 1. Pièce jointe factur-x.xml
  const xmlBytes = enc.encode(xml);
  const fileStream = ctx.flateStream(xmlBytes, {
    Type: 'EmbeddedFile',
    Subtype: 'text/xml',
    Params: { Size: xmlBytes.length, ModDate: PDFString.fromDate(now) },
  });
  const fileRef = ctx.register(fileStream);
  const relationship = ['MINIMUM', 'BASIC WL'].includes(opts.conformanceLevel) ? 'Data' : 'Alternative';
  const spec = ctx.obj({
    Type: 'Filespec',
    F: PDFString.of('factur-x.xml'),
    UF: PDFHexString.fromText('factur-x.xml'),
    Desc: PDFString.of('Factur-X invoice'),
    AFRelationship: relationship,
    EF: { F: fileRef, UF: fileRef },
  });
  const specRef = ctx.register(spec);

  // Arbre de noms : on garde les autres pièces jointes, on remplace l'ancienne facture XML.
  const isInvoiceName = (n: string) => XML_ATTACHMENT_NAMES.includes(n.toLowerCase());
  const entries = walkNameTree(doc, embeddedFilesNode(doc)).filter(([n]) => !isInvoiceName(n));
  entries.push(['factur-x.xml', specRef]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const namesArray = ctx.obj([]) as PDFArray;
  for (const [n, ref] of entries) {
    namesArray.push(PDFHexString.fromText(n));
    namesArray.push(ref);
  }
  let namesDict = doc.catalog.lookup(PDFName.of('Names'));
  if (!(namesDict instanceof PDFDict)) {
    namesDict = ctx.obj({});
    doc.catalog.set(PDFName.of('Names'), ctx.register(namesDict as PDFDict));
  }
  (namesDict as PDFDict).set(PDFName.of('EmbeddedFiles'), ctx.register(ctx.obj({ Names: namesArray })));

  // Tableau /AF du catalogue
  const afArray = ctx.obj([]) as PDFArray;
  const oldAf = doc.catalog.lookup(PDFName.of('AF'));
  if (oldAf instanceof PDFArray) {
    for (let i = 0; i < oldAf.size(); i++) {
      const s = oldAf.lookup(i);
      const name = s instanceof PDFDict ? str(s.lookup(PDFName.of('UF'))) ?? str(s.lookup(PDFName.of('F'))) : undefined;
      if (!name || !isInvoiceName(name)) afArray.push(oldAf.get(i));
    }
  }
  afArray.push(specRef);
  doc.catalog.set(PDFName.of('AF'), afArray);

  // 2. Dictionnaire Info et XMP (doivent concorder)
  const title = doc.getTitle() || opts.title || 'Facture';
  const author = doc.getAuthor() || opts.author;
  const subject = doc.getSubject();
  const keywords = doc.getKeywords();
  const creator = doc.getCreator() || 'factur-x-tools';
  const producer = 'factur-x-tools (pdf-lib)';
  const created = doc.getCreationDate() ?? now;
  created.setMilliseconds(0);
  doc.setTitle(title);
  if (author) doc.setAuthor(author);
  doc.setCreator(creator);
  doc.setProducer(producer);
  doc.setCreationDate(created);
  doc.setModificationDate(now);

  const xmp = buildXmp({
    title,
    author,
    subject,
    keywords,
    creator,
    producer,
    createDate: created,
    modifyDate: now,
    conformanceLevel: opts.conformanceLevel,
  });
  const xmpStream = ctx.stream(enc.encode(xmp), { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), ctx.register(xmpStream));

  // 3. OutputIntent sRGB
  const oi = doc.catalog.lookup(PDFName.of('OutputIntents'));
  if (!(oi instanceof PDFArray) || oi.size() === 0) {
    const icc = ctx.flateStream(buildSrgbIcc(), { N: 3 });
    const intent = ctx.obj({
      Type: 'OutputIntent',
      S: 'GTS_PDFA1',
      OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
      RegistryName: PDFString.of('http://www.color.org'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
      DestOutputProfile: ctx.register(icc),
    });
    doc.catalog.set(PDFName.of('OutputIntents'), ctx.obj([ctx.register(intent)]));
  }

  // 4. Identifiant de fichier (obligatoire en PDF/A)
  if (!ctx.trailerInfo.ID) {
    const id = PDFHexString.of(hex(randomId()));
    ctx.trailerInfo.ID = ctx.obj([id, id]);
  }

  const bytes = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  return { bytes, warnings };
}
