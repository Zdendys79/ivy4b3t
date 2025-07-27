## Analýza souboru `web/restricted/ivy_data_full.sql`

### Účel a chování
Soubor `ivy_data_full.sql` slouží k vložení výchozích dat do nově vytvořených tabulek systému Ivy4B3T. Tato data jsou převáděna z původní databáze `utiolite` a zajišťují, že systém má základní sadu uživatelů, skupin, příkazů, citátů, URL a dalších konfiguračních dat pro svůj provoz.

### Klíčové vlastnosti a komponenty

1.  **Nastavení relace:**
    *   `USE ivy;`: Určuje, že následující SQL příkazy se mají provádět v databázi `ivy`.
    *   `SET NAMES utf8mb4;`, `SET time_zone = '+00:00';`, `SET foreign_key_checks = 0;`, `SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';`: Nastavuje parametry relace pro správné zpracování dat a zabránění chybám během vkládání dat. `foreign_key_checks = 0` je klíčové pro import dat do tabulek s cizími klíči, aniž by se muselo řešit pořadí vkládání.

2.  **Převod dat z `utiolite`:**
    *   **`fb_users`:** Vkládá data uživatelů z `utiolite.fb_users` do `ivy.fb_users`.
    *   **`fb_groups`:** Vkládá data skupin z `utiolite.fb_groups` do `ivy.fb_groups`.
    *   **`ui_commands`:** Vkládá data UI příkazů z `utiolite.ui_commands` do `ivy.ui_commands`.
    *   **`ivy.quotes`:** Vkládá data citátů z `utiolite.statements` do `ivy.quotes`. (Poznámka: `utiolite.statements` je starší název tabulky pro citáty).
    *   **`urls`:** Vkládá data URL z `utiolite.urls` do `ivy.urls`.
    *   **`variables`:** Vkládá data systémových proměnných z `utiolite.variables` do `ivy.variables`.
    *   **`c_regions`, `c_portals`, `c_districts`:** Kopíruje data číselníků z `utiolite` do `ivy`.

3.  **Vložení dat do `scheme`:**
    *   Vkládá výchozí data do tabulky `scheme`, která popisuje strukturu celého systému Ivy4B3T. Tato data jsou používána pro vizualizaci a organizaci komponent projektu.

4.  **Výchozí limity pro uživatele:**
    *   Vkládá výchozí limity postování (`user_group_limits`) pro všechny existující uživatele v tabulce `fb_users`. Definuje limity pro různé typy skupin (G, GV, P, Z) a časová okna. Používá `UNION ALL` pro vložení limitů pro všechny typy skupin najednou.

### Předpokládané požadavky a odchylky

*   **Závislosti:** Spoléhá se na existenci databáze `utiolite` a jejích tabulek se správnou strukturou pro převod dat. Také vyžaduje, aby tabulky v databázi `ivy` již existovaly (byly vytvořeny skriptem `ivy_create_full.sql`).
*   **Chování:** Skript je navržen pro jednorázové spuštění během migrace. Je důležité, aby byl spuštěn po vytvoření schématu a před spuštěním aplikace, aby byla zajištěna dostupnost potřebných dat.

### Zjištěný stav
Soubor `ivy_data_full.sql` je komplexní a dobře strukturovaný. Zajišťuje, že nová databáze Ivy4B3T je naplněna relevantními daty z předchozí verze systému. Převod dat z `utiolite` je klíčový pro migraci a kontinuitu provozu. Vložení výchozích limitů a dat schématu je důležité pro okamžitou funkčnost systému po instalaci.

---