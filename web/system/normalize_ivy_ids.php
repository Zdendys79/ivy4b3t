<?php
// 📁 Soubor: web/system/normalize_ivy_ids.php
// ✳️ Přečísluje ID a parent_id v tabulce ivy_scheme a resetuje AUTO_INCREMENT

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . 'db_class.php';
$db = new Database ( __DIR__ . '../restricted/db_config.json');

// 1. Načíst všechna data v původním pořadí
$rows = $db->query("SELECT id, parent_id FROM ivy_scheme ORDER BY id ASC");
if (!$rows) {
    echo "❌ Chyba při načítání dat z tabulky ivy_scheme.\n";
    exit;
}

// 2. Vytvořit mapu starých ID na nová
$id_map = [];
$new_id = 1;
foreach ($rows as $row) {
    $id_map[$row['id']] = $new_id++;
}

// 3. Vytvořit dočasnou tabulku a přepsat záznamy s novými ID a parent_id
$db->query("DROP TABLE IF EXISTS ivy_scheme_temp");
$db->query("CREATE TABLE ivy_scheme_temp LIKE ivy_scheme");

foreach ($rows as $row) {
    $data = $db->query("SELECT * FROM ivy_scheme WHERE id = ?", [$row['id']]);
    if (!$data || count($data) === 0) {
        echo "⚠️  Záznam s id {$row['id']} nenalezen.\n";
        continue;
    }
    $d = $data[0];

    $db->query(
        "INSERT INTO ivy_scheme_temp (id, name, type, parent_id, description, status, visible, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $id_map[$d['id']],
            $d['name'],
            $d['type'],
            $d['parent_id'] ? $id_map[$d['parent_id']] : null,
            $d['description'],
            $d['status'],
            $d['visible'],
            $d['position_x'],
            $d['position_y']
        ]
    );
}

// 4. Přepsat tabulku
$db->query("RENAME TABLE ivy_scheme TO ivy_scheme_old");
$db->query("RENAME TABLE ivy_scheme_temp TO ivy_scheme");
$db->query("DROP TABLE ivy_scheme_old");

// 5. Reset AUTO_INCREMENT
$db->query("ALTER TABLE ivy_scheme AUTO_INCREMENT = $new_id");

echo "✅ ID a parent_id byly úspěšně přepsány a tabulka normalizována.\n";
