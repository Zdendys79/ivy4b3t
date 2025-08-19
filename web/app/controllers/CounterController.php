<?php
/**
 * File: CounterController.php
 * Location: ~/web/app/controllers/CounterController.php
 *
 * Purpose: Controller pro zobrazení Septem Segmenta countdown timeru
 *          Přijímá URL ve formátu /counter/{number} a zobrazuje odpočítávání
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

require_once dirname(__DIR__) . '/core/BaseController.php';

class CounterController extends BaseController
{
    /**
     * Zobrazí Septem Segmenta countdown displej s daným číslem
     */
    public function display()
    {
        try {
            // Získej číslo z URL parametru
            $number = $_GET['number'] ?? 0;
            $number = (int)$number;
            
            // Validace - minimum 1 sekunda
            if ($number < 1) {
                $number = 1;
            }
            
            // JavaScript má MAX_SAFE_INTEGER limit
            $max_js_number = 9007199254740991;
            if ($number > $max_js_number) {
                $number = $max_js_number;
            }
            
            // Příprava dat pro view
            $countdown_data = [
                'number' => $number,
                'title' => "Counter: " . number_format($number),
                'formatted_number' => number_format($number)
            ];
            
            // Render view bez autentifikace a bez layoutu
            $this->render('counter/display', $countdown_data, false, false);
            
        } catch (Exception $e) {
            http_response_code(500);
            die("Counter Error: " . $e->getMessage());
        }
    }
}