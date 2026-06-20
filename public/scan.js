// ---------------------------------------------------------------------------
//  scan.js – guidet "FootScan"-wizard der bruger vision.js til automatisk
//  at måle foden fra et foto + et fodaftryk.
//
//  Alt CV køres på ét display-canvas (skaleret ned til maks. bredde), så
//  tap-koordinater og pixel-koordinater er de samme – ingen omregning.
// ---------------------------------------------------------------------------
import { loadOpenCV, detectReference, scaleFromCorners, scanFoot, analyzeFootprint, REFERENCES } from "./vision.js";

const MAX_W = 720;

export function initScan(container, { onResult, getSide }) {
  container.innerHTML = `
    <div class="scan">
      <p class="hint">
        Tag et foto <b>lige ovenfra</b> af foden, der står på et lyst gulv eller
        et stykke papir, med <b>tæerne opad</b> i billedet. Læg et <b>referencekort</b>
        (fx et sygesikringskort) fladt ved siden af foden – det bruges til at finde
        den rigtige målestok.
      </p>

      <label class="scan-ref">
        Referenceobjekt
        <select id="refType">
          <option value="card">${REFERENCES.card.label}</option>
          <option value="a4">${REFERENCES.a4.label}</option>
          <option value="a5">${REFERENCES.a5.label}</option>
        </select>
      </label>

      <div class="scan-stage">
        <video id="scanCam" playsinline muted hidden></video>
        <canvas id="scanCanvas"></canvas>
      </div>

      <div class="row">
        <button id="scanCamBtn" class="btn">📷 Kamera</button>
        <button id="scanShot" class="btn" hidden>Tag billede</button>
        <label class="file-label">eller upload foto<input id="scanFile" type="file" accept="image/*" hidden /></label>
      </div>

      <div class="row">
        <button id="scanMeasure" class="btn primary" disabled>🔍 Find mål automatisk</button>
        <button id="scanTap" class="btn" disabled>✋ Tap kortets 4 hjørner</button>
      </div>
      <p id="scanStatus" class="result"></p>

      <div id="scanResults" class="scan-results" hidden>
        <div class="scan-readout">
          <div><span>Længde</span><b id="rLen">–</b></div>
          <div><span>Bredde</span><b id="rWid">–</b></div>
          <div><span>Svang</span><b id="rArch">–</b></div>
        </div>
        <details class="scan-arch">
          <summary>Svangmåling fra fodaftryk (valgfrit, mere præcist)</summary>
          <p class="hint">
            Lav et fodaftryk: fugt fodsålen let, og træd på et stykke papir. Tag et
            foto af aftrykket med referencekortet ved siden af, og analysér det her.
          </p>
          <div class="scan-stage small">
            <canvas id="printCanvas"></canvas>
          </div>
          <div class="row">
            <label class="file-label">Upload foto af fodaftryk<input id="printFile" type="file" accept="image/*" hidden /></label>
            <button id="printAnalyze" class="btn" disabled>Analysér svang</button>
          </div>
          <p id="printStatus" class="result"></p>
        </details>
        <button id="scanApply" class="btn primary">✅ Brug disse mål</button>
      </div>
    </div>
  `;

  const $ = (id) => container.querySelector("#" + id);
  const canvas = $("scanCanvas");
  const ctx = canvas.getContext("2d");
  const printCanvas = $("printCanvas");

  const state = {
    img: null, // HTMLImageElement med det skalerede foto
    mmPerPx: null,
    cardCorners: null,
    tapMode: false,
    taps: [],
    scan: null, // {lengthMm,widthMm,outline,contour}
    arch: null, // {csi,archType,archHeight}
    stream: null,
    photoBlob: null,
    printBlob: null,
  };

  const ref = () => REFERENCES[$("refType").value];

  function setStatus(msg, cls = "") {
    const el = $("scanStatus");
    el.textContent = msg;
    el.className = "result " + cls;
  }

  // Tegner basisbilledet (uden overlay).
  function drawBase() {
    if (!state.img) return;
    canvas.width = state.img.width;
    canvas.height = state.img.height;
    ctx.drawImage(state.img, 0, 0);
  }

  function loadImageToCanvas(srcUrl, blob) {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      off.getContext("2d").drawImage(img, 0, 0, w, h);
      const scaled = new Image();
      scaled.onload = () => {
        state.img = scaled;
        state.mmPerPx = null;
        state.cardCorners = null;
        state.scan = null;
        state.taps = [];
        state.tapMode = false;
        // Nulstil også svang/fodaftryk, så gamle resultater ikke følger med
        // et nyt scan.
        state.arch = null;
        state.printBlob = null;
        const pc = printCanvas.getContext("2d");
        pc.clearRect(0, 0, printCanvas.width, printCanvas.height);
        $("printAnalyze").disabled = true;
        $("printStatus").textContent = "";
        $("rArch").textContent = "(ikke målt)";
        drawBase();
        $("scanMeasure").disabled = false;
        $("scanTap").disabled = false;
        $("scanResults").hidden = true;
        setStatus("Foto klar. Tryk 'Find mål automatisk'.");
      };
      scaled.src = off.toDataURL("image/jpeg", 0.9);
    };
    img.src = srcUrl;
    state.photoBlob = blob || null;
  }

  // --- Kamera ---
  $("scanCamBtn").addEventListener("click", async () => {
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      const v = $("scanCam");
      v.srcObject = state.stream;
      v.hidden = false;
      canvas.hidden = true;
      await v.play();
      $("scanShot").hidden = false;
    } catch (e) {
      setStatus("Kunne ikke åbne kameraet: " + e.message, "err");
    }
  });

  $("scanShot").addEventListener("click", () => {
    const v = $("scanCam");
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((blob) => loadImageToCanvas(URL.createObjectURL(blob), blob), "image/jpeg", 0.9);
    v.hidden = true;
    canvas.hidden = false;
    $("scanShot").hidden = true;
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  });

  $("scanFile").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) loadImageToCanvas(URL.createObjectURL(f), f);
  });

  // --- Automatisk måling ---
  $("scanMeasure").addEventListener("click", async () => {
    if (!state.img) return;
    setStatus("Indlæser billedanalyse…", "busy");
    try {
      await loadOpenCV();
    } catch (e) {
      setStatus(e.message, "err");
      return;
    }
    drawBase();

    // 1) Skala
    if (!state.mmPerPx) {
      setStatus("Finder referencekort…", "busy");
      const det = detectReference(canvas, ref());
      if (det) {
        state.mmPerPx = det.mmPerPx;
        state.cardCorners = det.corners;
        drawQuad(det.corners, "#ffd166");
      } else {
        setStatus("Fandt ikke kortet automatisk. Tryk '✋ Tap kortets 4 hjørner'.", "err");
        return;
      }
    }

    // 2) Fod
    setStatus("Segmenterer fod (kan tage et par sekunder)…", "busy");
    await new Promise((r) => setTimeout(r, 30));
    const res = scanFoot(canvas, state.mmPerPx, state.cardCorners);
    if (!res) {
      setStatus("Kunne ikke finde foden tydeligt. Prøv et foto med mere kontrast/lys.", "err");
      return;
    }
    state.scan = res;
    drawContour(res.contour, "#36c2a0");
    showResults();
    setStatus("Mål fundet! Tjek omridset på billedet og finjustér evt. bagefter.", "ok");
  });

  // --- Manuel tap af kortets hjørner ---
  $("scanTap").addEventListener("click", () => {
    if (!state.img) return;
    state.tapMode = true;
    state.taps = [];
    drawBase();
    setStatus("Tap de 4 hjørner af referencekortet (med uret).", "busy");
  });

  canvas.addEventListener("click", (e) => {
    if (!state.tapMode) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    state.taps.push({ x, y });
    drawBase();
    drawPoints(state.taps, "#ffd166");
    if (state.taps.length === 4) {
      state.tapMode = false;
      const mmPerPx = scaleFromCorners(state.taps, ref());
      if (mmPerPx) {
        state.mmPerPx = mmPerPx;
        state.cardCorners = state.taps.slice();
        drawQuad(state.cardCorners, "#ffd166");
        setStatus("Målestok sat. Tryk 'Find mål automatisk' igen for at måle foden.", "ok");
      } else {
        setStatus("Kunne ikke beregne målestok. Prøv igen.", "err");
      }
    }
  });

  // --- Fodaftryk / svang ---
  $("printFile").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    state.printBlob = f;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.naturalWidth);
      printCanvas.width = Math.round(img.naturalWidth * scale);
      printCanvas.height = Math.round(img.naturalHeight * scale);
      printCanvas.getContext("2d").drawImage(img, 0, 0, printCanvas.width, printCanvas.height);
      $("printAnalyze").disabled = false;
      $("printStatus").textContent = "Foto klar. Tryk 'Analysér svang'.";
    };
    img.src = URL.createObjectURL(f);
  });

  $("printAnalyze").addEventListener("click", async () => {
    try {
      await loadOpenCV();
    } catch (e) {
      $("printStatus").textContent = e.message;
      return;
    }
    if (!state.mmPerPx) {
      $("printStatus").textContent = "Sæt først målestok via fod-fotoet ovenfor.";
      return;
    }
    const r = analyzeFootprint(printCanvas, state.mmPerPx);
    if (!r) {
      $("printStatus").textContent = "Kunne ikke analysere aftrykket.";
      return;
    }
    state.arch = r;
    $("rArch").textContent = `${archLabel(r.archType)} (CSI ${r.csi})`;
    $("printStatus").textContent = `Svangindeks ${r.csi} → ${archLabel(r.archType)}.`;
  });

  // --- Anvend resultater ---
  $("scanApply").addEventListener("click", () => {
    if (!state.scan) return;
    const m = {
      length: Math.round(state.scan.lengthMm),
      width: Math.round(state.scan.widthMm),
    };
    if (state.arch) {
      m.archType = state.arch.archType;
      m.archHeight = state.arch.archHeight;
    }
    const photos = [state.photoBlob, state.printBlob].filter(Boolean);
    onResult(m, state.scan.outline, photos);
    setStatus("Målene er overført til forhåndsvisningen ✅", "ok");
  });

  function showResults() {
    $("scanResults").hidden = false;
    $("rLen").textContent = Math.round(state.scan.lengthMm) + " mm";
    $("rWid").textContent = Math.round(state.scan.widthMm) + " mm";
    if (!state.arch) $("rArch").textContent = "(ikke målt)";
  }

  // --- Tegnehjælpere ---
  function drawQuad(pts, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  function drawContour(pts, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  function drawPoints(pts, color) {
    ctx.fillStyle = color;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function archLabel(t) {
  return { flat: "Platfod", low: "Lav svang", neutral: "Neutral", high: "Høj svang" }[t] || t;
}
