import { esc } from './build';

export interface XmpInfo {
  title: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator: string;
  producer: string;
  createDate: Date;
  modifyDate: Date;
  conformanceLevel: string;
  documentFileName?: string;
}

/** Date XMP (ISO 8601, UTC, sans millisecondes). */
export function xmpDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const FX = 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';

function prop(name: string, type: string, description: string): string {
  return `
              <rdf:li rdf:parseType="Resource">
                <pdfaProperty:name>${name}</pdfaProperty:name>
                <pdfaProperty:valueType>${type}</pdfaProperty:valueType>
                <pdfaProperty:category>external</pdfaProperty:category>
                <pdfaProperty:description>${description}</pdfaProperty:description>
              </rdf:li>`;
}

/**
 * Métadonnées XMP d'un PDF/A-3B Factur-X. Les valeurs doivent être
 * identiques à celles du dictionnaire Info du PDF (exigence PDF/A).
 */
export function buildXmp(i: XmpInfo): string {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(i.title)}</rdf:li></rdf:Alt></dc:title>${
        i.author ? `\n      <dc:creator><rdf:Seq><rdf:li>${esc(i.author)}</rdf:li></rdf:Seq></dc:creator>` : ''
      }${
        i.subject
          ? `\n      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${esc(i.subject)}</rdf:li></rdf:Alt></dc:description>`
          : ''
      }
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${esc(i.producer)}</pdf:Producer>${i.keywords ? `\n      <pdf:Keywords>${esc(i.keywords)}</pdf:Keywords>` : ''}
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${esc(i.creator)}</xmp:CreatorTool>
      <xmp:CreateDate>${xmpDate(i.createDate)}</xmp:CreateDate>
      <xmp:ModifyDate>${xmpDate(i.modifyDate)}</xmp:ModifyDate>
      <xmp:MetadataDate>${xmpDate(i.modifyDate)}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="${FX}">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${esc(i.documentFileName ?? 'factur-x.xml')}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${esc(i.conformanceLevel)}</fx:ConformanceLevel>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>${FX}</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>${prop('DocumentFileName', 'Text', 'name of the embedded XML invoice file')}${prop(
                'DocumentType',
                'Text',
                'INVOICE',
              )}${prop('Version', 'Text', 'The actual version of the Factur-X XML schema')}${prop(
                'ConformanceLevel',
                'Text',
                'The conformance level of the embedded Factur-X data',
              )}
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
${' '.repeat(2000)}
<?xpacket end="w"?>`;
}

/** Lecture rapide de quelques champs XMP utiles au diagnostic. */
export function readXmp(xmp: string): {
  pdfaPart?: string;
  pdfaConformance?: string;
  fxConformanceLevel?: string;
  fxDocumentFileName?: string;
  fxDocumentType?: string;
} {
  const pick = (name: string) => {
    // Forme élément <ns:name>v</ns:name> ou attribut ns:name="v"
    const el = new RegExp(`<[\\w-]+:${name}>\\s*([^<]*?)\\s*</[\\w-]+:${name}>`).exec(xmp);
    if (el) return el[1];
    const attr = new RegExp(`[\\w-]+:${name}="([^"]*)"`).exec(xmp);
    return attr?.[1];
  };
  return {
    pdfaPart: pick('part'),
    pdfaConformance: pick('conformance'),
    fxConformanceLevel: pick('ConformanceLevel'),
    fxDocumentFileName: pick('DocumentFileName'),
    fxDocumentType: pick('DocumentType'),
  };
}
