import { useEffect, useRef, useState } from "react";
import { RainInterpreter, type RainState, type Snapshot } from "./sensors";
import type { Calibration } from "./calibration";
export function useRain(
  snapshot: Snapshot | null,
  live: boolean,
  calibration: Calibration | null,
) {
  const interpreter = useRef(new RainInterpreter()),
    last = useRef<{ boot: string; device: string; at: number } | null>(null);
  const previousConfig = useRef(calibration);
  const [state, setState] = useState<RainState>("unknown");
  useEffect(() => {
    if (
      !live ||
      !snapshot ||
      !calibration ||
      calibration.deviceId !== snapshot.device_id
    ) {
      interpreter.current.reset();
      last.current = null;
      setState("unknown");
      return;
    }
    const now = performance.now();
    if (
      previousConfig.current !== calibration ||
      !last.current ||
      last.current.boot !== snapshot.boot_id ||
      last.current.device !== snapshot.device_id ||
      now - last.current.at > 1500
    )
      interpreter.current.reset();
    previousConfig.current = calibration;
    last.current = {
      boot: snapshot.boot_id,
      device: snapshot.device_id,
      at: now,
    };
    setState(interpreter.current.update(snapshot, calibration.config, now));
  }, [snapshot, live, calibration]);
  return live && snapshot && calibration?.deviceId === snapshot.device_id
    ? state
    : "unknown";
}
