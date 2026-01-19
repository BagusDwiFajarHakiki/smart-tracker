<?php
// Start output buffering immediately to catch unwanted whitespace/errors
ob_start();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
error_reporting(0);
ini_set('display_errors', 0);

require_once 'db_connect.php';

// Prepare response data
$response = [];
$http_code = 200;

try {
    // Handle POST request (Update Data)
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        if ($data) {
            $lat = isset($data['lat']) ? $data['lat'] : 0;
            $lng = isset($data['lng']) ? $data['lng'] : 0;
            $battery = isset($data['battery']) ? $data['battery'] : 0;
            $wifi = isset($data['wifi']) ? $data['wifi'] : 'Unknown';
            $gps = isset($data['gps']) ? $data['gps'] : 'Unknown';
            $satellites = isset($data['satellites']) ? $data['satellites'] : 0;
            $shock = isset($data['shock']) ? $data['shock'] : 0;
            
            $is_fallen = 0;
            $fall_sql_part = ""; 

            if (isset($data['is_fallen'])) {
                if ($data['is_fallen'] === true || $data['is_fallen'] === "true" || $data['is_fallen'] == 1) {
                    $is_fallen = 1;
                    // Only update fall time if currently falling
                    $fall_sql_part = ", last_fall_time=NOW()"; 
                }
            }

            // UPDATE query
            $sql = "UPDATE tracker_status SET lat=?, lng=?, battery=?, wifi_status=?, gps_status=?, satellites=?, shock_val=?, is_fallen=? $fall_sql_part, last_updated=NOW() WHERE id=1";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$lat, $lng, $battery, $wifi, $gps, $satellites, $shock, $is_fallen]);
            
            $response = ["status" => "success", "message" => "Status updated"];
        } else {
            $http_code = 400;
            $response = ["status" => "error", "message" => "Invalid JSON"];
        }
    }
    // Handle GET request (Read Data)
    else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // [RESET LOGIC]: Check if last_fall_time is from yesterday or older, and reset if so
        // This keeps the DB clean of old 'today's falls' when a new day starts
        $pdo->exec("UPDATE tracker_status SET last_fall_time = NULL WHERE DATE(last_fall_time) < CURDATE()");

        $stmt = $pdo->query("SELECT *, TIMESTAMPDIFF(SECOND, last_updated, NOW()) as seconds_ago FROM tracker_status WHERE id=1");
        $row = $stmt->fetch();

        if ($row) {
            $response = [
                "lat" => (float)$row['lat'],
                "lng" => (float)$row['lng'],
                "battery" => (int)$row['battery'],
                "wifi" => $row['wifi_status'],
                "gps" => $row['gps_status'],
                "satellites" => (int)$row['satellites'],
                "shock" => (int)$row['shock_val'], // [BARU]
                "is_fallen" => (bool)$row['is_fallen'],
                "last_fall_time" => $row['last_fall_time'], // [BARU]
                "timestamp" => $row['last_updated'],
                "seconds_ago" => (int)$row['seconds_ago']
            ];
        } else {
            // Default empty response
            $response = [
                "lat" => 0, "lng" => 0, "battery" => 0, "wifi" => "Disconnected",
                "gps" => "Searching", "satellites" => 0, "shock" => 0, 
                "is_fallen" => false, "last_fall_time" => null, 
                "timestamp" => "No Data"
            ];
        }
    } else {
        $http_code = 405;
        $response = ["status" => "error", "message" => "Method not allowed"];
    }

} catch (Exception $e) {
    $http_code = 500;
    $response = ["status" => "error", "message" => "Server error: " . $e->getMessage()];
}

// CLEAN BUFFER: Discard anything printed before this point!
ob_clean();

// Send valid response
http_response_code($http_code);
echo json_encode($response);
