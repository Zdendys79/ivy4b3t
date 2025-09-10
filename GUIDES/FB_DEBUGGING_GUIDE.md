# Facebook Debugging & Registration Guide

**Autor:** Nyara  
**Datum:** 2025-08-20  
**Účel:** Kompletní dokumentace postupů pro FB debugging, registraci a DOM analýzu

---

## 📋 OBSAH
- [Základní setup](#základní-setup)
- [Databázové operace](#databázové-operace)  
- [Browser & Puppeteer](#browser--puppeteer)
- [Facebook analýza](#facebook-analýza)
- [Registrační proces](#registrační-proces)
- [Troubleshooting](#troubleshooting)
- [Zjištěné poznatky](#zjištěné-poznatky)

---

## 🔧 ZÁKLADNÍ SETUP

### Volné User ID
```sql
-- Najít nejvyšší volné ID pod 999
SELECT n.num as missing_id
FROM (
  SELECT 997 as num UNION SELECT 996 UNION SELECT 995 -- pokračovat dolů
) n
LEFT JOIN fb_users u ON n.num = u.id
WHERE u.id IS NULL
ORDER BY n.num DESC
LIMIT 1;
```
**Výsledek:** ID 997 je nejvyšší volné pod 999

### Vytvoření debug uživatele
```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "
INSERT INTO fb_users (
  id, name, surname, day_limit, next_worktime, next_statement,
  e_mail, fb_login, u_login, host, day_count
) VALUES (
  997, 'Debug', 'User', 0, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW(),
  'debug997@example.com', '', '', 'd4689-6369', 0
)"
```

---

## 💾 DATABÁZOVÉ OPERACE

### Kritické poznatky
- **MCP MySQL je READ-ONLY** - pro INSERT/UPDATE/DELETE použít bash+mysql
- **UI Commands systém** má chybějící funkce (`db.getUICommands`, `db.insertUICommand`)
- **Přímé SQL přes bash** je spolehlivější než komplex MCP funkce

### Struktura fb_users tabulky
```sql
-- Hlavní pole pro debug uživatele
id (smallint) PRIMARY KEY
name, surname (tinytext) NOT NULL
e_mail (tinytext) NOT NULL  -- pozor: e_mail, ne email!
fb_login (tinytext) NOT NULL
day_limit (smallint) DEFAULT 10
next_worktime (datetime)
host (varchar(15))
day_count (int) DEFAULT 0
```

### Ověřování uživatele
```sql
SELECT id, name, surname, host FROM fb_users WHERE id = 997;
```

---

## 🌐 BROWSER & PUPPETEER

### Správné spuštění
```bash
# VŽDY ze správné složky
cd /home/remotes/ivy4b3t/ivy

# S grafickým výstupem na Chrome Remote Desktop
DISPLAY=:20 node script.js
```

### Browser konfigurace
```javascript
const browserConfig = {
  headless: false,
  defaultViewport: null,
  args: [
    '--suppress-message-center-popups',
    '--disable-notifications',
    '--disable-infobars',
    '--start-maximized',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--user-data-dir=/home/remotes/Chromium`,
    `--profile-directory=Profile997`  // ⚠️ KRITICKÉ: Profile číslo MUSÍ odpovídat user ID v fb_users!
  ]
};
```

### ⚠️ KRITICKÉ PRAVIDLO - Profile ID = User ID
**Browser profil MUSÍ mít stejné ID jako uživatel v databázi!**
- User ID 997 v `fb_users` → `--profile-directory=Profile997`
- User ID 25 v `fb_users` → `--profile-directory=Profile25`
- **NIKDY nemíchat profily mezi uživateli!**

### FBBot inicializace
```javascript
const fbBot = new FBBot(context, 997, false);
if (!await fbBot.init()) {
  throw new Error('Inicializace FBBot selhala');
}
const page = fbBot.page; // Přístup k Puppeteer page
```

---

## 📊 FACEBOOK ANALÝZA

### Úspěšná navigace
- **URL:** `https://www.facebook.com/`
- **Titul:** "Facebook - log in or sign up"
- **Načtení:** `networkidle2` + 3s wait
- **Screenshot:** `/tmp/fb_main_page.png`

### Registrační elementy - OVĚŘENO
```javascript
// ✅ FUNKČNÍ SELEKTORY
'[data-testid="open-registration-form-button"]' // 1 prvek - hlavní tlačítko
'a[role="button"]'                              // 4 prvky celkem

// ❌ NEFUNKČNÍ SELEKTORY  
'a:contains("Create account")' // SyntaxError - nevalidní CSS selektor
'button:contains("Create")'    // SyntaxError - :contains() není CSS standard
```

### Text analýza nalezla:
1. **"Create new account"** - hlavní registrační tlačítko
2. "Create a Page" - business účty
3. "Sign Up" - alternativní link  
4. "Create ad", "Create Page" - ostatní funkce

---

## 🔐 REGISTRAČNÍ PROCES

### Krok 1: Navigace na FB
```javascript
await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
await Wait.toSeconds(3, 'Načtení hlavní stránky');
```

### Krok 2: Hledání registračního tlačítka
```javascript
// Správný selektor - OVĚŘENO
const selector = '[data-testid="open-registration-form-button"]';
const element = await page.$(selector);

// Ověření viditelnosti
const isVisible = await element.isIntersectingViewport();
```

### Krok 3: Klik na registrační tlačítko
```javascript
// ✅ ÚSPĚŠNÉ - klik proběhl
await element.click();
await Wait.toSeconds(3, 'Čekání na načtení formuláře');

// Screenshot pro kontrolu
await page.screenshot({ path: '/tmp/fb_after_click.png' });
```

### Krok 4: Hledání formuláře (POTŘEBA DALŠÍHO TESTOVÁNÍ)
```javascript
// Selektory pro registrační formulář
const formSelectors = [
  'input[name="firstname"]',
  'input[name="lastname"]', 
  'input[name="reg_email__"]',
  'input[name="reg_passwd__"]',
  '[data-testid="reg_first_name"]',
  '[data-testid="reg_last_name"]'
];
```

---

## 🐛 TROUBLESHOOTING

### Časté chyby a řešení

#### 1. Module not found
```bash
# CHYBA: node interactive_fb_debug.js
# ❌ Error: Cannot find module '/home/remotes/ivy4b3t/interactive_fb_debug.js'

# ✅ ŘEŠENÍ: Vždy cd do správné složky
cd /home/remotes/ivy4b3t/ivy && node script.js
```

#### 2. Database funkce neexistuje
```bash  
# CHYBA: db.createUser is not a function
# ✅ ŘEŠENÍ: Použít přímé SQL přes bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "INSERT..."
```

#### 3. UI Commands nefungují
```bash
# CHYBA: db.getUICommands is not a function
# ✅ ŘEŠENÍ: Použít přímý puppeteer script místo složitého UI systému
```

#### 4. CSS selektor chyby
```javascript
// CHYBA: 'a:contains("text")' is not a valid selector
// ✅ ŘEŠENÍ: Použít page.evaluate() s DOM prohledáváním
await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a'))
    .filter(el => el.textContent.includes('text'));
});
```

---

## 📝 ZJIŠTĚNÉ POZNATKY

### Facebook DOM struktura
- **Moderní data-testid selektory** fungují nejlépe
- **Klasické CSS selektory** často nefungují kvůli dynamickému obsahu
- **JavaScript heavy** - 300+ scriptů, nutnost čekat na networkidle2
- **Responsive layout** - elementy se mění podle viewportu

### Browser profily
- **Profile997** - čistý profil pro debugging (User ID 997)
- **ProfileXXX** - číslo profilu MUSÍ odpovídat ID uživatele v databázi!
- **SingletonLock cleanup** nutný před každým spuštěním
- **Chrome Remote Desktop** na DISPLAY=:20
- **⚠️ KRITICKÉ:** Profile ID = User ID (např. User 25 → Profile25)

### Databázové požadavky
- **Hostname musí souhlasit** s db záznamem
- **day_limit: 0** pro debug uživatele (nevykonává akce)
- **next_worktime** nastavit na zítra (vyřazení z automatiky)

---

## 🎯 DALŠÍ KROKY

### Pro pokračování registrace:
1. **Ruční kontrola** browseru po kliku na "Create new account"
2. **Analýza modal/overlay** - formulář se možná otevřel v popup
3. **Delší wait time** - možná potřeba víc než 3 sekundy
4. **DOM mutation observer** pro detekci změn

### Rozšíření debugging systému:
1. **Screenshot srovnání** před/po akcích
2. **Network monitoring** pro AJAX requesty
3. **Console log capture** pro JS chyby
4. **Více wait strategií** (element visible, network idle, custom conditions)

---

## 📚 REFERENCE

### Testovací scripty:
- `test_fb_registration.js` - hlavní analýza registrace
- `test_stories_debug.js` - Stories DOM analýza  
- `interactive_fb_debug.js` - komplex UI command systém (WIP)

### Databáze:
- Tabulka: `fb_users` - hlavní uživatelé
- Tabulka: `ui_commands` - komunikační systém
- Host: `d4689-6369` - aktuální hostname

### Soubory:
- `/tmp/fb_main_page.png` - screenshot hlavní stránky
- `/tmp/fb_after_click.png` - screenshot po kliku na registraci
- `/home/remotes/Chromium/Profile997/` - browser profil

---

---

## 🚨 AKTUÁLNÍ PROBLÉM - Klik na registraci

### ✅ VYŘEŠENO - Zjištění ze session 2025-08-20 16:27:
- ✅ Tlačítko "Create new account" nalezeno a kliknut
- 🍪 **HLAVNÍ PROBLÉM**: **COOKIES MODAL v popředí!**
- 🎯 **Facebook se ptá na povolení cookies** - blokuje vše ostatní
- ✅ **ŘEŠENÍ**: Vybrat "Decline optional cookies"

### 🍪 COOKIES HANDLING - KRITICKÝ KROK

**Facebook cookies modal selektory (pro budoucí automatizaci):**
```javascript
// Hledání cookies modal
'[data-testid="cookie-policy-banner"]'
'[data-testid="cookie-policy-dialog"]'  
'[role="dialog"][aria-label*="cookie"]'

// Tlačítka pro cookies
'button:contains("Decline optional cookies")'  // ✅ PREFEROVANÉ
'button:contains("Allow essential and optional cookies")'
'[data-testid="cookie-policy-banner-accept"]'
'[data-testid="cookie-policy-banner-decline"]'
```

**Postup:**
1. **Najít cookies modal** - hned po načtení stránky
2. **Kliknout "Decline optional cookies"** - zachová soukromí  
3. **Teprve pak pokračovat** s registračním tlačítkem

---

---

## 📈 SOUHRN POKROKU

### ✅ DOKONČENO:
1. **Databáze setup** - User ID 997 vytvořen a funkční
2. **Browser spuštění** - Puppeteer + FBBot + DISPLAY=:20 
3. **FB navigace** - Úspěšné načtení facebook.com
4. **Registrační tlačítko** - Nalezeno a identifikováno `[data-testid="open-registration-form-button"]`
5. **Cookies modal detekce** - Klíčové zjištění blokující akce

### 🎯 DALŠÍ KROKY:
1. **Cookies handling** - Automaticky kliknout "Decline optional cookies"
2. **Registrační formulář** - Otevřít po vyřešení cookies
3. **Form analysis** - Analyzovat input pole (jméno, email, heslo atd.)
4. **CAPTCHA strategie** - Připravit ruční řešení s pomocí uživatele

### 🔧 POUŽITELNÉ NÁSTROJE:
- `test_fb_registration.js` - hlavní analyzační script
- `FB_DEBUGGING_GUIDE.md` - kompletní dokumentace
- User ID 997 - připravený debug účet
- Screenshots: `/tmp/fb_*.png` - vizuální kontrola

---

**📅 Poslední aktualizace:** 2025-08-20 16:28  
**🔄 Status:** Cookies modal identifikován, připraven na další iteraci s cookies handling