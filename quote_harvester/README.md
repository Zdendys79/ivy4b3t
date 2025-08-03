# Quote Harvester

Automatický systém pro sběr, validaci a import citátů z různých internetových zdrojů.

## Rychlý start

```bash
# Instalace závislostí
npm install

# Spuštění harvestingu
npm run harvest

# Zobrazení statistik
npm run stats
```

## Dostupné příkazy

```bash
node harvester.js --run              # Kompletní harvesting
node harvester.js --stats-only       # Pouze statistiky
node harvester.js --validate-only    # Validace existujících citátů
node harvester.js --sources          # Seznam zdrojů
node harvester.js --test-connection  # Test databáze
node harvester.js --help            # Nápověda
```

## Funkce

- ✅ **Vícejazyčná podpora** - 10 aktivních jazyků
- ✅ **Automatická detekce duplicit** - Hash + Levenshtein distance
- ✅ **Validace kvality** - Filtrování spam a nevhodného obsahu
- ✅ **Detekce jazyka** - Automatické rozpoznání jazyka citátu
- ✅ **Rate limiting** - Respektování robots.txt a API limitů
- ✅ **Databázová integrace** - Automatický import do IVY4B3T

## Zdroje

- **Quotable.io** - API s anglickými citáty
- **Wikiquote** - Web scraping pro 6 jazyků
- **BrainyQuote** - Motivační citáty
- **České zdroje** - Přísloví a překlady

## Očekávané výsledky

Po jednom spuštění: **~950 nových citátů** (po filtrování duplicit)

Více informací v [dokumentaci](../docs/README.quote_harvester.md).