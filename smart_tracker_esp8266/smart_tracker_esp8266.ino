#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h> // [BARU] Library HTTP
#include <UniversalTelegramBot.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPS++.h>
#include <SoftwareSerial.h>

/* ================= KONFIGURASI PENGGUNA (ISI DISINI) ================= */
const char* ssid = "POCO_F5";     
const char* password = "12345678";    
#define BOTtoken "7709488625:AAEq6jeOF0-fpONy_lYJsweDEGoK-o2O8Ow"     
#define CHAT_ID "7251486947"       

// [BARU] Konfigurasi Server
// GANTI "192.168.1.X" dengan IP Address Laptop Anda!
// Cara cek IP: Buka CMD di laptop -> ketik "ipconfig" -> cari "IPv4 Address"
const char* serverUrl = "http://10.225.38.15/smart-tracker/api.php"; 

/* --- KONFIGURASI HARDWARE --- */
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

static const int RXPin = D5; 
static const int TXPin = D6; 
TinyGPSPlus gps;
SoftwareSerial ss(RXPin, TXPin);

const int MPU_ADDR = 0x68;
const int BUZZER_PIN = D7;
const int BATTERY_PIN = A0; 

/* --- OBJEK TELEGRAM --- */
WiFiClientSecure client;
UniversalTelegramBot bot(BOTtoken, client);

/* --- VARIABEL LOGIKA --- */
const int SHAKE_THRESHOLD = 35000; 
unsigned long lastBeepTime = 0;    
bool isFallen = false;
unsigned long fallStartTime = 0;
bool startupMode = true; 

int16_t AcX, AcY, AcZ;
long prevVector = 0;

// [BARU] Timer untuk kirim data ke web agar tidak spamming
unsigned long lastWebSend = 0;
const long webSendInterval = 500; // Kirim setiap 0.5 detik (Hyper Realtime)

void setup() {
  Serial.begin(115200);
  ss.begin(9600);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // 1. Init I2C
  Wire.begin(D2, D1); 

  // 2. Init OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("OLED Error")); for(;;);
  }
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(10,20);
  display.println("SISTEM STARTING...");
  display.display();

  // 3. Init MPU6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0);
  Wire.endTransmission(true);
  delay(500); 
  
  readMPU();
  prevVector = abs(AcX + AcY + AcZ);

  // 4. Koneksi WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  client.setInsecure();
  
  display.clearDisplay();
  display.setCursor(0,20);
  display.println("Menyiapkan Sistem...");
  display.display();
  delay(2000); 
}

void loop() {
  // --- BACA SENSOR ---
  while (ss.available() > 0) gps.encode(ss.read());
  readMPU();
  int batLevel = readBattery();

  // --- LOGIKA DETEKSI JATUH ---
  long currentVector = abs(AcX + AcY + AcZ);
  long shock = abs(currentVector - prevVector);
  prevVector = currentVector;

  if (millis() < 3000) {
    shock = 0; 
  }
  
  if (millis() < 3000) {
    shock = 0; 
  }

  // Jika jatuh
  if (shock > SHAKE_THRESHOLD && !isFallen) {
    isFallen = true;
    fallStartTime = millis();

    tone(BUZZER_PIN, 3000); 
    display.clearDisplay();
    display.setTextSize(2); display.setCursor(10,10);
    display.println("MENGIRIM");
    display.println("SOS...");
    display.display();

    if (WiFi.status() == WL_CONNECTED) {
      kirimTelegramJatuh();
      sendToWeb(batLevel, true, shock); // Update web saat jatuh (kirim shock)
    } else {
      Serial.println("WiFi Putus");
      delay(1000); 
    }
  }
  
  if (isFallen && (millis() - fallStartTime > 10000)) {
    isFallen = false;
    noTone(BUZZER_PIN); 
    sendToWeb(batLevel, false, shock); // Update web status aman
  }

  // --- TAMPILAN & LOGIKA LOOP ---
  if (!isFallen) { 
    display.clearDisplay();
    modeIdle(batLevel);
    cekKoneksiDanBunyi(); 
    display.display();

    // [BARU] Kirim data ke web server rutin
    if (millis() - lastWebSend >= webSendInterval) {
      lastWebSend = millis();
      if (WiFi.status() == WL_CONNECTED) {
        // Kirim status isFallen yang benar & shock
        sendToWeb(batLevel, isFallen, shock);
      }
    }
  }
  
  delay(50); 
}

// ================= FUNGSI PENDUKUNG =================

// [BARU] Fungsi Kirim Data ke Website
void sendToWeb(int battery, bool fallStatus, long shockVal) {
  WiFiClient wclient; // Gunakan WiFiClient biasa untuk HTTP (bukan Secure)
  HTTPClient http;

  // Siapkan data JSON
  String statusWifi = (WiFi.status() == WL_CONNECTED) ? "Connected" : "Disconnected";
  String statusGps = gps.location.isValid() ? "Locked" : "Searching";
  float lat = gps.location.isValid() ? gps.location.lat() : 0.0;
  float lng = gps.location.isValid() ? gps.location.lng() : 0.0;

  // Buat string JSON manual
  String jsonData = "{";
  jsonData += "\"lat\":" + String(lat, 6) + ",";
  jsonData += "\"lng\":" + String(lng, 6) + ",";
  jsonData += "\"battery\":" + String(battery) + ",";
  jsonData += "\"wifi\":\"" + statusWifi + "\",";
  jsonData += "\"gps\":\"" + statusGps + "\",";
  jsonData += "\"gps\":\"" + statusGps + "\",";
  jsonData += "\"satellites\":" + String(gps.satellites.value()) + ",";
  jsonData += "\"shock\":" + String(shockVal) + ",";
  jsonData += "\"is_fallen\":" + String(fallStatus ? "true" : "false");
  jsonData += "}";

  // Kirim POST Request
  http.begin(wclient, serverUrl);
  http.addHeader("Content-Type", "application/json");
  int httpResponseCode = http.POST(jsonData);

  if (httpResponseCode > 0) {
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Error code: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

void kirimTelegramJatuh() {
  String pesan = "⚠️ DARURAT! PENGGUNA TERJATUH.\n\nLokasi:\n";
  if (gps.location.isValid()) {
    pesan += "http://maps.google.com/maps?q=";
    pesan += String(gps.location.lat(), 6);
    pesan += ",";
    pesan += String(gps.location.lng(), 6);
  } else {
    pesan += "Lokasi GPS belum terkunci.";
  }
  bot.sendMessage(CHAT_ID, pesan, "");
}

void modeIdle(int bat) {
  display.setTextSize(1);
  display.setCursor(0,0); display.print("MONITORING");
  display.setCursor(90,0); display.print(bat); display.print("%");
  display.drawLine(0, 10, 128, 10, WHITE); 

  display.setCursor(0, 20); display.print("WiFi: ");
  if (WiFi.status() == WL_CONNECTED) display.println("OK"); 
  else display.println("Putus");

  display.setCursor(0, 35); display.print("GPS : ");
  if (gps.location.isValid()) {
    display.print("OK ("); display.print(gps.satellites.value()); display.println(")");
  } else display.println("Cari...");

  display.setCursor(0, 55);
  if (WiFi.status() != WL_CONNECTED || !gps.location.isValid()) {
    display.print("! BELUM SIAP !");
  } else {
    display.print(">> SISTEM AMAN <<");
  }
}

void cekKoneksiDanBunyi() {
  bool notReady = (WiFi.status() != WL_CONNECTED) || (!gps.location.isValid());
  if (notReady) {
    if (millis() - lastBeepTime >= 2000) {
      lastBeepTime = millis();
      tone(BUZZER_PIN, 2000, 100); 
    }
  } else {
    noTone(BUZZER_PIN);
  }
}

int readBattery() {
  int raw = analogRead(BATTERY_PIN);
  int persen = map(raw, 700, 1024, 0, 100); 
  if (persen > 100) return 100;
  if (persen < 0) return 0;
  return persen;
}

void readMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);
  if (Wire.available() >= 6) {
    AcX = Wire.read()<<8|Wire.read();
    AcY = Wire.read()<<8|Wire.read();
    AcZ = Wire.read()<<8|Wire.read();
  }
}
