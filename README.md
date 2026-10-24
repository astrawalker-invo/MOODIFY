# Hyperlocal Weather Monitoring Dashboard

**ESP8266 NodeMCU + DHT11 + LM393 rain sensor → local Wi-Fi → WebSocket → React**

A physical monitoring-point instrument, not a city-weather website. No simulated
readings, mock server, polling, external forecasts, persistent measurements or backend.

## Current status

The software feature set is implemented, including chart, SVG indicators, calculated
dew point, lazy WebGL rain scene with SVG fallback, real-observation calibration,
connection settings, freshness and reconnection. Visual styling remains reviewable.

**Passed here:** frontend type checking, production build, NodeMCU v2 active firmware
compilation, and browser empty-state/responsiveness/reduced-motion checks.

**Not performed:** physical flashing, real-data end-to-end verification, electrical
inspection, actual rain calibration, runtime free-heap/client-load testing or latency
measurement. The project must not be described as hardware-verified yet.

## Demo setup — read this first

1. Read `docs/HARDWARE.md`: verify exact A0 voltage range and GPIO2 boot safety.
2. Install ESP8266 board core **3.1.2**, WebSockets **2.7.2**, Adafruit DHT **1.4.7**,
   and Adafruit Unified Sensor **1.1.15**.
3. Copy `firmware/weather_station/secrets.example.h` to `secrets.h` locally and enter
   actual Wi-Fi credentials. Never share/commit that file.
4. Only after electrical checks, set `ELECTRICAL_CHECK_COMPLETE = true` in the sketch.
   The default false is deliberate and stops sensor/network startup.
5. Flash with the board setting appropriate to your exact board. Compilation here
   used NodeMCU 1.0 / ESP-12E (`esp8266:esp8266:nodemcuv2`).
6. Open Serial Monitor at **115200**. Record the actual assigned IP.
7. On the laptop sharing the device network, install Node.js 24 LTS and run:

```sh
cd frontend
npm ci
npm run dev
```

8. Open the **HTTP** Vite address printed locally. Enter the actual IP (or
   `weather-node.local`), port **81**, your device name and monitoring-point label.
   Click **Apply & connect**. Location description is optional; no location is invented.
9. Verify actual values against Serial. Open **Rain calibration**, capture dry plate,
   then damp plate, and save the observed calibration. Both require stable real data.
10. Run the acceptance checklist and rehearse `docs/DEMO_GUIDE.md` before the HOD demo.

The remote HTTPS preview is for visual review only. It cannot ordinarily connect to
plain ws:// on your private device. Run locally over HTTP for hardware integration.
If `.local` fails, use Serial's actual IP. No IP is hardcoded. Router DHCP reservation
is optional. Browser local-network permissions may also need approval.

## Commands

- `npm run dev`: frontend Vite server (not an application backend).
- `npm run typecheck`: TypeScript validation.
- `npm run build`: type check and production bundle.

Exact direct versions and resolved transitive versions are pinned in package files.
The npm 10.8.2 peer resolver initially crashed (`edgesOut`); `.npmrc` records the
legacy-peer-deps workaround used for reproducible installation. Builds pass.
Vite handles JSX without a React plugin in this version; Fast Refresh is not enabled.

## Code map

| File | Responsibility |
|---|---|
| `frontend/src/main.tsx` | Dashboard composition, configuration, current values |
| `frontend/src/sensors.ts` | Contract validation, Magnus formula, rain state machine |
| `frontend/src/useStation.ts` | WebSocket, ordering, receipt freshness, bounded history |
| `frontend/src/calibration.tsx` | Collect actual observations, derive/store configuration |
| `frontend/src/useRain.ts` | Apply calibration and reset interpretation on faults/reboot |
| `frontend/src/TemperatureChart.tsx` | Lazy Chart.js graph and accessible table |
| `frontend/src/SensorIndicator.tsx` | SVG gauges; no WebGL needed |
| `frontend/src/RainVisual.tsx` | Labelled scene, lazy loading, fallback and motion policy |
| `frontend/src/RainScene.tsx` | Three.js/Fiber clouds and fixed 64-drop animation |
| `firmware/weather_station/weather_station.ino` | Sensor acquisition and raw push transport |

## Scientific limits and state rules

DHT11 temperature/RH are direct local measurements, approximately ±2 °C / ±5% RH,
with coarse resolution and two-second acquisition. Rings have fixed cyan scale
color—not comfort, danger or forecast meanings. Temperature scale is 0–50 °C;
humidity is 0–100% RH. Exact sensor model specifications should be confirmed.

Dew point uses Magnus (a=17.62, b=243.12 °C, water reference) from current valid
inputs only; RH=0 is undefined. It inherits DHT11 uncertainty.

Rain wetness is interpreted as rain detected. The module measures neither cloud
cover nor rainfall amount/intensity/probability. Cloud and drop visuals are a labelled
sensor-state representation; drop count/speed never encode intensity. Dry/damp
polarity is learned only from your hardware. Unknown is an intentional state.

Only accepted new snapshots refresh receipt time. >5 seconds without one is stale.
Closed socket is disconnected; current cards hide old values. History has actual
DHT sample points and explicit gaps, <=30 minutes / 1,200 entries, in memory only.
Only connection/identity settings and calibrated configuration are stored locally.

No fixture-based logic tests were added without approval. Browser tests here used
only the disconnected empty dashboard; no sensor inputs were synthesized.

## Performance / compatibility

Three.js/Fiber is a separate lazy chunk, ~242.5 KB gzip; main JS ~78.1 KB gzip; chart
~57.1 KB gzip. Vite warns about the uncompressed 913 KB scene chunk. This is the
explicit cost of real WebGL, not hidden in initial UI code; disable 3D for a lightweight
SVG scene. No Drei, shadow maps, post-processing or external models/assets.

The scene has 64 instanced drops, limited DPR (1.5), pauses offscreen/in hidden tabs,
and falls back to static SVG for reduced motion, WebGL failure or manual selection.
Desktop/mobile Chromium empty-state checks pass; other browser/device hardware
and actual live transitions remain to be verified. All styling uses Tailwind utilities.

Plain WebSocket is unencrypted and unauthenticated. Use a trusted local demo network;
public HTTPS/WSS deployment is a separate future phase. Do not expose port 81 publicly.
