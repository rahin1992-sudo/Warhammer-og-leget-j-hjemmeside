import "dotenv/config";
import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Filer i hukommelsen (op til 80 MB pr. fil - rigeligt til en kort video).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, "public")));

// Bygger en SMTP-transport hvis konfigurationen findes.
function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE ?? "true") === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function measurementsToText(m) {
  return [
    `Navn/note:        ${m.name || "(ingen)"}`,
    `Fod:              ${m.side === "left" ? "venstre" : "højre"}`,
    `Sko-størrelse:    EU ${m.shoeSize || "-"}`,
    `Fodlængde:        ${m.length} mm`,
    `Fodbredde:        ${m.width} mm`,
    `Svangtype:        ${m.archType}`,
    `Svangstøtte:      ${m.archHeight} mm`,
    `Hælkop:           ${m.heelCup} mm`,
    `Mellemfodsstøtte: ${m.metPad} mm`,
    `Basistykkelse:    ${m.baseThickness} mm`,
  ].join("\n");
}

// Gemmer ordren lokalt som fallback (eller altid, så du har en kopi).
function saveLocally(stlBuf, videoFile, photoFiles, measurements) {
  const dir = path.join(__dirname, "orders");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(dir, `saal_${stamp}`);
  fs.writeFileSync(`${base}.stl`, stlBuf);
  fs.writeFileSync(`${base}.txt`, measurementsToText(measurements));
  if (videoFile) {
    const ext = (videoFile.mimetype.split("/")[1] || "webm").replace(/[^a-z0-9]/gi, "");
    fs.writeFileSync(`${base}.${ext}`, videoFile.buffer);
  }
  photoFiles.forEach((p, i) => {
    const ext = (p.mimetype.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
    fs.writeFileSync(`${base}_scan${i + 1}.${ext}`, p.buffer);
  });
  return base;
}

app.post(
  "/api/order",
  upload.fields([
    { name: "stl", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "photos", maxCount: 4 },
  ]),
  async (req, res) => {
    try {
      const stlFile = req.files?.stl?.[0];
      const videoFile = req.files?.video?.[0];
      const photoFiles = req.files?.photos || [];
      if (!stlFile) return res.status(400).json({ ok: false, error: "Mangler STL-fil." });

      let measurements = {};
      try {
        measurements = JSON.parse(req.body.measurements || "{}");
      } catch {
        measurements = {};
      }

      const savedBase = saveLocally(stlFile.buffer, videoFile, photoFiles, measurements);

      const to = process.env.ORDER_EMAIL_TO || "rahin1992@gmail.com";
      const from = process.env.ORDER_EMAIL_FROM || "indlaegssaal-app@example.com";
      const transport = buildTransport();

      if (!transport) {
        return res.json({
          ok: true,
          emailed: false,
          message:
            "Ordren er gemt lokalt på serveren, men der er ikke sat SMTP op, så der blev ikke sendt en mail. Se README for at slå mail til.",
          savedTo: path.basename(savedBase),
        });
      }

      const attachments = [
        {
          filename: "indlaegssaal.stl",
          content: stlFile.buffer,
          contentType: "model/stl",
        },
      ];
      if (videoFile) {
        const ext = (videoFile.mimetype.split("/")[1] || "webm").replace(/[^a-z0-9]/gi, "");
        attachments.push({
          filename: `fod-video.${ext}`,
          content: videoFile.buffer,
          contentType: videoFile.mimetype || "video/webm",
        });
      }
      photoFiles.forEach((p, i) => {
        const ext = (p.mimetype.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
        attachments.push({
          filename: `scan-${i + 1}.${ext}`,
          content: p.buffer,
          contentType: p.mimetype || "image/jpeg",
        });
      });

      await transport.sendMail({
        from,
        to,
        subject: `Ny TPU-indlægssål – ${measurements.name || "uden navn"} (${measurements.side === "left" ? "venstre" : "højre"} fod)`,
        text:
          "Der er genereret en ny indlægssål klar til 3D-print i TPU.\n\n" +
          "Mål brugt til generering:\n" +
          measurementsToText(measurements) +
          "\n\nSTL-filen og videoen af foden er vedhæftet.\n",
        attachments,
      });

      res.json({ ok: true, emailed: true, message: `Sålen er sendt til ${to}.` });
    } catch (err) {
      console.error("Fejl i /api/order:", err);
      res.status(500).json({ ok: false, error: err.message || "Ukendt serverfejl." });
    }
  }
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, smtp: Boolean(buildTransport()) });
});

app.listen(PORT, () => {
  console.log(`\n  TPU-indlægssål-generator kører på  http://localhost:${PORT}`);
  console.log(`  Mail-afsendelse: ${buildTransport() ? "aktiveret" : "IKKE konfigureret (se README)"}\n`);
});
