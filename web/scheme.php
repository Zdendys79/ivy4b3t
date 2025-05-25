<?php
// scheme.php (web/scheme.php)
// Výpis stromu systému z databáze ivy.scheme ve formátu ASCII v HTML5

require_once __DIR__ . '/system/db_class.php';

// Připojení k databázi pomocí existující třídy
$db = new DbClass();
$db->connect();

$query = "SELECT * FROM scheme ORDER BY id";
$result = $db->query($query);

$items = [];
while ($row = $result->fetch_assoc()) {
    $items[$row['id']] = $row;
}

// Rekurzivní ASCII výpis stromu podle prefixů ID (každý stupeň = další znak)
function print_tree($id, $items, $prefix = '', $is_last = true, &$lines = []) {
    $line_prefix = $prefix;
    if ($prefix !== '') {
        $line_prefix .= $is_last ? '└─ ' : '├─ ';
    }
    $label = $items[$id]['name'] . ' [' . $items[$id]['type'] . ']';
    if (!empty($items[$id]['description'])) {
        $label .= ' – ' . $items[$id]['description'];
    }
    $lines[] = $line_prefix . $label;
    // Najdi podřízené položky podle prefixu ID a větší délky:
    $children = [];
    foreach ($items as $child_id => $item) {
        if (strlen($child_id) == strlen($id) + 1 && strpos($child_id, $id) === 0) {
            $children[] = $child_id;
        }
    }
    $count = count($children);
    foreach ($children as $i => $child_id) {
        $new_prefix = $prefix . ($is_last ? '    ' : '│   ');
        print_tree($child_id, $items, $new_prefix, $i === $count - 1, $lines);
    }
}

// Najdi kořeny stromu (nejvyšší prvky = délka 6 znaků)
$root_ids = [];
foreach ($items as $id => $item) {
    if (strlen($id) == 6 && in_array($item['type'], ['osoba', 'MLM', 'systém', 'server', 'database', 'web'])) {
        $root_ids[] = $id;
    }
}

// Vygeneruj celý strom do pole
$lines = [];
foreach ($root_ids as $root_id) {
    print_tree($root_id, $items, '', true, $lines);
}
?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <!--
        Název souboru: scheme.php
        Umístění: web/scheme.php
        Popis: ASCII výpis stromu systému z tabulky ivy.scheme
    -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Strom systému Ivy4B3T</title>
    <style>
        body { font-family: 'Fira Mono', 'Consolas', monospace; background: #f8f9fa; color: #222; margin: 0; padding: 0;}
        main { max-width: 900px; margin: 2em auto; background: #fff; padding: 2em 2.5em 2.5em 2.5em; border-radius: 12px; box-shadow: 0 0 12px #c7c7c744;}
        h1 { font-size: 2.2rem; margin-top: 0; letter-spacing: 1px;}
        pre { background: #f4f4f4; padding: 1.5em; border-radius: 8px; overflow-x: auto; font-size: 1.01em;}
        .note { color: #666; font-size: .98em; margin-bottom: 1.2em;}
    </style>
</head>
<body>
<main>
    <h1>Strom systému Ivy4B3T</h1>
    <div class="note">
        <strong>Automaticky generováno</strong> z tabulky <code>ivy.scheme</code>.<br>
        ASCII struktura znázorňuje hierarchii systému v reálném čase.
    </div>
    <pre><?php
        echo htmlspecialchars(implode("\n", $lines), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?></pre>
</main>
</body>
</html>
