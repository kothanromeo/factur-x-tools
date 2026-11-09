/*
 * Génère un petit profil ICC v2 « sRGB » (matrice + courbe gamma 2,2).
 *
 * PDF/A exige un OutputIntent qui embarque un profil ICC. Plutôt que de
 * livrer un fichier binaire de provenance incertaine, on le fabrique ici :
 * en-tête de 128 octets, table des balises, puis les balises elles-mêmes.
 * Les primaires sont celles de sRGB adaptées à D50 (Bradford), comme dans
 * le profil de référence de l'ICC.
 */

const s15 = (v: number) => Math.round(v * 65536);

class Writer {
  bytes: number[] = [];
  u8(v: number) {
    this.bytes.push(v & 0xff);
  }
  u16(v: number) {
    this.u8(v >>> 8);
    this.u8(v);
  }
  u32(v: number) {
    this.u16((v >>> 16) & 0xffff);
    this.u16(v & 0xffff);
  }
  i32(v: number) {
    this.u32(v >>> 0);
  }
  ascii(s: string) {
    for (const ch of s) this.u8(ch.charCodeAt(0));
  }
  zeros(n: number) {
    for (let i = 0; i < n; i++) this.u8(0);
  }
  pad4() {
    while (this.bytes.length % 4) this.u8(0);
  }
}

function xyz(x: number, y: number, z: number): number[] {
  const w = new Writer();
  w.ascii('XYZ ');
  w.zeros(4);
  w.i32(s15(x));
  w.i32(s15(y));
  w.i32(s15(z));
  return w.bytes;
}

function desc(text: string): number[] {
  const w = new Writer();
  w.ascii('desc');
  w.zeros(4);
  w.u32(text.length + 1);
  w.ascii(text);
  w.u8(0);
  w.u32(0); // langue Unicode
  w.u32(0); // longueur Unicode
  w.u16(0); // code ScriptCode
  w.u8(0); // longueur ScriptCode
  w.zeros(67);
  return w.bytes;
}

function text(t: string): number[] {
  const w = new Writer();
  w.ascii('text');
  w.zeros(4);
  w.ascii(t);
  w.u8(0);
  return w.bytes;
}

function curve(gamma: number): number[] {
  const w = new Writer();
  w.ascii('curv');
  w.zeros(4);
  w.u32(1);
  w.u16(Math.round(gamma * 256)); // u8Fixed8
  return w.bytes;
}

export function buildSrgbIcc(): Uint8Array {
  const trc = curve(2.2);
  const tags: [string, number[]][] = [
    ['desc', desc('sRGB IEC61966-2.1')],
    ['cprt', text('No copyright, use freely')],
    ['wtpt', xyz(0.9642, 1.0, 0.8249)],
    ['rXYZ', xyz(0.4360747, 0.2225045, 0.0139322)],
    ['gXYZ', xyz(0.3850649, 0.7168786, 0.0971045)],
    ['bXYZ', xyz(0.1430804, 0.0606169, 0.7141733)],
    ['rTRC', trc],
    ['gTRC', trc],
    ['bTRC', trc],
  ];

  // Calcul des décalages : en-tête (128) + compteur (4) + 12 octets par balise.
  let offset = 128 + 4 + tags.length * 12;
  const table: { sig: string; offset: number; size: number }[] = [];
  const data = new Writer();
  const seen = new Map<number[], number>();
  for (const [sig, bytes] of tags) {
    const known = seen.get(bytes);
    if (known !== undefined) {
      table.push({ sig, offset: known, size: bytes.length });
      continue;
    }
    while ((offset + data.bytes.length) % 4) data.u8(0);
    const at = offset + data.bytes.length;
    data.bytes.push(...bytes);
    seen.set(bytes, at);
    table.push({ sig, offset: at, size: bytes.length });
  }
  data.pad4();
  const total = offset + data.bytes.length;

  const w = new Writer();
  w.u32(total); // taille du profil
  w.u32(0); // CMM
  w.u32(0x02100000); // version 2.1
  w.ascii('mntr'); // classe : écran
  w.ascii('RGB ');
  w.ascii('XYZ ');
  // Date de création : 2026-01-01 00:00:00
  w.u16(2026); w.u16(1); w.u16(1); w.u16(0); w.u16(0); w.u16(0);
  w.ascii('acsp');
  w.u32(0); // plateforme
  w.u32(0); // drapeaux
  w.u32(0); // fabricant
  w.u32(0); // modèle
  w.zeros(8); // attributs
  w.u32(0); // intention de rendu : perceptuelle
  w.i32(s15(0.9642)); w.i32(s15(1.0)); w.i32(s15(0.8249)); // illuminant D50
  w.u32(0); // créateur
  w.zeros(16 + 28); // ID (v4) + réservé
  w.u32(tags.length);
  for (const t of table) {
    w.ascii(t.sig);
    w.u32(t.offset);
    w.u32(t.size);
  }
  w.bytes.push(...data.bytes);
  return new Uint8Array(w.bytes);
}
