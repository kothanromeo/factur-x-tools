import regularUrl from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import boldUrl from '@fontsource/inter/files/inter-latin-700-normal.woff?url';
import type { Fonts } from '../lib/facturx/render';

let cache: Promise<Fonts> | undefined;

/** Charge (une seule fois) la police Inter incorporée dans les PDF générés. */
export function loadFonts(): Promise<Fonts> {
  cache ??= Promise.all([fetch(regularUrl), fetch(boldUrl)]).then(async ([r, b]) => {
    if (!r.ok || !b.ok) throw new Error('Police introuvable');
    return { regular: await r.arrayBuffer(), bold: await b.arrayBuffer() };
  });
  return cache;
}
