import { memo } from "react";

type Props = {
  value: number | null; // scale e.g. 0 to 10
  label: string;
  category: string;
};

export default memo(function ComfortArcGauge({ value, label, category }: Props) {
  // Normalize value 0 to 10
  const normalized = value === null ? 0 : Math.max(0, Math.min(10, value));
  const percent = normalized / 10;
  
  // Radius and semi-circle arc math
  // Semi-circle circumference for r=60 is PI * 60 = 188.49
  const radius = 55;
  const arcLength = Math.PI * radius; // 172.78
  const strokeDashoffset = arcLength * (1 - percent);

  return (
    <article className="relative overflow-hidden rounded-3xl border border-purple-500/15 bg-[#160b29]/90 p-6 backdrop-blur-xl shadow-2xl shadow-purple-950/40">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400/80">
            Biometeorology
          </span>
          <h2 className="text-base font-bold text-white tracking-tight">{label}</h2>
        </div>
        <span className="text-purple-400/60 text-xs">•••</span>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center">
        {/* Semi-circular SVG Gauge */}
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 140 85" className="w-44 h-28 overflow-visible">
            <defs>
              <linearGradient id="purpleGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="60%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
              <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#c084fc" floodOpacity="0.5" />
              </filter>
            </defs>
            {/* Background Arch */}
            <path
              d="M 15 75 A 55 55 0 0 1 125 75"
              fill="none"
              stroke="#261247"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* Active Neon Arch */}
            {value !== null && (
              <path
                d="M 15 75 A 55 55 0 0 1 125 75"
                fill="none"
                stroke="url(#purpleGaugeGrad)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={arcLength}
                strokeDashoffset={strokeDashoffset}
                filter="url(#gaugeGlow)"
                className="transition-all duration-700 ease-out"
              />
            )}
            {/* Tick marks */}
            {[0, 2.5, 5, 7.5, 10].map((tick, i) => {
              const angle = Math.PI - (tick / 10) * Math.PI;
              const x1 = 70 + Math.cos(angle) * 44;
              const y1 = 75 - Math.sin(angle) * 44;
              return (
                <circle
                  key={i}
                  cx={x1}
                  cy={y1}
                  r="1.5"
                  fill="rgba(192, 132, 252, 0.4)"
                />
              );
            })}
          </svg>

          {/* Centered value */}
          <div className="absolute bottom-2 text-center">
            <span className="text-2xl font-extrabold tracking-tight text-white font-mono">
              {value === null ? "—" : value.toFixed(1)}
            </span>
            <span className="text-xs text-purple-300 ml-1 font-semibold">IX</span>
          </div>
        </div>

        <p className="mt-2 text-xs font-semibold text-purple-300 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          {category}
        </p>
      </div>
    </article>
  );
});
