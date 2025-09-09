# Seznam.cz Registrace - Postup pro ID 81

## Uživatel
- **ID:** 81
- **Jméno:** Zdeněk Němec  
- **Pohlaví:** M
- **Datum narození:** 23.9.2001
- **Profil:** Profile81

## E-mailové údaje
- **E-mail varianty:**
  - `zdenek.nemec01@seznam.cz` (rok 2001 → 01)
  - `zdenek.nemec23@seznam.cz` (den 23)  
  - `zdenek.nemec17@seznam.cz` (numerologie)
- **Heslo:** mVI9KJxL2#eI (12 znaků)

## Krok 1: Hlavní stránka registrace ✅
- **URL:** https://registrace.seznam.cz/
- **Stav:** Načteno úspěšně
- **Screenshot:** /tmp/seznam_registration_81.png

### Dostupné možnosti:
1. **"Vytvořit adresu @seznam.cz"** 👈 **KLIKNOUT TOTO** (česky!)
2. "Použít můj stávající e-mail"
3. "Použít telefonní číslo"

### Puppeteer příkaz pro klik: ✅ OVĚŘENO!
```javascript
// FUNGUJÍCÍ SELEKTOR: button.official
await page.click('button.official');
```

## Krok 2: Úspěšné otevření formuláře ✅
**STAV:** Klik na `button.official` úspěšně otevřel registrační formulář

**NALEZENÝ FORMULÁŘ:**
- Email address (text input)
- Password (password input)  
- Continue tlačítko (červené)

**PUPPETEER KROKY PRO VYPLNĚNÍ:**
```javascript
// 1. Klik na registrační tlačítko
await page.click('button.official');
await page.waitForSelector('input[placeholder*="Email"]', { timeout: 5000 });

// 2. Vyplnění e-mailu
await page.type('input[placeholder*="Email"]', 'zdenek.nemec01');

// 3. Vyplnění hesla  
await page.type('input[type="password"]', password);

// 4. Klik na Continue
await page.click('button[type="submit"]'); // nebo text=Continue
```

## Puppeteer příkazy k dokončení:
```javascript
// 1. Klik na Create @seznam.cz address
await page.click('element_obsahující_Create_seznam_address');

// 2. Čekání na formulář
await page.waitForSelector('input[name="firstName"]', { timeout: 5000 });

// 3. Vyplnění formuláře
await page.type('input[name="firstName"]', 'Zdeněk');
await page.type('input[name="lastName"]', 'Němec');
// ... další kroky
```

## Status
- ✅ Browser spuštěn s Profile81
- ✅ Stránka načtena
- ✅ Screenshot pořízen
- ⏳ Čeká na klik na registrační možnost