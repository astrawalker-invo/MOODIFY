# Faculty / HOD demonstration guide

## Before the demonstration — mandatory

- Verify safe A0 voltage and GPIO2 boot behavior on the exact physical board.
- Supply stable USB power; protect electronics from water. Do not wet the controller.
- Compile/flash with your local Wi-Fi secrets and the electrical gate enabled only
  after verification. The downloaded source defaults to a safe stopped state.
- Start the dashboard locally over HTTP, not from the remote HTTPS preview.
- Set actual device name and monitoring-point label. No city/area coverage claim.
- Confirm Serial readings match received browser values and valid snapshots.
- Complete real dry/damp calibration. Repeat wet/dry transitions and verify recovery.
- Let actual session history accumulate for a few minutes; never prefill it.
- Rehearse power-off/reconnect and invalid-DHT handling safely before faculty arrive.
- Have a cloth/tissue and a small dropper ready; keep the rain module electronics dry.
- Save the source ZIP locally; install dependencies and board libraries in advance.

## Suggested 4–5 minute sequence

### 1. Purpose (30 seconds)

“This station measures conditions at its own local monitoring point rather than
showing a city-wide estimate. The numbers come directly from this ESP8266 and its
sensors; there is no external weather feed.”

Point out the physical DHT11, rain plate, ESP8266 and actual monitoring-point label.

### 2. Trace a measurement (45 seconds)

Show temperature and relative humidity, Serial output if desired, and the actual
hardware ID in the dashboard. Explain: DHT11 is sampled every two seconds; ESP8266
pushes full snapshots over WebSocket. The browser does not poll a sensor endpoint.

“The time displayed is when this browser received the latest accepted update,
not an exact sensor timestamp.”

### 3. Wet-plate demonstration (60 seconds)

Start with the calibrated dry plate. Show raw AO and DO. Apply a small amount of
water to the sensing plate ONLY. After debounce, the status should become “Rain
detected” and the fixed-rate drops appear. This expected behavior must be tested
on your hardware beforehand; it has not been verified remotely.

“The module detects moisture on its plate, which this project interprets as rain.
It does not measure rainfall intensity, cloud cover, or precipitation probability.”

Dry the plate and wait for stable dry confirmation. Residual moisture can delay this;
do not promise an instant return. Never manually force a state for appearance.

### 4. History and calculated value (45 seconds)

Show the graph labelled session-only/not saved. Explain that gaps are not filled.
Show dew point labelled Calculated: it comes from Magnus and the two DHT inputs,
not another physical sensor. DHT11 uncertainty limits the calculated accuracy.

### 5. Honest failure behavior (45 seconds)

Power the ESP8266 off without touching sensor wiring. Show disconnected/no-live-data
and static scene; old values are not presented as fresh. Restore power and show
reconnection and new real readings. A router may report disconnect slowly; if the
socket stays open without messages, the dashboard marks stale after five seconds.

For DHT-fault demonstration, use the safely rehearsed procedure. Prefer power off
before changing DATA wiring. GPIO2 must remain HIGH at boot; do not improvise live
wire changes during the faculty demonstration.

### 6. Limits (30 seconds)

“DHT11 is a low-cost sensor with approximately ±2 °C and ±5% RH uncertainty. Placement,
sun, ventilation and controller heating matter. This is a local instrument, not a
forecast service or a claim of superior accuracy to official weather stations.”

## Troubleshooting

| Symptom | Check |
|---|---|
| Serial prints STOP | Complete electrical checks, then enable sketch safety gate |
| No Wi-Fi IP | Your local credentials, 2.4 GHz availability, power and Serial logs |
| .local not found | Use the actual Serial IP; mDNS is not universal |
| Browser cannot connect | HTTP URL, same reachable network, actual IP, port 81, permissions |
| Unknown rain state | Calibration missing/wrong device, capture inconsistency, analog grey zone |
| Calibration rejected | AO ranges overlap or DO did not change; inspect/adjust potentiometer |
| DHT invalid | Safe wiring, module supply rating, pull-up, GPIO2 boot interaction |
| Scene unavailable | Use SVG fallback/turn 3D off; numeric data remains independent |
| Dry status delayed | Plate still damp or debounce is confirming; do not force it |

## Release acceptance

Software compilation and empty-state browser checks have passed. Physical acceptance
is your remaining release gate. Do not claim the demo is hardware-ready until the
checks in TESTING.md have been executed successfully on the actual station.
