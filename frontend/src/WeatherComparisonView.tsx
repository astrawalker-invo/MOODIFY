import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { Point } from "./useStation";
import type { WeatherApiData } from "./useWeatherApi";

ChartJS.register(
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend
);

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

type WeatherComparisonProps = {
  sensorPoints: Point[];
  liveSensorTempC: number | null;
  liveSensorHumidity: number | null;
  unit: "C" | "F";
  apiData: WeatherApiData | null;
  apiLoading: boolean;
  apiError: string | null;
  lastUpdated: number | null;
  nextRefreshSec: number;
  onRefreshApi: () => void;
};

export default function WeatherComparisonView({
  sensorPoints,
  liveSensorTempC,
  liveSensorHumidity,
  unit,
  apiData,
  apiLoading,
  apiError,
  lastUpdated,
  nextRefreshSec,
  onRefreshApi,
}: WeatherComparisonProps) {
  const [viewFilter, setViewFilter] = useState<"both" | "temp" | "hum">("both");

  // Convert celsius to display unit
  const toDisplayTemp = (c: number | null) => {
    if (c === null) return null;
    return unit === "C" ? c : (c * 9) / 5 + 32;
  };

  // Recent 30 sensor samples for live comparison chart
  const recentPoints = useMemo(() => {
    return sensorPoints.slice(-30);
  }, [sensorPoints]);

  const displaySensorTemp = toDisplayTemp(liveSensorTempC);
  const displayApiTemp = apiData ? toDisplayTemp(apiData.temperature) : null;

  // Live Deltas computed dynamically whenever sensor sends a sample
  const tempDelta =
    displaySensorTemp !== null && displayApiTemp !== null
      ? displaySensorTemp - displayApiTemp
      : null;

  const humDelta =
    liveSensorHumidity !== null && apiData?.humidity !== undefined
      ? liveSensorHumidity - apiData.humidity
      : null;

  // Chart datasets comparing live sensor vs weather API
  const chartData = useMemo(() => {
    const labels = recentPoints.map((p) => formatTime(p.received));
    const sensorTempData = recentPoints.map((p) =>
      toDisplayTemp(p.temperature)
    );
    const sensorHumData = recentPoints.map((p) => p.humidity);

    // Weather API reference baseline across the timeline
    const apiTempData = recentPoints.map(() =>
      apiData ? toDisplayTemp(apiData.temperature) : null
    );
    const apiHumData = recentPoints.map(() =>
      apiData ? apiData.humidity : null
    );

    const datasets: any[] = [];

    if (viewFilter === "both" || viewFilter === "temp") {
      // 1. Live Sensor Temperature
      datasets.push({
        label: `Live Sensor Temp (°${unit})`,
        data: sensorTempData,
        borderColor: "#f43f5e", // Rose
        backgroundColor: "rgba(244, 63, 94, 0.12)",
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: "#f43f5e",
        tension: 0.35,
        fill: viewFilter === "temp",
        yAxisID: "yTemp",
      });

      // 2. Weather API Temperature (Dashed Reference Line)
      datasets.push({
        label: `Greater Noida API Temp (°${unit})`,
        data: apiTempData,
        borderColor: "#fbbf24", // Amber dashed
        borderDash: [6, 4],
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0,
        yAxisID: "yTemp",
      });
    }

    if (viewFilter === "both" || viewFilter === "hum") {
      // 3. Live Sensor Humidity
      datasets.push({
        label: "Live Sensor Humidity (%)",
        data: sensorHumData,
        borderColor: "#06b6d4", // Cyan
        backgroundColor: "rgba(6, 182, 212, 0.12)",
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: "#06b6d4",
        tension: 0.35,
        fill: viewFilter === "hum",
        yAxisID: "yHum",
      });

      // 4. Weather API Humidity (Dashed Reference Line)
      datasets.push({
        label: "Greater Noida API Humidity (%)",
        data: apiHumData,
        borderColor: "#818cf8", // Indigo dashed
        borderDash: [6, 4],
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0,
        yAxisID: "yHum",
      });
    }

    return { labels, datasets };
  }, [recentPoints, apiData, unit, viewFilter]);

  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            color: "#d8b4fe",
            font: { size: 11, weight: "bold" },
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: "rgba(18, 8, 43, 0.95)",
          titleColor: "#f3e8ff",
          bodyColor: "#e9d5ff",
          borderColor: "rgba(168, 85, 247, 0.4)",
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y;
              if (val === null || val === undefined) return "";
              const label = ctx.dataset.label || "";
              return label.includes("Humidity")
                ? ` ${label}: ${val.toFixed(1)}%`
                : ` ${label}: ${val.toFixed(1)}°${unit}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(168, 85, 247, 0.08)" },
          ticks: { color: "#c084fc", font: { size: 10 }, maxRotation: 0 },
        },
        yTemp: {
          type: "linear",
          position: "left",
          display: viewFilter === "both" || viewFilter === "temp",
          grid: { color: "rgba(244, 63, 94, 0.08)" },
          ticks: {
            color: "#f43f5e",
            font: { size: 10, weight: "bold" },
            callback: (v) => `${v}°`,
          },
          title: {
            display: true,
            text: `Temperature (°${unit})`,
            color: "#f43f5e",
            font: { size: 10, weight: "bold" },
          },
        },
        yHum: {
          type: "linear",
          position: "right",
          display: viewFilter === "both" || viewFilter === "hum",
          grid: { drawOnChartArea: false },
          ticks: {
            color: "#06b6d4",
            font: { size: 10, weight: "bold" },
            callback: (v) => `${v}%`,
          },
          title: {
            display: true,
            text: "Humidity (%)",
            color: "#06b6d4",
            font: { size: 10, weight: "bold" },
          },
          min: 0,
          max: 100,
        },
      },
    }),
    [unit, viewFilter]
  );

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Location & Sync Status */}
      <div className="rounded-3xl border border-purple-500/15 bg-gradient-to-r from-[#1b0d36]/90 via-[#160b29]/90 to-[#120726]/90 p-5 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Live Sensor vs Greater Noida Weather Benchmark
            </h2>
          </div>
          <p className="text-xs text-purple-300/70 mt-1">
            Realtime ESP8266 DHT11 sensor feed compared continuously against Open-Meteo API for Greater Noida (28.47°N, 77.50°E).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] font-semibold text-purple-300">
              API Refresh in: <span className="font-mono text-amber-300">{formatCountdown(nextRefreshSec)}</span>
            </div>
            <div className="text-[10px] text-purple-400/60 font-mono">
              {lastUpdated ? `Synced: ${new Date(lastUpdated).toLocaleTimeString()}` : "Fetching..."}
            </div>
          </div>

          <button
            onClick={onRefreshApi}
            disabled={apiLoading}
            className="flex items-center gap-1.5 rounded-2xl bg-purple-600/80 hover:bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 cursor-pointer"
            title="Force refresh online weather data"
          >
            <svg
              className={`w-3.5 h-3.5 ${apiLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{apiLoading ? "Syncing..." : "Sync API"}</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300 flex items-center gap-2">
          <span className="font-bold">Weather API Note:</span> {apiError}. Using latest available readings.
        </div>
      )}

      {/* 3 Real-time Comparison Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Temperature Comparison */}
        <div className="rounded-[28px] border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">
              Temperature Comparison
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-500/20 text-purple-300">
              Continuous
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-[11px] font-semibold text-purple-300/70">Live Sensor</span>
              <p className="text-3xl font-black text-white font-mono mt-0.5">
                {displaySensorTemp !== null ? `${displaySensorTemp.toFixed(1)}°${unit}` : "—"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-amber-300/80">API Greater Noida</span>
              <p className="text-3xl font-black text-amber-300 font-mono mt-0.5">
                {displayApiTemp !== null ? `${displayApiTemp.toFixed(1)}°${unit}` : "—"}
              </p>
            </div>
          </div>

          {/* Delta Pill */}
          <div className="mt-4 p-2.5 rounded-2xl bg-purple-950/50 border border-purple-500/15 flex items-center justify-between text-xs">
            <span className="text-purple-300 font-medium">Difference (Δ Sensor - API):</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                tempDelta === null
                  ? "text-purple-400"
                  : Math.abs(tempDelta) <= 1.5
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : Math.abs(tempDelta) <= 3
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}
            >
              {tempDelta !== null ? `${tempDelta >= 0 ? "+" : ""}${tempDelta.toFixed(1)}°${unit}` : "—"}
            </span>
          </div>

          <p className="text-[10px] text-purple-400/60 mt-2">
            {tempDelta !== null && Math.abs(tempDelta) <= 1.5
              ? "✓ Accurate match within typical outdoor/indoor deviation."
              : tempDelta !== null && tempDelta > 0
              ? "Notice: Sensor reads higher (typical of indoor/terrace heat)."
              : "Live calculation updates with every sensor packet."}
          </p>
        </div>

        {/* Card 2: Humidity Comparison */}
        <div className="rounded-[28px] border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Humidity Comparison
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-500/20 text-purple-300">
              Continuous
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-[11px] font-semibold text-purple-300/70">Live Sensor</span>
              <p className="text-3xl font-black text-white font-mono mt-0.5">
                {liveSensorHumidity !== null ? `${liveSensorHumidity}%` : "—"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-indigo-300/80">API Greater Noida</span>
              <p className="text-3xl font-black text-indigo-300 font-mono mt-0.5">
                {apiData ? `${apiData.humidity}%` : "—"}
              </p>
            </div>
          </div>

          {/* Delta Pill */}
          <div className="mt-4 p-2.5 rounded-2xl bg-purple-950/50 border border-purple-500/15 flex items-center justify-between text-xs">
            <span className="text-purple-300 font-medium">Difference (Δ Sensor - API):</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                humDelta === null
                  ? "text-purple-400"
                  : Math.abs(humDelta) <= 5
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : Math.abs(humDelta) <= 10
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}
            >
              {humDelta !== null ? `${humDelta >= 0 ? "+" : ""}${humDelta}%` : "—"}
            </span>
          </div>

          <p className="text-[10px] text-purple-400/60 mt-2">
            DHT11 rated accuracy: ±5% RH tolerance against regional stations.
          </p>
        </div>

        {/* Card 3: Greater Noida Official Station Data */}
        <div className="rounded-[28px] border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Official Station Stats
              </span>
              <span className="text-[10px] text-purple-400/60 font-mono">Open-Meteo</span>
            </div>
            <p className="text-sm font-bold text-white mt-2">Greater Noida, India</p>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-purple-500/10 pt-3 text-center">
            <div>
              <span className="text-[10px] uppercase font-semibold text-purple-400/70">Feels Like</span>
              <p className="text-sm font-bold text-white font-mono mt-0.5">
                {apiData ? `${toDisplayTemp(apiData.apparentTemperature)?.toFixed(1)}°` : "—"}
              </p>
            </div>
            <div className="border-x border-purple-500/10">
              <span className="text-[10px] uppercase font-semibold text-purple-400/70">Pressure</span>
              <p className="text-sm font-bold text-white font-mono mt-0.5">
                {apiData ? `${apiData.pressure} hPa` : "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-purple-400/70">Wind</span>
              <p className="text-sm font-bold text-white font-mono mt-0.5">
                {apiData ? `${apiData.windSpeed} km/h` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Chart Container */}
      <div className="rounded-[32px] border border-purple-500/15 bg-gradient-to-b from-[#180b33]/90 to-[#120726]/90 p-6 backdrop-blur-2xl shadow-2xl shadow-purple-950/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Live Sensor vs Regional API Comparison Graph
            </h3>
            <p className="text-xs text-purple-300/60">
              Solid lines = Real-time Sensor stream • Dashed lines = Greater Noida 15-min API benchmark
            </p>
          </div>

          {/* Metric View Filter Buttons */}
          <div className="flex items-center rounded-2xl bg-[#130728] p-1 border border-purple-500/20 text-xs">
            <button
              onClick={() => setViewFilter("both")}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all ${
                viewFilter === "both"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/40"
                  : "text-purple-400/80 hover:text-white"
              }`}
            >
              All Metrics
            </button>
            <button
              onClick={() => setViewFilter("temp")}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all ${
                viewFilter === "temp"
                  ? "bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/40"
                  : "text-purple-400/80 hover:text-white"
              }`}
            >
              Temperature
            </button>
            <button
              onClick={() => setViewFilter("hum")}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all ${
                viewFilter === "hum"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/40"
                  : "text-purple-400/80 hover:text-white"
              }`}
            >
              Humidity
            </button>
          </div>
        </div>

        {/* The Chart */}
        <div className="h-80 w-full pt-2">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Explanatory Live Card */}
      <div className="rounded-3xl border border-purple-500/15 bg-[#160b29]/90 p-5 backdrop-blur-xl flex items-start gap-4">
        <div className="h-10 w-10 rounded-2xl bg-purple-900/40 border border-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.5M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
        </div>
        <div className="text-xs text-purple-300/80 space-y-1">
          <h4 className="font-bold text-white text-sm">How This Continuous Live Comparison Works:</h4>
          <p>
            1. **Local Sensor (ESP8266 DHT11):** Streams readings over WebSocket every 2 seconds. Any temperature fluctuation at your desk/terrace updates instantly.
          </p>
          <p>
            2. **Regional Weather API (Open-Meteo):** Updates its satellite and ground station models every 15 minutes.
          </p>
          <p>
            3. **Continuous Delta Calculation:** The comparison difference (Δ) recalculates dynamically on every single sensor transmission, so you get an immediate look at microclimate deviations.
          </p>
        </div>
      </div>
    </div>
  );
}
