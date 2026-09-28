import React from 'react';

interface IllustrationProps {
  type: 'radial' | 'oxen' | 'wright' | 'piston' | 'steam' | 'systems' | 'maintenance' | 'gauges' | 'borescope';
  className?: string;
}

export const VisualIllustration: React.FC<IllustrationProps> = ({ type, className = '' }) => {
  switch (type) {
    case 'steam':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#121c21] via-[#1a2327] to-[#0d1417] ${className}`}>
          <svg viewBox="0 0 800 450" className="w-full h-full object-cover select-none">
            <defs>
              <linearGradient id="steamBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1a272c" />
                <stop offset="50%" stopColor="#222f33" />
                <stop offset="100%" stopColor="#11191c" />
              </linearGradient>
              <linearGradient id="warmLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#b45309" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ironSteel" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2d3748" />
                <stop offset="35%" stopColor="#4a5568" />
                <stop offset="50%" stopColor="#718096" />
                <stop offset="70%" stopColor="#4a5568" />
                <stop offset="100%" stopColor="#1a202c" />
              </linearGradient>
              <linearGradient id="brassBronze" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#78350f" />
                <stop offset="40%" stopColor="#d97706" />
                <stop offset="60%" stopColor="#fde68a" />
                <stop offset="80%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
              <radialGradient id="steamSmoke" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
                <stop offset="40%" stopColor="#e2e8f0" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Factory workshop background walls & arched window */}
            <rect width="800" height="450" fill="url(#steamBg)" />
            <path d="M580,40 L760,40 L760,320 L580,320 Z" fill="#1e293b" opacity="0.4" />
            <path d="M600,60 C640,30 700,30 740,60 L740,240 L600,240 Z" fill="#fef08a" opacity="0.12" />
            <line x1="670" y1="40" x2="670" y2="240" stroke="#0f172a" strokeWidth="4" opacity="0.5" />
            <line x1="600" y1="140" x2="740" y2="140" stroke="#0f172a" strokeWidth="4" opacity="0.5" />

            {/* Atmospheric window god-rays */}
            <polygon points="670,50 800,450 420,450 670,120" fill="url(#warmLight)" opacity="0.6" />

            {/* Industrial Floor */}
            <polygon points="0,320 800,320 800,450 0,450" fill="#0f172a" opacity="0.9" />
            <line x1="0" y1="320" x2="800" y2="320" stroke="#334155" strokeWidth="2" opacity="0.4" />

            {/* Massive Cast Iron Flywheel on Left */}
            <g transform="translate(240, 260)">
              {/* Outer rim */}
              <circle cx="0" cy="0" r="160" fill="none" stroke="url(#ironSteel)" strokeWidth="32" />
              <circle cx="0" cy="0" r="176" fill="none" stroke="#1a202c" strokeWidth="3" />
              <circle cx="0" cy="0" r="144" fill="none" stroke="#1a202c" strokeWidth="3" />
              {/* Central hub */}
              <circle cx="0" cy="0" r="42" fill="url(#ironSteel)" stroke="#0f172a" strokeWidth="4" />
              <circle cx="0" cy="0" r="16" fill="#0f172a" />
              {/* Heavy curved spokes */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <line
                  key={i}
                  x1="0"
                  y1="0"
                  x2={Math.cos((angle * Math.PI) / 180) * 144}
                  y2={Math.sin((angle * Math.PI) / 180) * 144}
                  stroke="url(#ironSteel)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
              ))}
            </g>

            {/* Main Steam Cylinder & Crosshead Guide */}
            <g transform="translate(270, 210)">
              {/* Horizontal boiler cylinder body */}
              <rect x="100" y="-35" width="240" height="70" rx="8" fill="url(#ironSteel)" stroke="#1e293b" strokeWidth="3" />
              {/* Circumferential rib bands */}
              <rect x="130" y="-37" width="12" height="74" fill="url(#brassBronze)" />
              <rect x="220" y="-37" width="12" height="74" fill="url(#brassBronze)" />
              <rect x="310" y="-37" width="12" height="74" fill="url(#brassBronze)" />

              {/* Steam manifold pipe rising vertically */}
              <rect x="150" y="-120" width="20" height="85" fill="url(#brassBronze)" />
              <rect x="145" y="-125" width="30" height="12" rx="3" fill="url(#brassBronze)" />
              {/* Centrifugal Watt Governor on top */}
              <g transform="translate(160, -145)">
                <line x1="0" y1="0" x2="0" y2="30" stroke="#cbd5e1" strokeWidth="3" />
                <circle cx="-16" cy="14" r="8" fill="url(#brassBronze)" />
                <circle cx="16" cy="14" r="8" fill="url(#brassBronze)" />
                <line x1="-16" y1="14" x2="0" y2="0" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="16" y1="14" x2="0" y2="0" stroke="#cbd5e1" strokeWidth="2" />
              </g>

              {/* Piston Rod & Crosshead */}
              <rect x="0" y="-10" width="105" height="20" fill="url(#brassBronze)" />
              <rect x="330" y="-12" width="60" height="24" rx="4" fill="url(#ironSteel)" />
            </g>

            {/* Steam plume / clouds */}
            <circle cx="430" cy="100" r="50" fill="url(#steamSmoke)" />
            <circle cx="470" cy="80" r="65" fill="url(#steamSmoke)" />
            <circle cx="510" cy="95" r="45" fill="url(#steamSmoke)" />

            {/* Victorian Machinist Engineer Silhouette on Right */}
            <g transform="translate(560, 200)">
              {/* Flat cap */}
              <ellipse cx="65" cy="40" rx="16" ry="7" fill="#1c1917" />
              <circle cx="63" cy="48" r="12" fill="#78350f" opacity="0.9" />
              {/* Beard profile */}
              <path d="M68,52 Q74,60 70,68 Q64,68 62,60 Z" fill="#292524" />
              {/* Torso & Vest */}
              <path d="M50,65 L80,65 L88,140 L45,140 Z" fill="#292524" />
              {/* Apron */}
              <path d="M52,85 L78,85 L84,165 L46,165 Z" fill="#854d0e" opacity="0.8" />
              {/* Arms reaching to valve */}
              <path d="M55,75 Q30,95 10,110" stroke="#44403c" strokeWidth="12" strokeLinecap="round" fill="none" />
              <circle cx="10" cy="110" r="5" fill="#78350f" />
              {/* Legs */}
              <rect x="50" y="140" width="16" height="80" fill="#1c1917" />
              <rect x="70" y="140" width="16" height="80" fill="#1c1917" />
            </g>
          </svg>
          {/* Subtle vignette border */}
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none rounded-xl" />
        </div>
      );

    case 'radial':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#06171b] via-[#092227] to-[#040e11] ${className}`}>
          <svg viewBox="0 0 800 450" className="w-full h-full object-cover select-none">
            <defs>
              <radialGradient id="radialCore" cx="62%" cy="48%" r="60%">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.45" />
                <stop offset="35%" stopColor="#0f766e" stopOpacity="0.2" />
                <stop offset="85%" stopColor="#040e11" stopOpacity="0.95" />
              </radialGradient>
              <linearGradient id="propellerBlade" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="50%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>

            {/* Ambient Background glow */}
            <rect width="800" height="450" fill="url(#radialCore)" />

            {/* Atmospheric technical radial lines */}
            <circle cx="520" cy="225" r="220" fill="none" stroke="#14b8a6" strokeWidth="1" strokeDasharray="6 6" opacity="0.25" />
            <circle cx="520" cy="225" r="160" fill="none" stroke="#14b8a6" strokeWidth="1" opacity="0.2" />
            <circle cx="520" cy="225" r="90" fill="none" stroke="#14b8a6" strokeWidth="1.5" opacity="0.4" />

            {/* Radial Engine Cylinders (9-cylinder radial array) */}
            <g transform="translate(520, 225)">
              {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((angle, i) => (
                <g key={i} transform={`rotate(${angle})`}>
                  {/* Cylinder barrel */}
                  <rect x="-24" y="-200" width="48" height="110" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                  {/* Deep Cooling Fins */}
                  {[-195, -185, -175, -165, -155, -145, -135, -125, -115, -105].map((y, idx) => (
                    <line key={idx} x1="-30" y1={y} x2="30" y2={y} stroke="#475569" strokeWidth="2" />
                  ))}
                  {/* Cylinder Rocker Box Cap */}
                  <ellipse cx="0" cy="-205" rx="20" ry="10" fill="#0f766e" stroke="#14b8a6" strokeWidth="1.5" />
                  {/* Twin Pushrod tubes */}
                  <line x1="-12" y1="-90" x2="-8" y2="-195" stroke="#94a3b8" strokeWidth="3" />
                  <line x1="12" y1="-90" x2="8" y2="-195" stroke="#94a3b8" strokeWidth="3" />
                </g>
              ))}

              {/* Central Crankcase Dome */}
              <circle cx="0" cy="0" r="90" fill="#1e293b" stroke="#475569" strokeWidth="4" />
              <circle cx="0" cy="0" r="75" fill="#0f172a" stroke="#14b8a6" strokeWidth="2" />

              {/* Aerodynamic Bullet Propeller Spinner */}
              <path d="M-40,-50 C-10,-120 10,-120 40,-50 C50,20 -50,20 -40,-50 Z" fill="url(#propellerBlade)" stroke="#64748b" strokeWidth="2" />
              <ellipse cx="0" cy="15" rx="44" ry="18" fill="#1e293b" stroke="#334155" strokeWidth="2" />

              {/* Propeller Blade 1 (Scythe aerodynamic shape) */}
              <path d="M-15,-60 C-60,-220 -180,-310 -320,-320 C-260,-240 -120,-140 -25,-40 Z" fill="url(#propellerBlade)" opacity="0.9" />
              {/* Propeller Blade 2 */}
              <path d="M25,20 C140,160 220,260 340,320 C260,260 140,140 20,40 Z" fill="url(#propellerBlade)" opacity="0.9" />
              {/* Blade safety tip (yellow/orange stripe) */}
              <path d="M-300,-318 C-320,-320 -310,-300 -290,-295 Z" fill="#eab308" />
            </g>

            {/* Left Vignette & Gradient text backdrop */}
            <rect x="0" y="0" width="380" height="450" fill="url(#radialCore)" opacity="0.8" />
          </svg>
          <div className="absolute inset-0 ring-1 ring-inset ring-teal-500/20 pointer-events-none rounded-xl" />
        </div>
      );

    case 'oxen':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#1e1b18] via-[#2d261e] to-[#12100d] ${className}`}>
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover select-none">
            <defs>
              <linearGradient id="warmDust" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#1e1b18" />
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#warmDust)" />
            {/* Ancient Desert Sun / Atmospheric haze */}
            <circle cx="320" cy="70" r="45" fill="#fef3c7" opacity="0.25" />

            {/* Stone Mill circular base */}
            <g transform="translate(130, 180)">
              {/* Circular lower grindstone */}
              <ellipse cx="0" cy="40" rx="90" ry="32" fill="#57534e" stroke="#292524" strokeWidth="3" />
              <ellipse cx="0" cy="20" rx="90" ry="32" fill="#78716c" stroke="#44403c" strokeWidth="2" />
              {/* Vertical rotating grain mill wheel */}
              <ellipse cx="0" cy="-20" rx="42" ry="75" fill="#a8a29e" stroke="#44403c" strokeWidth="4" />
              <ellipse cx="0" cy="-20" rx="20" ry="40" fill="#78716c" />
              <circle cx="0" cy="-20" r="10" fill="#292524" />
              {/* Wooden axle beam */}
              <line x1="0" y1="-20" x2="180" y2="-10" stroke="#78350f" strokeWidth="12" strokeLinecap="round" />
            </g>

            {/* Ancient Draft Oxen Pair on Right */}
            <g transform="translate(260, 160)">
              {/* Ox 1 Body */}
              <ellipse cx="40" cy="0" rx="45" ry="24" fill="#44403c" />
              <ellipse cx="80" cy="-15" rx="20" ry="18" fill="#57534e" />
              {/* Horns */}
              <path d="M85,-28 Q95,-45 88,-50" stroke="#d6d3d1" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M80,-28 Q75,-45 70,-48" stroke="#d6d3d1" strokeWidth="4" fill="none" strokeLinecap="round" />
              {/* Legs */}
              <line x1="15" y1="20" x2="15" y2="70" stroke="#292524" strokeWidth="6" />
              <line x1="65" y1="20" x2="65" y2="70" stroke="#292524" strokeWidth="6" />
              {/* Wooden Yoke */}
              <rect x="10" y="-35" width="80" height="8" rx="3" fill="#854d0e" />
            </g>

            {/* Human laborer behind stone wheel */}
            <g transform="translate(60, 140)">
              <circle cx="10" cy="-25" r="9" fill="#a8a29e" />
              <path d="M10,-15 L15,35 L0,70" stroke="#78716c" strokeWidth="8" strokeLinecap="round" fill="none" />
              {/* Pushing arm */}
              <line x1="12" y1="-5" x2="55" y2="10" stroke="#78716c" strokeWidth="6" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      );

    case 'wright':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#1c242b] via-[#23313d] to-[#131b22] ${className}`}>
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover select-none">
            <defs>
              <linearGradient id="kittyHawkSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#kittyHawkSky)" />
            {/* Kitty Hawk sand dunes & ocean line */}
            <path d="M0,230 Q150,210 260,235 T400,220 L400,300 L0,300 Z" fill="#78716c" opacity="0.6" />

            {/* 1903 Wright Flyer Biplane in Flight */}
            <g transform="translate(190, 130)">
              {/* Top Wing */}
              <rect x="-140" y="-38" width="280" height="14" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
              {/* Bottom Wing */}
              <rect x="-140" y="8" width="280" height="14" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />

              {/* Wing Struts (Vertical interplane uprights) */}
              {[-120, -70, -20, 30, 80, 120].map((x, i) => (
                <g key={i}>
                  <line x1={x} y1="-24" x2={x} y2="8" stroke="#78350f" strokeWidth="3" />
                  {/* Cross rigging wires */}
                  <line x1={x - 20} y1="-24" x2={x + 20} y2="8" stroke="#94a3b8" strokeWidth="0.8" opacity="0.6" />
                  <line x1={x + 20} y1="-24" x2={x - 20} y2="8" stroke="#94a3b8" strokeWidth="0.8" opacity="0.6" />
                </g>
              ))}

              {/* Forward Canard Elevator */}
              <rect x="-40" y="-15" width="80" height="7" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
              <line x1="-30" y1="-10" x2="-20" y2="8" stroke="#854d0e" strokeWidth="2" />
              <line x1="30" y1="-10" x2="20" y2="8" stroke="#854d0e" strokeWidth="2" />

              {/* Central Charlie Taylor Aluminum Engine */}
              <rect x="-12" y="-2" width="24" height="16" fill="#14b8a6" stroke="#0f766e" strokeWidth="1.5" />

              {/* Twin Pusher Propellers (spinning blur) */}
              <ellipse cx="-45" cy="-8" rx="8" ry="24" fill="#f59e0b" opacity="0.35" />
              <ellipse cx="45" cy="-8" rx="8" ry="24" fill="#f59e0b" opacity="0.35" />
              <line x1="-45" y1="-28" x2="-45" y2="12" stroke="#451a03" strokeWidth="2" />
              <line x1="45" y1="-28" x2="45" y2="12" stroke="#451a03" strokeWidth="2" />

              {/* Pilot Orville prone on lower wing */}
              <rect x="-18" y="2" width="36" height="7" rx="3" fill="#334155" />
              <circle cx="-16" cy="4" r="4" fill="#d97706" />
            </g>
          </svg>
        </div>
      );

    case 'piston':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#0c1920] via-[#12232c] to-[#081116] ${className}`}>
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover select-none">
            <defs>
              <linearGradient id="pistonMetal" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="35%" stopColor="#94a3b8" />
                <stop offset="55%" stopColor="#f8fafc" />
                <stop offset="75%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="#0c1920" />
            <circle cx="200" cy="150" r="120" fill="#14b8a6" opacity="0.1" />

            <g transform="translate(200, 110)">
              {/* Piston Crown & Skirt */}
              <rect x="-65" y="-55" width="130" height="110" rx="8" fill="url(#pistonMetal)" stroke="#1e293b" strokeWidth="3" />
              {/* Piston Compression & Oil Ring Grooves */}
              <line x1="-65" y1="-40" x2="65" y2="-40" stroke="#0f172a" strokeWidth="3" />
              <line x1="-65" y1="-28" x2="65" y2="-28" stroke="#0f172a" strokeWidth="3" />
              <line x1="-65" y1="-16" x2="65" y2="-16" stroke="#0f172a" strokeWidth="3" />

              {/* Wrist Pin Hole */}
              <circle cx="0" cy="15" r="20" fill="#0f172a" stroke="#64748b" strokeWidth="4" />
              <circle cx="0" cy="15" r="14" fill="#334155" />

              {/* Connecting Rod */}
              <path d="M-14,25 L-10,130 L10,130 L14,25 Z" fill="url(#pistonMetal)" stroke="#1e293b" strokeWidth="2" />
              {/* Big End Rod Cap */}
              <circle cx="0" cy="140" r="28" fill="none" stroke="url(#pistonMetal)" strokeWidth="16" />
              <circle cx="0" cy="140" r="20" fill="#081116" />
              {/* Cap Bolts */}
              <circle cx="-25" cy="140" r="4" fill="#f8fafc" />
              <circle cx="25" cy="140" r="4" fill="#f8fafc" />
            </g>
          </svg>
        </div>
      );

    case 'systems':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#0c181e] via-[#10272a] to-[#071317] ${className}`}>
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover select-none">
            <rect width="400" height="300" fill="#0c181e" />
            {/* Turbocharger scroll & pipes */}
            <g transform="translate(190, 150)">
              {/* Exhaust Manifold Pipes (Amber) */}
              <path d="M-120,-80 C-80,-20 -40,-10 0,0" stroke="#f97316" strokeWidth="12" fill="none" opacity="0.8" />
              <path d="M-120,-20 C-70,0 -40,10 0,0" stroke="#f97316" strokeWidth="12" fill="none" opacity="0.8" />

              {/* Turbocharger Turbine Casing */}
              <ellipse cx="30" cy="0" rx="45" ry="55" fill="#334155" stroke="#f97316" strokeWidth="3" />
              <circle cx="30" cy="0" r="20" fill="#0f172a" />
              {/* Compressor scroll (Cyan) */}
              <ellipse cx="80" cy="-10" rx="38" ry="48" fill="#1e293b" stroke="#06b6d4" strokeWidth="3" />
              {/* Induction intake tube */}
              <path d="M80,-30 C100,-70 140,-80 170,-80" stroke="#06b6d4" strokeWidth="14" fill="none" />
              {/* Fuel injection distribution spider */}
              <circle cx="-50" cy="-60" r="15" fill="#14b8a6" />
              {[-30, 0, 30].map((deg, i) => (
                <line key={i} x1="-50" y1="-60" x2={-110 + i * 20} y2="-100" stroke="#14b8a6" strokeWidth="2.5" />
              ))}
            </g>
          </svg>
        </div>
      );

    case 'maintenance':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#121c21] via-[#1a252a] to-[#0d1519] ${className}`}>
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover select-none">
            <rect width="400" height="300" fill="#121c21" />
            {/* Mechanic Wrench and Aircraft Engine Fitting */}
            <g transform="translate(200, 150)">
              {/* Engine oil braided stainless hose */}
              <line x1="-160" y1="-70" x2="160" y2="80" stroke="#64748b" strokeWidth="18" strokeDasharray="6 3" />
              {/* Hex fitting (B-nut) */}
              <polygon points="-25,-25 25,-25 40,0 25,25 -25,25 -40,0" fill="#0ea5e9" stroke="#38bdf8" strokeWidth="3" />

              {/* Combination Wrench in Hand */}
              <g transform="rotate(-35)">
                <rect x="-15" y="-120" width="30" height="180" rx="8" fill="#cbd5e1" stroke="#475569" strokeWidth="3" />
                {/* Open end jaw */}
                <path d="M-22,-120 C-22,-155 22,-155 22,-120 Z" fill="#94a3b8" />
              </g>

              {/* Mechanic Gloves silhouette */}
              <ellipse cx="60" cy="50" rx="35" ry="25" fill="#1e293b" opacity="0.9" />
            </g>
          </svg>
        </div>
      );

    case 'gauges':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#0c1418] via-[#111c21] to-[#070d10] ${className}`}>
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover select-none">
            <rect width="400" height="300" fill="#0c1418" />
            {/* 4 Circular Aircraft Engine Instrument Cluster */}
            <g transform="translate(130, 95)">
              {/* Gauge 1: Manifold Pressure */}
              <circle cx="0" cy="0" r="48" fill="#090f12" stroke="#334155" strokeWidth="5" />
              <circle cx="0" cy="0" r="44" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 4" />
              <text x="0" y="-18" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">MP (IN.HG)</text>
              <text x="0" y="24" fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">31.5</text>
              <line x1="0" y1="0" x2="24" y2="-18" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="0" cy="0" r="4" fill="#ffffff" />
            </g>

            <g transform="translate(270, 95)">
              {/* Gauge 2: Tachometer RPM */}
              <circle cx="0" cy="0" r="48" fill="#090f12" stroke="#334155" strokeWidth="5" />
              <circle cx="0" cy="0" r="44" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 4" />
              <text x="0" y="-18" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">RPM x 100</text>
              <text x="0" y="24" fill="#14b8a6" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">2400</text>
              <line x1="0" y1="0" x2="18" y2="-22" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="0" cy="0" r="4" fill="#ffffff" />
            </g>

            <g transform="translate(130, 215)">
              {/* Gauge 3: CHT / EGT */}
              <circle cx="0" cy="0" r="45" fill="#090f12" stroke="#334155" strokeWidth="4" />
              <text x="0" y="-15" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">CHT °F</text>
              <text x="0" y="20" fill="#f97316" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">380°</text>
              <line x1="0" y1="0" x2="15" y2="-12" stroke="#f97316" strokeWidth="2" />
            </g>

            <g transform="translate(270, 215)">
              {/* Gauge 4: Fuel Flow GPH */}
              <circle cx="0" cy="0" r="45" fill="#090f12" stroke="#334155" strokeWidth="4" />
              <text x="0" y="-15" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">FUEL FLOW</text>
              <text x="0" y="20" fill="#06b6d4" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">18.4</text>
              <line x1="0" y1="0" x2="-14" y2="-14" stroke="#06b6d4" strokeWidth="2" />
            </g>
          </svg>
        </div>
      );

    case 'borescope':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#0c161a] via-[#102428] to-[#071216] ${className}`}>
          <svg viewBox="0 0 400 300" className="w-full h-full object-cover select-none">
            <rect width="400" height="300" fill="#0c161a" />
            {/* Circular borescope camera view inside cylinder */}
            <circle cx="200" cy="150" r="110" fill="#000000" stroke="#14b8a6" strokeWidth="3" />
            {/* Crosshair grid */}
            <circle cx="200" cy="150" r="80" fill="none" stroke="#14b8a6" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.4" />
            <line x1="90" y1="150" x2="310" y2="150" stroke="#14b8a6" strokeWidth="0.8" opacity="0.3" />
            <line x1="200" y1="40" x2="200" y2="260" stroke="#14b8a6" strokeWidth="0.8" opacity="0.3" />

            {/* Exhaust Valve Head Borescope View (Showing symmetric healthy combustion pattern) */}
            <g transform="translate(200, 150)">
              <circle cx="0" cy="0" r="62" fill="#78350f" stroke="#b45309" strokeWidth="3" />
              {/* Thermal color pattern on valve face */}
              <circle cx="0" cy="0" r="45" fill="#f59e0b" opacity="0.7" />
              <circle cx="0" cy="0" r="28" fill="#d97706" opacity="0.9" />
              <circle cx="0" cy="0" r="14" fill="#451a03" />
            </g>
            <text x="200" y="278" fill="#14b8a6" fontSize="10" fontFamily="monospace" textAnchor="middle">BORESCOPE: CYL #1 EXHAUST VALVE OK</text>
          </svg>
        </div>
      );

    default:
      return <div className="w-full h-full bg-[#112026]" />;
  }
};

