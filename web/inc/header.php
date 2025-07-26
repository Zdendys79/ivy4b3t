<?php
/**
 * Název souboru: header.php
 * Umístění: ~/web/inc/header.php
 * 
 * Popis: Společná hlavička pro PHP stránky
 */

// Nastavení českého locale
setlocale(LC_TIME, 'cs_CZ.UTF-8');

// Nastavení timezone
date_default_timezone_set('Europe/Prague');

// Zabránění cache
header("Cache-Control: no-cache, must-revalidate");
header("Pragma: no-cache");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");
?>