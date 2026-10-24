import { useEffect, useRef, useState } from "react";
import type { RainConfig, Snapshot } from "./sensors";
export type Calibration = {
  deviceId: string;
  config: RainConfig;
  recordedAt: string;
};
type Observation = { analog: number; digital: 0 | 1; at: number };
export function readCalibration(): Calibration | null {
  try {
    const c = JSON.parse(localStorage.getItem("rain-calibration-v1") || "null");
    if (
      !c ||
      typeof c.deviceId !== "string" ||
      typeof c.recordedAt !== "string"
    )
      return null;
    const r = c.config;
    if (!r || (r.wetDigital !== 0 && r.wetDigital !== 1)) return null;
    for (const key of [
      "wetAnalogMin",
      "wetAnalogMax",
      "dryAnalogMin",
      "dryAnalogMax",
    ])
      if (!Number.isInteger(r[key]) || r[key] < 0 || r[key] > 1023) return null;
    if (
      r.wetAnalogMin > r.wetAnalogMax ||
      r.dryAnalogMin > r.dryAnalogMax ||
      !(r.wetAnalogMax < r.dryAnalogMin || r.dryAnalogMax < r.wetAnalogMin)
    )
      return null;
    return c;
  } catch {
    return null;
  }
}
export function CalibrationPanel({
  snapshot,
  live,
  onSave,
  onClear,
  calibration,
}: {
  snapshot: Snapshot | null;
  live: boolean;
  onSave: (c: Calibration) => void;
  onClear: () => void;
  calibration: Calibration | null;
}) {
  const [dry, setDry] = useState<Observation[]>([]),
    [wet, setWet] = useState<Observation[]>([]),
    [capturing, setCapturing] = useState<"dry" | "wet" | null>(null),
    [message, setMessage] = useState("");
  const samples = useRef<Observation[]>([]),
    last = useRef<number | null>(null),
    device = useRef(""),
    boot = useRef("");
  useEffect(() => {
    if (!capturing) return;
    if (!live || !snapshot || !snapshot.rain.valid) {
      setCapturing(null);
      samples.current = [];
      setMessage("Capture stopped: valid live rain readings are required.");
      return;
    }
    if (
      device.current !== snapshot.device_id ||
      boot.current !== snapshot.boot_id
    ) {
      setCapturing(null);
      setDry([]);
      setWet([]);
      setMessage("Device or boot changed. Repeat both captures.");
      return;
    }
    if (last.current === snapshot.rain.sample_seq) return;
    last.current = snapshot.rain.sample_seq;
    samples.current.push({
      analog: snapshot.rain.analog!,
      digital: snapshot.rain.digital!,
      at: performance.now(),
    });
    const collected = samples.current;
    setMessage(
      `Capturing ${capturing}: ${collected.length} real observations. Keep the plate state steady.`,
    );
    if (
      collected.length >= 10 &&
      collected[collected.length - 1].at - collected[0].at >= 4500
    ) {
      if (collected.some((o) => o.digital !== collected[0].digital)) {
        setMessage(
          "Digital output changed during capture. Adjust/steady the plate and repeat.",
        );
      } else {
        if (capturing === "dry") setDry([...collected]);
        else setWet([...collected]);
        setMessage(
          `${capturing === "dry" ? "Dry" : "Damp"} observations captured from this device.`,
        );
      }
      setCapturing(null);
    }
  }, [snapshot, live, capturing]);
  useEffect(() => {
    if (
      snapshot &&
      device.current &&
      (snapshot.device_id !== device.current ||
        snapshot.boot_id !== boot.current)
    ) {
      setDry([]);
      setWet([]);
    }
  }, [snapshot]);
  function start(kind: "dry" | "wet") {
    if (!snapshot || !live) return;
    if (
      device.current !== snapshot.device_id ||
      boot.current !== snapshot.boot_id
    ) {
      setDry([]);
      setWet([]);
    }
    device.current = snapshot.device_id;
    boot.current = snapshot.boot_id;
    samples.current = [];
    last.current = null;
    if (kind === "dry") setDry([]);
    else setWet([]);
    setCapturing(kind);
    setMessage("Waiting for real sensor observations…");
  }
  function save() {
    if (
      !dry.length ||
      !wet.length ||
      !snapshot ||
      !live ||
      snapshot.device_id !== device.current ||
      snapshot.boot_id !== boot.current
    ) {
      setMessage("Capture both states on the current live device first.");
      return;
    }
    if (dry[0].digital === wet[0].digital) {
      setMessage(
        "Dry and damp digital levels are identical. Adjust the potentiometer and repeat; calibration was not saved.",
      );
      return;
    }
    const dmin = Math.min(...dry.map((o) => o.analog)),
      dmax = Math.max(...dry.map((o) => o.analog));
    const wmin = Math.min(...wet.map((o) => o.analog)),
      wmax = Math.max(...wet.map((o) => o.analog));
    if (!(dmax < wmin || wmax < dmin)) {
      setMessage(
        "Observed analog ranges overlap. Calibration cannot establish consistency bands; repeat or review the module.",
      );
      return;
    }
    const lowEnd = Math.min(dmax, wmax),
      highStart = Math.max(dmin, wmin),
      distance = highStart - lowEnd;
    if (distance < 10) {
      setMessage(
        "Analog separation is under 10 ADC counts. Repeat with clearer states; no reliable consistency bands established.",
      );
      return;
    }
    // Central 20% of observed separation remains uncertain. No intensity is inferred.
    const lower = Math.floor(lowEnd + distance * 0.4),
      upper = Math.ceil(lowEnd + distance * 0.6);
    const wetLow = wmax < dmin;
    const config: RainConfig = {
      wetDigital: wet[0].digital,
      wetAnalogMin: wetLow ? 0 : upper,
      wetAnalogMax: wetLow ? lower : 1023,
      dryAnalogMin: wetLow ? upper : 0,
      dryAnalogMax: wetLow ? 1023 : lower,
    };
    onSave({
      deviceId: snapshot.device_id,
      config,
      recordedAt: new Date().toISOString(),
    });
    setMessage(
      "Calibration saved for this device. Confirm wet/dry operation repeatedly before the demo.",
    );
    setDry([]);
    setWet([]);
  }
  const describe = (list: Observation[]) =>
    list.length
      ? `${list.length} observations · AO ${Math.min(...list.map((o) => o.analog))}–${Math.max(...list.map((o) => o.analog))} · DO ${list[0].digital}`
      : "Not captured";
  const button =
    "rounded-lg border border-slate-600 px-4 py-2 text-sm hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-cyan-300";
  return (
    <details className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
      <summary className="cursor-pointer font-medium">
        Rain calibration · actual plate observations
      </summary>
      <p className="mt-4 text-sm leading-6 text-slate-400">
        Verify safe A0 voltage first. Keep electronics dry. Capture a dry plate,
        then dampen the sensing plate only and capture again. Each capture
        requires at least 10 received observations over 4.5 seconds. Do not move
        the potentiometer afterwards.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <button
            className={button}
            disabled={!live || !!capturing}
            onClick={() => start("dry")}
          >
            Capture dry plate
          </button>
          <p className="mt-2 text-xs text-slate-400">{describe(dry)}</p>
        </div>
        <div>
          <button
            className={button}
            disabled={!live || !!capturing}
            onClick={() => start("wet")}
          >
            Capture damp plate
          </button>
          <p className="mt-2 text-xs text-slate-400">{describe(wet)}</p>
        </div>
      </div>
      <p role="status" className="mt-4 text-sm text-cyan-200">
        {message}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className={button}
          disabled={!!capturing || !dry.length || !wet.length || !live}
          onClick={save}
        >
          Save observed calibration
        </button>
        <button
          className={button}
          onClick={() => {
            setCapturing(null);
            setDry([]);
            setWet([]);
            onClear();
            setMessage("Calibration cleared. Rain interpretation is unknown.");
          }}
        >
          Clear calibration
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">
        {calibration
          ? `Configured for ${calibration.deviceId}. Wet digital level: ${calibration.config.wetDigital}. `
          : "No verified calibration. "}
        Only configuration bands and polarity are saved locally; raw captures
        are session-only. Bands use the observed separation, with a central 20%
        uncertain zone; this is an engineering consistency check, not scientific
        rain-intensity calibration.
      </p>
    </details>
  );
}
