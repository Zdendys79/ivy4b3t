# Group Explore Action - Dokumentace

## Základní charakteristiky

### A) needsUtio: false
- **Znamená:** Akce nepotřebuje otevřenou záložku UTIO pro své provedení
- **Neznamená:** Že je pouze záložní akce

### B) Neinvazivní akce
- **Význam:** Může běžet mezi invazivními akcemi na vyplnění času
- **Využití:** Aktivní činnost když čekáme na cooldown invazivních akcí

### C) Spouštění
- **Metoda:** Standardní losování podle váhy na kole štěstí
- **Frekvence:** Dostupná stále, ne pouze když nejsou posting akce
- **Priorita:** Podle nastavené váhy v systému

## Workflow akce

### 1. Navigační systém (2 úrovně)
```
Cache → Feed loading
```

**A) Cache navigace:**
- Použije `global.groupUrlsCache` s uloženými URL
- Vybere náhodnou skupinu, odebere z cache
- Rychlá navigace bez načítání feedu

**B) Feed loading:**
- Naviguje na `https://www.facebook.com/groups/feed/`
- Scrolluje 3x pro načtení více skupin
- Extrahuje všechny group URL, ukládá do cache
- Pak naviguje na náhodnou skupinu z cache

**❌ Žádný fallback** - dodržuje absolutní zákaz legacy funkcí

### 2. Analýza skupiny
- **Extrahuje název skupiny** (prioritní pro kategorizaci)
- **Zjistí počet členů**
- **Typ vždy = Z** (operátoři B3 přeřadí ručně)
- **Uloží do tabulky fb_groups**

### 3. Prohlížecí aktivity (nová procenta)
- **60%** - scrollování a "čtení" příspěvků
- **30%** - prozkoumat členy skupiny  
- **10%** - ukončit
- **0%** - navigace na další skupinu (řeší wheel, ne duplikace)

### 4. Session management
- **Sledování:** Každá prohlížecí aktivita se provede max 1x v session
- **Limit průzkumů:** 10-15 průzkumů na session
- **Reset:** Po vyčerpání session reset a plánování za 30-60 minut

### 5. Plánování dalšího spuštění

**Běžný průzkum:**
- **Úspěch:** 3-8 minut
- **Chyba:** 1-3 minuty (retry)

**Session dokončena:**
- **Pauza:** 30-60 minut před další session
- **Důvod:** Prevence over-exploration

## Kolo štěstí - ukončování

**Kolo štěstí se ukončí když:**
- Jsou vyčerpány všechny invazivní akce
- Překročené limity + naplánované v budoucnosti
- **Následuje přechod na:** account_sleep / account_delay akce

## Technické detaily

### Global proměnné
```javascript
global.groupUrlsCache = []; // Cache pro group URLs
global.exploreSession = {   // Session tracking
  [userId]: {
    completedActivities: [],
    explorationCount: 0
  }
};
```

### Typy skupin
- **G** = cizí skupina pro UTIO příspěvky (nevlastníme)
- **GV** = vlastní skupina B3 (vlastníme, správce z B3)
- **P** = prodejní skupina
- **Z** = zájmová skupina (**všechny nové skupiny prozatím**)

### Databáze
- **Tabulka:** fb_groups
- **Unikátní klíč:** fb_id
- **Auto-typ:** Z pro všechny nové objevené skupiny
- **Přeřazení:** Manuálně operátory B3