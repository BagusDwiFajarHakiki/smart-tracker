<?php
require_once 'db_connect.php';

try {
    $pdo->exec("ALTER TABLE tracker_status ADD COLUMN shock_val INT DEFAULT 0");
    echo "Added 'shock_val' column.<br>";
} catch (PDOException $e) {
    echo "Column 'shock_val' likely exists or error: " . $e->getMessage() . "<br>";
}

try {
    $pdo->exec("ALTER TABLE tracker_status ADD COLUMN last_fall_time DATETIME DEFAULT NULL");
    echo "Added 'last_fall_time' column.<br>";
} catch (PDOException $e) {
    echo "Column 'last_fall_time' likely exists or error: " . $e->getMessage() . "<br>";
}

echo "Migration Complete.";
?>
