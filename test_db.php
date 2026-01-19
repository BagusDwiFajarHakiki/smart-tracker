<?php
require_once 'db_connect.php';

try {
    echo "Checking database connection...\n";
    
    // Check if table exists
    $stmt = $pdo->query("SELECT * FROM tracker_status WHERE id=1");
    $row = $stmt->fetch();
    
    if ($row) {
        echo "SUCCESS: Database connected and table found.\n";
        echo "Current Data: " . json_encode($row) . "\n";
    } else {
        echo "WARNING: Table exists but no row with id=1 found. Attempting to insert...\n";
        $pdo->exec("INSERT INTO tracker_status (id) VALUES (1)");
        echo "INSERTED default row.\n";
    }
} catch (PDOException $e) {
    echo "ERROR: Database error: " . $e->getMessage() . "\n";
}
?>
