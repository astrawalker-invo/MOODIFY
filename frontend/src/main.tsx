import React, { Suspense, lazy, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useStation } from "./useStation";
import { useRain } from "./useRain";
import { readCalibration, type Calibration } from "./calibration";
import RainVisual from "./RainVisual";
import { dewPoint } from "./sensors";
import "./style.css";

import { useWeatherApi } from "./useWeatherApi";

const TemperatureChart = lazy(() => import("./TemperatureChart"));
const WeatherComparisonView = lazy(() => import("./WeatherComparisonView"));

type Settings = {
  host: string;
  port: string;
  name: string;
  point: string;
  location: string;
};

const defaults: Settings = {
  host: "192.168.0.111",
  port: "81",
  name: "SkyPulse Station",
  point: "ESP8266 Live Station",
  location: "Terrace Lab, NodeMCU",
};

function load(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem("station-settings") || "null");
    if (v) {
      if (!v.host || v.host === "localhost" || v.host === "weather-node.local") {
        v.host = "192.168.0.111";
      }
      v.port = "81";
    }
    return v &&
      Object.keys(defaults).every(
        (k) => typeof v[k] === "string" && v[k].length <= 128,
      )
      ? v
      : defaults;
  } catch {
    return defaults;
  }
}

function App() {
  const [settings, setSettings] = useState(load);
  const [showIpModal, setShowIpModal] = useState(false);
  const [ipInput, setIpInput] = useState(settings.host);
  const [calibration] = useState<Calibration | null>(readCalibration);
  const [unit, setUnit] = useState<"C" | "F">("C");
  const [activeTab, setActiveTab] = useState<"home" | "chart" | "compare">("home");

  // Open-Meteo Weather API hook (Greater Noida, 15m auto-sync)
  const weatherApi = useWeatherApi();

  const saveIp = (newIp: string) => {
    const val = newIp.trim() || defaults.host;
    const updated = { ...settings, host: val };
    setSettings(updated);
    localStorage.setItem("station-settings", JSON.stringify(updated));
    setShowIpModal(false);
  };

  // Real ESP8266 Hardware Hook via WebSocket
  const {
    snapshot: s,
    state,
    received,
    history,
    elapsed,
  } = useStation(settings.host, settings.port, true);

  // Sensor freshness validation
  const dhtFresh =
    state === "live" &&
    s?.dht.sample_age_ms !== null &&
    s?.dht.sample_age_ms !== undefined &&
    s.dht.sample_age_ms + elapsed <= 5000;

  const rainFresh =
    state === "live" &&
    s?.rain.sample_age_ms !== null &&
    s?.rain.sample_age_ms !== undefined &&
    s.rain.sample_age_ms + elapsed <= 1000;

  // Real sensor readings from ESP8266
  const rawTempC = dhtFresh && s?.dht.valid ? s.dht.temperature_c : null;
  const humidity = dhtFresh && s?.dht.valid ? s.dht.humidity_percent : null;

  const displayTemp = useMemo(() => {
    if (rawTempC === null) return null;
    return unit === "C" ? rawTempC : (rawTempC * 9) / 5 + 32;
  }, [rawTempC, unit]);

  const rawDewC =
    rawTempC !== null && humidity !== null
      ? dewPoint(rawTempC, humidity)
      : null;

  const displayDew = useMemo(() => {
    if (rawDewC === null) return null;
    return unit === "C" ? rawDewC : (rawDewC * 9) / 5 + 32;
  }, [rawDewC, unit]);

  const rainAnalogVal = rainFresh && s?.rain.valid ? s.rain.analog : null;
  const rainDigitalVal = rainFresh && s?.rain.valid ? s.rain.digital : null;

  // Direct physical interpretation of LM393 Rain Sensor:
  // Digital LOW (0) means water detected on the sensor plate, or Analog < 750
  const isRainWet =
    rainFresh &&
    (rainDigitalVal === 0 || (rainAnalogVal !== null && rainAnalogVal < 750));
  const effectiveRainState: "wet" | "dry" = isRainWet ? "wet" : "dry";

  const weatherConditionText = useMemo(() => {
    if (state !== "live") return "Connecting to ESP8266...";
    if (isRainWet) return "Precipitation / Rain Active";
    if (rawTempC === null) return "Reading Sensors...";
    if (rawTempC >= 28) return "Warm Atmosphere";
    if (rawTempC >= 20) return "Clear & Mild";
    return "Cool Climate";
  }, [state, isRainWet, rawTempC]);

  return (
    <div className="min-h-screen bg-[#0e0720] text-purple-100 flex flex-col md:flex-row antialiased selection:bg-purple-600/30 selection:text-purple-200">
      {/* Background Ambient Radial Purple Glows */}
      <div className="fixed -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-purple-700/15 blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-fuchsia-700/10 blur-[150px] pointer-events-none" />

      {/* Slim Vertical Left Sidebar: only Home and Chart */}
      <aside className="w-full md:w-20 bg-[#12082b]/80 border-b md:border-b-0 md:border-r border-purple-500/10 backdrop-blur-2xl p-4 flex md:flex-col items-center justify-between z-40 shrink-0">
        <div className="flex md:flex-col items-center gap-6">
          {/* Brand Logo */}
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-fuchsia-500 p-0.5 shadow-lg shadow-purple-600/30">
            <div className="h-full w-full rounded-[14px] bg-[#12082b] flex items-center justify-center text-purple-300">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
          </div>

          {/* Navigation: Exactly 2 items - Home and Chart */}
          <nav className="flex md:flex-col items-center gap-3">
            {/* 1. Home Tab */}
            <button
              onClick={() => setActiveTab("home")}
              title="Home Dashboard"
              className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === "home"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                  : "text-purple-300/60 hover:text-white hover:bg-purple-900/30"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>

            {/* 2. Chart Tab */}
            <button
              onClick={() => setActiveTab("chart")}
              title="Temperature History & Charts"
              className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === "chart"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                  : "text-purple-300/60 hover:text-white hover:bg-purple-900/30"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* 3. Live Sensor vs Greater Noida Weather Benchmark */}
            <button
              onClick={() => setActiveTab("compare")}
              title="Sensor vs Greater Noida Weather Benchmark"
              className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                activeTab === "compare"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/40"
                  : "text-purple-300/60 hover:text-white hover:bg-purple-900/30"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </button>
          </nav>
        </div>

        {/* Live Hardware Status Indicator */}
        <div className="flex md:flex-col items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              state === "live" ? "bg-emerald-400 animate-ping" : "bg-purple-700"
            }`}
            title={state === "live" ? "ESP8266 Connected" : "Awaiting ESP8266"}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 p-5 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
              <span>ESP8266 Live Node</span>
              <span>•</span>
              <span className="text-purple-300/60">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
              {activeTab === "home"
                ? "Hyperlocal Weather Station"
                : activeTab === "chart"
                ? "Sensor Telemetry & Trends"
                : "Live Sensor vs Greater Noida Weather Benchmark"}
            </h1>
          </div>

          {/* Unit Toggle and Connection Badge */}
          <div className="flex items-center gap-3">
            {/* °C / °F Unit Toggle */}
            <div className="flex items-center rounded-2xl bg-[#160b29] p-1 border border-purple-500/20">
              <button
                onClick={() => setUnit("C")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  unit === "C" ? "bg-purple-600 text-white shadow-md shadow-purple-600/40" : "text-purple-400/80 hover:text-white"
                }`}
              >
                °C
              </button>
              <button
                onClick={() => setUnit("F")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  unit === "F" ? "bg-purple-600 text-white shadow-md shadow-purple-600/40" : "text-purple-400/80 hover:text-white"
                }`}
              >
                °F
              </button>
            </div>

            {/* Connection Status Pill with IP config button */}
            <button
              onClick={() => {
                setIpInput(settings.host);
                setShowIpModal(true);
              }}
              className={`flex items-center gap-2 rounded-2xl px-3.5 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                state === "live"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-purple-950/40 border-purple-500/20 text-purple-300 hover:border-purple-400/50"
              }`}
              title="Click to change or verify ESP8266 IP address"
            >
              <span className={`h-2 w-2 rounded-full ${state === "live" ? "bg-emerald-400 animate-pulse" : "bg-purple-500 animate-ping"}`} />
              <span>{state === "live" ? "ESP8266 Live" : `Connecting (${settings.host})...`}</span>
              <span className="text-[10px] text-purple-400/80 underline ml-1">Change IP</span>
            </button>
          </div>
        </div>

        {/* Change IP Modal */}
        {showIpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-purple-500/25 bg-[#160b29] p-6 shadow-2xl shadow-purple-950/80">
              <h3 className="text-base font-bold text-white">ESP8266 IP Address</h3>
              <p className="text-xs text-purple-300/70 mt-1">
                Enter the IP address printed on your Arduino Serial Monitor after Wi-Fi connects.
              </p>
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder="e.g. 192.168.1.5 or weather-node.local"
                className="mt-4 w-full rounded-xl bg-purple-950/60 border border-purple-500/30 px-3.5 py-2 text-sm text-white font-mono outline-none focus:border-purple-400"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setShowIpModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-purple-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveIp(ipInput)}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500"
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: HOME PAGE */}
        {activeTab === "home" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Hero Current Weather Card */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="relative overflow-hidden rounded-[32px] border border-purple-500/15 bg-gradient-to-b from-[#1b0d36]/95 to-[#120726]/95 p-7 backdrop-blur-2xl shadow-2xl shadow-purple-950/60">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold text-white tracking-tight">{settings.name}</h2>
                    <p className="text-xs font-medium text-purple-300/70 mt-0.5">{settings.location}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-500/20 text-purple-300 font-mono">
                    {s?.device_id || "NodeMCU"}
                  </span>
                </div>

                {/* Rain plate visual state */}
                <div className="my-2">
                  <RainVisual state={effectiveRainState} live={!!rainFresh} configured={true} />
                </div>

                {/* Big Temperature Readout */}
                <div className="flex items-baseline justify-between mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-black text-white tracking-tight font-mono">
                      {displayTemp === null ? "—" : Math.round(displayTemp)}
                    </span>
                    <span className="text-3xl font-bold text-purple-400">°{unit}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-semibold tracking-wider text-purple-400/80">Atmosphere</span>
                    <p className="text-lg font-bold text-white capitalize">{weatherConditionText}</p>
                  </div>
                </div>

                {/* Quick Real Sensor Metrics */}
                <div className="mt-7 grid grid-cols-3 gap-3 border-t border-purple-500/10 pt-5 text-center">
                  <div>
                    <span className="text-[11px] font-semibold text-purple-400/70 uppercase">Rain ADC</span>
                    <p className="text-sm font-bold text-white font-mono mt-0.5">
                      {rainAnalogVal !== null ? `${rainAnalogVal}` : "—"}
                    </p>
                  </div>
                  <div className="border-x border-purple-500/10">
                    <span className="text-[11px] font-semibold text-purple-400/70 uppercase">Humidity</span>
                    <p className="text-sm font-bold text-white font-mono mt-0.5">
                      {humidity !== null ? `${humidity}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-purple-400/70 uppercase">Dew Point</span>
                    <p className="text-sm font-bold text-white font-mono mt-0.5">
                      {displayDew !== null ? `${displayDew.toFixed(1)}°` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Hardware Status Log Card */}
              <div className="rounded-[28px] border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Hardware Links</span>
                  <span className="text-[11px] font-semibold text-purple-400/60 font-mono">
                    {received ? new Date(received).toLocaleTimeString() : "Waiting for ping"}
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-purple-950/40 border border-purple-500/10">
                    <span className="text-purple-300 font-medium flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dhtFresh ? "bg-emerald-400" : "bg-purple-600"}`} />
                      DHT11 (GPIO D4)
                    </span>
                    <span className="font-mono text-purple-200 font-semibold">
                      {dhtFresh ? "Active · 2s interval" : "Waiting for reading"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-purple-950/40 border border-purple-500/10">
                    <span className="text-purple-300 font-medium flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${isRainWet ? "bg-fuchsia-400 animate-ping" : rainFresh ? "bg-emerald-400" : "bg-purple-600"}`} />
                      Rain Sensor (A0 / D5)
                    </span>
                    <span className="font-mono text-purple-200 font-semibold">
                      {rainFresh ? (isRainWet ? "Moisture Triggered" : "Plate Dry") : "Waiting for reading"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 4 Real Sensor Cards + Telemetry Chart Preview */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* 4 Sensor Cards Strip */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    Real Sensor Outputs
                  </span>
                  <span className="text-xs text-purple-400/60 font-mono">ESP8266 Live Feed</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {/* 1. Temp Card */}
                  <div className="rounded-[26px] border border-purple-500/15 bg-gradient-to-b from-[#190c33]/90 to-[#120726]/90 p-4 text-center hover:border-purple-400/30 transition-all shadow-xl shadow-purple-950/30">
                    <span className="text-xs font-semibold text-purple-300/80">Temperature</span>
                    <div className="my-3 flex justify-center">
                      <svg className="w-8 h-8 text-fuchsia-400 filter drop-shadow-[0_0_8px_rgba(232,121,249,0.5)]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <span className="text-2xl font-black text-white font-mono">
                      {displayTemp === null ? "—" : `${Math.round(displayTemp)}°`}
                    </span>
                    <p className="text-[10px] text-purple-400/70 mt-1 font-medium">DHT11 (D4)</p>
                  </div>

                  {/* 2. Humidity Card */}
                  <div className="rounded-[26px] border border-purple-500/15 bg-gradient-to-b from-[#190c33]/90 to-[#120726]/90 p-4 text-center hover:border-purple-400/30 transition-all shadow-xl shadow-purple-950/30">
                    <span className="text-xs font-semibold text-purple-300/80">Humidity</span>
                    <div className="my-3 flex justify-center">
                      <svg className="w-8 h-8 text-purple-400 filter drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <span className="text-2xl font-black text-white font-mono">
                      {humidity !== null ? `${humidity}%` : "—"}
                    </span>
                    <p className="text-[10px] text-purple-400/70 mt-1 font-medium">DHT11 (D4)</p>
                  </div>

                  {/* 3. Dew Point Card */}
                  <div className="rounded-[26px] border border-purple-500/15 bg-gradient-to-b from-[#190c33]/90 to-[#120726]/90 p-4 text-center hover:border-purple-400/30 transition-all shadow-xl shadow-purple-950/30">
                    <span className="text-xs font-semibold text-purple-300/80">Dew Point</span>
                    <div className="my-3 flex justify-center">
                      <svg className="w-8 h-8 text-pink-400 filter drop-shadow-[0_0_8px_rgba(244,114,182,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <span className="text-2xl font-black text-white font-mono">
                      {displayDew === null ? "—" : `${Math.round(displayDew)}°`}
                    </span>
                    <p className="text-[10px] text-purple-400/70 mt-1 font-medium">Magnus Calc</p>
                  </div>

                  {/* 4. Rain Plate Card */}
                  <div className="rounded-[26px] border border-purple-500/15 bg-gradient-to-b from-[#190c33]/90 to-[#120726]/90 p-4 text-center hover:border-purple-400/30 transition-all shadow-xl shadow-purple-950/30">
                    <span className="text-xs font-semibold text-purple-300/80">Rain Plate</span>
                    <div className="my-3 flex justify-center">
                      <svg className="w-8 h-8 text-violet-400 filter drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                    </div>
                    <span className="text-2xl font-black text-white capitalize font-mono">
                      {rainFresh ? (isRainWet ? "Wet" : "Dry") : "—"}
                    </span>
                    <p className="text-[10px] text-purple-400/70 mt-1 font-medium">LM393 (A0)</p>
                  </div>
                </div>
              </div>

              {/* Temperature Trend Chart */}
              <Suspense fallback={<div className="h-56 rounded-3xl bg-purple-950/40 animate-pulse" />}>
                <TemperatureChart points={history} />
              </Suspense>

              {/* Physical Hardware Pinout Banner */}
              <div className="rounded-3xl border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-purple-900/40 border border-purple-500/20 flex items-center justify-center text-purple-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">ESP8266 NodeMCU Wiring Setup</h3>
                    <p className="text-xs text-purple-300/60">DHT11: Pin D4 • Rain Analog: Pin A0 • Rain Digital: Pin D5</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-purple-500/20 border border-purple-400/30 px-3 py-1 text-xs font-semibold text-purple-200 font-mono">
                    ws://{settings.host}:{settings.port}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEDICATED CHART & ANALYTICS PAGE */}
        {activeTab === "chart" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-[28px] border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl">
                <span className="text-xs font-semibold text-purple-400 uppercase">Current Temperature</span>
                <p className="text-3xl font-black text-white font-mono mt-1">
                  {displayTemp !== null ? `${displayTemp.toFixed(1)} °${unit}` : "—"}
                </p>
                <p className="text-[11px] text-purple-300/60 mt-1">Direct DHT11 probe measurement</p>
              </div>

              <div className="rounded-[28px] border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl">
                <span className="text-xs font-semibold text-purple-400 uppercase">Recorded Data Points</span>
                <p className="text-3xl font-black text-white font-mono mt-1">
                  {history.length}
                </p>
                <p className="text-[11px] text-purple-300/60 mt-1">Rolling real-time memory buffer</p>
              </div>

              <div className="rounded-[28px] border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl">
                <span className="text-xs font-semibold text-purple-400 uppercase">Rain Plate ADC</span>
                <p className="text-3xl font-black text-white font-mono mt-1">
                  {rainAnalogVal !== null ? `${rainAnalogVal} / 1023` : "—"}
                </p>
                <p className="text-[11px] text-purple-300/60 mt-1">A0 ADC Voltage Readout</p>
              </div>
            </div>

            {/* Expanded Chart */}
            <Suspense fallback={<div className="h-80 rounded-3xl bg-purple-950/40 animate-pulse" />}>
              <TemperatureChart points={history} />
            </Suspense>

            {/* Sensor Pinout / Diagnostic Info */}
            <div className="rounded-3xl border border-purple-500/15 bg-[#160b29]/90 p-6 backdrop-blur-xl">
              <h3 className="text-base font-bold text-white mb-2">Physical Hardware Telemetry Information</h3>
              <p className="text-xs text-purple-300/70 leading-relaxed max-w-3xl">
                This dashboard reads live streaming frames directly from your ESP8266 NodeMCU over local WebSocket. 
                Temperature and humidity are sampled every 2 seconds by the DHT11, and moisture is continuously checked by the LM393 plate via the analog pin A0.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE SENSOR VS GREATER NOIDA WEATHER COMPARISON */}
        {activeTab === "compare" && (
          <Suspense fallback={<div className="h-96 rounded-3xl bg-purple-950/40 animate-pulse" />}>
            <WeatherComparisonView
              sensorPoints={history}
              liveSensorTempC={rawTempC}
              liveSensorHumidity={humidity}
              unit={unit}
              apiData={weatherApi.data}
              apiLoading={weatherApi.loading}
              apiError={weatherApi.error}
              lastUpdated={weatherApi.lastUpdated}
              nextRefreshSec={weatherApi.nextRefreshSec}
              onRefreshApi={weatherApi.refetch}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
