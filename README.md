# 🦶 TPU Indlægssål-generator

En lille web-app der hjælper med at lave **3D-printbare indlægssåler i TPU** —
fx til platfod (flade fødder). Brugeren optager en video af foden, indtaster
nogle mål, ser en 3D-forhåndsvisning, og får en **STL-fil** sendt til mail
(eller downloader den direkte) klar til at blive printet i fleksibelt TPU.

## Sådan virker det

1. **Video** (valgfrit) – en kort video af foden der sendes med som reference.
2. **Scan automatisk (FootScan)** – tag et foto lige ovenfra af foden med et
   **referencekort** (fx sygesikringskort) ved siden af. Appen bruger computer
   vision (OpenCV.js) til at:
   - finde referencekortet og dermed den rigtige **målestok** (mm pr. pixel),
   - segmentere foden og udtrække dens **rigtige omrids**,
   - måle **længde og bredde** automatisk,
   - (valgfrit) analysere et **fodaftryk** og beregne svangindekset
     (Chippaux-Smirak) → klassificere flad/normal/høj svang.
3. **Mål** – felterne udfyldes automatisk fra scanningen (kan altid rettes):
   fodlængde, fodbredde, svangtype, svangstøtte, hælkop osv.
4. **Generér** – der bygges en ortopædisk sål formet efter fodens **faktiske
   omrids**, med medial svangstøtte, dyb hælkop og mellemfodsstøtte. Geometrien
   er lukket (watertight), så STL'en kan slices direkte.
5. **Send/Download** – STL'en (+ video + scan-fotos) sendes til din mail, eller
   hentes lokalt.

> **Ærlig forventningsafstemning:** Dette er ikke en fuld fotogrammetrisk 3D-
> rekonstruktion (det kræver LiDAR eller en tung GPU-server). I stedet *måles*
> foden automatisk fra billeder med et referenceobjekt for skala — i praksis
> samme tilgang som de fleste "scan din fod"-apps. Resultatet vises som overlay
> på fotoet, så du kan tjekke det, og alle mål kan finjusteres manuelt bagefter.

### Tips til et godt scan-foto

- Skyd **lige ovenfra**, så lidt forvrængning som muligt.
- Læg referencekortet **fladt** i samme plan som foden (på gulvet/papiret).
- God, jævn belysning og **kontrast** mellem fod og underlag (fx bar fod eller
  mørk sok på lyst gulv/papir).
- **Tæerne opad** i billedet, foden nogenlunde centreret.
- Hvis kortet ikke findes automatisk, kan du **tappe dets 4 hjørner** i appen.

## Kom i gang

```bash
npm install
cp .env.example .env      # ret derefter værdierne i .env
npm start
```

Åbn derefter **http://localhost:3000**.

### Brug på telefon (anbefales til kamera)

Kør serveren på din computer og åbn `http://<computerens-ip>:3000` på
telefonen (samme netværk). Bemærk: browserens kamera kræver ofte **HTTPS**
eller `localhost`. Den nemmeste vej er at hoste appen et sted med HTTPS,
eller bruge en tunnel (fx `ngrok http 3000`) når du tester på telefon.
Man kan altid bruge "upload en video" i stedet for live-optagelse.

## Mail-opsætning (så STL'en sendes automatisk)

Mail sendes via SMTP. Nemmest med en Gmail-konto + et **App Password**:

1. Slå 2-trinsbekræftelse til på Google-kontoen.
2. Lav et app-password på https://myaccount.google.com/apppasswords
3. Udfyld `.env`:

```env
ORDER_EMAIL_TO=rahin1992@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=din-gmail@gmail.com
SMTP_PASS=dit-app-password
```

Er SMTP ikke sat op, gemmes hver ordre i stedet lokalt i mappen `orders/`
(STL + video + mål), og appen siger det tydeligt. **"Download STL"-knappen
virker altid**, uanset mail-opsætning.

## Printtips (TPU)

- Materiale: TPU (shore 95A er et godt udgangspunkt; blødere = mere dæmpning).
- Lag: 0,2 mm, 3–4 perimeters, 15–25 % infill (fx gyroid for komfort).
- Print langsomt (20–30 mm/s) og uden retraction-problemer.
- Den flade bund printes nedad; ingen support nødvendig.

## Projektstruktur

```
server.js          Express-server: tager imod ordre, gemmer + mailer
public/
  index.html       UI
  styles.css       styling
  app.js           video, formular, 3D-preview, STL-eksport, upload
  insole.js        parametrisk sål-geometri (THREE.BufferGeometry)
.env.example       skabelon til konfiguration
```
