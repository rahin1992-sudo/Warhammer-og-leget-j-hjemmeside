# Brugsvejledning – TPU Indlægssål

Sådan laver du en 3D-printet indlægssål fra start til slut. Vejledningen er
delt i to: **opsætning** (gøres én gang på en computer) og **daglig brug**
(det du/din kone gør hver gang, I vil lave en sål).

---

## Del 1: Opsætning (én gang)

Du skal bruge en computer med **Node.js 18+** installeret
(hentes på https://nodejs.org).

1. Hent programmet og start det. Åbn en terminal og skriv:

   ```bash
   git clone https://github.com/rahin1992-sudo/Warhammer-og-leget-j-hjemmeside.git
   cd Warhammer-og-leget-j-hjemmeside
   npm install
   npm start
   ```

   > Hvis koden ligger på din feature-branch og ikke `main`, så kør
   > `git checkout claude/foot-video-insole-generator-jtxhjc` før `npm install`.

2. Når der står `kører på http://localhost:3000` i terminalen, så åbn den
   adresse i en browser (Chrome/Edge/Safari). Så er appen klar.

   > _Indsæt evt. skærmbillede af forsiden her._

### (Valgfrit) Slå mail-afsendelse til

Vil du have STL'en sendt automatisk til din mail, skal du sætte SMTP op:

1. Lav en kopi af filen `.env.example`, og kald kopien `.env`.
2. Brug en Gmail-konto med et **App Password**
   (https://myaccount.google.com/apppasswords – kræver 2-trinsbekræftelse).
3. Udfyld i `.env`:

   ```env
   ORDER_EMAIL_TO=rahin1992@gmail.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=din-gmail@gmail.com
   SMTP_PASS=dit-app-password
   ```

4. Stop appen (Ctrl+C) og start den igen med `npm start`.

> Uden mail-opsætning gemmes hver ordre i mappen `orders/`, og knappen
> **"Download STL" virker altid** – så du kan sagtens komme i gang med det samme.

---

## Del 2: Daglig brug (lav en sål)

Du laver **én sål ad gangen** – én til venstre fod og én til højre.

### Det du skal bruge
- Et **referencekort** med kendt størrelse (fx sygesikringskort/kreditkort).
- Et **lyst gulv eller et stykke papir** med god kontrast til foden.
- Godt, jævnt lys.

### Trin 1 – Video (valgfrit)
Optag eller upload en kort video af foden. Den bruges kun som reference og
sendes med i mailen.

### Trin 2 – Scan foden automatisk ⭐ (det vigtigste)
1. Vælg **referenceobjekt** øverst (fx sygesikringskort).
2. Læg kortet **fladt ved siden af foden** i samme plan (på gulvet/papiret).
3. Tag et foto **lige ovenfra**, med **tæerne opad** og foden midt i billedet.
   - Tryk **📷 Kamera → Tag billede**, eller **upload foto**.
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
- **✉️ Send til 3D-print** → sender STL + fotos til mailen, **eller**
- **⬇️ Download STL** → gemmer filen på computeren.

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
