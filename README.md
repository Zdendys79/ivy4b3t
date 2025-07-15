# Ivy4B3T – Autonomní systém pro správu účtů na FBu

**IV. Verze systému Ivy4B3T** je plně přepracovaná a modernizovaná verze původního systému pro autonomní správu FB účtů, který zajišťuje distribuci realitních inzerátů a správu profilů ve skupinách.

## 🎯 Hlavní cíle verze IV

* Napodobování lidského chování (reakce, pauzy, přihlášení, aktivita)
* Stabilní a bezpečná architektura klient-server
* Efektivní verzování a správa aktualizací přes Git a databázi
* Kontrola běžící verze na klientovi a automatické ukončení při nesouladu
* Automatické přihlašování na UTIO a FB
* Distribuce příspěvku do skupin podle lokality a priority
* Snadná rozšiřitelnost a přehledná struktura kódu

## 🔄 Jak systém funguje

### Hlavní cyklus (ivy.js)
1. **Spuštění a inicializace**: Systém načte verzi, inicializuje logger a zapíše startup event
2. **Nekonečná smyčka**: Kontroluje heartbeat, verzi v databázi a volá pracovní tick
3. **Graceful shutdown**: Při ukončení zavře všechny browsery a databázové spojení

### Pracovní cyklus (iv_worker.js)
1. **Kontrola UI příkazů**: Zpracování manuálních příkazů z webového rozhraní
2. **Ochrana hostname**: Kontrola, zda není hostname zablokován kvůli detekci banů
3. **Výběr uživatele**: 
   - Na hlavní větvi (main): Rotační výběr nejstaršího připraveného uživatele
   - Na produkční větvi: Výběr uživatele s dostupnými akcemi
4. **Kolo štěstí**: Losování akcí podle vah a limitů
5. **Inicializace služeb**: Otevření browseru a požadovaných záložek (FB/UTIO)
6. **Provedení akcí**: Postupné provádění vylosovaných akcí
7. **Ukončující akce**: Po vyprázdnění kola account_delay nebo account_sleep
8. **Čekání**: 1-5 minut s pravidelným heartbeat

### Typy akcí
- **FB akce**: timeline_post, group_post, comment, react, messenger_check, quote_post, group_explore
- **UTIO akce**: post_utio_g (běžné skupiny), post_utio_gv (vlastní skupiny), post_utio_p (prodejní skupiny)
- **Systémové akce**: account_delay, account_sleep

### Bezpečnostní mechanismy
- **Invasive lock**: Ochrana před příliš častými invazivními akcemi
- **Hostname protection**: Blokování hostname při detekci banu účtu
- **Account blocking**: Automatické označení problémových účtů
- **Consecutive failures**: Automatický account_delay po 5 neúspěšných akcích

---

## 📁 Struktura projektu

```
~/git/ivy4b3t/                ← Git repozitář
├── ivy/                      ← Hlavní kód robota
│   ├── ivy.js                ← Hlavní smyčka klienta (verifikační + volání tick())
│   ├── iv_worker.js          ← Pracovní cyklus: výběr uživatele, login, akce
│   ├── iv_ui.js              ← Zpracování UI příkazů z webového rozhraní
│   ├── iv_fb.js              ← Práce s FBem (login, postování, analýza)
│   ├── iv_utio.js            ← Login a práce s UTIO portálem
│   ├── iv_wait.js            ← Pauzy a zpoždění pro simulaci lidského chování
│   ├── iv_sql.js             ← Komunikace s databází přes ESM SQL modul
│   ├── iv_support.js         ← Pomocné funkce – vkládání zpráv, zvýšení limitů, screenshoty
│   ├── iv_version.js         ← Načítání verze z `package.json`
│   ├── iv_rhythm.js          ← Plánování akcí podle `action_plan`
│   ├── libs/                ← Objektově orientované třídy
│   │   ├── iv_actions.class.js    ← Implementace všech typů akcí
│   │   ├── iv_fb.class.js         ← Třída pro práci s Facebook
│   │   ├── iv_utio.class.js       ← Třída pro práci s UTIO portálem
│   │   ├── iv_ui.class.js         ← Třída pro zpracování UI příkazů
│   │   ├── iv_log.class.js        ← Centralizované logování
│   │   ├── iv_page_analyzer.class.js ← Analýza stavu FB stránky
│   │   ├── iv_querybuilder.class.js  ← Builder pro složité SQL dotazy
│   │   ├── iv_console_logger.class.js ← Logger pro konzoli s session ID
│   │   └── iv_char.class.js       ← Pomocné funkce pro práci s textem
│   ├── config.json           ← Konfigurace větve, log úrovní, ikon a chování
│   ├── git-common.sh         ← Společný modul pro Git operace napříč skripty
│   ├── start.sh              ← Opakovaný spouštěcí skript (git pull + rsync + `node ivy.js`)
│   ├── main-start.sh         ← Produkční spouštěcí skript (vždy main větev)
│   ├── update-files.sh       ← Pomocný skript pro aktualizaci souborů bez spuštění
│   ├── loginuser.js          ← Skript pro správu FB uživatele na webu
│   ├── cycleusers.js         ← Cyklické přepínání uživatelů na virtuálu
│   ├── rss_reader.js         ← Skript pro načítání zpráv z RSS a ukládání URL do databáze
│   ├── git_commit_version.js ← Hook/post-commit pro uložení verze do DB a package.json
│   └── sql/                  ← SQL dotazy a konfigurace
│       ├── queries/          ← Modulární SQL dotazy v ESM struktuře
│       │   ├── index.js      ← Hlavní exportní bod všech SQL dotazů
│       │   ├── users.js      ← Dotazy pro práci s uživateli
│       │   ├── groups.js     ← Dotazy pro práci se skupinami
│       │   ├── quotes.js     ← Dotazy pro práci s citáty
│       │   ├── actions.js    ← Dotazy pro akce a plánování
│       │   ├── limits.js     ← Dotazy pro správu limitů
│       │   ├── system.js     ← Systémové dotazy
│       │   └── logs.js       ← Dotazy pro logování
│       ├── sql_config.json   ← Databázové přístupové údaje (NEukládá se do Git)
│       ├── sql_config_sample.json ← Vzor pro sql_config.json
│       ├── iv_user.sql       ← Legacy dotaz pro výběr uživatele
│       └── iv_group.sql      ← Legacy dotaz pro výběr skupiny
├── scripts/                  ← Utility a systémové skripty pro správu projektu
│   ├── setup-ivy.sh          ← Kompletní instalační skript pro IVY prostředí
│   ├── db_ivy_create.sh      ← Vytvoření databáze s všemi tabulkami a daty
│   ├── db_backup.sh          ← Zálohování databáze s versioning
│   ├── install_ivy_git.sh    ← Instalace projektu Ivy z Gitu na VM
│   ├── install-ivy-deps.sh   ← Instalace závislostí pro Ivy v Linuxu
│   ├── install-latest-node.sh ← Instalace nejnovější verze Node.js
│   ├── bootstrap-ivy.sh      ← Bootstrap prostředí pro Ivy
│   ├── manage-git.sh         ← Správa git repozitáře a základní operace
│   ├── update-node-env.sh    ← Aktualizace NVM, Node.js a NPM
│   ├── commit.ps1            ← PowerShell commit s verzováním a Notepad editorem
│   ├── create_links.bat      ← Vytváření symbolických linků ve Windows
│   ├── pre-commit            ← Git hook – automatizace před commitem
│   └── post-commit           ← Git hook – automatizace po commitu
├── web/                      ← Webová a dashboard část projektu
│   ├── restricted/           ← Část webu nedostupná přes HTTP
│   │   ├── ivy_create_full.sql     ← SQL skript pro vytvoření celé databáze
│   │   ├── ivy_data_full.sql       ← SQL skript pro import výchozích dat
│   │   ├── ivy_data_scheme.sql     ← SQL skript pro vložení dat do scheme
│   │   ├── ivy_data_referers.sql   ← SQL skript pro vložení referer URL
│   │   ├── ivy_data_action_definitions.sql ← SQL skript pro definice akcí
│   │   ├── sql_config.json         ← Přístupové údaje do databáze pro PHP (NEukládá se do Git)
│   │   ├── sql_config_example.json ← Vzor pro sql_config.json
│   │   ├── install_ivy.sh          ← Instalační skript pro inicializaci databáze
│   │   └── backups/               ← Složka pro automatické zálohy databáze
│   ├── system/               ← Systémová složka pro PHP
│   │   └── db_class.php      ← Třída pro správu databáze
│   ├── index.php             ← Hlavní vstupní bod webové aplikace
│   ├── dashboard.php         ← Dashboard pro správu robotů
│   ├── style.css             ← Styly pro webovou aplikaci
│   └── script.js             ← JavaScript pro interaktivitu webu
└── README.md                 ← Tento dokumentační soubor
```

---

## ✅ Vytvořené a používané soubory ve verzi IV

### Složka ivy - hlavní soubory

| Soubor                  | Účel                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `ivy.js`                | Spouštěcí smyčka klienta – volá `tick()`, hlídá verzi, zapisuje heartBeat |
| `iv_worker.js`          | Hlavní pracovní logika robota – výběr uživatele, kolo štěstí, provedení akcí |
| `iv_wheel.js`           | Implementace kola štěstí pro losování akcí, správa invasive lock          |
| `iv_sql.js`             | Abstrakce databázové vrstvy pomocí dotazů ze `sql/queries/index.js`       |
| `iv_wait.js`            | Generování zpoždění pro simulaci lidského chování                         |
| `iv_support.js`         | Pomocné funkce: postování zpráv, screenshoty, zvyšování limitů            |
| `iv_version.js`         | Načtení verze z `package.json`, použití pro validaci vůči DB              |
| `iv_config.js`          | Správa konfigurace - načítání a validace config.json                      |
| `hostname_block_handler.js` | Ochrana před lavinou banů - blokování hostname                        |
| `iv_interactive_debugger.js` | Interaktivní debugger pro analýzu chyb                             |

### Složka ivy/libs - objektové třídy

| Soubor                  | Účel                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `iv_actions.class.js`   | Hlavní třída pro správu a provádění všech typů akcí                     |
| `iv_fb.class.js`        | FBBot - třída pro interakci s Facebook (login, postování, analýza)      |
| `iv_utio.class.js`      | UtioBot - třída pro práci s UTIO portálem (login, získání zpráv)        |
| `iv_ui.class.js`        | UIBot - zpracování manuálních příkazů z webového rozhraní               |
| `iv_log.class.js`       | Log - centralizované logování s podporou úrovní a barev                 |
| `iv_page_analyzer.class.js` | PageAnalyzer - pokročilá analýza stavu FB stránky                  |
| `iv_querybuilder.class.js` | QueryBuilder - dynamické vytváření složitých SQL dotazů              |
| `iv_console_logger.class.js` | ConsoleLogger - logger s podporou session ID a flush mechanismu     |
| `iv_char.class.js`      | Char - pomocné funkce pro práci s textem a řetězci                      |
| `iv_math.class.js`      | IvMath - matematické funkce, náhodná čísla, intervaly                   |

### Složka ivy - konfigurační soubory

| Soubor                     | Účel                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| `config.json`              | Hlavní konfigurace: větev, log úrovně, ikony, lidské chování          |
| `git-common.sh`            | Společný Bash modul pro Git operace používaný více skripty            |
| `start.sh`                 | Bash skript pro opakované spouštění `ivy.js` s Git aktualizacemi      |
| `main-start.sh`            | Produkční bash skript (vždy main větev, ignoruje config.json)         |
| `update-files.sh`          | Pomocný skript pro aktualizaci souborů bez spuštění aplikace          |

### Složka ivy/sql - databázové dotazy

| Soubor                         | Účel                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| `queries/index.js`             | Hlavní exportní bod všech SQL dotazů v ESM struktuře              |
| `queries/users.js`             | Modularizované dotazy pro práci s uživateli                       |
| `queries/groups.js`            | Modularizované dotazy pro práci se skupinami                      |
| `queries/quotes.js`            | Modularizované dotazy pro práci s citáty                          |
| `queries/actions.js`           | Modularizované dotazy pro akce a plánování                        |
| `queries/limits.js`            | Modularizované dotazy pro správu limitů                           |
| `queries/system.js`            | Modularizované systémové dotazy                                    |
| `queries/logs.js`              | Modularizované dotazy pro logování                                 |
| `sql_config.json`             | Obsahuje DB přístupové údaje pro JS (NEukládá se do Git)           |
| `sql_config_sample.json`      | Šablona pro `sql_config.json`                                     |
| `iv_user.sql`                 | Legacy dotaz pro výběr uživatele (zachován pro kompatibilitu)     |
| `iv_group.sql`                | Legacy dotaz pro výběr skupiny (zachován pro kompatibilitu)       |

### Složka web/restricted - databázové skripty

| Soubor                              | Účel                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| `ivy_create_full.sql`               | SQL skript pro vytvoření celé databázové struktury           |
| `ivy_data_full.sql`                 | SQL skript pro import výchozích dat z utiolite               |
| `ivy_data_scheme.sql`               | SQL skript pro vložení dat do tabulky scheme                 |
| `ivy_data_referers.sql`             | SQL skript pro vložení výchozích referer URL                 |
| `ivy_data_action_definitions.sql`   | SQL skript pro vložení definic akcí                          |
| `sql_config.json`                  | Přístupové údaje do databáze pro PHP (NEukládá se do Git)     |
| `sql_config_example.json`          | Vzor pro `sql_config.json`                                   |
| `install_ivy.sh`                   | Instalační skript pro inicializaci databáze                  |

### Složka scripts - pomocné skripty

| Soubor                    | Popis a účel                                                    |
| ------------------------- | --------------------------------------------------------------- |
| `setup-ivy.sh`            | Kompletní instalační skript pro IVY prostředí                  |
| `db_ivy_create.sh`        | Vytvoření databáze s všemi tabulkami a daty                    |
| `db_backup.sh`            | Zálohování databáze s versioning a porovnáním se šablonou      |
| `install_ivy_git.sh`      | Instalace projektu Ivy z Gitu na VM                            |
| `install-ivy-deps.sh`     | Instalace závislostí pro Ivy v Linuxu                          |
| `install-latest-node.sh`  | Aktualizace Node.js na nejnovější verzi                        |
| `bootstrap-ivy.sh`        | Bootstrap prostředí pro Ivy                                    |
| `manage-git.sh`           | Správa git repozitáře a základní operace                       |
| `update-node-env.sh`      | Samostatný skript pro aktualizaci NVM, Node.js a NPM.          |
| `commit.ps1`              | PowerShell commit s verzováním a Notepad editorem              |
| `commit.sh`               | Batch commit skript, pro odesílání commitů na vývojovém PC     |
| `create_links.bat`        | Vytváření symbolických linků na vývojových PC                  |
| `pre-commit`              | Git hook – automatizace před commitem                          |
| `post-commit`             | Git hook – automatizace po commitu                             |

---

## 🔧 Konfigurační soubory

### config.json
Hlavní konfigurační soubor umístěný v `~/ivy/config.json`:

```json
{
  "branch": "main",
  "use_icons": false,
  "debug_mode": true,
  "log_levels": {
    "main": "debug",
    "release": "info"
  },
  "icons": {
    "info": "ℹ️",
    "warn": "⚠️",
    "error": "❌",
    "success": "✅",
    "debug": "🐛",
    "db": "🗄️"
  },
  "human_behavior": {
    "typing_mistakes_chance": 0.07,
    "hesitation_chance": 0.3,
    "reading_time_min": 2000,
    "reading_time_max": 5000
  }
}
```

**Účel sekcí:**
- `branch`: Určuje aktuální větev (main = debug režim, release = produkční)
- `log_levels`: Úroveň logování podle větve (error, warn, info, debug)
- `icons`: Ikony pro různé typy log zpráv
- `human_behavior`: Parametry pro simulaci lidského chování
- `new_post_texts` / `submit_texts`: Texty pro rozpoznání UI elementů

### Databázové konfigurace
Projekt používá dva identické konfigurační soubory pro databázi:

- `~/ivy/sql/sql_config.json` - pro Node.js aplikaci
- `~/web/restricted/sql_config.json` - pro PHP webové rozhraní

**Struktura (podle sql_config_example.json):**
```json
{
  "host": "localhost",
  "user": "database_user",
  "password": "unbreakable_database_password",
  "database": "database_name"
}
```

---

## 🔗 Vytváření symbolických linků (create_links.bat)

Tento skript slouží k vytvoření potřebných symbolických odkazů mezi složkami projektu:

| Odkud | Kam | Účel |
|-------|-----|------|
| `e:\B3projekty\ivy4b3t\web` | `e:\B3-VPS00.website\ivy` | Synchronizace s webserverem Apache (PHP dashboard) |
| `e:\B3projekty\ivy4b3t\scripts` | `e:\B3.puppeteer\scripts` | Sdílená složka skriptů mezi PC a VM (Syncthing) |
| `e:\B3projekty\ivy4b3t\.git\hooks\pre-commit` | `e:\B3.puppeteer\scripts\pre-commit` | Git hook pro verifikaci před commitem |
| `e:\B3projekty\ivy4b3t\.git\hooks\post-commit` | `e:\B3.puppeteer\scripts\post-commit` | Git hook pro zápis verze do DB po commitu |

⚠️ **Skript je potřeba spustit jako správce** – pokud není spuštěn s oprávněními administrátora, automaticky se restartuje se zvýšenými právy.

---

## 📊 Databázová struktura

### Funkce skriptu `db_backup.sh`

- Načítá přihlašovací údaje z JSON souboru: `/var/www/b3.web/ivy/restricted/sql_config.json`
- Získává poslední `versionCode` z tabulky `ivy.versions` (sloupec `code`)
- Vytváří dva zálohové soubory:
  - Struktura: `backup_structure_{versionCode}.sql`
  - Data: `backup_data_{versionCode}.sql`
- Zachovává vždy poslední 3 zálohy (starší automaticky maže)
- Porovnává strukturu databáze s referenčním souborem `ivy_create_full.sql`
- Výsledek rozdílů ukládá do `backup_diff_{versionCode}.log`
- Zálohy a logy jsou ukládány do: `/var/www/b3.web/ivy/restricted/backups`

### Umístění záloh

Zálohy jsou ukládány do složky, která je synchronizována zpět na vývojová PC pomocí Syncthing:
`/var/www/b3.web/ivy/restricted/backups`

### Spuštění skriptu

Skript spouštěj ručně v případě potřeby:

```bash
bash ~/Sync/scripts/db_backup.sh
```

---

## 🚫 Gitignore pravidla

V projektu používáme .gitignore k zajištění, že citlivé, zbytečné či velké soubory nebudou verzovány.
Níže je seznam pravidel, která jsou aktuálně nastavena:

```
.vscode/                 # Konfigurační soubory editoru Visual Studio Code
node_modules/            # Knihovny a závislosti z Node.js - vytvoří se při instalaci projektu (npm install)
/web/restricted/backups/ # Zálohy – nejsou určeny pro verzování
/web/restricted/sql_config.json  # Konfigurace databáze – obsahuje citlivé údaje pro PHP
/ivy/sql/sql_config.json         # Konfigurace databáze – obsahuje citlivé údaje pro Node.js
*.bak                    # Záložní soubory (například .bak z editorů)
```

**Poznámka:**
Soubory a složky uvedené výše nejsou součástí verzované historie projektu a neměly by být přidávány do repozitáře.

---

## 🛠️ Modulární SQL struktura

Verze IV používá plně modulární ESM strukturu pro SQL dotazy:

### Hlavní moduly v `~/ivy/sql/queries/`:

- **`index.js`** - Hlavní exportní bod, spojuje všechny moduly
- **`users.js`** - Dotazy pro správu uživatelů (výběr, aktualizace, limity)
- **`groups.js`** - Dotazy pro správu FB skupin (výběr podle priority, regionu)
- **`quotes.js`** - Dotazy pro práci s citáty (výběr, hash kontrola)
- **`actions.js`** - Dotazy pro plánování a správu akcí
- **`limits.js`** - Dotazy pro správu denních a maximálních limitů
- **`system.js`** - Systémové dotazy (verze, heartBeat, konfigurace)
- **`logs.js`** - Dotazy pro logování a audit trail

### Použití v kódu:

```javascript
import { SQL, QueryUtils } from './sql/queries/index.js';

// Přímý přístup k dotazu
const query = SQL.users.getActiveUser;

// Nebo pomocí utility
const query2 = QueryUtils.getQuery('users.getActiveUser');
```

---

## 📌 Poznámky

* Aktivní ESM (`type: "module"`)
* Hook před GIT Commit přepisuje `package.json` (verze)
* Modulová struktura pro SQL dotazy
* Centralizované logování s konfigurovatelnou úrovní
* Debug režim automaticky určovaný podle větve
* Kompatibilita s Linux a Windows
* Společný Git modul pro všechny skripty

---

## 📌 To-Do / Budoucí kroky

* [ ] Nové tabulky (např. `activity_log`)
* [ ] Simulace v `iv_worker.js`
* [ ] Vytvoření všech aktivit na FB (přijímání a odesílání žádostí o přátelství, konverzace na messengeru, reakce na příspěvky a vytváření vlastních)
* [ ] Doprogramovat rozšířený modulový režim
* [ ] Implementace pokročilého human behavior systému
* [ ] Rozšíření webového dashboardu o real-time monitoring

---

## 📞 Autoři a kontakty

* **Hlavní vývoj: Zdeněk Jelínek**
  * mobil: 773 368 283
  * email: [zdendys79@gmail.com](mailto:zdendys79@gmail.com)

* **Programová logika, dokumentace: Nyara (Claude Sonnet 4)**

---

## 🚀 Rychlý start

1. **Klonování repozitáře:**
   ```bash
   git clone https://github.com/Zdendys79/ivy4b3t.git ~/git/ivy4b3t
   ```

2. **Instalace prostředí:**
   ```bash
   bash ~/git/ivy4b3t/scripts/setup-ivy.sh
   ```

3. **Konfigurace databáze:**
   ```bash
   cp ~/ivy/sql/sql_config_sample.json ~/ivy/sql/sql_config.json
   # Editujte sql_config.json s vašimi databázovými údaji
   ```

4. **Spuštění:**
   ```bash
   cd ~/ivy && chmod +x start.sh && ./start.sh
   ```

5. **Spuštění v main větvi (doporučeno pro produkci):**
   ```bash
   cd ~/ivy && chmod +x main-start.sh && ./main-start.sh
   ```

### ⚠️ Spustitelná oprávnění po Git aktualizaci

Po každé aktualizaci z Git repozitáře je nutné znovu nastavit spustitelná oprávnění pro skripty na VM:

```bash
# Základní start skripty
chmod +x ~/ivy/start.sh
chmod +x ~/ivy/main-start.sh
chmod +x ~/ivy/update-files.sh

# Nebo všechny shell skripty najednou:
chmod +x ~/ivy/*.sh
```

**Poznámka:** Git neuchovává execute permissions, proto je nutné je nastavit po každém pull/rsync na VM.

---

## 📝 Aktualizace souborů

Pro aktualizaci souborů bez spuštění aplikace:
```bash
cd ~/ivy && ./update-files.sh
```
