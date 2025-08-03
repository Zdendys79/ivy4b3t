# Translation Quality Checker

AI-powered kontrola a vylepšování kvality překladů citátů pomocí Claude API.

## Spuštění

```bash
cd translation-checker
npm start
```

## Funkce

- **Profesionální lingvistický přístup** - posuzuje věrnost, přirozenost, poetičnost a gramatiku
- **Claude Sonnet 3.5** pro nejvyšší kvalitu hodnocení
- **Rate limiting** - 1 citát za 10 minut pro kontrolu nákladů
- **Token monitoring** - sledování spotřeby a nákladů v reálném čase
- **Automatické označování výsledků:**
  - `translation_approved = 1` pro schválené překlady
  - `translation_approved = 0` pro opravené překlady (čekají další kontrolu)  
  - `translation_approved = 2` pro problematické případy
- **Graceful handling** - pokračuje při problémech bez zastavení
- **Detailní statistiky** - míra schválení, průměrné tokeny, odhad nákladů

## Systémové požadavky

- Node.js 18+
- Systémová proměnná `OPENAI_API_KEY` (obsahuje Claude API klíč)
- Přístup k databázi přes systémové proměnné `MYSQL_*`