export type Snapshot = {
  schema_version: 1;
  device_id: string;
  boot_id: string;
  seq: number;
  uptime_ms: number;
  dht: {
    sample_seq: number;
    sample_age_ms: number | null;
    valid: boolean;
    temperature_c: number | null;
    humidity_percent: number | null;
  };
  rain: {
    sample_seq: number;
    sample_age_ms: number | null;
    valid: boolean;
    analog: number | null;
    digital: 0 | 1 | null;
  };
};
const uint = (v: unknown): v is number =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 4294967295;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function parseSnapshot(text: string): Snapshot {
  if (text.length > 2048) throw Error("Oversized message rejected");
  const s = JSON.parse(text);
  if (
    !s ||
    s.schema_version !== 1 ||
    typeof s.device_id !== "string" ||
    !s.device_id ||
    s.device_id.length > 64 ||
    typeof s.boot_id !== "string" ||
    !s.boot_id ||
    s.boot_id.length > 64 ||
    !uint(s.seq) ||
    !uint(s.uptime_ms)
  )
    throw Error("Invalid snapshot header");
  for (const b of [s.dht, s.rain])
    if (
      !b ||
      typeof b.valid !== "boolean" ||
      !uint(b.sample_seq) ||
      !(b.sample_age_ms === null || uint(b.sample_age_ms))
    )
      throw Error("Invalid sensor block");
  const d = s.dht,
    r = s.rain;
  if (
    d.valid
      ? !(
          finite(d.temperature_c) &&
          d.temperature_c >= 0 &&
          d.temperature_c <= 50 &&
          finite(d.humidity_percent) &&
          d.humidity_percent >= 0 &&
          d.humidity_percent <= 100 &&
          d.sample_age_ms !== null
        )
      : !(d.temperature_c === null && d.humidity_percent === null)
  )
    throw Error("Invalid DHT values");
  if (
    r.valid
      ? !(
          uint(r.analog) &&
          r.analog <= 1024 &&
          (r.digital === 0 || r.digital === 1) &&
          r.sample_age_ms !== null
        )
      : !(r.analog === null && r.digital === null)
  )
    throw Error("Invalid rain values");
  return s as Snapshot;
}
export function dewPoint(t: number, rh: number): number | null {
  if (!Number.isFinite(t) || !Number.isFinite(rh) || rh <= 0 || rh > 100)
    return null;
  const gamma = Math.log(rh / 100) + (17.62 * t) / (243.12 + t);
  const result = (243.12 * gamma) / (17.62 - gamma);
  return Number.isFinite(result) ? result : null;
}
export type RainConfig = {
  wetDigital: 0 | 1;
  wetAnalogMin: number;
  wetAnalogMax: number;
  dryAnalogMin: number;
  dryAnalogMax: number;
};
export type RainState = "unknown" | "wet" | "dry";
// No default calibration: must come from observed hardware, not generic module assumptions.
export class RainInterpreter {
  state: RainState = "unknown";
  private candidate: RainState = "unknown";
  private since = 0;
  private count = 0;
  private last: number | null = null;
  reset() {
    this.state = "unknown";
    this.candidate = "unknown";
    this.count = 0;
    this.last = null;
  }
  update(s: Snapshot, config: RainConfig | null, now: number): RainState {
    if (
      !config ||
      !s.rain.valid ||
      s.rain.sample_age_ms === null ||
      s.rain.sample_age_ms > 1000
    ) {
      this.reset();
      return this.state;
    }
    if (this.last === s.rain.sample_seq)
      return this.candidate === this.state ? this.state : "unknown";
    this.last = s.rain.sample_seq;
    const r = s.rain,
      wet = r.digital === config.wetDigital;
    const consistent = wet
      ? r.analog! >= config.wetAnalogMin && r.analog! <= config.wetAnalogMax
      : r.analog! >= config.dryAnalogMin && r.analog! <= config.dryAnalogMax;
    const next: RainState = consistent ? (wet ? "wet" : "dry") : "unknown";
    if (next !== this.candidate) {
      this.candidate = next;
      this.since = now;
      this.count = 1;
    } else this.count++;
    const wait = next === "wet" ? 500 : next === "dry" ? 1500 : 1000;
    if (this.count >= 3 && now - this.since >= wait) this.state = next;
    return next === this.state ? this.state : "unknown";
  }
}
