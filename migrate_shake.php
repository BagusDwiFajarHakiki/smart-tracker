<?php
require_once 'db_connect.php';

try {
    // Add shake_val column if it doesn't exist
    $sql = "ALTER TABLE tracker_status ADD COLUMN shake_val INT DEFAULT 0";
    $pdo->exec($sql);
    echo "Column 'shake_val' added successfully.";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), "Duplicate column name") !== false) {
        echo "Column 'shake_val' already exists.";
    } else {
        echo "Error adding column: " . $e->getMessage();
    }
}
?>
