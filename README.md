# 🦶 TPU Indlægssål-generator

En lille web-app der hjælper med at lave **3D-printbare indlægssåler i TPU** —
fx til platfod (flade fødder). Brugeren optager en video af foden, indtaster
nogle mål, ser en 3D-forhåndsvisning, og får en **STL-fil** sendt til mail
(eller downloader den direkte) klar til at blive printet i fleksibelt TPU.

## Sådan virker det

1. **Video** – appen optager (eller man uploader) en kort video af foden.
   Videoen bruges som *reference* og sendes med i mailen, så foden kan
   vurderes manuelt.
2. **Mål** – fodlængde, fodbredde, svangtype (platfod/lav/neutral/høj),
   svangstøtte, hælkop osv. Sko-størrelse kan auto-udfylde længden.
3. **Generér** – ud fra målene bygges en parametrisk, ortopædisk sål med
   medial svangstøtte, dyb hælkop og mellemfodsstøtte. Geometrien er lukket
   (watertight), så STL'en kan slices direkte.
4. **Send/Download** – STL'en (+ video) sendes til din mail, eller hentes lokalt.

> **Ærlig forventningsafstemning:** Dette er *ikke* en præcis 3D-rekonstruktion
> af foden fra videoen (ægte fotogrammetri kræver tung billedbehandling/ML).
> Sålen genereres ud fra de indtastede mål, og videoen er en visuel reference.
> Det giver i praksis en god, brugbar støttesål – især for platfod.

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
