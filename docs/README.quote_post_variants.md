# Quote Post Akce - Varianty zobrazení citátů

## Přehled

Quote post akce podporuje **3 náhodné varianty** zobrazení citátů podle dostupnosti originálního textu a českého překladu. Systém automaticky vybere nejvhodnější variantu pro maximální rozmanitost a přirozenost postů.

## Struktura dat v databázi

```sql
quotes:
- text: český překlad/originál
- original_text: originální text (NULL = text je originál)  
- language_code: kód jazyka originálu (FK na c_languages)
- author: autor citátu (volitelný)
```

## Varianty zobrazení

### **Varianta 1: Pouze český překlad** 
*Používá se když: original_text je NULL nebo když náhodně vybrána*

```
Představivost je důležitější než znalosti.

- Albert Einstein
```

**Logika:**
- Zobrazí pouze `text` (český překlad/originál)
- Na konci autor (pokud je známý)
- Nejkratší a nejčitelnější varianta

---

### **Varianta 2: Originál + český překlad**
*Používá se když: original_text existuje a náhodně vybrána*

```
"Imagination is more important than knowledge."

Představivost je důležitější než znalosti.

- Albert Einstein
```

**Logika:**
- První řádek: `original_text` v uvozovkách
- Druhý řádek: prázdný (oddělovač)
- Třetí řádek: `text` (český překlad)
- Na konci autor (pokud je známý)
- Nejautentičtější varianta

---

### **Varianta 3: Pouze originál**
*Používá se když: original_text existuje a náhodně vybrána*

```
"Imagination is more important than knowledge."

- Albert Einstein
```

**Logika:**
- Zobrazí pouze `original_text` v uvozovkách
- Na konci autor (pokud je známý)
- Pro mezinárodní publikum a autenticitu

## Algoritmus výběru varianty

```javascript
function selectQuoteVariant(quote) {
    // Pokud není originální text, použij pouze český
    if (!quote.original_text) {
        return 'czech_only';
    }
    
    // Náhodný výběr mezi 3 variantami pro originály
    const variants = ['czech_only', 'original_plus_czech', 'original_only'];
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
}
```

## Výhody systému

### **Rozmanitost**
- Každý post vypadá jinak
- Prevence monotónnosti
- Zachovává čtenářův zájem

### **Flexibilita**
- Podporuje citáty v jakémkoli jazyce
- Funguje i s pouze českými citáty
- Adaptabilní na budoucí rozšíření

### **Autenticita**
- Zachovává originální znění slavných citátů
- Respektuje původní jazyk autora
- Poskytuje český překlad pro pochopení

### **Engagement**
- Mix jazyků přitahuje různé cílové skupiny
- Originály působí sofistikovaně
- České překlady jsou přístupné všem

## Příklady ze systému

### **Francouzský citát - Descartes**
```sql
original_text: "Je pense, donc je suis"
text: "Myslím, tedy jsem"
language_code: "fra"
author: "René Descartes"
```

**Možné zobrazení:**
- Varianta 1: "Myslím, tedy jsem. - René Descartes"
- Varianta 2: "Je pense, donc je suis" + "Myslím, tedy jsem. - René Descartes"  
- Varianta 3: "Je pense, donc je suis. - René Descartes"

### **Latinsky citát - Caesar**
```sql
original_text: "Veni, vidi, vici"
text: "Přišel jsem, viděl jsem, zvítězil jsem"
language_code: "lat"
author: "Gaius Julius Caesar"
```

### **Český originál - bez překladu**
```sql
original_text: NULL
text: "Hledali jsme štěstí a našli jsme sebe"
language_code: "ces"
author: "John Lennon"
```

**Zobrazení:** Pouze Varianta 1 (česky)

## Implementace v kódu

Varianta se volí v `QuotePostAction.step3_insertContent()` metodě:

```javascript
// 1. Vybrat variantu
const variant = this.selectDisplayVariant(quote);

// 2. Sestavit text podle varianty
const textToType = this.buildQuoteText(quote, variant);

// 3. Napsat lidským způsobem
await humanBehavior.typeLikeHuman(fbBot.page, textToType, 'quote_writing');
```

Tento systém zajišťuje **maximální rozmanitost a přirozenost** Facebook postů s citáty.