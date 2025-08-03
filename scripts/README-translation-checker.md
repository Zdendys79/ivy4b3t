# Translation Quality Checker

Skript pro kontrolu a zlepšování kvality překladů citátů pomocí Claude API.

## Instalace

```bash
# Nainstalovat node-fetch pokud není
npm install node-fetch

# Používá existující systémovou proměnnou OPENAI_API_KEY
```

## Spuštění

```bash
# Základní spuštění (používá OPENAI_API_KEY ze systému)
./scripts/translation-quality-checker.js

# Nebo s node
node scripts/translation-quality-checker.js
```

## Funkce

- **Kontroluje kvalitu** existujících překladů
- **Používá Claude Haiku** (nejlevnější model) pro úsporu tokenů
- **Rate limiting** - 1 citát za 10 minut
- **Automaticky aktualizuje** zlepšené překlady v databázi
- **Statistiky** průběhu a výsledků

## Výstup

```
🔍 Kontroluji citát ID 123
📖 Originál: "Life is what happens when you're busy making other plans."
🇨🇿 Překlad: "Život je to co se stane zatímco děláš jiné plány."
✨ Zlepšený překlad: "Život je to, co se děje, zatímco si plánuješ něco jiného."
✅ Překlad aktualizován v databázi
```

## Rate Limiting

- **1 citát za 10 minut** = 144 citátů denně
- **Claude Haiku** = ~$0.01 za 1000 tokenů
- **Denní náklady** ~$1-2 při plném využití

## Ukončení

- `Ctrl+C` pro graceful shutdown
- Zobrazí finální statistiky
- Automaticky uzavře DB připojení