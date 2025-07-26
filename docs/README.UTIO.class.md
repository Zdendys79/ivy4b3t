# UtioBot README

## 📂 Umístění

`~/ivy/iv_utio.class.js`

## 🌟 Účel

Třída `UtioBot` zajišťuje **automatickou interakci s UTIO systémem** pomocí Puppeteer.
Ovládá přihlášení, získávání zpráv a správu UTIO záložky.
Je navržena podle vzoru FBBot pro **konzistentní architekturu**:
➡️ `UtioBot` = interakce s UTIO systémem
➡️ Čistá separace logiky bez přímých volání DB/API

## 🏗️ Základní použití

```javascript
import { UtioBot } from './iv_utio.class.js';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const context = await browser.createIncognitoBrowserContext();
  const utioBot = new UtioBot(context);

  await utioBot.init();
  const user = {
    id: 64,
    u_login: 'uzivatel@example.com',
    u_pass: 'heslo123',
    portal_id: 1
  };

  await utioBot.openUtio(user);
  const message = await utioBot.getMessage(1, 5, 0); // portál=1, region=5, okres=náhodný
  console.log('Získaná zpráva:', message);

  await utioBot.logout();
  await utioBot.close();
  await browser.close();
})();
```

## 🔑 Hlavní metody

| Metoda                            | Popis                                         |
| --------------------------------- | --------------------------------------------- |
| `init()`                          | Inicializuje UTIO stránku                    |
| `openUtio(user)`                  | Přihlásí uživatele do UTIO                   |
| `getMessage(portalId, regionId, districtId)` | Získá zprávu podle parametrů |
| `logout()`                        | Odhlásí uživatele z UTIO                     |
| `isReady()`                       | Zkontroluje dostupnost UTIO                  |
| `close()`                         | Zavře záložku a vyčistí zdroje               |
| `bringToFront()`                  | Přivede záložku do popředí                   |
| `screenshot(name)`                | Uloží screenshot pro debugging               |

## 🔧 Interní helpery (private metody)

| Metoda                           | Popis                                    |
| -------------------------------- | ---------------------------------------- |
| `_isPageReady()`                 | Kontrola dostupnosti stránky            |
| `_checkIfLoggedIn()`             | Kontrola stavu přihlášení                |
| `_performLogin(login, password)` | Provádí přihlášení                       |
| `_navigateToMessageGenerator()`  | Navigace na stránku generátoru zpráv     |
| `_fillMessageForm(portalId, regionId, districtId)` | Vyplní formulář |
| `_generateMessage()`             | Spustí generování zprávy                 |
| `_extractMessage()`              | Extrahuje obsah zprávy z DOM             |
| `_getRandomRegion()`             | Generuje náhodný region                  |
| `_getRandomDistrict(region)`     | Generuje náhodný okres pro region        |

## 🔄 Zpětná kompatibilita

Pro zachování kompatibility se starým kódem jsou exportované helper funkce:

```javascript
// Funkční exports pro starý kód
export { getRandomRegion, getRandomDistrict };

// Deprecated funkce (budou odebrány v budoucích verzích)
export { newUtioTab, openUtio, getMessage, isUtioReady, closeUtio, bringToFront };
```

## 📊 Příklad integrace s FBBot

```javascript
import { UtioBot } from './iv_utio.class.js';
import { FBBot } from './iv_fb.class.js';

async function postUtioMessage(user, group, context) {
  // Inicializace obou botů
  const utioBot = new UtioBot(context);
  const fbBot = new FBBot(context);

  await utioBot.init();
  await fbBot.init();

  // Přihlášení
  await utioBot.openUtio(user);
  await fbBot.openFB(user);

  // Získání zprávy z UTIO
  const message = await utioBot.getMessage(
    user.portal_id,
    group.region_id,
    group.district_id
  );

  if (message) {
    // Publikování na FB
    await fbBot.openGroup(group);
    await fbBot.newThing();
    await fbBot.clickNewThing();
    await fbBot.pasteStatement(message[0]);
    await fbBot.clickSendButton();

    console.log('Zpráva úspěšně publikována!');
  }

  // Cleanup
  await utioBot.close();
}
```

## 🚦 Stavy třídy

| Stav                | Popis                                    | isReady() |
| ------------------- | ---------------------------------------- | --------- |
| **Neinicializováno** | Třída vytvořena, init() ještě nevolán   | false     |
| **Inicializováno**   | init() úspěšný, stránka načtena         | false     |
| **Přihlášeno**       | openUtio() úspěšný, uživatel přihlášen  | true      |
| **Odhlášeno**        | logout() volán nebo chyba přihlášení    | false     |
| **Zavřeno**          | close() volán, zdroje uvolněny          | false     |

## 🛡️ Error Handling

```javascript
const utioBot = new UtioBot(context);

try {
  if (!await utioBot.init()) {
    throw new Error('Inicializace UTIO selhala');
  }

  if (!await utioBot.openUtio(user)) {
    throw new Error('Přihlášení do UTIO selhalo');
  }

  const message = await utioBot.getMessage(1, 0, 0);
  if (!message) {
    throw new Error('Nepodařilo se získat zprávu');
  }

  console.log('Úspěch!', message);

} catch (err) {
  console.error('Chyba při práci s UTIO:', err);
  await utioBot.screenshot('error_state');
} finally {
  await utioBot.close();
}
```

## 🎯 Výhody nové architektury

✅ **Konzistentní API** - Stejný vzor jako FBBot
✅ **Lepší error handling** - Robustní kontroly stavu
✅ **Enkapsulace** - Všechna logika v jedné třídě
✅ **Testovatelnost** - Snadné unit testy
✅ **Zpětná kompatibilita** - Starý kód funguje
✅ **Čisté zdroje** - Automatické cleanup

## 🔄 Migrace ze starého kódu

### Před (starý způsob):
```javascript
import * as utio from './iv_utio.js';

await utio.newUtioTab(context);
await utio.openUtio(login, pass);
const message = await utio.getMessage(portal, region, district);
await utio.closeUtio();
```

### Po (nový způsob):
```javascript
import { UtioBot } from './iv_utio.class.js';

const utioBot = new UtioBot(context);
await utioBot.init();
await utioBot.openUtio({ u_login: login, u_pass: pass });
const message = await utioBot.getMessage(portal, region, district);
await utioBot.close();
```

## 🛠️ Poznámky pro vývojáře

- Třída automaticky spravuje lifecycle UTIO záložky
- Všechny timeouty a čekací doby jsou optimalizované pro stabilitu
- Podpora pro náhodné regiony/okresy (0 = náhodný výběr)
- Robustní detekce stavu přihlášení a chybových stavů
- Screenshot funkce pro debugging problematických stavů
