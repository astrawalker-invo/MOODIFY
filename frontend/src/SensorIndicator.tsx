import { memo } from "react";

type Props = {
  title: string;
  value: number | null;
  unit: string;
  maximum: number;
  note?: string;
  status: string;
  badge?: string;
  theme?: "amber" | "cyan" | "indigo" | "emerald";
};

export default memo(function SensorIndicator({
  title,
  value,
  unit,
  maximum,
  note,
  status,
  badge,
  theme = "cyan",
}: Props) {
  const percent =
    value === null ? 0 : Math.max(0, Math.min(1, value / maximum));
  const circumference = 2 * Math.PI * 40;

  // Weather-themed dynamic color schemes
  const themes = {
    amber: {
      stroke: "#fb923c",
      strokeGradient: ["#f97316", "#fde047"],
      glow: "from-amber-500/10 to-orange-500/0",
      accent: "text-amber-400",
      badgeBg: "bg-amber-400/10 text-amber-300 border-amber-400/20",
      icon: (
        <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m0 0a3 3 0 100-6 3 3 0 000 6zm0-11a2 2 0 00-2 2v8.5a4 4 0 104 0V2a2 2 0 00-2-2z" />
        </svg>
      ),
    },
    cyan: {
      stroke: "#38bdf8",
      strokeGradient: ["#0284c7", "#38bdf8"],
      glow: "from-sky-500/10 to-cyan-500/0",
      accent: "text-sky-400",
      badgeBg: "bg-sky-400/10 text-sky-300 border-sky-400/20",
      icon: (
        <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    indigo: {
      stroke: "#818cf8",
      strokeGradient: ["#6366f1", "#a855f7"],
      glow: "from-indigo-500/10 to-purple-500/0",
      accent: "text-indigo-400",
      badgeBg: "bg-indigo-400/10 text-indigo-300 border-indigo-400/20",
      icon: (
        <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    emerald: {
      stroke: "#34d399",
      strokeGradient: ["#059669", "#34d399"],
      glow: "from-emerald-500/10 to-teal-500/0",
      accent: "text-emerald-400",
      badgeBg: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
      icon: (
        <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
  }[theme];

  const gradientId = `gauge-grad-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-6 backdrop-blur-xl shadow-2xl shadow-black/40 transition-all duration-300 hover:border-white/20 hover:scale-[1.01]">
      {/* Ambient gradient top glow */}
      <div className={`absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${themes.glow} blur-2xl pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-60`} />

      {/* Header with Title and Icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
            {themes.icon}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 tracking-tight">{title}</h2>
            <p className="text-xs text-slate-400 font-medium">Real-time sensor feed</p>
          </div>
        </div>

        {badge && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight ${themes.badgeBg}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            {badge}
          </span>
        )}
      </div>

      {/* Main Metric & Visual Ring */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
              {value === null ? "—" : value.toFixed(1)}
            </span>
            <span className={`text-xl font-medium ${themes.accent}`}>{unit}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {status}
          </p>
        </div>

        {/* Circular Gauge */}
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={themes.strokeGradient[0]} />
                <stop offset="100%" stopColor={themes.strokeGradient[1]} />
              </linearGradient>
            </defs>
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="7"
            />
            {/* Active progress */}
            {value !== null && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - percent)}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            )}
          </svg>
          <div className="absolute text-center">
            <span className="text-xs font-semibold text-slate-300">
              {value !== null ? `${Math.round(percent * 100)}%` : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Note / Weather context footer */}
      {note && (
        <div className="mt-5 border-t border-white/[0.06] pt-3.5">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {note}
          </p>
        </div>
      )}
    </article>
  );
});
