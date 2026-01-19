CREATE DATABASE IF NOT EXISTS smart_tracker;

USE smart_tracker;

-- We don't need logs for this use case, just the CURRENT status
DROP TABLE IF EXISTS tracker_logs;

CREATE TABLE IF NOT EXISTS tracker_status (
    id INT PRIMARY KEY,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    battery INT,
    wifi_status VARCHAR(50),
    gps_status VARCHAR(50),
    satellites INT DEFAULT 0,
    is_fallen BOOLEAN,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initialize with one row (ID=1)
INSERT IGNORE INTO tracker_status (id, lat, lng, battery, wifi_status, gps_status, satellites, is_fallen) 
VALUES (1, 0, 0, 0, 'Disconnected', 'Searching', 0, 0);
