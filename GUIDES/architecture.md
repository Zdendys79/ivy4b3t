# Architecture Guide - IVY4B3T System

## Spouštění IVY aplikace na serveru

### Přímé spuštění s grafickým výstupem
```bash
# Přejít do projektové složky s moduly
cd /home/remotes/ivy4b3t/ivy

# Spustit s grafickým výstupem na Chrome Remote Desktop
DISPLAY=:20 node ivy.js

# Pro delší běh s timeoutem (např. 10 minut)
DISPLAY=:20 timeout 600s node ivy.js
```

### Poznámky k spouštění
- **Grafický výstup** směřuje na Chrome Remote Desktop (DISPLAY=:20)
- **Node.js moduly** jsou nainstalovány v projektové složce ivy/
- **Prohlížeč se otevře** na vzdálené ploše pro ruční ovládání
- **UI příkazy** se zpracovávají automaticky (testovací uživatel Aster Sloh ID: 999)
- **Normální provoz** pokračuje losováním akcí po dokončení UI příkazů

## Systémové požadavky

- **Font Noto Mono** MUSÍ být nainstalován pro správné zobrazení ikon v terminálu
- **OSTATNÍ Noto fonty nejsou potřeba** - pouze Noto Mono postačuje
- Bez tohoto fontu se ikony zobrazují jako čtverečky s čísly

## Code Maintenance Principles

- **YAGNI, KISS, DRY, Single Responsibility**
- **ECMAScript 2022 (ES13) standards** - Node.js 22 LTS
- **ALWAYS add comprehensive comments** explaining WHY, not WHAT
- **Naming:** camelCase functions, PascalCase classes, snake_case variables, kebab-case files

## Deployment struktura

- **Vývojový PC:** `/home/remotes/ivy4b3t/ivy` - celý projekt pro vývoj
- **VM produkce:** `/home/remotes/ivy` - jen složka ivy pro běh aplikace
- **Git synchronizace:** VM stahuje z `/home/remotes/git/ivy4b3t` do `/home/remotes/ivy`

## Workflow Zásady

### Základní Postup (NEMĚNIT)
1. **Zdendys předává myšlenky/požadavky** → Já je zpracovávám
2. **Implementuji do kódu** → Zdendys hodnotí výsledky
3. **Zpětná vazba/opravy** → Iterace až do úspěchu

### Pravidla pro Lepší Výkon
- Vždy nejprve ANALYZOVAT co se požaduje
- Pak NAPLÁNOVAT postup (TODO list pokud komplexní)
- Poté IMPLEMENTOVAT po malých krocích
- Nakonec OVĚŘIT funkcionalitu

### POVINNÉ: Použití PROJECT_MAP.md
- **VŽDY ČÍST PROJECT_MAP.md před složitými úkoly**
- Místo dlouhého hledání souborů použít mapu pro rychlou orientaci
- Když nevím kde je komponenta → PROJECT_MAP.md → pak teprve hledat
- Při změnách architektury aktualizovat PROJECT_MAP.md