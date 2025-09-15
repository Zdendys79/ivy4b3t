# Správa Facebook skupin - Dokumentace

## Typy skupin
- **G** = Cizí skupina pro UTIO příspěvky (nevlastníme)
- **GV** = Vlastní skupina - B3 vlastní, správce z B3 (vlastníme)
- **P** = Prodejní skupina (zatím neřešíme)
- **Z** = Zájmová skupina (speciální obsah, ne realitní příspěvky)

## Pravidla výběru skupiny pro postování

### Algoritmus výběru (`getSingleAvailableGroup`)

Systém vybírá skupinu podle následujících priorit:

1. **Nejstarší next_seen** - Skupiny s nejstarším cooldownem mají absolutní přednost
   - NULL hodnoty jsou považovány za '1970-01-01' (okamžitě dostupné)
   - Zajišťuje spravedlivé rozložení mezi všemi skupinami

2. **Nejvyšší priorita** - Při shodném next_seen
   - Priority 1-5 (5 = nejvyšší)
   - Priority 0 = neaktivní skupina (nevybírá se)

3. **Náhodný výběr** - Při shodě času i priority
   - Rozložení zátěže mezi identické skupiny
   - Prevence opakovaného používání stejné skupiny

### SQL dotaz
```sql
SELECT g.*
FROM fb_groups g
LEFT JOIN user_groups ug ON g.id = ug.group_id AND ug.user_id = ?
WHERE g.type = ?
  AND g.priority > 0
  AND (g.next_seen IS NULL OR g.next_seen <= NOW())
  AND (ug.blocked_until IS NULL OR ug.blocked_until <= NOW())
ORDER BY 
  CASE WHEN g.next_seen IS NULL THEN '1970-01-01' ELSE g.next_seen END ASC,
  g.priority DESC,
  RAND()
LIMIT 1
```

### Podmínky výběru
- **Správný typ** (G nebo GV podle akce)
- **Aktivní priorita** (> 0)
- **Vypršelý cooldown** (next_seen <= NOW nebo NULL)
- **Neblokovaná pro uživatele** (user_groups.blocked_until <= NOW nebo žádný záznam)

## Cooldown systém

### Výpočet cooldownu (`GroupCooldownCalculator`)

**Vzorec:** `1_000_000 / Math.pow(Math.log10(clamped_members), k)`
- k ≈ 6.64
- Clampování: min 50, max 10000 členů

**Příklady:**
- 100 členů → ~10000 minut (7 dní)
- 1000 členů → ~1000 minut (17 hodin)
- 10000 členů → ~100 minut (1.7 hodiny)

### Priority multiplikátory
- Priority 1: 2.0× delší cooldown
- Priority 2: 1.5× delší
- Priority 3: 1.0× normální
- Priority 4: 0.67× kratší
- Priority 5: 0.5× velmi krátký

### Nastavení cooldownu
- Po úspěšném postu se automaticky nastaví next_seen
- Pro hodnoty > 1440 minut (24h) používá HODINY
- Pro kratší intervaly používá MINUTY

## Blokování skupin (user_groups)

### Důvody blokování
1. **Group join cooldown** - Cooldown na připojení ke skupině
2. **Navigation timeout** - Timeout při navigaci na skupinu
3. **Cannot find post input** - Nenalezeno vstupní pole pro příspěvek
4. **Facebook checkpoint** - Bezpečnostní kontrola Facebooku
5. **Post failed** - Selhání publikování příspěvku

### Doba blokování
- Standardně 24 hodin pro chyby skupiny
- Žádné blokování pro systémové chyby (FB checkpoint)
- Automatické odblokovnání po vypršení blocked_until

## Statistiky

### Aktuální stav (září 2025)
- **1914 skupin** typu G/GV celkem
- **822 skupin (43%)** připraveno k okamžitému použití
- **31 skupin (1.6%)** aktuálně blokovaných
- **620 skupin (32%)** má historii blokování

### Monitoring
- Skupiny s NULL v next_seen = okamžitě dostupné
- Skupiny s next_seen < NOW() = cooldown vypršel
- Skupiny s next_seen > NOW() = v cooldownu

## Maintenance

### Reset cooldownů
```sql
UPDATE fb_groups
SET next_seen = NOW()
WHERE type IN ('G', 'GV')
  AND next_seen > NOW() + INTERVAL 30 DAY;
```

### Vyčištění starých blokování
```sql
DELETE FROM user_groups
WHERE blocked_until < NOW() - INTERVAL 30 DAY;
```