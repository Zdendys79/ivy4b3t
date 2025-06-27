# FacebookBot README

## 📂 Umístění

`~/ivy/iv_fb.class.js`

## 🌟 Účel

Třída `FacebookBot` zajišťuje **automatickou interakci s Facebookem** pomocí Puppeteer.
Ovládá přihlášení, psaní příspěvků, interakce se skupinami, detekci obsahu a další činnosti.
Je navržena pro **čistou separaci logiky**:
➡️ `FacebookBot` = interakce s Facebookem
➡️ Žádné přímé volání DB, API, logiky projektu.

## 🏗️ Základní použití

```javascript
import { FacebookBot } from './iv_fb.class.js';
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const context = await browser.createIncognitoBrowserContext();
  const fbBot = new FacebookBot(context);

  await fbBot.init();
  const user = { id: 85, name: 'Pavla', surname: 'Skřivánková', fb_login: 'pavla@example.com', fb_pass: '123456' };

  await fbBot.openFB(user);
  await fbBot.newThing();
  await fbBot.clickNewThing();
  await fbBot.pasteStatement("Vychovávat dítě znamená vychovávat sebe. – anglické přísloví");
  await fbBot.clickSendButton();

  await browser.close();
})();
```

## 🔑 Hlavní metody

| Metoda                       | Popis                                         |
| ---------------------------- | --------------------------------------------- |
| `init()`                     | Inicializuje Puppeteer stránku                |
| `openFB(user)`               | Přihlásí uživatele na Facebook                |
| `newThing(index)`            | Najde pole pro psaní příspěvku                |
| `clickNewThing()`            | Klikne do pole pro psaní příspěvku            |
| `pasteStatement(text)`       | Vloží text příspěvku                          |
| `clickSendButton()`          | Klikne na tlačítko "Zveřejnit"                |
| `defaultRange()`             | Nastaví výchozí viditelnost příspěvku         |
| `openGroup(group)`           | Otevře skupinu                                |
| `readUserCounter()`          | Načte počet členů nebo sledujících skupiny    |
| `addMeToGroup()`             | Přidá se do skupiny                           |
| `clickLike()`                | Klikne na tlačítko "To se mi líbí"            |
| `contentNotAvailable()`      | Zjistí, zda je obsah nedostupný               |
| `spamDetected()`             | Detekuje hlášku o spamu                       |
| `tryAgainLater()`            | Detekuje "Můžete to zkusit později"           |
| `problemWithURL()`           | Detekuje hlášku o problému s URL              |
| `loginFailedEn()`            | Detekuje anglickou chybu přihlášení           |
| `loginFailedCs()`            | Detekuje českou chybu přihlášení              |
| `isSellGroup()`              | Detekuje, zda je skupina prodejní             |
| `clickDiscus()`              | Klikne na tlačítko "Diskuze"                  |
| `joinToGroup()`              | Klikne na tlačítko "Přidat se ke skupině"     |
| `testXPath(selector)`        | Najde a vrátí element podle XPath (pro testy) |
| `getScreenshot(name)`        | Uloží screenshot                              |
| `getScreenshotForDatabase()` | Vrátí screenshot jako buffer pro DB           |

## 🔧 Interní helpery (používány v metodách)

| Metoda                      | Popis                                    |
| --------------------------- | ---------------------------------------- |
| `_findByText(text)`         | Najde elementy podle textu (XPath)       |
| `_clickByText(text)`        | Najde a klikne na element podle textu    |
| `_checkTexts(text1, text2)` | Zkontroluje výskyt obou textů na stránce |
| `_typeActive(text)`         | Napíše text do aktivního elementu        |

## 🛡️ Poznámky

✅ Třída je optimalizovaná pro Puppeteer + Facebook UI (stav k roku 2025).
✅ Čekací doby (`wait.timeout()`) lze upravit v `iv_wait.js` podle rychlosti serveru a připojení.
✅ Přesnost závisí na stabilitě DOM struktury Facebooku (možné budoucí změny).
