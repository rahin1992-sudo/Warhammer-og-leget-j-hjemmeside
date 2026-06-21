# Brugsvejledning – TPU Indlægssål

Sådan laver du en 3D-printet indlægssål fra start til slut.

**Hele forløbet kan foregå på en telefon:** man filmer foden, tager billederne
og uploader det hele i appen – der skal ikke bruges en computer undervejs. Det
eneste, der skal gøres én gang, er at lægge appen online (så telefonen kan åbne
den via et link). Det beskrives i Del 1.

---

## Del 1: Læg appen online (én gang) – så den kan bruges fra telefon

For at telefonens kamera/upload virker, skal appen køre på en adresse med
**HTTPS**. Den nemmeste vej er gratis hosting på **Render.com**.

**Nemmest (ét klik):** Åbn README'en på GitHub og tryk på den blå
**"Deploy to Render"**-knap. Log ind med GitHub, klik dig igennem, og Render
bygger appen automatisk.

Eller manuelt:

1. Sørg for at koden er på GitHub (det er den allerede).
2. Opret en gratis konto på https://render.com.
3. Tryk **New +** → **Blueprint**, og vælg dette repo. Render læser
   `render.yaml` og opretter web-servicen automatisk.
4. Udfyld de hemmelige felter, så mailen kan sendes (se "Mail" nedenfor):
   `SMTP_USER` og `SMTP_PASS`.
5. Når den er deployet, får du en URL som `https://tpu-indlaegssaal.onrender.com`.
   **Åbn den URL på telefonen** (gem den evt. på hjemmeskærmen) – så er I klar.

> Første gang appen åbnes efter en pause kan den være ~30 sek. om at "vågne"
> (gratis-planen). Appen viser selv en besked om det – det er ikke en fejl.

> _Indsæt skærmbillede af appen åbnet på telefonen her._

### Mail (så STL'en sendes til dig automatisk)

1. Brug en Gmail-konto med et **App Password**
   (https://myaccount.google.com/apppasswords – kræver 2-trinsbekræftelse).
2. Sæt disse i Render-dashboardet under servicens **Environment**:
   - `SMTP_USER` = din-gmail@gmail.com
   - `SMTP_PASS` = dit app-password
   - (`ORDER_EMAIL_TO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` er sat på forhånd.)

> Uden mail virker knappen **"Download STL"** stadig, så man kan gemme filen
> manuelt. På hosting er mail dog den rigtige vej, da serverens filer ikke gemmes
> permanent.

### Alternativ: test lokalt på en computer

Vil du bare teste på din egen computer (Node.js 18+):

```bash
git clone https://github.com/rahin1992-sudo/Warhammer-og-leget-j-hjemmeside.git
cd Warhammer-og-leget-j-hjemmeside
npm install
cp .env.example .env   # udfyld mail-felterne
npm start              # åbn http://localhost:3000
```

Vil du teste fra telefonen mod din computer (så kameraet virker), kan du lave en
HTTPS-tunnel: `npx ngrok http 3000` og åbne den viste `https://…`-adresse på
telefonen.

---

## Del 2: Daglig brug (lav en sål) – fra telefonen

Åbn appens link på telefonen. Hele forløbet kan klares her: man **filmer og
fotograferer med telefonen og uploader det i appen**. Når man trykker på en
upload-knap, åbner telefonen automatisk kameraet (eller billedrullen), så man
kan optage/tage billedet og sende det med det samme.

> På et hostet link (HTTPS) virker også "📷 Kamera"-knapperne, der filmer/tager
> billede direkte inde i appen. Begge veje virker – brug den, der er nemmest.

Du laver **én sål ad gangen** – én til venstre fod og én til højre.

### Det du skal bruge
- Et **referencekort** med kendt størrelse (fx sygesikringskort/kreditkort).
- Et **lyst gulv eller et stykke papir** med god kontrast til foden.
- Godt, jævnt lys.

### Trin 1 – Video (valgfrit)
Film foden med telefonen og upload videoen (eller brug "📷 Kamera"). Den bruges
kun som reference og sendes med i mailen.

### Trin 2 – Scan foden automatisk ⭐ (det vigtigste)
1. Vælg **referenceobjekt** øverst (fx sygesikringskort).
2. Læg kortet **fladt ved siden af foden** i samme plan (på gulvet/papiret).
3. Tag et foto **lige ovenfra** med telefonen, med **tæerne opad** og foden
   midt i billedet.
   - Tryk **upload foto** (åbner telefonens kamera), eller **📷 Kamera → Tag
     billede**.
4. Tryk **🔍 Find mål automatisk**.
   - Appen finder kortet (målestok) og tegner fodens **omrids** ovenpå fotoet,
     og udfylder **længde** og **bredde**.
   - Finder den ikke kortet automatisk? Tryk **✋ Tap kortets 4 hjørner** og
     prik de fire hjørner.
5. (Valgfrit, mere præcis svang) Åbn **"Svangmåling fra fodaftryk"**:
   fugt fodsålen let, træd på et papir, fotografér aftrykket med kortet ved
   siden af, upload det og tryk **Analysér svang**.
6. Tryk **✅ Brug disse mål**.

   > _Indsæt skærmbillede af et scannet foto med omrids her._

### Trin 3 – Tjek mål og indstillinger
- Vælg **venstre eller højre fod** (vigtigt!).
- Tjek de auto-udfyldte tal. **Mål gerne efter med et målebånd den første gang**,
  så du ved at scanningen rammer rigtigt i jeres lys/opsætning.
- Finjustér efter behov: svangtype, svangstøtte, hælkop, mellemfodsstøtte,
  basistykkelse.

### Trin 4 – 3D-forhåndsvisning
Drej og zoom på modellen, og se at sålen ser fornuftig ud.

### Trin 5 – Færdiggør
- **✉️ Send til 3D-print** → sender STL + video + fotos til din mail, **eller**
- **⬇️ Download STL** → gemmer filen på telefonen.

Gentag derefter trin 2–5 for den **anden fod**.

---

## Del 3: Print sålen i TPU

1. Åbn STL-filen i en slicer (Cura, PrusaSlicer e.l.).
2. Anbefalede indstillinger:
   - Materiale: **TPU** (shore **95A** er et godt udgangspunkt; blødere = mere
     dæmpning).
   - Laghøjde: **0,2 mm**, 3–4 perimeters.
   - Infill: **15–25 %** (fx gyroid for komfort).
   - Hastighed: **langsomt**, ca. 20–30 mm/s.
   - **Ingen support** – den flade bund printes nedad.

---

## Tips til et godt scan

- Skyd **lige ovenfra** for mindst mulig forvrængning.
- Hold kortet **fladt** i samme plan som foden.
- Brug **bar fod eller mørk sok** på et lyst underlag for god kontrast.
- **Tæerne opad** i billedet.
- Scanning kræver internet i browseren (billedanalysen hentes online).
- Kamera direkte i browseren virker kun over `https`/`localhost`. På telefon er
  det nemmest at **uploade et foto** taget med telefonens kamera-app, eller køre
  appen via en tunnel (fx `ngrok http 3000`).

---

> **Bemærk:** Programmet *måler* foden ud fra billeder med et referenceobjekt –
> det er ikke en fuld 3D-scanning (LiDAR/fotogrammetri). Tjek derfor det viste
> omrids og de målte tal, og ret dem manuelt hvis nødvendigt.
