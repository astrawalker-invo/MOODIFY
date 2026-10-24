import { memo, useMemo } from "react";
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

export default memo(function TemperatureChart({ points }: { points: Point[] }) {
  // Take the most recent 30 samples for a fluid, live moving stream
  const recent = useMemo(() => {
    return points.slice(-30);
  }, [points]);

  const latestPoint = recent[recent.length - 1];

  const chartData = useMemo(() => {
    const labels = recent.map((p) => formatTime(p.received));
    const tempData = recent.map((p) => p.temperature);
    const humData = recent.map((p) => p.humidity);

    return {
      labels,
      datasets: [
        {
          label: "Temperature (°C)",
          data: tempData,
          borderColor: "#f43f5e", // Vibrant coral / rose
          backgroundColor: "rgba(244, 63, 94, 0.12)",
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: "#f43f5e",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#ffffff",
          pointHoverBorderColor: "#f43f5e",
          tension: 0.4,
          fill: true,
          yAxisID: "yTemp",
        },
        {
          label: "Humidity (%)",
          data: humData,
          borderColor: "#06b6d4", // Vibrant cyan / electric blue
          backgroundColor: "rgba(6, 182, 212, 0.12)",
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: "#06b6d4",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#ffffff",
          pointHoverBorderColor: "#06b6d4",
          tension: 0.4,
          fill: true,
          yAxisID: "yHum",
        },
      ],
    };
  }, [recent]);

  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false, // We have a custom badge header
        },
        tooltip: {
          backgroundColor: "rgba(18, 10, 34, 0.95)",
          titleColor: "#e9d5ff",
          bodyColor: "#f3e8ff",
          borderColor: "rgba(168, 85, 247, 0.35)",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 12,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            title: (items) => (items.length ? `Time: ${items[0].label}` : ""),
            label: (item) => {
              const val = item.parsed.y;
              if (val === null || val === undefined) return "";
              if (item.datasetIndex === 0) {
                return ` Temperature: ${val.toFixed(1)} °C`;
              }
              return ` Humidity: ${val.toFixed(1)} %`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: "rgba(168, 85, 247, 0.06)",
          },
          ticks: {
            color: "#a855f7",
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7,
          },
          border: { display: false },
        },
        yTemp: {
          type: "linear",
          position: "left",
          min: 0,
          max: 50,
          grid: {
            color: "rgba(244, 63, 94, 0.08)",
          },
          ticks: {
            color: "#f43f5e",
            font: { size: 10, weight: 600 },
            callback: (val) => `${val}°C`,
          },
          border: { display: false },
        },
        yHum: {
          type: "linear",
          position: "right",
          min: 0,
          max: 100,
          grid: {
            drawOnChartArea: false, // Don't duplicate grid lines
          },
          ticks: {
            color: "#06b6d4",
            font: { size: 10, weight: 600 },
            callback: (val) => `${val}%`,
          },
          border: { display: false },
        },
      },
    }),
    []
  );

  return (
    <section className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-[#160b29]/90 p-6 backdrop-blur-xl shadow-2xl shadow-purple-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400/80">
            Real-time Telemetry Graph
          </span>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            Live Temperature & Humidity Variation
          </h2>
        </div>

        {/* Live Values Badges / Legend */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 border border-rose-500/20">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-semibold text-rose-300">
              Temp:{" "}
              {latestPoint?.temperature !== null && latestPoint?.temperature !== undefined
                ? `${latestPoint.temperature.toFixed(1)}°C`
                : "--"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 border border-cyan-500/20">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-cyan-300">
              Humidity:{" "}
              {latestPoint?.humidity !== null && latestPoint?.humidity !== undefined
                ? `${latestPoint.humidity.toFixed(1)}%`
                : "--"}
            </span>
          </div>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="mt-5 h-56 sm:h-64">
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className="mt-5 flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-purple-500/20 bg-purple-950/20 p-5 text-center">
          <span className="text-xs font-medium text-purple-300">
            Awaiting Real-time Sensor Data...
          </span>
          <p className="mt-1 text-[11px] text-purple-400/60">
            Live Temperature & Humidity curves will stream continuously as samples arrive.
          </p>
        </div>
      )}
    </section>
  );
});
