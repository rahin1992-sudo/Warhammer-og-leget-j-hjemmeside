// ---------------------------------------------------------------------------
//  vision.js – computer vision til automatisk fodmåling (OpenCV.js).
//
//  Pipeline (kører helt i browseren):
//    1. Skala: find et referenceobjekt (kreditkort eller A4) i billedet, eller
//       lad brugeren tappe de 4 hjørner. Det giver mm pr. pixel.
//    2. Fod: segmentér foden (GrabCut) og udtræk det rigtige omrids ->
//       længde, bredde og en asymmetrisk fodseng-kontur.
//    3. Svang: analysér et fodaftryk og beregn svangindeks (Chippaux-Smirak)
//       -> klassificér flad/normal/høj svang.
//
//  Alle funktioner er defensive: ved fejl returneres null, så UI'et kan
//  falde tilbage til manuel måling.
// ---------------------------------------------------------------------------

export const REFERENCES = {
  card: { w: 85.6, h: 53.98, label: "Kreditkort / sygesikringskort (85,6 × 54 mm)" },
  a4: { w: 297, h: 210, label: "A4-ark (297 × 210 mm)" },
  a5: { w: 210, h: 148, label: "A5-ark (210 × 148 mm)" },
};

let cvReady = null;

// Indlæser OpenCV.js én gang.
export function loadOpenCV() {
  if (cvReady) return cvReady;
  cvReady = new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) return resolve(window.cv);
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.10.0/opencv.js";
    script.async = true;
    script.onload = () => {
      const check = () => {
        if (window.cv && window.cv.Mat) resolve(window.cv);
        else if (window.cv) window.cv.onRuntimeInitialized = () => resolve(window.cv);
        else setTimeout(check, 50);
      };
      check();
    };
    script.onerror = () => reject(new Error("Kunne ikke hente OpenCV.js (kræver internet)."));
    document.head.appendChild(script);
  });
  return cvReady;
}

// --- Små geometri-hjælpere ----------------------------------------------------
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Sorterer 4 hjørner: [tl, tr, br, bl].
function orderCorners(pts) {
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bot = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bot[1], bot[0]];
}

// mm pr. pixel ud fra 4 hjørner af et referenceobjekt med kendte mål.
export function scaleFromCorners(pts, ref) {
  const [tl, tr, br, bl] = orderCorners(pts);
  const wPx = (dist(tl, tr) + dist(bl, br)) / 2;
  const hPx = (dist(tl, bl) + dist(tr, br)) / 2;
  const longPx = Math.max(wPx, hPx);
  const shortPx = Math.min(wPx, hPx);
  const longMm = Math.max(ref.w, ref.h);
  const shortMm = Math.min(ref.w, ref.h);
  if (longPx < 5 || shortPx < 5) return null;
  return (longMm / longPx + shortMm / shortPx) / 2;
}

// --- Automatisk detektion af referenceobjekt --------------------------------
export function detectReference(canvas, ref) {
  const cv = window.cv;
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const edged = new cv.Mat();
  const contours = new cv.MatVector();
  const hier = new cv.Mat();
  let result = null;
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edged, 50, 150);
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.dilate(edged, edged, kernel);
    kernel.delete();
    cv.findContours(edged, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const targetAspect = Math.max(ref.w, ref.h) / Math.min(ref.w, ref.h);
    const minArea = 0.01 * src.rows * src.cols;
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const area = cv.contourArea(approx);
        if (area > minArea) {
          const rect = cv.minAreaRect(approx);
          const w = rect.size.width;
          const h = rect.size.height;
          const aspect = Math.max(w, h) / Math.min(w, h);
          const score = Math.abs(aspect - targetAspect);
          if (score < bestScore && score < 0.3) {
            bestScore = score;
            const d = approx.data32S;
            best = [
              { x: d[0], y: d[1] },
              { x: d[2], y: d[3] },
              { x: d[4], y: d[5] },
              { x: d[6], y: d[7] },
            ];
          }
        }
      }
      approx.delete();
      c.delete();
    }

    if (best) {
      const mmPerPx = scaleFromCorners(best, ref);
      if (mmPerPx) result = { corners: best, mmPerPx };
    }
  } catch (e) {
    console.warn("detectReference fejl:", e);
  } finally {
    src.delete();
    gray.delete();
    edged.delete();
    contours.delete();
    hier.delete();
  }
  return result;
}

// --- PCA-orientering af en punktsky -----------------------------------------
function principalAxis(points) {
  let mx = 0, my = 0;
  for (const p of points) { mx += p.x; my += p.y; }
  mx /= points.length; my /= points.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  // Største egenvektor af [[sxx,sxy],[sxy,syy]]
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { cx: mx, cy: my, theta };
}

// Roterer punkter så hovedaksen ligger langs x.
function alignPoints(points, axis) {
  const cos = Math.cos(-axis.theta), sin = Math.sin(-axis.theta);
  return points.map((p) => {
    const dx = p.x - axis.cx, dy = p.y - axis.cy;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  });
}

function smooth(arr, win = 2) {
  const out = arr.slice();
  for (let i = 0; i < arr.length; i++) {
    let s = 0, n = 0;
    for (let k = -win; k <= win; k++) {
      const j = i + k;
      if (j >= 0 && j < arr.length) { s += arr[j]; n++; }
    }
    out[i] = s / n;
  }
  return out;
}

// Største kontur i en binær maske.
function largestContour(cv, mask) {
  const contours = new cv.MatVector();
  const hier = new cv.Mat();
  cv.findContours(mask, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  let best = null, bestArea = 0, bestPts = null;
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const a = cv.contourArea(c);
    if (a > bestArea) {
      if (best) best.delete();
      bestArea = a;
      best = c;
      const d = c.data32S;
      bestPts = [];
      for (let k = 0; k < d.length; k += 2) bestPts.push({ x: d[k], y: d[k + 1] });
    } else {
      c.delete();
    }
  }
  contours.delete();
  hier.delete();
  if (best) best.delete();
  return bestPts;
}

// Bygger et omrids (lateral/medial-arrays i mm) ud fra en kontur.
function contourToOutline(points, mmPerPx, stations = 48) {
  const axis = principalAxis(points);
  const aligned = alignPoints(points, axis);
  let xmin = Infinity, xmax = -Infinity, ymean = 0;
  for (const p of aligned) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); ymean += p.y; }
  ymean /= aligned.length;
  const lengthPx = xmax - xmin;
  if (lengthPx < 5) return null;

  // Per station: min/max y (de to kanter).
  const lo = new Array(stations + 1).fill(Infinity);
  const hi = new Array(stations + 1).fill(-Infinity);
  for (const p of aligned) {
    const s = Math.round(((p.x - xmin) / lengthPx) * stations);
    const idx = Math.min(stations, Math.max(0, s));
    lo[idx] = Math.min(lo[idx], p.y);
    hi[idx] = Math.max(hi[idx], p.y);
  }
  // Fyld huller.
  for (let i = 0; i <= stations; i++) {
    if (!Number.isFinite(lo[i])) lo[i] = ymean;
    if (!Number.isFinite(hi[i])) hi[i] = ymean;
  }

  let widthProfile = hi.map((h, i) => h - lo[i]);
  const maxWidth = Math.max(...widthProfile);
  const ballIdx = widthProfile.indexOf(maxWidth);

  // Sørg for retning hæl(0) -> tå(1): ballen sidder i forreste halvdel.
  let A = lo.slice(), B = hi.slice();
  if (ballIdx < stations / 2) {
    A = A.reverse(); B = B.reverse(); widthProfile = widthProfile.reverse();
  }

  // Centrér om midten og konvertér til mm.
  const sideA = A.map((y) => (y - ymean) * mmPerPx);
  const sideB = B.map((y) => (y - ymean) * mmPerPx);

  // Medial = den rette(re) side. Mål afvigelse fra en ret linje.
  const straightness = (arr) => {
    const n = arr.length;
    const slope = (arr[n - 1] - arr[0]) / (n - 1);
    let dev = 0;
    for (let i = 0; i < n; i++) dev += Math.abs(arr[i] - (arr[0] + slope * i));
    return dev / n;
  };
  let medial, lateral;
  if (straightness(sideA) < straightness(sideB)) { medial = sideA; lateral = sideB; }
  else { medial = sideB; lateral = sideA; }

  // Sørg for at medial er den positive side.
  const medMean = medial.reduce((a, b) => a + b, 0) / medial.length;
  if (medMean < 0) { medial = medial.map((v) => -v); lateral = lateral.map((v) => -v); }

  return {
    lengthMm: lengthPx * mmPerPx,
    widthMm: maxWidth * mmPerPx,
    outline: { medial: smooth(medial), lateral: smooth(lateral) },
  };
}

// --- Segmentér fod og mål den ----------------------------------------------
export function scanFoot(canvas, mmPerPx, excludeCorners = null) {
  const cv = window.cv;
  const src = cv.imread(canvas);
  const rgb = new cv.Mat();
  const mask = new cv.Mat();
  const bgd = new cv.Mat();
  const fgd = new cv.Mat();
  let out = null;
  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    const mx = Math.round(src.cols * 0.1);
    const my = Math.round(src.rows * 0.08);
    const rect = new cv.Rect(mx, my, src.cols - 2 * mx, src.rows - 2 * my);
    cv.grabCut(rgb, mask, rect, bgd, fgd, 4, cv.GC_INIT_WITH_RECT);

    // Forgrund = GC_FGD(1) eller GC_PR_FGD(3).
    const bin = new cv.Mat(mask.rows, mask.cols, cv.CV_8UC1);
    for (let i = 0; i < mask.data.length; i++) {
      const v = mask.data[i];
      bin.data[i] = v === 1 || v === 3 ? 255 : 0;
    }

    // Fjern referenceobjektet fra masken, så det ikke tælles med som fod.
    if (excludeCorners && excludeCorners.length === 4) {
      const pts = [];
      for (const c of excludeCorners) pts.push(c.x, c.y);
      const poly = cv.matFromArray(4, 1, cv.CV_32SC2, pts);
      const mv = new cv.MatVector();
      mv.push_back(poly);
      cv.fillPoly(bin, mv, new cv.Scalar(0));
      poly.delete();
      mv.delete();
    }

    const k = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(7, 7));
    cv.morphologyEx(bin, bin, cv.MORPH_OPEN, k);
    cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, k);
    k.delete();

    const pts = largestContour(cv, bin);
    bin.delete();
    if (!pts || pts.length < 20) return null;

    const measured = contourToOutline(pts, mmPerPx);
    if (!measured) return null;
    out = { ...measured, contour: pts };
  } catch (e) {
    console.warn("scanFoot fejl:", e);
  } finally {
    src.delete();
    rgb.delete();
    mask.delete();
    bgd.delete();
    fgd.delete();
  }
  return out;
}

// --- Svanganalyse fra et fodaftryk ------------------------------------------
export function analyzeFootprint(canvas, mmPerPx) {
  const cv = window.cv;
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const bin = new cv.Mat();
  let out = null;
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // Aftrykket er mørkere end papiret -> invers Otsu giver aftrykket som hvidt.
    cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    const k = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
    cv.morphologyEx(bin, bin, cv.MORPH_OPEN, k);
    cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, k);
    k.delete();

    const pts = largestContour(cv, bin);
    if (!pts || pts.length < 20) return null;

    const axis = principalAxis(pts);
    const aligned = alignPoints(pts, axis);
    let xmin = Infinity, xmax = -Infinity;
    for (const p of aligned) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); }
    const len = xmax - xmin;
    const S = 60;
    const lo = new Array(S + 1).fill(Infinity);
    const hi = new Array(S + 1).fill(-Infinity);
    for (const p of aligned) {
      const idx = Math.min(S, Math.max(0, Math.round(((p.x - xmin) / len) * S)));
      lo[idx] = Math.min(lo[idx], p.y);
      hi[idx] = Math.max(hi[idx], p.y);
    }
    const width = [];
    for (let i = 0; i <= S; i++) {
      width[i] = Number.isFinite(lo[i]) && Number.isFinite(hi[i]) ? hi[i] - lo[i] : 0;
    }
    // Forfod = den brede ende. Sørg for at forfoden er i sidste tredjedel.
    const front = width.slice(Math.round(S * 0.66));
    const back = width.slice(0, Math.round(S * 0.33));
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    let w = width;
    if (sum(back) > sum(front)) w = width.slice().reverse();

    const foreMax = Math.max(...w.slice(Math.round(S * 0.6))); // ballen
    const midMin = Math.min(...w.slice(Math.round(S * 0.33), Math.round(S * 0.6))); // svangen
    const csi = foreMax > 0 ? (midMin / foreMax) * 100 : 0;

    let archType, archHeight;
    if (csi >= 45) { archType = "flat"; archHeight = 16; }
    else if (csi >= 40) { archType = "low"; archHeight = 12; }
    else if (csi >= 28) { archType = "neutral"; archHeight = 8; }
    else { archType = "high"; archHeight = 5; }

    out = { csi: Math.round(csi), archType, archHeight };
  } catch (e) {
    console.warn("analyzeFootprint fejl:", e);
  } finally {
    src.delete();
    gray.delete();
    bin.delete();
  }
  return out;
}
