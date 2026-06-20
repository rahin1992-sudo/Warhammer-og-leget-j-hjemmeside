import * as THREE from "three";

// ---------------------------------------------------------------------------
//  Parametrisk generator for en ortopædisk TPU-indlægssål.
//
//  Modellen er bygget som en struktureret (Nu x Nv) flade, der nøjagtigt
//  følger en realistisk sål-kontur. Den genererede geometri er lukket
//  (watertight): top-flade + flad bund + sidevæg hele vejen rundt, hvilket
//  giver en STL der kan slices og printes direkte.
//
//  Koordinatsystem (mm):
//    x = langs foden, 0 = hæl, L = tå
//    y = på tværs, negativ = lateral (ydersiden), positiv = medial (indersiden)
//    z = opad (sålens tykkelse)
//
//  De terapeutiske elementer for platfod:
//    - Medial svangstøtte (forhøjning langs indersiden af svangen)
//    - Dyb hælkop der stabiliserer hælen mod overpronation
//    - Mellemfodsstøtte (metatarsal-pude) bag forfoden
// ---------------------------------------------------------------------------

// Breddeprofil: hvor bred sålen er (som andel af maks-bredden) langs foden.
// u = 0 (hæl) -> u = 1 (tå). Værdierne er empirisk valgt så formen ligner
// en almindelig fodseng.
const WIDTH_PROFILE = [
  [0.0, 0.42],
  [0.04, 0.5],
  [0.12, 0.55],
  [0.3, 0.62],
  [0.5, 0.7],
  [0.62, 0.92],
  [0.72, 1.0],
  [0.8, 0.97],
  [0.88, 0.88],
  [0.95, 0.7],
  [1.0, 0.4],
];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gaussian(x, center, sigma) {
  const d = (x - center) / sigma;
  return Math.exp(-d * d);
}

// Lineær interpolation i breddeprofilet.
function widthFraction(u) {
  const pts = WIDTH_PROFILE;
  if (u <= pts[0][0]) return pts[0][1];
  if (u >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [u0, w0] = pts[i];
    const [u1, w1] = pts[i + 1];
    if (u >= u0 && u <= u1) {
      const t = (u - u0) / (u1 - u0);
      return w0 + (w1 - w0) * t;
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Beregner højden af topfladen (sålens tykkelse) på et givet punkt.
 * @param {number} u  0..1 langs foden (0=hæl, 1=tå)
 * @param {number} v  0..1 på tværs (0=lateral, 1=medial)
 * @param {object} p  parametre i mm
 */
function topHeight(u, v, p) {
  // |2v-1|: 0 i midten, 1 ved kanterne.
  const edgeness = Math.abs(2 * v - 1);

  // --- Hælkop: forhøjede kanter bagest der danner en skål. ---
  const heelRegion = smoothstep(0.32, 0.0, u); // 1 ved hæl -> 0 ved u=0.32
  const cup = p.heelCup * heelRegion * Math.pow(edgeness, 1.4);

  // --- Medial svangstøtte ---
  // Toppen ligger ca. 42% fra hælen, på den mediale side (v ~ 0.8).
  const archAlong = gaussian(u, 0.42, 0.17);
  const archAcross = v < 0.4 ? 0 : gaussian(v, 0.82, 0.24);
  const arch = p.archHeight * archAlong * archAcross;

  // --- Mellemfodsstøtte (metatarsal-pude) ---
  const metAlong = gaussian(u, 0.6, 0.09);
  const metAcross = gaussian(v, 0.5, 0.32);
  const met = p.metPad * metAlong * metAcross;

  // --- Let generel skålform så foden holdes på plads ---
  const cradle = p.cradle * smoothstep(0.1, 0.5, u) * smoothstep(0.95, 0.6, u) * Math.pow(edgeness, 2);

  let z = p.baseThickness + cup + arch + met + cradle;

  // --- Tå-udtynding: forfoden gøres tyndere så den er behagelig i skoen. ---
  const toeScale = 1 - 0.55 * smoothstep(0.86, 1.0, u);
  z *= toeScale;

  // Sikr en minimumstykkelse så det kan printes.
  return Math.max(p.minThickness, z);
}

/**
 * Bygger en watertight THREE.BufferGeometry for sålen.
 * @param {object} params
 * @param {boolean} mirror  spejlvend til den anden fod
 */
export function buildInsoleGeometry(params, mirror = false) {
  const p = normalizeParams(params);
  const Nu = 140; // segmenter langs foden
  const Nv = 52; // segmenter på tværs
  const cols = Nv + 1;

  const positions = [];
  const indices = [];

  const L = p.length;
  const halfMaxW = (p.width / 2);

  // Topfladens punkter.
  for (let i = 0; i <= Nu; i++) {
    const u = i / Nu;
    const x = u * L;
    const halfW = halfMaxW * widthFraction(u);
    for (let j = 0; j <= Nv; j++) {
      const v = j / Nv;
      let y = (2 * v - 1) * halfW;
      const z = topHeight(u, v, p);
      if (mirror) y = -y;
      positions.push(x, y, z);
    }
  }

  const topCount = (Nu + 1) * cols;

  // Bundfladens punkter (flad, z = 0).
  for (let i = 0; i <= Nu; i++) {
    const u = i / Nu;
    const x = u * L;
    const halfW = halfMaxW * widthFraction(u);
    for (let j = 0; j <= Nv; j++) {
      const v = j / Nv;
      let y = (2 * v - 1) * halfW;
      if (mirror) y = -y;
      positions.push(x, y, 0);
    }
  }

  const t = (i, j) => i * cols + j;
  const b = (i, j) => topCount + i * cols + j;

  const tri = (a, c, d) => {
    if (mirror) indices.push(a, d, c);
    else indices.push(a, c, d);
  };

  // Topflade (normaler opad).
  for (let i = 0; i < Nu; i++) {
    for (let j = 0; j < Nv; j++) {
      tri(t(i, j), t(i + 1, j), t(i + 1, j + 1));
      tri(t(i, j), t(i + 1, j + 1), t(i, j + 1));
    }
  }

  // Bundflade (omvendt vinding -> normaler nedad).
  for (let i = 0; i < Nu; i++) {
    for (let j = 0; j < Nv; j++) {
      tri(b(i, j), b(i + 1, j + 1), b(i + 1, j));
      tri(b(i, j), b(i, j + 1), b(i + 1, j + 1));
    }
  }

  // Sidevæg hele vejen rundt langs konturen.
  const loop = [];
  for (let j = 0; j <= Nv; j++) loop.push([0, j]); // hæl-kant
  for (let i = 1; i <= Nu; i++) loop.push([i, Nv]); // medial kant
  for (let j = Nv - 1; j >= 0; j--) loop.push([Nu, j]); // tå-kant
  for (let i = Nu - 1; i >= 1; i--) loop.push([i, 0]); // lateral kant

  for (let k = 0; k < loop.length; k++) {
    const [i0, j0] = loop[k];
    const [i1, j1] = loop[(k + 1) % loop.length];
    const tp = t(i0, j0);
    const tq = t(i1, j1);
    const bp = b(i0, j0);
    const bq = b(i1, j1);
    tri(tp, bp, bq);
    tri(tp, bq, tq);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // Centrér på x/y så modellen står pænt i previewet.
  geom.translate(-L / 2, 0, 0);
  return geom;
}

// Sætter fornuftige defaults + udleder svanghøjde ud fra svangtype.
export function normalizeParams(input) {
  const archDefaults = { flat: 16, low: 12, neutral: 8, high: 5 };
  const archType = input.archType || "flat";

  const p = {
    length: clamp(num(input.length, 240), 150, 360),
    width: clamp(num(input.width, 95), 60, 160),
    baseThickness: clamp(num(input.baseThickness, 3), 1.5, 8),
    heelCup: clamp(num(input.heelCup, 9), 0, 20),
    archHeight: input.archHeight != null ? clamp(num(input.archHeight, 16), 0, 30) : archDefaults[archType],
    metPad: clamp(num(input.metPad, 3.5), 0, 12),
    cradle: clamp(num(input.cradle, 2.5), 0, 8),
    minThickness: 1.6,
    archType,
  };
  return p;
}

function num(x, fallback) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
