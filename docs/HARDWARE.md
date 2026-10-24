# Hardware and flashing gate

## Information still needed

The user selected “A0 range verified” but did not supply the voltage range or rain
observations. They selected “I’ll supply the labels” without supplying text.
Neither is treated as actual technical evidence. Identity fields therefore remain
unconfigured; rain interpretation remains unknown.

Supply:
- exact NodeMCU board/revision, A0 permitted input voltage, evidence/source;
- exact DHT breakout/bare sensor and LM393 module details;
- dry and damp AO/DO observations, potentiometer setting;
- device name and monitoring-point label;
- power source, indoor/outdoor placement and enclosure;
- demo deadline and desired report/presentation deliverables.

## Existing wiring — no pins changed

| Signal | Connection |
|---|---|
| DHT VCC / GND | 3V3 / GND |
| DHT DATA | D4 / GPIO2 |
| Rain VCC / GND | 3V3 / GND |
| Rain AO | A0 |
| Rain DO | D5 / GPIO14 |

GPIO2 is a boot strap requiring HIGH at boot, and commonly shares an active-low
onboard LED. Check the DHT data pull-up to 3.3 V and successful cold starts/resets.
Do not drive the LED from firmware. A bare DHT may need a pull-up; identify the
module and existing resistors before adding one. Verify exact sensor supply ratings.

The raw ESP8266 ADC is approximately 0–1 V; NodeMCU variants often add an A0 divider
for approximately 0–3.3 V. Do not assume the divider exists on your exact board.
Measure/check module AO against the permitted A0 voltage. DO must be safe 3.3 V
logic, not pulled to 5 V. Get approval before any needed divider or wiring change.
Do not test unsafe wiring just to get raw readings.

## Prepare Arduino locally

1. Install Arduino IDE and ESP8266 Arduino board support using its official Boards
   Manager instructions. Select your exact board, port and appropriate flash settings.
2. Use ESP8266 core **3.1.2** (compile-verified here). Install **WebSockets by Markus Sattler (Links2004), 2.7.2**, **DHT sensor library by
   Adafruit, 1.4.7**, and its **Adafruit Unified Sensor 1.1.15** dependency. ESP8266WiFi and
   ESP8266mDNS come from the board core. Record exact core/dependency versions.
3. Copy `firmware/weather_station/secrets.example.h` to `secrets.h` in the same folder.
   Enter actual Wi-Fi credentials locally. The real file is gitignored.
4. Read and record the electrical verification above. ONLY then change
   `ELECTRICAL_CHECK_COMPLETE` to true in the sketch. Default false deliberately
   starts neither sensors nor networking and prints an explanatory stop message.
5. Leave `RAIN_POLARITY_VERIFIED` false until empirically verified. Sensor raw values
   work without polarity calibration. Serial wet/dry text is intentionally withheld
   rather than preserving an unverified LOW=wet claim.
6. Compile and flash locally. Active-path NodeMCU v2 compilation has passed here;
   flashing and hardware operation have NOT been performed. See TESTING.md.
7. Open Serial at 115200. Record actual IP, join/rejoin messages and sensor reports.

Non-blocking millis scheduling replaces delay(2000). DHT remains a short synchronous
library read. Wi-Fi reconnect attempts occur without stopping acquisition. Rain is
sampled at 100 ms; snapshots every 500 ms and after digital changes or DHT attempts.
No NTP, RTC, wall-clock sensor timestamps, or debug HTTP endpoint is included.

## Empirical rain verification

With safe verified wiring and the board powered normally:
1. Keep the electronics dry; only the exposed sensor plate should be dampened.
2. Record repeated dry analog/digital readings and threshold potentiometer setting.
3. Add a small amount of water to the plate; record repeated damp AO/DO readings.
4. Observe drying and threshold chatter. Record the range near transition too.
5. Repeat. Determine wet polarity and whether robust analog consistency bands exist.
6. Send the observations for a documented calibration configuration. No generic
   thresholds are assumed, and there is intentionally no arbitrary calibration UI.

The dashboard now includes an actual-observation calibration workflow. Capture dry
and damp plate readings while the connection is live (at least 10 observations across
4.5 seconds per capture). It requires stable and opposite DO values and non-overlapping
AO ranges separated by at least 10 counts. The central 20% of observed separation is
left uncertain; other bands check consistency with learned polarity. This policy is
an engineering heuristic requiring repeated hardware verification, not an intensity
calibration. Only derived configuration and device identity persist; raw captures do not.
If calibration cannot establish separation, status stays unknown. Recheck the module
and potentiometer, or request review; do not enter invented observation values.

A DHCP reservation is optional: find the ESP8266 MAC in the router client list,
reserve its assigned address, and reconnect. No static IP is invented in firmware.
