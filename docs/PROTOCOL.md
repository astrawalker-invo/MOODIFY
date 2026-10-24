# Protocol v1

Device endpoint: ws://<actual hostname or IPv4>:81/. Default mDNS weather-node.local.
Client limit: library default 5 slots; demo target 1–3 clients, not yet measured.

Every application text message is a full snapshot. No sensor time-of-day exists.

| Field | Type / meaning |
|---|---|
| schema_version | integer 1 |
| device_id | stable chip-based hardware identifier, not a location |
| boot_id | new opaque random identifier each boot; not a security token |
| seq | uint32 generated-snapshot sequence |
| uptime_ms | uint32 millis() value |
| dht.sample_seq | uint32 count of acquisition attempts |
| dht.sample_age_ms | elapsed since attempt; null before any attempt |
| dht.valid | latest attempt valid |
| dht.temperature_c | finite 0–50 °C number, null when invalid |
| dht.humidity_percent | finite 0–100 % number, null when invalid |
| rain.sample_seq | uint32 count of real acquisitions |
| rain.sample_age_ms | elapsed since acquisition; null initially |
| rain.valid | raw acquisition available, NOT a wiring-health guarantee |
| rain.analog | integer 0–1023; null before acquisition |
| rain.digital | raw 0 or 1; null before acquisition |

Firmware builds snapshots for regular broadcasts and a new-client immediate send.
Each generation increments seq, including initial unicast; other clients may see
sequence skips. Every new client receives current cached sensor values with current
ages. It does NOT force a new DHT read. Old successful DHT values are replaced with
null on a failed new attempt. The JSON output buffer is bounded and checked.

Frontend rejects malformed data, overlong messages, unsupported versions, invalid
numeric ranges and impossible validity/null combinations. Extra fields can be ignored
for forward compatibility. Device identity changing at one host is rejected until
an explicit disconnect/reconnect. Duplicate/old seq does not refresh freshness.

Sequence comparison uses unsigned modular distance, accepting normal uint32 wrap.
An unexpected decrease/out-of-order message without boot_id change is rejected and
reported. A changed boot_id resets interpretation and breaks session history. millis
wrap alone is not classified as reboot. Sample ages use unsigned subtraction.

## Freshness

Only an accepted new application snapshot refreshes receipt time. Ping/pong and invalid
messages do not count. Open socket plus >5 s without accepted data is stale. A closed
socket is disconnected. Opening/retrying is connecting; only valid data becomes live.
Retry backoff is approximately 1,2,4,8,15 seconds with ±10% jitter and a final 15-second cap.
DHT acquisition age plus browser elapsed time must be <=5 s for current display.
Rain acquisition age plus elapsed must be <=1 s. Otherwise raw values are hidden.
Last raw snapshot remains inspectable in diagnostics, explicitly not the live cards.

Receipt label: “Last update received at HH:MM:SS — browser receipt time”. It is an
approximation of update delivery, never exact acquisition time. Freshness intervals
use performance.now, independent of wall-clock corrections. Browser background
throttling may delay callbacks; upon running again elapsed time is re-evaluated.

## Rain module

One isolated interpreter exists in sensors.ts. No calibration is fabricated.
When supplied calibrated non-overlapping bands: wet confirmation >=500 ms and >=3
observations; dry >=1500 ms and >=3 observations; clear contradiction >=1 s; pending
transitions report unknown. Missing calibration/invalid/stale raw data reset evidence.
Distinct rain sample_seq values prevent duplicate evidence. No intensity metric.
The dashboard applies the interpreter only with calibration matching the actual
device_id. It resets evidence on reboot, no-live-data, invalid raw data, a >1.5 s
interpretation gap, or configuration change. The UI hides rain raw values after 1 s
of acquisition age; unknown/no-live-data never animates rain.

## Session history

Only a new dht.sample_seq can append a temperature. Invalid attempts create null
breaks. Missed attempt sequences, reconnect, reboot, and stale delivery create gaps.
Bounded to 30 minutes and <=1,200 entries; no persistence, interpolation or prefill.
The dashboard now renders a lazy Chart.js temperature chart and an accessible recent
measurements table. Three.js/Fiber is lazy-loaded for the state scene only. No chart values exist without hardware.

## Calibration settings

The real-observation panel captures two stable states from one device/boot. It requires
>=10 received acquisitions across >=4.5 s each, opposite dry/damp DO and separated AO
ranges. A minimum 10-count AO separation and central 20% uncertainty zone are explicit
engineering choices, not sensor specifications. A change to the potentiometer, supply,
module or installation requires calibration review/repetition. No generic LOW=wet or
analog direction is built into the interpretation. No raw capture is saved across refresh.
