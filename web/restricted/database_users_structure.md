# NOVÁ STRUKTURA DATABÁZOVÝCH UŽIVATELŮ

## Hierarchie přístupů podle bezpečnosti

### 1. **root** - Super admin (pouze lokálně)
- **Host:** localhost pouze
- **Oprávnění:** ALL PRIVILEGES na všechny databáze
- **Účel:** Administrace, vytváření uživatelů, backup
- **Přístup:** Pouze z příkazového řádku serveru

### 2. **claude** - Local full access
- **Host:** localhost pouze  
- **Oprávnění:** ALL PRIVILEGES na všechny databáze (kromě mysql systémových)
- **Účel:** Lokální vývoj, analýza, správa projektů
- **Heslo:** Uloženo v environment variables
- **Environment:** `DB_USER=claude`

### 3. **php** - Local web access  
- **Host:** localhost pouze
- **Oprávnění:** ALL PRIVILEGES na všechny databáze (kromě mysql systémových)
- **Účel:** PHP webové aplikace, Adminer
- **Navrhované heslo:** Nové bezpečné heslo
- **Environment:** `PHP_DB_USER=php, PHP_DB_PASS=nové_heslo`

### 4. **remotes** - Remote limited access
- **Host:** % (odkudkoli) 
- **Oprávnění:** 
  - ALL PRIVILEGES na `ivy` (produkční)
  - ALL PRIVILEGES na `ivy_main` (testovací)
  - ŽÁDNÝ přístup k jiným databázím
- **Účel:** IVY roboti z různých stanic
- **Environment na stanicích:** `DB_USER=remotes`

## Výhody této struktury:

### ✅ **Bezpečnostní separace:**
- **Lokální uživatelé** (claude, php) - plný přístup, ale pouze localhost
- **Vzdálení uživatelé** (remotes) - omezený přístup, ale z internetu

### ✅ **Operační flexibilita:**
- **claude + php** - mohou spravovat všechny databáze lokálně
- **remotes** - mají přístup jen k potřebným ivy databázím

### ✅ **Snadná správa:**
- Jedna role **remotes** pro všechny stanice
- Lokální správa přes **claude** nebo **php**