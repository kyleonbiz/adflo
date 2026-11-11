/** Decorative login backdrop: navy gradient, glowing 3D-style ribbons, a lit skyline, waves and drifting particles. Pure SVG + CSS, no images. */
const PARTICLES = [
  [8, 22, 3, 0], [16, 68, 2, 2], [27, 38, 2, 4], [38, 82, 3, 1], [47, 14, 2, 5], [58, 58, 2, 3], [66, 30, 3, 6],
  [74, 74, 2, 2], [83, 18, 3, 4], [90, 52, 2, 1], [94, 86, 3, 5], [4, 90, 2, 3], [52, 92, 2, 0], [34, 8, 2, 6],
] as const;

export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="auth-backdrop">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />

      <svg className="auth-ribbons" viewBox="0 0 800 900" preserveAspectRatio="xMaxYMin slice" focusable="false">
        <defs>
          <linearGradient id="rb1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3aa8ff" />
            <stop offset="0.55" stopColor="#2f6bff" />
            <stop offset="1" stopColor="#7a4cf0" />
          </linearGradient>
          <linearGradient id="rb2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a56f4" />
            <stop offset="1" stopColor="#1d3fb8" />
          </linearGradient>
          <linearGradient id="rb3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a6cff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#13236e" stopOpacity="0.2" />
          </linearGradient>
          <filter id="rbBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" /></filter>
        </defs>
        <g className="auth-ribbon auth-ribbon-1" filter="url(#rbBlur)">
          <path d="M250 900 C 330 520 470 130 640 78 C 740 48 810 120 860 260 L 860 420 C 800 270 740 215 690 262 C 600 345 520 640 470 900 Z" fill="url(#rb1)" />
          <path d="M640 78 C 740 48 810 120 860 260 L 860 330 C 800 200 735 150 660 190 C 690 120 700 90 640 78 Z" fill="#9ed2ff" opacity="0.35" />
        </g>
        <g className="auth-ribbon auth-ribbon-2" filter="url(#rbBlur)">
          <path d="M690 262 C 740 215 800 270 860 420 L 860 640 C 800 520 750 400 700 380 C 650 360 640 330 690 262 Z" fill="url(#rb2)" opacity="0.92" />
        </g>
        <g className="auth-ribbon auth-ribbon-3">
          <path d="M330 520 C 460 380 640 330 860 520 L 860 600 C 650 430 480 470 380 640 Z" fill="url(#rb3)" opacity="0.7" />
        </g>
      </svg>

      <svg className="auth-skyline" viewBox="0 0 520 360" preserveAspectRatio="xMinYMax meet" focusable="false">
        <defs>
          <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d3a8a" stopOpacity="0.95" />
            <stop offset="1" stopColor="#0a1442" stopOpacity="0.9" />
          </linearGradient>
          <pattern id="win" width="12" height="16" patternUnits="userSpaceOnUse">
            <rect x="3" y="4" width="5" height="7" fill="#7fb4ff" opacity="0.55" />
          </pattern>
        </defs>
        {[
          [10, 60, 70, 300], [86, 120, 54, 240], [146, 20, 80, 340], [232, 150, 60, 210], [298, 90, 48, 270], [352, 170, 56, 190], [414, 130, 44, 230], [462, 190, 50, 170],
        ].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="url(#sk)" />
            <rect x={x} y={y} width={w} height={h} fill="url(#win)" />
            <rect x={x} y={y} width="2" height={h} fill="#6aa8ff" opacity="0.45" />
          </g>
        ))}
      </svg>

      <svg className="auth-waves" viewBox="0 0 1440 400" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="w1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5b3fe0" />
            <stop offset="0.5" stopColor="#1f3fc4" />
            <stop offset="1" stopColor="#8a56f4" />
          </linearGradient>
          <linearGradient id="w2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0b1a6e" />
            <stop offset="1" stopColor="#3a35d8" />
          </linearGradient>
        </defs>
        <path className="auth-wave auth-wave-2" d="M0 250 C 360 150 700 330 1100 250 C 1250 220 1360 180 1440 170 L1440 400 L0 400 Z" fill="url(#w2)" opacity="0.8" />
        <path className="auth-wave auth-wave-1" d="M0 190 C 320 160 620 270 960 300 C 1180 320 1330 290 1440 250 L1440 400 L0 400 Z" fill="url(#w1)" opacity="0.9" />
        <path d="M0 190 C 320 160 620 270 960 300 C 1180 320 1330 290 1440 250" fill="none" stroke="#a9d4ff" strokeOpacity="0.55" strokeWidth="2" />
      </svg>

      {PARTICLES.map(([left, top, size, delay], i) => (
        <span key={i} className="auth-particle" style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay * -2}s` }} />
      ))}
    </div>
  );
}
