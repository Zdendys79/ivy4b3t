# 🐛 Interactive Debugging System

Systém pro interaktivní debugging umožňuje automatické zastavení při chybách a varováních s možností vytvoření debug reportu.

## ✨ Funkce

- **Automatické zastavení** při chybách a varováních
- **Interaktivní volby** - [s] Stop, [c] Continue, [d] Disable
- **Automatické kopírování DOM** a screenshot
- **Uživatelské komentáře** k chybám
- **Kompletní debug report** s kontextem

## 🚀 Aktivace

Interactive debugging je **vždy aktivní** jako integrální součást aplikace.
Není potřeba žádná speciální aktivace - systém se spouští automaticky.

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

## 💾 Database Storage

Debug incidents se ukládají přímo do sdílené databáze v tabulce `debug_incidents`:

### Tabulka obsahuje:
- **Basic Info**: incident_id, timestamp, user_id, error_level, error_message
- **Page Data**: page_url, page_title, user_agent
- **Binary Data**: screenshot_data (PNG), dom_html, console_logs  
- **User Input**: user_comment, user_analysis_request
- **System Data**: system_info, stack_trace
- **Analysis**: status, analyzed_by, analysis_notes, resolution_notes

## 📝 Uživatelský komentář

Po stisknutí [s] se zobrazí prompt:
```
📝 Please describe what went wrong (press Enter twice to finish):
```

**Jak psát text:**
- **Enter** - nový řádek v textu
- **Dvojitý Enter** (prázdný řádek) - dokončí vstup

Můžeš napsat popis problému, například:
```
Uživatel nemohl být přihlášen na Facebook.
Stránka zobrazovala captcha která nebyla vyřešena.
Možná je potřeba ruční verifikace účtu.

[Enter - prázdný řádek]
[Enter - dokončí vstup]
```

## 🔍 Analýza Incidents

### SQL Queries for Analysis:
```sql
-- List recent incidents
SELECT * FROM debug_incidents_summary ORDER BY timestamp DESC LIMIT 10;

-- Get specific incident with all data
SELECT * FROM debug_incidents WHERE incident_id = 'YOUR_INCIDENT_ID';

-- Screenshots analysis (Claude can analyze these!)
SELECT incident_id, user_comment, user_analysis_request, LENGTH(screenshot_data) as size 
FROM debug_incidents WHERE screenshot_data IS NOT NULL;

-- DOM analysis for Facebook issues
SELECT incident_id, page_url, LEFT(dom_html, 500) as dom_preview 
FROM debug_incidents WHERE dom_html LIKE '%facebook%';
```

## ⚙️ Konfigurace

### Timeout pro rozhodnutí:
Defaultně 30 sekund, po kterých automaticky pokračuje.

### Automatické spuštění:
Debugging je vždy aktivní - žádná konfigurace není potřeba.

### Dočasné vypnutí:
Pokud je potřeba dočasně vypnout debugging, lze použít volbu [d] během běhu.

## 🎯 Použití ve vývoji

### Pro debugging konkrétního problému:
1. Spusť robota (debugging je vždy aktivní)
2. Počkej na problém 
3. Stiskni [s] pro debug report
4. Analyzuj report a oprav problém

### Pro monitoring produkčního běhu:
1. Debugging běží automaticky na pozadí
2. Při problémech se zobrazí interaktivní volby
3. Stiskni [s] pro vytvoření debug reportu
4. Nebo [c] pro pokračování bez reportu

## 🚨 Upozornění

- Interactive debugging **zpomaluje** běh robota
- Používej jen pro **debugging**, ne pro produkci
- Reports mohou obsahovat **citlivé údaje** - chraň je
- Při [s] se robot **úplně zastaví** - je potřeba restart

## 📋 Příklady použití

### Debugging login problémů:
```bash
./start.sh
# Když dojde k login problému -> [s]
# Analyzuj screenshot a DOM pro příčinu
```

### Monitoring nových features:
```bash
./start.sh
# Sleduj nové funkce a zachyť problémy
# Debugging běží automaticky
```

### Jednorázový test:
```bash
npm start
# Debugging je vždy aktivní
```