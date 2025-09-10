# FB Nursery (Školka) - Koncept a implementace

**Datum:** 2025-08-21
**Účel:** Vytvoření systému pro výchovu nových FB účtů
**Status:** V přípravě - fáze dotazů a upřesnění

## 📋 ZÁKLADNÍ KONCEPT

### Cíl:
Vytvoření "školky" pro nové FB účty, které budou postupně prováděny všemi možnými akcemi jako skuteční lidé. FB musí účty akceptovat jako samostatné jedince.

### Integrace:
- **Plnohodnotná součást IVY** - zakomponována do stávajících režimů
- **Worker** - standardní výběr účtů
- **Wheel → Nursery** - pro školkové účty možná záměna wheel za nursery modul
- **Plynulý přechod** - postupné začleňování do běžného provozu

## 👤 POŽADOVANÉ ÚDAJE PRO ÚČET

- **Osobní ID** - jedinečný identifikátor v systému
- **Jméno a příjmení** - existující generátor
- **Datum narození** - existující generátor  
- **Místo narození** - město (potřeba databáze)
- **Aktuální bydliště** - reálná ulice/obec (RUIAN?)
- **Osobní zájmy** - seznam zájmů (potřeba vytvořit)
- **E-mailová adresa** - pro registrace

## 📊 DATABÁZOVÁ STRUKTURA

### Existující tabulky:
- `fb_users` - hlavní tabulka uživatelů
- `behavioral_profiles` - profily chování
- `action_log` - historie akcí (úspěch/neúspěch/kdy/jaká)

### Potřebné úpravy:
- Nové sloupce pro školkové funkce
- Datum založení účtu v systému
- Level účtu a datum přechodu na další úroveň

## 🎯 VÝVOJOVÉ FÁZE ÚČTU

### Stupně vývoje (max 3 úrovně):
1. **Nováček** - čerstvě registrovaný účet
2. **Začátečník** - učí se základní akce
3. **Běžný provoz** - plnohodnotný účet

### Časování:
- **4-6 týdnů v každé fázi** (náhodně s rozlišením dnů)
- Individuální podle behavioral profilu
- Datum přechodu určeno při vstupu do fáze

## 🏠 GEOGRAFICKÁ DATA

### Města a adresy:
- **Částečně v číselníkách c_*** - pouze okresní města
- **RUIAN rejstřík** - https://www.cuzk.gov.cz/ruian/Poskytovani-udaju-ISUI-RUIAN-VDP/Vymenny-format-RUIAN-(VFR).aspx
- **TODO:** Import RUIAN databáze

## 📧 EMAILOVÉ ADRESY

### Formát:
- Náhodná složenina: jméno + příjmení + rok/den narození
- Zkomoleniny a zkratky povoleny
- Přijmout návrhy systémů při registraci

### Poskytovatelé (české):
- ✅ Seznam.cz
- ✅ Post.cz
- ✅ Tiscali.cz
- ✅ Volny.cz
- ✅ Centrum.cz
- ❌ Gmail, Outlook (vyhýbat se)

## ⏱️ ČASOVÁNÍ A LIMITY

### Denní limity:
- Určeny podle typu akcí v tabulce
- Individuální pro každý účet
- **TODO:** Přesná definice limitů

### Pauzy mezi akcemi:
- **Invasive lock:** 2-4 minuty pro invazivní akce
- **Prohlížení/čtení:** Omezeno četností podle behavioral profile
- **Spánkový režim:** `account_delay` a `account_sleep` (respektují denní hodinu)

## 🖥️ TECHNICKÉ ASPEKTY

### Browser profily:
- Každý uživatel má vlastní profil Chromium
- Path profilu = ID uživatele (např. Profile997)
- Puppeteer spouští s user-specific profilem

### Bezpečnost:
- **Cookies:** V režii FB (neřešíme)
- **Detekce podezření:** Analyzátor počítá objekty na stránce
- **CAPTCHA:** Ruční řešení přes interaktivní systém (Nyara-Zdendys)

## 📚 OBSAH VÝCHOVY - DETAILNÍ ROZPIS

### FÁZE 1: NOVÁČEK (týden 1-6)
**Denní limity:**
- **Přátelé:** +2 za den
- **Skupiny:** Všechny dostupné skupiny
- **Příspěvky:** Vlastní jednoduché (AI generované)
- **Profilová fotka:** AI generovaná

**Akce:**
- Vyplnění základního profilu
- Nahrání profilové fotky (AI)
- První příspěvky (osobní, jednoduché)
- Vstup do skupin
- Přidání prvních přátel

### FÁZE 2: ZAČÁTEČNÍK (týden 7-12)  
**Denní limity:**
- **Přátelé:** +1 za den
- **Skupiny:** Pokračování ve vstupech
- **Komentáře:** AI generované (TODO: implementovat)

**Akce:**
- Aktivní komentování (AI)
- Reakce na příspěvky podle obsahu
- Postupné zvyšování aktivity
- ❌ Stories/Reels (není implementováno)
- ❌ Messenger (není implementováno)

### FÁZE 3: BĚŽNÝ PROVOZ (týden 13+)
**Postupné zvyšování limitů:**
- **Vkládání do skupin:** +1 za 3 dny
- **Marketplace:** Prohlížení (TODO: doprogramovat)
- **Události:** Přihlašování (TODO: doprogramovat)

**Plná aktivita:**
- Všechny dostupné implementované akce
- Postupný přechod do produkce

## 🤝 VZÁJEMNÉ INTERAKCE

### Strategie:
- **Vzájemné přátelení:** ANO, ale opatrně
- **Vyhledávání z vnějšku** - aby FB neodhalil propojení
- **Společné skupiny:** ANO, přirozené překryvy

### Generování obsahu:
- **Texty příspěvků:** AI generované
- **Komentáře:** AI generované  
- **⚠️ POZOR:** Limity tokenů!
- **Cíl:** Vyvolat diskusi, ne konflikt
- **Reakce:** Podle obsahu - kontextové

## 🚀 IMPLEMENTAČNÍ PRIORITY

### Musíme doprogramovat:
1. **AI generátor profilových fotek**
2. **Komentování příspěvků** (AI texty)
3. **Messenger konverzace** (základní)
4. **Marketplace prohlížení** (neinvazivní)
5. **Události - přihlašování**
6. **Sdílení příspěvků**

### Později:
- Stories a Reels (komplexnější)
- Pokročilé messenger funkce
- Marketplace aktivní účast

## 📝 DALŠÍ KROKY

1. Dokončit odpovědi na zbývající otázky
2. Navrhnout detailní strukturu nursery modulu
3. Vytvořit interaktivní puppeteer controller
4. Začít s Fází 1: Registrace emailu

---

**Poslední aktualizace:** 2025-08-21
**Verze:** 1.0
**Autor:** Nyara & Zdendys