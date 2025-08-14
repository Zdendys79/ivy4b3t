<?php

class QuotesController extends BaseController
{
    /**
     * Main quotes page with filtering options
     */
    public function index()
    {
        try {
            // Get filter and page from query parameters
            $filter = $_GET['filter'] ?? 'czech';
            $page = max(1, intval($_GET['page'] ?? 1));
            
            // Validate filter
            if (!in_array($filter, ['czech', 'approved', 'untranslated'])) {
                $filter = 'czech';
            }
            
            // Check if this is an AJAX request for more quotes
            $isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && 
                     strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
            
            $pdo = $this->db->getPdo();
            $quotes = $this->getQuotesWithFilter($pdo, $filter, $page);
            
            if ($isAjax) {
                // Return JSON for AJAX requests
                $totalCount = $this->getTotalQuotesCount($pdo, $filter);
                $perPage = 100;
                $hasMore = ($page * $perPage) < $totalCount;
                
                $this->json([
                    'quotes' => $quotes,
                    'hasMore' => $hasMore,
                    'nextPage' => $page + 1
                ]);
            } else {
                // Get statistics for all categories
                $stats = $this->getQuotesStatistics($pdo);
                
                $this->render_partial('quotes/index', [
                    'title' => 'Citáty - IVY4B3T',
                    'quotes' => $quotes,
                    'current_filter' => $filter,
                    'stats' => $stats
                ]);
            }
            
        } catch (Exception $e) {
            if (isset($_SERVER['HTTP_X_REQUESTED_WITH'])) {
                $this->json(['error' => $e->getMessage()], 500);
            } else {
                http_response_code(500);
                echo "Error: " . htmlspecialchars($e->getMessage());
            }
        }
    }
    
    /**
     * Get quotes based on filter
     */
    private function getQuotesWithFilter($pdo, $filter, $page = 1)
    {
        $perPage = 100;
        $offset = ($page - 1) * $perPage;
        
        switch ($filter) {
            case 'czech':
                $query = "
                    SELECT id, original_text as quote_text, author, language_code
                    FROM quotes 
                    WHERE language_code = 'ces'
                    ORDER BY id DESC
                    LIMIT ? OFFSET ?
                ";
                break;
                
            case 'approved':
                $query = "
                    SELECT id, translated_text as quote_text, author, language_code
                    FROM quotes 
                    WHERE translation_approved = 1 AND translated_text IS NOT NULL
                    ORDER BY id DESC
                    LIMIT ? OFFSET ?
                ";
                break;
                
            case 'untranslated':
                $query = "
                    SELECT id, original_text as quote_text, author, language_code
                    FROM quotes 
                    WHERE (translation_approved = 0 OR translated_text IS NULL) 
                    AND language_code != 'ces'
                    ORDER BY id DESC
                    LIMIT ? OFFSET ?
                ";
                break;
                
            default:
                throw new Exception("Invalid filter: " . $filter);
        }
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$perPage, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get total count of quotes for filter
     */
    private function getTotalQuotesCount($pdo, $filter)
    {
        switch ($filter) {
            case 'czech':
                $query = "SELECT COUNT(*) as count FROM quotes WHERE language_code = 'ces'";
                break;
                
            case 'approved':
                $query = "SELECT COUNT(*) as count FROM quotes WHERE translation_approved = 1 AND translated_text IS NOT NULL";
                break;
                
            case 'untranslated':
                $query = "SELECT COUNT(*) as count FROM quotes WHERE (translation_approved = 0 OR translated_text IS NULL) AND language_code != 'ces'";
                break;
                
            default:
                throw new Exception("Invalid filter: " . $filter);
        }
        
        $stmt = $pdo->prepare($query);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    }
    
    /**
     * Get statistics for all quote categories
     */
    private function getQuotesStatistics($pdo)
    {
        $stats = [];
        
        // Czech quotes
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM quotes WHERE language_code = 'ces'");
        $stmt->execute();
        $stats['czech'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        // Approved translations
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM quotes WHERE translation_approved = 1 AND translated_text IS NOT NULL");
        $stmt->execute();
        $stats['approved'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        // Untranslated/unapproved
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM quotes WHERE (translation_approved = 0 OR translated_text IS NULL) AND language_code != 'ces'");
        $stmt->execute();
        $stats['untranslated'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        return $stats;
    }
}