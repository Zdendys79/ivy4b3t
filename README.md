# Ivy4B3T – Autonomní systém pro správu účtů na Facebooku

**IV. Verze systému Ivy4B3T** je plně přepracovaná a modernizovaná verze původního systému pro autonomní správu Facebook účtů, který zajišťuje distribuci realitních inzerátů a správu profilů ve skupinách.

## 🎯 Hlavní cíle verze IV

* Napodobování lidského chování (reakce, pauzy, přihlášení, aktivita)
* Stabilní a bezpečná architektura klient-server
* Efektivní verzování a správa aktualizací přes Git a databázi
* Kontrola běžící verze na klientovi a automatické ukončení při nesouladu
* Automatické přihlašování na UTIO a Facebook
* Distribuce příspěvku do skupin podle lokality a priority
* Snadná rozšiřitelnost a přehledná struktura kódu

---

## 📁 Struktura projektu

```
~/git/ivy4b3t/                ← Git repozitář
├── ivy/                      ← Hlavní kód robota
│   ├── ivy.js                ← Hlavní smyčka klienta (verifikační + volání tick())
│   ├── iv_worker.js          ← Pracovní cyklus: výběr uživatele, login, akce
│   ├── iv_ui.js              ← Zpracování UI příkazů z webového rozhraní
│   ├── iv_fb.js              ← Práce s Facebookem (login, postování, analýza)
│   ├── iv_utio.js            ← Login a práce s UTIO portálem
│   ├── iv_wait.js            ← Pauzy a zpoždění pro simulaci lidského chování
│   ├── iv_sql.js             ← Komunikace s databází přes ESM SQL modul
│   ├── iv_sql_queries.js     ← Definice všech SQL dotazů (exportované jako ESM objekt)
│   ├── iv_support.js         ← Pomocné funkce – vkládání zpráv, zvýšení limitů, screenshoty
│   ├── iv_version.js         ← Načítání verze z `package.json`
│   ├── iv_rhythm.js          ← Plánování akcí podle `action_plan`
│   ├── iv_actions.js         ← Implementace akcí na základě `action_code`
│   └── sql/                  ← Původní SQL dotazy ve formátu `.sql`
│       ├── _sql_sample.json  ← Vzor konfiguračního souboru pro připojení k DB
│       ├── _sql.json         ← Konfiguračního souboru pro připojení k DB
│       ├── iv_sql_queries.js ← Definice všech SQL dotazů (exportované jako ESM objekt)
│       ├── iv_user.sql       ← Výběr uživatele
│       └── iv_group.sql      ← Výběr vhodné skupiny
├── scripts/               # Utility a systémové skripty pro správu projektu
│   ├── commit.ps1         # PowerShell commit s verzováním
│   ├── install_ivy_git.sh # Instalace projektu Ivy z Gitu na VM
│   ├── install-latest-node.sh # Instalace nejnovější verze Node.js
│   ├── fix_crd_xfce.sh    # Oprava CRD problémů na Xfce
│   ├── fix_crd_freeze.sh  # Restart CRD procesu při zamrznutí
│   ├── edit_sources.sh    # Úprava sources.list
│   ├── edit_all_sources.sh # Úprava více sources.list najednou
│   ├── edit_sources_yaml.sh # Převod sources.list do YAML
│   └── reset_vm.sh        # Rychlý reset VM
├── start.sh                 ← Spouštěcí skript s pull + rsync + node
├── git_commit_version.js   ← Hook/post-commit pro uložení verze do DB a package.json
├── _sql_sample.json        ← Vzor konfiguračního souboru pro připojení k DB
```

---

## ✅ Vytvořené a používané soubory ve verzi IV

| Soubor                  | Účel                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `ivy.js`                | Spouštěcí smyčka klienta – volá `tick()`, hlídá verzi, zapisuje heartbeat |
| `iv_worker.js`          | Hlavní pracovní logika robota – login, akce, volání FB a UTIO             |
| `iv_ui.js`              | Zpracování UI příkazů z tabulky `ui_commands`                             |
| `iv_fb.js`              | Interakce s Facebookem: login, vkládání, skupiny, kontrola stavů          |
| `iv_utio.js`            | Práce s portálem UTIO: přihlášení, výběr oblasti, získání zprávy          |
| `iv_wait.js`            | Generování zpoždění pro simulaci lidského chování                         |
| `iv_sql.js`             | Abstrakce databázové vrstvy pomocí dotazů ze `iv_sql_queries.js`          |
| `iv_support.js`         | Pomocné funkce: postování zpráv, screenshoty, zvyšování limitů            |
| `iv_version.js`         | Načtení verze z `package.json`, použití pro validaci vůči DB              |
| `iv_rhythm.js`          | Modul pro plánování akcí z `action_definitions` a `user_action_plan`      |
| `iv_actions.js`         | Realizace konkrétních typů akcí uživatelů (např. delay, sleep, like)      |
| `sql/iv_user.sql`       | Původní dotaz pro výběr uživatele                                         |
| `sql/iv_group.sql`      | Původní dotaz pro výběr skupiny pro daného uživatele                      |
| `aql/iv_sql_queries.js` | ESM export SQL dotazů – nahrazuje přímé čtení ze souborů                  |
| `start.sh`              | Opakovaný spouštěcí skript (git pull + rsync + `node ivy.js`)             |
| `git_commit_version.js` | Získání GIT hashe a zapsání verze do DB a `package.json`                  |
| `_sql_sample.json`      | Šablona pro `_sql.json` obsahující DB přístupové údaje                    |

| Soubory - scripts        | Popis a účel                                          |
| ------------------------ | ----------------------------------------------------- |
| `commit.ps1`             | Pomocný PowerShell skript pro commit s verzováním     |
| `install_ivy_git.sh`     | Instalace projektu Ivy z Gitu na VM                   |
| `install-latest-node.sh` | Aktualizace Node.js na nejnovější verzi               |
| `fix_crd_xfce.sh`        | Oprava problémů s CRD (Chrome Remote Desktop) na Xfce |
| `fix_crd_freeze.sh`      | Reset CRD procesu při zamrznutí na VM                 |
| `edit_sources.sh`        | Pomocný skript pro úpravu souborů `sources.list`      |
| `edit_all_sources.sh`    | Hromadná úprava více `sources.list` souborů           |
| `edit_sources_yaml.sh`   | Převod `sources.list` do formátu YAML (pro úpravy)    |
| `reset_vm.sh`            | Rychlý reset VM (restart služby, cleanup)             |
| `create-links.bat`       | Vytváření symbolických linků na vývojových PC         |

---

## 🔗 Vytváření symbolických linků (create-links.bat)
Tento skript slouží k vytvoření potřebných symbolických odkazů mezi složkami projektu:

Odkud	Kam	Účel
e:\B3projekty\ivy4b3t\web	e:\B3-VPS00.website\ivy	Synchronizace s webserverem Apache (PHP dashboard)
e:\B3projekty\ivy4b3t\scripts	e:\B3.puppeteer\scripts	Sdílená složka skriptů mezi PC a VM (Syncthing)
e:\B3projekty\ivy4b3t\.git\hooks\pre-commit e:\B3.puppeteer\scripts\pre-commit     Git hook pro verifikaci před commitem
e:\B3projekty\ivy4b3t\.git\hooks\post-commit e:\B3.puppeteer\scripts\post-commit   Git hook pro zápis verze do DB po commitu

⚠️ Skript je potřeba spustit jako správce – pokud není spuštěn s oprávněními administrátora, automaticky se restartuje se zvýšenými právy.

---

## 📦 Instalace na Ubuntu
Pro instalaci a přípravu systému na Ubuntu jsou připraveny dva skripty:

1️⃣ Příprava systému a Node.js
Spusť skript install-latest-node.sh:

cd ~/Sync/scripts
bash install-latest-node.sh
Tento skript:
Aktualizuje systém (apt-get update && apt-get upgrade),
Instaluje správce verzí nvm,
Nainstaluje nejnovější verzi node a npm.

2️⃣ Instalace klienta Ivy z GitHubu
Pro klonování a instalaci projektu Ivy použij skript install_ivy_git.sh:

cd ~/Sync/scripts
bash install_ivy_git.sh
Tento skript:
Stáhne repozitář ivy4b3t do složky ~/git/ivy4b3t,
Zkopíruje složku ivy do cílové složky ~/ivy,
Provede npm install v cílové složce a připraví prostředí pro běh klienta.


## ▶️ Spuštění klienta
Po dokončení instalace spusť klienta pomocí skriptu start.sh:

cd ~/ivy
bash start.sh

---

## 🔁 Správa verzí systému
Při git commit se spouští post-commit hook, který volá skript git_commit_version.js. Tento skript:

Získá aktuální GIT hash (git rev-parse HEAD),
Vygeneruje unikátní kód verze (např. C47 – kombinace hodin, desítek minut a sekund),
Zapíše tento kód a hash do tabulky versions v databázi ivy,
Zapíše kód verze do package.json pod klíčem versionCode.
Soubor iv_version.js tuto hodnotu (versionCode) načítá a ivy.js při každém spuštění kontroluje shodu s kódem verze v databázi:

if (dbVersion.code !== versionCode) process.exit(1);
Pokud verze nesouhlasí, klient se ukončí a je vyžadována aktualizace.
---

## 🧠 Architektura systému

| Komponenta    | Popis                                                          |
| ------------- | -------------------------------------------------------------- |
| **Ivy4B3T**   | Označení celého systému (framework).                           |
| **Ivy**       | Samostatný klient běžící na VM, provozuje účty a provádí akce. |
| **Node.JS**   | Runtime prostředí pro běh klienta Ivy.                         |
| **Puppeteer** | Automatizace prohlížeče Chromium.                              |
| **MariaDB**   | Databáze řídící stav účtů, logy a heartbeat.                   |
| **GitHub**    | Distribuce verzí a synchronizace pomocí Git repozitáře.        |

---

## 🌍 Zdroj příspěvku: Portál **UTIO**

* Web, kde si účet vybere lokalitu (kraj, okres)
* Získá URL příspěvku pro Facebookovou skupinu

---

## 💻 Virtualizace a prostředí

* **Počet VM**: 22
* **Hypervizory**: 6 (každý hostuje max. 4 VM)
* **Hardware**: Intel i3, RAM 16 GB
* **Každý VM**: 2 jádra, 3 GB RAM

---

## ⚙️ Provozní charakteristiky

* Na VM běží 4–7 účtů
* Každý účet obsluhuje skupiny dle lokality
* Heartbeat zapisován do DB

---

## 📦 Deployment a aktualizace (v přípravě)

* Přechod ze **Syncthing** na **Git**
* Klient se aktualizuje podle verze zapsané v DB

---

## 📊 Uživatelské rozhraní a přehledy

### "Don't panic" – kontrolní tabulka

* Webová PHP stránka
* Zobrazuje aktivitu účtů, stav, odpovědi, chyby

### UI Dashboard

* Spuštění nebo restart klientů
* Úpravy parametrů, lokalit
* Logy, stav VM a účtů

---

## 📁 Vývojové prostředí

* Windows 10/11
* Visual Studio Code
* Webový Adminer

---

## 📦 Verze použitého prostředí

| Komponenta       | Ubuntu (VM)   | Windows (vývoj) |
|------------------|---------------|-----------------|
| Node.js          | v24.0.2       | v22.12.0        |
| npm              | 11.4.0        | 11.4.0          |
| puppeteer        | 24.8.2        | 24.8.2          |
| puppeteer-extra  | 3.3.6         | 3.3.6           |

---

## 💻 Klient – hlavní cyklus

Soubor `ivy.js`:

1. zapisuje heartbeat
2. ověřuje verzi
3. volá `iv_worker.tick()`

Soubor `iv_worker.js`:

* ověřuje, že nikdo jiný není přihlášen
* vybírá uživatele a skupinu
* přihlašuje na UTIO a FB
* vkládá příspěvky a loguje
* zavírá prohlížeč

---

## 💡 Další vlastnosti

* UI příkazy přes `ui_commands` z budoucího PHP dashboardu
* Automatické přidávání uživatelů do skupin
* Náhodné časy, odklady
* Denní limity, historie, změna limitů

---

## 📦 Příprava a deployment

* Vývoj na Windows
* Nasazení na Ubuntu s Node.js LTS
* Všechny soubory ESM (import/export)
* Synchronizace verzí pomocí zápisu kódu verze při akci "Git commit": pre_hook => `package.json` + post_hook => databáze

---

## 🗄️ Zálohování databáze

Pro zálohování databáze projektu Ivy4B3T slouží skript `db_backup.sh`, umístěný ve složce `~/Sync/scripts` - synchronizovaný ze složky projektu Ivy4B3T/scripts.

### Funkce skriptu `db_backup.sh`

- Načítá přihlašovací údaje z JSON souboru:
  `/var/www/metaboost.tech/ivy/restricted/db_config.json`
- Získává poslední `versionCode` z tabulky `ivy.versions` (sloupec `code`)
- Vytváří dva zálohové soubory:
  - Struktura: `backup_structure_{versionCode}.sql`
  - Data: `backup_data_{versionCode}.sql`
- Zachovává vždy poslední 3 zálohy (starší automaticky maže)
- Porovnává strukturu databáze s referenčním souborem `ivy_create_full.sql`
- Výsledek rozdílů ukládá do `backup_diff_{versionCode}.log`
- Zálohy a logy jsou ukládány do:
  `/var/www/metaboost.tech/ivy/restricted/backups`

### Umístění záloh

Zálohy jsou ukládány do složky, která je synchronizována zpět na vývojová PC pomocí Syncthing:
`/var/www/metaboost.tech/ivy/restricted/backups`

### Spuštění skriptu

Skript spouštěj ručně v případě potřeby:

```
bash ~/Sync/scripts/db_backup.sh
```

## Gitignore pravidla
V projektu používáme .gitignore k zajištění, že citlivé, zbytečné či velké soubory nebudou verzovány.
Níže je seznam pravidel, která jsou aktuálně nastavena:

.vscode/                 # Konfigurační soubory editoru Visual Studio Code
node_modules/            # Knihovny a závislosti z Node.js - vytvoří se při instalaci projektu (npm install)
/web/restricted/backups/ # Zálohy – nejsou určeny pro verzování
/web/restricted/db_config.json  # Konfigurace databáze – obsahuje citlivé údaje pro PHP
/ivy/sql/_sql.json       # Konfigurace databáze – obsahuje citlivé údaje pro Node.js (soubory jsou téměř identické)
*.bak                    # Záložní soubory (například .bak z editorů)
Poznámka:
Soubory a složky uvedené výše nejsou součástí verzované historie projektu a neměly by být přidávány do repozitáře.

## 📌 Poznámky

* Aktivní ESM (`type: "module"`)
* Hook před GIT Commit přepisuje `package.json` (verze)
* Modulová struktura
* Kompatibilita s Linux a Windows

---

## 📌 To-Do / Budoucí kroky

* [ ] Nové tabulky (např. `activity_log`)
* [ ] Simulace v `iv_worker.js`
* [ ] Vytvoření všech aktivit na FB. (např přijímání a odesílání žádostí o přátelství, konverzace na messenmgeru, reakce na příspěvky a vytváření vlastních)
* [ ] Doprogramovat rozšířený modulový režim

---

## 📞 Autoři a kontakty

* Hlavní vývoj: **Zdeněk Jelínek**

  * mobil: 773 368 283
  * email: [zdendys79@gmail.com](mailto:zdendys79@gmail.com)
* Programová logika, dokumentace: **Nyara (ChatGPT)**
