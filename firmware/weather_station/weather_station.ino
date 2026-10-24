#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <WebSocketsServer.h>
#include <DHT.h>
extern "C" {
#include <user_interface.h>
}
#include "secrets.h"
#define DHTPIN D4
#define DHTTYPE DHT11
#define RAIN_PIN A0
#define RAIN_DIGITAL D5
// Set to true to start sensors and Wi-Fi
constexpr bool ELECTRICAL_CHECK_COMPLETE = true;
constexpr bool RAIN_POLARITY_VERIFIED = true;
constexpr int VERIFIED_WET_LEVEL = LOW;
constexpr char HOSTNAME[] = "weather-node";
DHT dht(DHTPIN, DHTTYPE);
WebSocketsServer webSocket(81);
char deviceId[32], bootId[32], payload[768];
uint32_t seq=0, dhtSeq=0, rainSeq=0, lastDht=0, lastRain=0, lastPush=0, lastWifiTry=0;
bool dhtAvailable=false, rainAvailable=false, dhtValid=false, wasConnected=false, mdnsReady=false;
float temperature=0, humidity=0;
int rainAnalog=0, rainDigital=0;
void buildSnapshot() {
 const uint32_t now=millis();
 char t[24],h[24],da[16],ra[16],a[16],d[8];
 if(dhtValid){dtostrf(temperature,0,2,t);dtostrf(humidity,0,2,h);}else{strcpy(t,"null");strcpy(h,"null");}
 if(dhtAvailable)snprintf(da,sizeof da,"%lu",(unsigned long)(now-lastDht));else strcpy(da,"null");
 if(rainAvailable){snprintf(ra,sizeof ra,"%lu",(unsigned long)(now-lastRain));snprintf(a,sizeof a,"%d",rainAnalog);snprintf(d,sizeof d,"%d",rainDigital);}else{strcpy(ra,"null");strcpy(a,"null");strcpy(d,"null");}
 int n=snprintf(payload,sizeof payload,"{\"schema_version\":1,\"device_id\":\"%s\",\"boot_id\":\"%s\",\"seq\":%lu,\"uptime_ms\":%lu,\"dht\":{\"sample_seq\":%lu,\"sample_age_ms\":%s,\"valid\":%s,\"temperature_c\":%s,\"humidity_percent\":%s},\"rain\":{\"sample_seq\":%lu,\"sample_age_ms\":%s,\"valid\":%s,\"analog\":%s,\"digital\":%s}}",deviceId,bootId,(unsigned long)seq,(unsigned long)now,(unsigned long)dhtSeq,da,dhtValid?"true":"false",t,h,(unsigned long)rainSeq,ra,rainAvailable?"true":"false",a,d);
 if(n<0 || (size_t)n>=sizeof payload){payload[0]='\0';Serial.println("JSON buffer overflow: snapshot not sent");}
}
void pushSnapshot(){++seq;buildSnapshot();if(payload[0]){webSocket.broadcastTXT(payload);Serial.print("SNAPSHOT:");Serial.println(payload);}lastPush=millis();}
void printSensors(){
 Serial.println("\n--- LIVE SENSOR DATA ---");
 Serial.print("WiFi Status: ");Serial.print(WiFi.status());
 if(WiFi.status() == WL_CONNECTED){Serial.print(" (CONNECTED) IP: ");Serial.println(WiFi.localIP());}
 else {Serial.println(" (NOT CONNECTED YET)");}
 if(!dhtValid)Serial.println("DHT11: Reading failed! Check wiring.");
 else{Serial.print("Temperature: ");Serial.print(temperature);Serial.println(" °C");Serial.print("Humidity: ");Serial.print(humidity);Serial.println(" %");}
 Serial.print("Rain Analog Value: ");Serial.println(rainAnalog);
 Serial.print("Rain Digital Output: ");Serial.println(rainDigital);
 if(rainDigital == LOW || rainAnalog < 750) {
   Serial.println("Rain sensor: WET DETECTED (Rain Active)");
 } else {
   Serial.println("Rain sensor: DRY (No Moisture)");
 }
 Serial.println("------------------------");
}
void setup(){
 Serial.begin(115200);Serial.println("\nESP8266 Weather Monitoring\n--------------------------");
 snprintf(deviceId,sizeof deviceId,"esp8266-%06X",ESP.getChipId());
 snprintf(bootId,sizeof bootId,"%08lX%08lX",(unsigned long)os_random(),(unsigned long)os_random());
 if(!ELECTRICAL_CHECK_COMPLETE){Serial.println("STOP: verify exact A0 range and AO voltage, then explicitly enable ELECTRICAL_CHECK_COMPLETE. No sensors/network started.");return;}
 pinMode(RAIN_DIGITAL,INPUT);dht.begin();
 Serial.println("Scanning 2.4GHz Wi-Fi networks...");
 int n = WiFi.scanNetworks();
 Serial.printf("Found %d networks:\n", n);
 for(int i=0; i<n; ++i) {
   Serial.printf("  %d: %s (RSSI %d, Ch %d)\n", i+1, WiFi.SSID(i).c_str(), WiFi.RSSI(i), WiFi.channel(i));
 }
 WiFi.scanDelete();
 delay(100);
 ESP.eraseConfig();
 WiFi.disconnect(true);
 delay(200);
 WiFi.mode(WIFI_STA);
 WiFi.setSleepMode(WIFI_NONE_SLEEP);
 WiFi.setOutputPower(20.5);
 WiFi.hostname(HOSTNAME);
 WiFi.setAutoReconnect(true);
 Serial.printf("Connecting to SSID: '%s' with Password: '%s' ...\n", WIFI_SSID, WIFI_PASSWORD);
 WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
 int attempts = 0;
 while (WiFi.status() != WL_CONNECTED && attempts < 25) {
   delay(400);
   Serial.print(".");
   attempts++;
 }
 Serial.println();
 if (WiFi.status() == WL_CONNECTED) {
   Serial.print("Wi-Fi connected! IP Address: ");
   Serial.println(WiFi.localIP());
 } else {
   Serial.printf("Handshake in progress or failed (Status: %d). Continuing to loop...\n", WiFi.status());
 }
 lastWifiTry = millis();
 webSocket.begin();
 webSocket.onEvent([](uint8_t client, WStype_t type, uint8_t*, size_t){
   if(type == WStype_CONNECTED){
     ++seq;
     buildSnapshot();
     if(payload[0]) webSocket.sendTXT(client, payload);
   }
 });
 lastDht = millis();
 lastRain = millis();
 lastPush = millis();
}
void loop(){
 if(!ELECTRICAL_CHECK_COMPLETE){yield();return;}
 webSocket.loop();
 if(mdnsReady) MDNS.update();
 const uint32_t now = millis();
 bool dirty = false;
 const bool connected = WiFi.status() == WL_CONNECTED;
 if(connected && !wasConnected){
   Serial.print("Wi-Fi connected! IP Address: ");
   Serial.println(WiFi.localIP());
   mdnsReady = MDNS.begin(HOSTNAME);
   if(mdnsReady){
     MDNS.addService("ws","tcp",81);
     Serial.println("mDNS: weather-node.local; WebSocket port 81");
   } else {
     Serial.println("mDNS failed; use Serial IP.");
   }
 }
 if(!connected && wasConnected){
   Serial.println("Wi-Fi disconnected; retrying...");
   if(mdnsReady) MDNS.close();
   mdnsReady = false;
 }
 wasConnected = connected;
 if(!connected && (uint32_t)(now - lastWifiTry) >= 8000){
   Serial.printf("Retrying connection to %s (Status: %d)...\n", WIFI_SSID, WiFi.status());
   WiFi.disconnect();
   WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
   lastWifiTry = now;
 }
 if(!rainAvailable || (uint32_t)(now-lastRain)>=100){
   int next = digitalRead(RAIN_DIGITAL);
   dirty = rainAvailable && next != rainDigital;
   rainAnalog = constrain(analogRead(RAIN_PIN), 0, 1023);
   rainDigital = next;
   rainAvailable = true;
   lastRain = millis();
   ++rainSeq;
 }
 if((uint32_t)(now-lastDht)>=2000){
   humidity = dht.readHumidity();
   temperature = dht.readTemperature();
   lastDht = millis();
   dhtAvailable = true;
   ++dhtSeq;
   dhtValid = isfinite(temperature) && isfinite(humidity) && temperature>=0 && temperature<=50 && humidity>=0 && humidity<=100;
   printSensors();
   dirty = true;
 }
 if(dirty || (uint32_t)(millis()-lastPush)>=500) pushSnapshot();
 yield();
}
