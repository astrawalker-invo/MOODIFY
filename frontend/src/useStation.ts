import { useEffect, useRef, useState } from "react";
import { parseSnapshot, RainInterpreter, type Snapshot } from "./sensors";
export type Point = {
  received: number;
  temperature: number | null;
  humidity: number | null;
};
export function useStation(host: string, port: string, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [socketState, setSocketState] = useState("disconnected");
  const [received, setReceived] = useState<number | null>(null),
    [lastMono, setLastMono] = useState<number | null>(null);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [error, setError] = useState(""),
    [history, setHistory] = useState<Point[]>([]),
    [now, setNow] = useState(performance.now());
  const interpreter = useRef(new RainInterpreter());
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const prune = setInterval(
      () =>
        setHistory((old) => {
          const cutoff = Date.now() - 1800000;
          return old.some((p) => p.received < cutoff)
            ? old.filter((p) => p.received >= cutoff)
            : old;
        }),
      10000,
    );
    return () => clearInterval(prune);
  }, []);
  useEffect(() => {
    setOpenedAt(null);
    setSnapshot(null);
    setReceived(null);
    setLastMono(null);
    setHistory([]);
    setError("");
    interpreter.current.reset();
    if (!enabled) {
      setSocketState("disconnected");
      return;
    }
    let disposed = false,
      ws: WebSocket | null = null,
      retry: ReturnType<typeof setTimeout> | undefined,
      openingTimeout: ReturnType<typeof setTimeout> | undefined,
      attempt = 0;
    let previous: Snapshot | null = null,
      lastDht: number | null = null,
      lastAccepted: number | null = null,
      gap = true;
    const insert = (temperature: number | null, humidity: number | null) =>
      setHistory((old) =>
        [
          ...old.filter((p) => p.received >= Date.now() - 1800000),
          { received: Date.now(), temperature, humidity },
        ].slice(-1200),
      );
    function connect() {
      if (disposed) return;
      setSocketState("connecting");
      setOpenedAt(null);
      try {
        ws = new WebSocket(`ws://${host}:${port}/`);
      } catch {
        setError("Connection URL could not be opened.");
        schedule();
        return;
      }
      openingTimeout = setTimeout(() => {
        if (!disposed && ws?.readyState === WebSocket.CONNECTING) {
          setError("Device connection timed out. Retrying.");
          ws.close();
        }
      }, 10000);
      ws.onopen = () => {
        clearTimeout(openingTimeout);
        if (!disposed) {
          setOpenedAt(performance.now());
          setSocketState("awaiting");
        }
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          if (typeof event.data !== "string")
            throw Error("Non-text message rejected");
          const s = parseSnapshot(event.data),
            mono = performance.now();
          if (previous && previous.device_id !== s.device_id)
            throw Error("Device identity changed: disconnect and verify host");
          const reboot = previous && previous.boot_id !== s.boot_id;
          if (previous && !reboot) {
            const delta = (s.seq - previous.seq) >>> 0;
            if (delta === 0) return;
            if (delta >= 2147483648)
              throw Error(
                "Sequence decreased or out-of-order snapshot; verify device reboot",
              );
          }
          if (reboot) {
            gap = true;
            lastDht = null;
            interpreter.current.reset();
          }
          if (lastAccepted !== null && mono - lastAccepted > 5000) gap = true;
          if (s.dht.sample_seq !== lastDht) {
            if (lastDht !== null && (s.dht.sample_seq - lastDht) >>> 0 !== 1)
              gap = true;
            if (gap) insert(null, null);
            const isValid =
              s.dht.valid &&
              s.dht.sample_age_ms !== null &&
              s.dht.sample_age_ms <= 5000;
            insert(
              isValid ? s.dht.temperature_c : null,
              isValid ? s.dht.humidity_percent : null,
            );
            lastDht = s.dht.sample_seq;
            gap = false;
          }
          previous = s;
          lastAccepted = mono;
          attempt = 0;
          setSnapshot(s);
          setReceived(Date.now());
          setLastMono(mono);
          setSocketState("open");
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Rejected message");
        }
      };
      ws.onerror = () => {
        if (!disposed)
          setError(
            "WebSocket error. Check power, host, network, and browser local-network permissions.",
          );
      };
      ws.onclose = () => {
        clearTimeout(openingTimeout);
        if (disposed) return;
        setSocketState("disconnected");
        if (!gap) insert(null, null);
        gap = true;
        interpreter.current.reset();
        schedule();
      };
    }
    function schedule() {
      if (disposed) return;
      retry = setTimeout(
        connect,
        Math.min(
          15000,
          1000 * 2 ** Math.min(attempt++, 4) * (0.9 + Math.random() * 0.2),
        ),
      );
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearTimeout(openingTimeout);
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [host, port, enabled]);
  const elapsed = lastMono === null ? Infinity : Math.max(0, now - lastMono);
  const state =
    socketState === "open"
      ? elapsed > 5000
        ? "stale"
        : "live"
      : socketState === "awaiting"
        ? openedAt !== null && now - openedAt > 5000
          ? "stale"
          : "connecting"
        : socketState;
  return { snapshot, state, received, error, history, elapsed };
}
