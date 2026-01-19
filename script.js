// Initialize Map
// Initialize Map (Zoom Control Disabled)
const map = L.map('map', { zoomControl: false }).setView([-6.200000, 106.816666], 15);
let userMarker = null;
let routeLine = null;
let isTracking = false;
let watchId = null;
let trackerLat = 0;
let trackerLng = 0;

// Google Maps Hybrid Layer (Satellite + Streets)
L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps'
}).addTo(map);

let marker = L.marker([-6.200000, 106.816666]).addTo(map);

// DOM Elements
const latVal = document.getElementById('lat-val');
const lngVal = document.getElementById('lng-val');
const timestampVal = document.getElementById('timestamp-val');
const batteryLevel = document.getElementById('battery-level');
const batteryText = document.getElementById('battery-text');
const wifiStatus = document.getElementById('wifi-status');
const gpsStatus = document.getElementById('gps-status');
const satellitesVal = document.getElementById('satellites-val');
const connectionBadge = document.getElementById('connection-status');
const systemBadge = document.getElementById('system-badge');
const shockVal = document.getElementById('shock-val');
const lastFallVal = document.getElementById('last-fall-val');
const alertCard = document.getElementById('alert-card');
const btnDismiss = document.getElementById('btn-dismiss');
// AUDIO CONTEXT
let audioCtx = null;
let oscillator = null;
let gainNode = null;
let isAlertActive = false;

const btnTrack = document.getElementById('btn-track');
// btnGmaps removed per user request
const btnFocus = document.getElementById('btn-focus');
const dynamicAlert = document.getElementById('dynamic-alert');

const API_URL = 'api.php';

// --- TRACKING LOGIC ---
btnTrack.addEventListener('click', () => {
    isTracking = !isTracking;
    
    if (isTracking) {
        // START Tracking -> Show STOP button
        btnTrack.innerHTML = '<span class="material-icons-round icon">stop_circle</span> Stop Tracking';
        btnTrack.classList.add('active');
        
        if (navigator.geolocation) {
            const options = {
                enableHighAccuracy: true, // Force GPS
                maximumAge: 0,            // No cache
                timeout: 10000            // Wait up to 10s
            };
            watchId = navigator.geolocation.watchPosition(updateUserLocation, (err) => {
                console.error("GPS Error", err);
                alert("Cannot get your location. Ensure GPS is enabled.");
                stopTracking(); 
            }, options);
        }
    } else {
        stopTracking();
    }
});

function stopTracking() {
    isTracking = false;
    btnTrack.innerHTML = '<span class="material-icons-round icon">my_location</span> Start Tracking';
    btnTrack.classList.remove('active');
    
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }
}

function updateUserLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const userLatLng = [lat, lng];
    
    // Update Blue Dot
    if (!userMarker) {
        userMarker = L.circleMarker(userLatLng, {
            radius: 8,
            fillColor: "#3b82f6",
            color: "#fff",
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);
    } else {
        userMarker.setLatLng(userLatLng);
    }
    
    drawRouteLine(lat, lng);
}

// Debounce routing to avoid hitting API rate limits
let lastRouteTime = 0;

function drawRouteLine(userLat, userLng) {
    if (trackerLat === 0 || trackerLng === 0) return;
    
    // Rate limit: OSRM calls max once every 3 seconds
    const now = Date.now();
    if (now - lastRouteTime < 3000) return;
    lastRouteTime = now;

    // Use OSRM for Road Routing (Walking Profile)
    // Coords format: {lng},{lat};{lng},{lat}
    const osrmUrl = `https://router.project-osrm.org/route/v1/walking/${userLng},${userLat};${trackerLng},${trackerLat}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
        .then(res => res.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                const routeGeoJSON = data.routes[0].geometry;
                
                if (routeLine) {
                    map.removeLayer(routeLine);
                }
                
                routeLine = L.geoJSON(routeGeoJSON, {
                    style: {
                        color: 'var(--accent-color)', // Blue/Theme color
                        weight: 5,
                        opacity: 0.8,
                        dashArray: '10, 10',
                        lineCap: 'round'
                    }
                }).addTo(map);
            }
        })
        .catch(err => console.error("Routing Error:", err));
}

// Open Google Maps Button Removed

// Focus Button Logic
if (btnFocus) {
    btnFocus.addEventListener('click', () => {
        if (trackerLat !== 0 && trackerLng !== 0) {
            map.flyTo([trackerLat, trackerLng], 18); // Zoom in on tracker
        } else {
            alert("Waiting for tracker location...");
        }
    });
}

async function fetchData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Clone response to read text if JSON fails
        const tempResponse = response.clone();
        try {
            const data = await response.json();
            updateUI(data);
        } catch (e) {
            const text = await tempResponse.text();
            console.error('Invalid JSON received:', text);
            throw new Error('Invalid JSON');
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        connectionBadge.textContent = 'Offline';
        connectionBadge.className = 'status-badge offline';
    }
}

function updateUI(data) {
    if (!data) return;

    // Update Connection Badge (Not used in Android UI, but kept logic safe)
    
    // Update Map & Location (Coords Overlay)
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    
    if (lat !== 0 && lng !== 0) {
        trackerLat = lat;
        trackerLng = lng;
    
        const newLatLng = new L.LatLng(lat, lng);
        marker.setLatLng(newLatLng);
        
        if (!isTracking) {
             map.panTo(newLatLng);
        }
       
        // Update Overlay Text
        latVal.textContent = lat.toFixed(5);
        lngVal.textContent = lng.toFixed(5);
        
        if (isTracking && userMarker) {
            const ull = userMarker.getLatLng();
            drawRouteLine(ull.lat, ull.lng);
        }
    }

    // Update Clock (Time Only - Removed Date)
    const clockEl = document.getElementById('clock-val');
    
    if (data.timestamp && data.timestamp !== 'No Data') {
        const date = new Date(data.timestamp);
        
        // Time HH:MM
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        if(clockEl) clockEl.textContent = `${hours}:${minutes}`;
    } else {
        if(clockEl) clockEl.textContent = '--:--';
    }

    // Update Battery Icon & Text
    const batt = parseInt(data.battery);
    batteryText.textContent = `${batt}%`;
    const battIcon = document.getElementById('battery-icon'); 
    
    if (battIcon) {
        if (batt >= 90) battIcon.textContent = 'battery_full';
        else if (batt >= 20) battIcon.textContent = 'battery_std'; 
        else battIcon.textContent = 'battery_alert'; 
        
        if (batt <= 20) battIcon.style.color = 'var(--danger-color)';
        else battIcon.style.color = 'var(--text-primary)'; // White/Theme
    }

    // Update WiFi Icon (Slashed if disconnected)
    const wifiIcon = document.getElementById('wifi-icon');
    if (wifiIcon) {
        if (data.wifi === 'Connected') {
            wifiIcon.textContent = 'wifi';
            wifiIcon.style.color = 'var(--text-primary)';
        } else {
            wifiIcon.textContent = 'wifi_off'; // Slashed icon
            // Keep color white even if offline (per request)
            wifiIcon.style.color = 'var(--text-primary)'; 
        }
    }

    // Update GPS Icon (Slashed if disconnected)
    const gpsIcon = document.getElementById('gps-icon');
    if (gpsIcon) {
        if (data.gps === 'Locked') {
            gpsIcon.textContent = 'near_me'; // Changed to 'near_me' (Slim Nav Arrow)
            // Keep color white (per request) or accent? User said "white". 
            // "ubah warna gps wifi dan baterai menjadi warna putih"
            gpsIcon.style.color = 'var(--text-primary)';
        } else {
            gpsIcon.textContent = 'location_disabled'; // Slashed icon
            gpsIcon.style.color = 'var(--text-primary)'; // Keep White
        }
    }

    satellitesVal.textContent = data.satellites || 0;

    // [BARU] Update Shock & Last Fall
    if (shockVal) {
        shockVal.textContent = data.shock || 0;
        if (data.shock > 20000) shockVal.style.color = "orange";
        else shockVal.style.color = "var(--text-primary)";
    }
    
    if (lastFallVal) {
        if (data.last_fall_time) {
            const dateObj = new Date(data.last_fall_time);
            lastFallVal.textContent = dateObj.toLocaleTimeString('id-ID');
            lastFallVal.style.color = 'var(--danger-color)';
        } else {
            lastFallVal.textContent = "None Today";
            lastFallVal.style.color = 'var(--text-secondary)';
        }
    }

    // Alert Logic (Unchanged)
    const isOffline = (data.seconds_ago > 5);
    // Note: In Android UI, we might want to change the Header Color if offline? 
    // For now, let's just use the existing alert logic.
    
    if (isOffline) {
        // Maybe turn clock red?
        timestampVal.style.color = 'var(--danger-color)';
        if(wifiIcon) wifiIcon.style.color = 'var(--danger-color)';
    } else {
        timestampVal.style.color = 'var(--text-primary)';
    }

    const serverReportedFall = data.is_fallen === true || data.is_fallen === "true" || data.is_fallen == 1;
    if (serverReportedFall && !isAlertActive) {
        triggerFallAlert();
    }
    if (isAlertActive) {
        alertCard.classList.remove('hidden');
        if(dynamicAlert) {
             dynamicAlert.classList.remove('hidden');
             // Small delay to allow CSS transition to render width expansion
             setTimeout(() => dynamicAlert.classList.add('active'), 10);
        }
    } else {
        alertCard.classList.add('hidden');
        if(dynamicAlert) {
             dynamicAlert.classList.remove('active');
             // Wait for animation then hide
             setTimeout(() => dynamicAlert.classList.add('hidden'), 300);
        }
    }
}

// --- AUDIO & ALERT LOGIC ---
function triggerFallAlert() {
    isAlertActive = true;
    startAlarmSound();
}

btnDismiss.addEventListener('click', () => {
    dismissAlert();
});

// Swipe Logic for Dynamic Island
let touchStartX = 0;
let touchEndX = 0;

if (dynamicAlert) {
    dynamicAlert.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });

    dynamicAlert.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });
}

function handleSwipe() {
    const threshold = 50; // Min distance
    if (Math.abs(touchEndX - touchStartX) > threshold) {
        dismissAlert();
    }
}

function dismissAlert() {
    isAlertActive = false;
    stopAlarmSound();
    alertCard.classList.add('hidden');
    if (dynamicAlert) {
        dynamicAlert.classList.remove('active');
        setTimeout(() => dynamicAlert.classList.add('hidden'), 300);
    }
}

function startAlarmSound() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Prevent multiple overlapped sounds
    if (oscillator) return;

    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // Start freq
    
    // Siren effect (800Hz to 1200Hz loop)
    oscillator.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.5);
    oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 1.0);
    
    // Loop the siren effect manually strictly isn't easy with simple ramp, 
    // so we use an interval or LFO. Simpler: Just a loud beeping pattern?
    // Let's stick to a simple annoying beep pattern for stability:
    
    // Re-create simple beep loop using setInterval
}

// BETTER AUDIO APPROACH: IoT Buzzer Style (Sharp Beep)
let alarmInterval = null;

function startAlarmSound() {
    if (alarmInterval) return; // Already running

    // Play immediate tone
    playBuzzerTone();
    // Loop every 150ms for fast "Beep-Beep-Beep"
    alarmInterval = setInterval(playBuzzerTone, 150);
}

function playBuzzerTone() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create oscillator
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // Classic IoT Piezo frequency (approx 2000-2500Hz)
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(2500, audioCtx.currentTime);
    
    // Sharp "On-Off" envelope (No fading)
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime + 0.08); // Hard cut off after 80ms
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
}

function stopAlarmSound() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

// Fetch data every 2 seconds
// Fetch data every 0.5 second (Hyper Realtime)
setInterval(fetchData, 500);
fetchData(); // Initial call
