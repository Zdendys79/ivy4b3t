# Browser Profile Setup - Dokumentace

## Účel
Automatický setup nového browser profilu pro FB automatizaci s českým jazykem a optimálním nastavením.

## Script
`/home/remotes/ivy4b3t/ivy/setup_new_browser_profile.js`

## Použití
```bash
DISPLAY=:20 node setup_new_browser_profile.js [USER_ID]
```

## Co script dělá

### 1. Příprava profilu
- **Profil:** `Profile{USER_ID}` (např. Profile81)
- **Umístění:** `/home/remotes/Chromium/Profile{USER_ID}/`
- **Název profilu:** `[{USER_ID}] Jméno Příjmení` (např. [81] Zdeněk Němec)
- **SingletonLock:** Automaticky odstraněn před spuštěním

### 2. Browser argumenty
```javascript
args: [
  '--suppress-message-center-popups',  // Potlačí popup zprávy
  '--disable-notifications',           // Zakáže notifikace
  '--start-maximized',                 // Maximalizované okno
  '--no-sandbox',                      // Bez sandbox (nutné pro headless)
  '--disable-web-security',            // Vypne web security
  '--disable-features=TranslateUI',    // Zakáže translate UI
  '--lang=cs-CZ',                      // Český jazyk
  '--accept-lang=cs-CZ,cs,en-US,en',   // Jazykové preference
  '--user-data-dir=/home/remotes/Chromium',
  '--profile-directory=Profile{USER_ID}',
  '--display=:20'                      // Chrome Remote Desktop
]
```

### 3. Startup popup handling
- **"Restore pages?" dialog:** Automaticky zrušen kliknutím na Cancel/Zrušit
- **Timeout:** 2 sekundy čekání na dialog
- **Fallback:** Pokud selže, pokračuje bez chyby

### 4. Nastavení jazyka
- **URL:** `chrome://settings/languages`
- **Akce:** Nastavení češtiny jako hlavního jazyka
- **Screenshot:** `/tmp/setup_languages_{USER_ID}.png`

### 5. Vypnutí automatického překladu
- **Cíl:** Najít a vypnout toggle pro automatický překlad
- **Metoda:** Puppeteer `page.evaluate()` hledá toggle s textem "translate" nebo "překlad"
- **Výsledek:** Překlad vypnut pro konzistentní FB automatizaci

### 6. Přejmenování profilu
- **URL:** `chrome://settings/manageProfile`
- **Formát:** `[{USER_ID}] Jméno Příjmení`
- **Metoda:** Najde input[type="text"] a změní hodnotu
- **Screenshot:** `/tmp/setup_profile_{USER_ID}.png`

### 7. Optimalizace pro automatizaci
#### Notifikace
- **URL:** `chrome://settings/content/notifications`
- **Akce:** Vypnutí všech notifikací
- **Důvod:** Prevence popup dialogů během automatizace

#### Ostatní nastavení
- **defaultViewport:** `null` (použije plnou velikost okna)
- **headless:** `false` (viditelné okno pro debugging)

### 8. Testování nastavení
- **Test URL:** `https://www.google.com/`
- **Účel:** Ověření funkčnosti a jazykového nastavení
- **Screenshot:** `/tmp/test_google_{USER_ID}.png`

### 9. Generování přihlašovacích údajů
- **E-mail formát:** `{jmeno}.{prijmeni}{cislo}@seznam.cz` (bez diakritiky)
- **Číslo varianty:**
  - **Rok narození:** Poslední 2 číslice roku (2001 → 01)
  - **Den narození:** Den v měsíci (23. září → 23)
  - **Numerologie:** Součet všech číslic data narození (23.9.2001 → 2+3+9+2+0+0+1 = 17)
- **Heslo:** Generováno pomocí `./scripts/enhanced-password-generator.js 12`
- **Délka hesla:** 12 znaků s mixem písmen, čísel a symbolů
- **Příklady:** 
  - `zdenek.nemec01@seznam.cz` (rok)
  - `zdenek.nemec23@seznam.cz` (den)
  - `zdenek.nemec17@seznam.cz` (numerologie)

## Screenshoty vytvářené během setupu
1. `/tmp/setup_languages_{USER_ID}.png` - Nastavení jazyků
2. `/tmp/setup_profile_{USER_ID}.png` - Profil management
3. `/tmp/setup_final_{USER_ID}.png` - Finální nastavení
4. `/tmp/test_google_{USER_ID}.png` - Test funkčnosti

## Výstup scriptu
```
🆕 === SETUP PROFILU PRO UŽIVATELE 81 ===
👤 Uživatel: [81] Zdeněk Němec
🔐 Vygenerované heslo: oKI2tuKV*n5mtE4w5mg+ZifsuKDOrX-F7uS%cPgR
🚀 Spouštím browser pro první setup...
🚫 === ZVLÁDÁNÍ STARTUP POPUPŮ ===
⚙️ === NASTAVENÍ JAZYKA ===
🚫 === VYPNUTÍ AUTOMATICKÉHO PŘEKLADU ===
👤 === PŘEJMENOVÁNÍ PROFILU ===
🔧 === OPTIMALIZACE PRO AUTOMATIZACI ===
🧪 === TEST NASTAVENÍ ===
💾 E-mail varianty:
   Rok narození: zdenek.nemec01@seznam.cz (01)
   Den narození: zdenek.nemec23@seznam.cz (23)
   Numerologie:  zdenek.nemec17@seznam.cz (17)
💌 Primární e-mail: zdenek.nemec01@seznam.cz
🔐 Heslo: [generované heslo]

🎉 === SETUP DOKONČEN ===
👤 Profil: [81] Zdeněk Němec
🇨🇿 Jazyk: Čeština nastavena
🚫 Překlad: Automatický překlad vypnut
🔕 Notifikace: Zakázány
⚙️ Browser je připraven pro automatizaci
```

## Dependencies
- `puppeteer` - Browser ovládání
- `./iv_sql.js` - Databázový přístup
- `./libs/iv_wait.class.js` - Wait utility
- `./scripts/enhanced-password-generator.js` - Generátor hesel

## Použití po setupu
Po dokončení setupu je profil připraven pro:
1. Facebook automatizaci
2. E-mail registraci na Seznam.cz
3. Další webové automatizace

Browser zůstává otevřený pro ruční dokončení registračních procesů.

## Troubleshooting
- **"Restore pages?" stále viditelný:** Popup může vyžadovat ruční zavření
- **Jazykové nastavení neplatí:** Chrome může vyžadovat restart pro plné uplatnění
- **Profil název se nezmění:** Management stránka může mít jiné selektory
- **Password generátor chyba:** Zkontroluj existenci `./scripts/enhanced-password-generator.js`