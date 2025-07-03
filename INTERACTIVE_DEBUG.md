# 🐛 Interactive Debugging System

Systém pro interaktivní debugging umožňuje automatické zastavení při chybách a varováních s možností vytvoření debug reportu.

## ✨ Funkce

- **Automatické zastavení** při chybách a varováních
- **Interaktivní volby** - [s] Stop, [c] Continue, [d] Disable
- **Automatické kopírování DOM** a screenshot
- **Uživatelské komentáře** k chybám
- **Kompletní debug report** s kontextem

## 🚀 Aktivace

### Způsob 1: Environment Variable
```bash
export INTERACTIVE_DEBUG=true
./start.sh
```

### Způsob 2: Dočasně pro jeden běh
```bash
INTERACTIVE_DEBUG=true node ivy.js
```

### Způsob 3: PowerShell (Windows)
```powershell
$env:INTERACTIVE_DEBUG = "true"
./start.sh
```

## 🔧 Použití

### Když dojde k chybě/varování:
```
🛑 PAUSED ON ERROR/WARNING
Error Level: WARNING
Message: [USER_123]: 🚨 FB initialization problem: login_failed

💡 Options:
  [s] - STOP and create debug report
  [c] - CONTINUE without report  
  [d] - DISABLE interactive debugging

⏱️  Auto-continue in 30 seconds...
Enter your choice: 
```

### Možnosti:
- **[s]** - Zastaví a vytvoří kompletní debug report
- **[c]** - Pokračuje bez reportu
- **[d]** - Vypne interaktivní debugging pro zbytek běhu

## 📁 Debug Reports

Reports se ukládají do `./debug_reports/` ve formátu:
```
debug_reports/
├── 2025-07-03T15-30-45-123Z_USER_456_ERROR/
│   ├── README.md              # Popis reportu
│   ├── error_info.json        # Detailní informace o chybě
│   ├── screenshot.png         # Screenshot stránky
│   ├── dom.html              # Kompletní DOM HTML
│   ├── console_logs.json     # Browser console logy
│   ├── user_comment.txt      # Tvůj komentář k chybě
│   └── system_info.json      # Systémové informace
```

## 📝 Uživatelský komentář

Po stisknutí [s] se zobrazí prompt:
```
📝 Please describe what went wrong (press Enter twice to finish):
```

Můžeš napsat popis problému, například:
```
Uživatel nemohl být přihlášen na Facebook.
Stránka zobrazovala captcha která nebyla vyřešena.
Možná je potřeba ruční verifikace účtu.

[Enter]
[Enter]
```

## 🔍 Analýza Reports

### Rychlý přehled:
1. Otevři `README.md` pro základní informace
2. Prohlédni si `screenshot.png` pro vizuální stav
3. Přečti `user_comment.txt` pro kontext
4. Otevři `dom.html` v browseru pro inspekci DOM

### Detailní analýza:
- `error_info.json` - technické detaily chyby
- `console_logs.json` - chyby z browser console
- `system_info.json` - info o systému a prostředí

## ⚙️ Konfigurace

### Timeout pro rozhodnutí:
Defaultně 30 sekund, po kterých automaticky pokračuje.

### Automatické spuštění:
Přidej do `start.sh`:
```bash
export INTERACTIVE_DEBUG=true
```

### Vypnutí:
```bash
unset INTERACTIVE_DEBUG
# nebo
export INTERACTIVE_DEBUG=false
```

## 🎯 Použití ve vývoji

### Pro debugging konkrétního problému:
1. Aktivuj interactive debugging
2. Spusť robota
3. Počkej na problém 
4. Stiskni [s] pro debug report
5. Analyzuj report a oprav problém

### Pro monitoring produkčního běhu:
1. Nech interactive debugging vypnutý
2. V případě problémů dočasně aktivuj
3. Vytvoř report pro konkrétní chybu
4. Vypni zpět pro normální běh

## 🚨 Upozornění

- Interactive debugging **zpomaluje** běh robota
- Používej jen pro **debugging**, ne pro produkci
- Reports mohou obsahovat **citlivé údaje** - chraň je
- Při [s] se robot **úplně zastaví** - je potřeba restart

## 📋 Příklady použití

### Debugging login problémů:
```bash
INTERACTIVE_DEBUG=true node ivy.js
# Když dojde k login problému -> [s]
# Analyzuj screenshot a DOM pro příčinu
```

### Monitoring nových features:
```bash
export INTERACTIVE_DEBUG=true
./start.sh
# Sleduj nové funkce a zachyť problémy
```

### Jednorázový test:
```bash
INTERACTIVE_DEBUG=true npm start
# Pro rychlý test s debugging podporou
```