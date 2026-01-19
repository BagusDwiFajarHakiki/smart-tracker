CREATE DATABASE IF NOT EXISTS smart_tracker;

USE smart_tracker;

-- Hapus tabel lama jika ada, agar struktur baru bisa dibuat
DROP TABLE IF EXISTS tracker_logs;

CREATE TABLE IF NOT EXISTS tracker_status (
  `id` int(11) NOT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `battery` int(11) DEFAULT NULL,
  `wifi_status` varchar(50) DEFAULT NULL,
  `gps_status` varchar(50) DEFAULT NULL,
  `satellites` int(11) DEFAULT 0,
  `is_fallen` tinyint(1) DEFAULT NULL,
  `last_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `shock_val` int(11) DEFAULT 0,
  `last_fall_time` datetime DEFAULT NULL
);

INSERT INTO tracker_status 
(id, lat, lng, battery, wifi_status, gps_status, satellites, is_fallen, shock_val, last_fall_time) 
VALUES 
(1, 0, 0, 0, 'Connecting', 'Searching', 0, 0, 0, NULL);