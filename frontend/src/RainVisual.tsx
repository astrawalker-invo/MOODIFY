import {
  Component,
  Suspense,
  lazy,
  memo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RainState } from "./sensors";

const Scene = lazy(() => import("./RainScene"));

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// Custom 3D-styled SVG illustration matching the reference (violet cloud with neon moon & drops)
function StaticScene({ wet }: { wet: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center py-2">
      <svg viewBox="0 0 240 180" className="h-full max-h-48 w-auto filter drop-shadow-[0_10px_20px_rgba(168,85,247,0.35)]" aria-hidden="true">
        <defs>
          <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2e1065" />
            <stop offset="50%" stopColor="#1e0c40" />
            <stop offset="100%" stopColor="#120626" />
          </linearGradient>
          <linearGradient id="neonMoonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="60%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="lightningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <filter id="moonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#e879f9" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Ambient Moon behind cloud */}
        <path
          d="M 130,30 A 38,38 0 0,0 168,96 A 44,44 0 1,1 130,30 Z"
          fill="url(#neonMoonGrad)"
          filter="url(#moonGlow)"
          opacity={wet ? "0.6" : "0.95"}
        />

        {/* Little decorative stars */}
        <circle cx="180" cy="40" r="2" fill="#f472b6" opacity="0.9" />
        <circle cx="195" cy="55" r="1.5" fill="#c084fc" opacity="0.7" />

        {/* 3D-styled Dark Violet Cloud Body */}
        <path
          d="M 60,120 
             A 28,28 0 0,1 85,75 
             A 38,38 0 0,1 150,70 
             A 32,32 0 0,1 185,110 
             A 24,24 0 0,1 175,135 
             L 65,135 
             A 18,18 0 0,1 60,120 Z"
          fill="url(#cloudGrad)"
          stroke="#4c1d95"
          strokeWidth="1.5"
        />

        {/* Highlight on top of cloud */}
        <path
          d="M 90,75 A 36,36 0 0,1 145,72"
          fill="none"
          stroke="#a855f7"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Raindrops / Lightning when wet */}
        {wet ? (
          <>
            {/* Neon Raindrops */}
            {[55, 75, 95, 115, 135, 155].map((x, i) => (
              <g key={i} className="animate-pulse" style={{ animationDelay: `${i * 120}ms` }}>
                <line
                  x1={x}
                  y1={145 + (i % 3) * 6}
                  x2={x - 4}
                  y2={160 + (i % 3) * 6}
                  stroke="#c084fc"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>
            ))}
            {/* Mini neon lightning */}
            <path
              d="M 105,135 L 98,150 L 106,151 L 96,168"
              fill="none"
              stroke="url(#lightningGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          /* Subtle soft glow under dry cloud */
          <ellipse cx="120" cy="148" rx="45" ry="4" fill="#a855f7" opacity="0.15" />
        )}
      </svg>
    </div>
  );
}

export default memo(function RainVisual({
  state,
  live,
  configured: _configured,
}: {
  state: RainState;
  live: boolean;
  configured: boolean;
}) {
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [use3d, setUse3d] = useState(false); // default to our sleek reference 3D SVG
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    let inView = true;
    const change = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      change();
    });
    if (container.current) observer.observe(container.current);
    document.addEventListener("visibilitychange", change);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", change);
    };
  }, []);

  const isRaining = live && state === "wet";
  const displayTitle = !live
    ? "Connecting Station"
    : state === "wet"
      ? "Rain Active"
      : state === "dry"
        ? "Clear & Dry"
        : "Standby";

  const fallback = <StaticScene wet={isRaining} />;

  return (
    <div ref={container} className="relative flex flex-col items-center">
      {/* 3D/Scene visual */}
      <div className="relative w-full h-44 flex items-center justify-center">
        {use3d && !failed && !reduced && visible ? (
          <SceneBoundary fallback={fallback} onError={() => setFailed(true)}>
            <Suspense fallback={fallback}>
              <Scene
                state={live ? state : "unknown"}
                animate={live && visible && !reduced}
                onFailure={() => setFailed(true)}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          fallback
        )}
      </div>

      {/* Dynamic Condition Label */}
      <div className="text-center mt-1">
        <span className="text-sm font-semibold tracking-wide text-purple-300/80 uppercase">
          Plate Status
        </span>
        <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          {displayTitle}
          {isRaining && <span className="inline-block animate-bounce">🌧️</span>}
        </h3>
      </div>

      {/* Toggle between custom stylized 3D art & Three.js canvas */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setUse3d((v) => !v)}
          className="text-[11px] font-medium text-purple-400 hover:text-purple-200 transition-colors"
        >
          {use3d ? "Switch to Illustration" : "Switch to 3D Canvas"}
        </button>
      </div>
    </div>
  );
});
