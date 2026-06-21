import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { buildInsoleGeometry } from "./insole.js";
import { initScan } from "./scan.js";

// ---------------------------------------------------------------------------
//  State
// ---------------------------------------------------------------------------
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null; // den endelige video (optaget eller uploadet)
let recTimer = null;
let recSeconds = 0;
let scannedOutline = null; // fodens omrids fra automatisk scanning
let scanPhotos = []; // fotos brugt til scanning (sendes med i mailen)

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
//  Video: kamera + optagelse
// ---------------------------------------------------------------------------
const preview = $("preview");
const playback = $("playback");

$("startCam").addEventListener("click", async () => {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: false,
    });
    preview.srcObject = mediaStream;
    preview.hidden = false;
    playback.hidden = true;
    $("recBtn").disabled = false;
    $("startCam").textContent = "📷 Kamera tændt";
  } catch (err) {
    setVideoStatus("Kunne ikke åbne kameraet: " + err.message, true);
  }
});

$("recBtn").addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  startRecording();
});

function pickMimeType() {
  const candidates = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

function startRecording() {
  if (!mediaStream) return;
  recordedChunks = [];
  const mimeType = pickMimeType();
  mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
    showRecordedVideo(recordedBlob);
    stopRecTimer();
    const btn = $("recBtn");
    btn.textContent = "● Optag igen";
    btn.classList.remove("recording");
  };
  mediaRecorder.start();
  startRecTimer();
  const btn = $("recBtn");
  btn.textContent = "■ Stop";
  btn.classList.add("recording");
}

function showRecordedVideo(blob) {
  const url = URL.createObjectURL(blob);
  playback.src = url;
  playback.hidden = false;
  preview.hidden = true;
  setVideoStatus(`Video klar (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
}

function startRecTimer() {
  recSeconds = 0;
  const el = $("recTime");
  el.hidden = false;
  el.textContent = "00:00";
  recTimer = setInterval(() => {
    recSeconds++;
    const m = String(Math.floor(recSeconds / 60)).padStart(2, "0");
    const s = String(recSeconds % 60).padStart(2, "0");
    el.textContent = `${m}:${s}`;
  }, 1000);
}
function stopRecTimer() {
  clearInterval(recTimer);
  $("recTime").hidden = true;
}

$("videoFile").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  recordedBlob = file;
  showRecordedVideo(file);
});

function setVideoStatus(msg, isError = false) {
  const el = $("videoStatus");
  el.textContent = msg;
  el.style.color = isError ? "var(--danger)" : "var(--accent)";
}

// ---------------------------------------------------------------------------
//  Mål-formular
// ---------------------------------------------------------------------------
const sliderPairs = [
  ["archHeight", "archHeightVal"],
  ["heelCup", "heelCupVal"],
  ["metPad", "metPadVal"],
  ["baseThickness", "baseThicknessVal"],
];
sliderPairs.forEach(([input, label]) => {
  $(input).addEventListener("input", () => {
    $(label).textContent = $(input).value;
    scheduleUpdate();
  });
});

// EU-størrelse -> foreslået fodlængde (mm). Lasten er ca. 1,5 cm længere end foden.
$("shoeSize").addEventListener("input", () => {
  const eu = Number($("shoeSize").value);
  if (Number.isFinite(eu) && eu > 0) {
    const lengthMm = Math.round((eu / 1.5) * 10 - 15);
    $("length").value = lengthMm;
    $("width").value = Math.round(lengthMm * 0.39);
    scheduleUpdate();
  }
});

// Svangtype ændrer default-svangstøtte.
$("archType").addEventListener("change", () => {
  const defaults = { flat: 16, low: 12, neutral: 8, high: 5 };
  const v = defaults[$("archType").value];
  $("archHeight").value = v;
  $("archHeightVal").textContent = v;
  scheduleUpdate();
});

["length", "width", "side", "name", "shoeSize"].forEach((id) =>
  $(id).addEventListener("input", scheduleUpdate)
);

function readParams() {
  return {
    name: $("name").value.trim(),
    side: $("side").value,
    shoeSize: $("shoeSize").value,
    length: Number($("length").value),
    width: Number($("width").value),
    archType: $("archType").value,
    archHeight: Number($("archHeight").value),
    heelCup: Number($("heelCup").value),
    metPad: Number($("metPad").value),
    baseThickness: Number($("baseThickness").value),
    outline: scannedOutline,
  };
}

// ---------------------------------------------------------------------------
//  3D-preview (Three.js)
// ---------------------------------------------------------------------------
const viewerEl = $("viewer");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1014);

const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
camera.position.set(0, -260, 230);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewerEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 6);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(120, -150, 220);
scene.add(key);
const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
fill.position.set(-150, 120, 80);
scene.add(fill);

const grid = new THREE.GridHelper(400, 20, 0x2d3744, 0x1c2530);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const material = new THREE.MeshStandardMaterial({
  color: 0x36c2a0,
  roughness: 0.55,
  metalness: 0.05,
  side: THREE.DoubleSide,
});
let mesh = null;

function rebuildMesh() {
  const params = readParams();
  if (!Number.isFinite(params.length) || !Number.isFinite(params.width)) return;
  const mirror = params.side === "right";
  const geom = buildInsoleGeometry(params, mirror);
  if (mesh) {
    mesh.geometry.dispose();
    mesh.geometry = geom;
  } else {
    mesh = new THREE.Mesh(geom, material);
    scene.add(mesh);
  }
}

let updateRaf = null;
function scheduleUpdate() {
  if (updateRaf) return;
  updateRaf = requestAnimationFrame(() => {
    updateRaf = null;
    rebuildMesh();
  });
}

function resize() {
  const w = viewerEl.clientWidth;
  const h = viewerEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

resize();
rebuildMesh();
animate();

// ---------------------------------------------------------------------------
//  Eksport: STL
// ---------------------------------------------------------------------------
function exportStlBlob() {
  const exporter = new STLExporter();
  const result = exporter.parse(mesh, { binary: true });
  // Binær eksport kan være DataView eller ArrayBuffer afhængigt af version.
  const buf = result.buffer ? result.buffer : result;
  return new Blob([buf], { type: "model/stl" });
}

function fileBaseName() {
  const p = readParams();
  const safe = (p.name || "saal").replace(/[^a-z0-9æøå]+/gi, "_");
  return `${safe}_${p.side === "left" ? "venstre" : "hojre"}`;
}

$("downloadBtn").addEventListener("click", () => {
  const blob = exportStlBlob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fileBaseName()}.stl`;
  a.click();
  URL.revokeObjectURL(a.href);
  setResult("STL downloadet.", "ok");
});

// ---------------------------------------------------------------------------
//  Send til server (mail)
// ---------------------------------------------------------------------------
$("sendBtn").addEventListener("click", async () => {
  const btn = $("sendBtn");
  btn.disabled = true;
  setResult("Genererer og sender…", "busy");

  // På gratis hosting kan serveren "sove" – vis en venlig besked hvis det
  // trækker ud, så ventetiden ikke ligner en fejl.
  const wakeTimer = setTimeout(
    () => setResult("Serveren vågner op – det kan tage op til ~30 sek. første gang. Vent venligst…", "busy"),
    4000
  );

  try {
    const stlBlob = exportStlBlob();
    const params = readParams();
    const fd = new FormData();
    fd.append("stl", stlBlob, `${fileBaseName()}.stl`);
    fd.append("measurements", JSON.stringify(params));
    if (recordedBlob) {
      const ext = (recordedBlob.type.split("/")[1] || "webm").split(";")[0];
      fd.append("video", recordedBlob, `fod-video.${ext}`);
    }
    scanPhotos.forEach((blob, i) => {
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
      fd.append("photos", blob, `scan-${i + 1}.${ext}`);
    });

    const res = await fetch("/api/order", { method: "POST", body: fd });
    clearTimeout(wakeTimer);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Serverfejl");

    if (data.emailed) {
      setResult("✅ " + data.message, "ok");
    } else {
      setResult("⚠️ " + data.message, "busy");
    }
  } catch (err) {
    setResult("❌ Kunne ikke sende: " + err.message + " — prøv 'Download STL' i stedet.", "err");
  } finally {
    clearTimeout(wakeTimer);
    btn.disabled = false;
  }
});

function setResult(msg, cls) {
  const el = $("result");
  el.textContent = msg;
  el.className = "result " + (cls || "");
}

if (!recordedBlob) setVideoStatus("Ingen video endnu (valgfrit, men anbefales).");

// ---------------------------------------------------------------------------
//  Automatisk scanning (FootScan)
// ---------------------------------------------------------------------------
initScan(document.getElementById("scanRoot"), {
  getSide: () => $("side").value,
  onResult: (m, outline, photos) => {
    if (m.length) {
      $("length").value = Math.round(m.length);
    }
    if (m.width) {
      $("width").value = Math.round(m.width);
    }
    if (m.archType) {
      $("archType").value = m.archType;
    }
    if (m.archHeight != null) {
      $("archHeight").value = m.archHeight;
      $("archHeightVal").textContent = m.archHeight;
    }
    scannedOutline = outline || null;
    scanPhotos = photos || [];
    $("scanNote").hidden = false;
    scheduleUpdate();
    document.getElementById("viewer").scrollIntoView({ behavior: "smooth", block: "center" });
  },
});
