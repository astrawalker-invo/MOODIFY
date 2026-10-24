# Verification record — 21 October 2026

## Executed here

| Check | Result | Scope |
|---|---|---|
| Stable npm versions queried and exact pinned | PASS | Registry metadata, lockfile |
| TypeScript `tsc --noEmit` | PASS | All frontend source |
| Vite production build | PASS | Main, chart, lazy 3D chunks |
| Arduino active firmware compilation | PASS | NodeMCU v2, core 3.1.2, libraries below |
| Desktop disconnected page | PASS | Chromium; no fabricated measurements |
| No sensor data / empty graph | PASS | Browser DOM checks |
| Calibration disabled without hardware | PASS | Browser disabled-control check |
| Mobile 390px no horizontal overflow | PASS | Browser layout check |
| Reduced-motion SVG fallback | PASS | Browser media preference check |
| Browser runtime exceptions | None observed | Disconnected page checks only |

Browser screenshots: `screenshots/desktop-no-device.png`, `screenshots/mobile-no-device.png`.
No sensor data was injected, no WebSocket server was mocked, and no fixture logic
tests were added. These are UI-only checks, not substitutes for hardware tests.
Playwright tooling lived only in an excluded tooling cache; it is not a runtime dependency.

## Firmware compile evidence

See `firmware-compile.txt`. Libraries: ESP8266 core 3.1.2, Links2004 WebSockets 2.7.2,
Adafruit DHT 1.4.7, Unified Sensor 1.1.15. Arduino CLI 1.5.2-rc.1 was used.

To ensure the active code path was compiled, a temporary copy of the sketch in an
excluded tool cache was compiled with the electrical gate true and the supplied
credential TEMPLATE. It was not executed/flashed. The distributed sketch still has
the gate false. Placeholder Wi-Fi strings are configuration only, not sensor data.

Compiler report for the active path:
- Global/static data: 32,096 / 80,192 bytes (40%). This is NOT free runtime heap.
- IRAM + reserved instruction cache: 60,755 / 65,536 bytes (92%). 32,768 bytes are
  the reserved cache; actual IRAM code is 27,987 bytes. Leave headroom; do not add
  heavy firmware libraries without checking again.
- Flash code: 283,628 / 1,048,576 bytes (27%).
- Host-tool Python SyntaxWarnings from the ESP core's elf2bin.py did not prevent build.

Compilation proves target/toolchain compatibility, not Wi-Fi, wiring, ADC safety,
sensor accuracy, debounce behavior, runtime heap, client capacity or long-term stability.
No binary with template credentials is distributed for flashing.

## Frontend bundle

- Main JS ~248.3 KB / 78.1 KB gzip.
- Lazy Chart.js chunk ~162.3 KB / 57.1 KB gzip.
- Lazy Three.js/Fiber scene ~913.4 KB / 242.5 KB gzip.
- CSS ~18.6 KB / 4.5 KB gzip.

The scene chunk triggers Vite's >500 KB uncompressed warning. It is already lazy,
not imported by sensor state logic. The manual SVG toggle, reduced motion, context
failure fallback, bounded particles and DPR limit are intentional trade-offs.

## Physical acceptance checklist — all pending

- [ ] Verify exact A0/AO voltages, DHT supply/pull-up, GPIO2 cold boot/reset.
- [ ] Compile and flash for the actual board with real local secrets and verified gate.
- [ ] Wi-Fi joins and prints actual IP; mDNS or manual host works.
- [ ] Laptop WebSocket connects; JSON fields match protocol.
- [ ] Compare real browser readings against Serial output.
- [ ] Browser network inspector shows no periodic sensor HTTP requests.
- [ ] New DHT attempts, not repeated snapshots, create graph points.
- [ ] Complete observed dry/damp calibration; verify polarity and AO consistency.
- [ ] Confirm wet/dry debounce, grey-zone unknown, drying and repeated recovery.
- [ ] Verify cloud/drops respond to actual calibrated state, never intensity.
- [ ] Safely disconnect DHT DATA: invalid DHT values hidden; rain still works.
- [ ] Restore DHT, verify recovery. Prefer power off before wiring changes.
- [ ] Power off ESP8266: no live values; restore and verify reconnect.
- [ ] Wi-Fi off/on: Serial acquisition continues; network reconnects.
- [ ] Genuinely stalled connection: stale after five seconds without accepted data.
- [ ] ESP reboot changes boot_id, breaks history, resets interpretation evidence.
- [ ] Refresh clears readings/history but retains only configuration.
- [ ] Test intended 1–3 clients; record free heap, measured latency and reliability.
- [ ] Test actual demo browser/device, keyboard access, motion and WebGL recovery.

Only mark a hardware item passed after performing it on the real installation.
