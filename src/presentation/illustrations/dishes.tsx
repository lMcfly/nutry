import type { ReactNode } from 'react';
import type { DishFamily } from './match';

/*
 * Illustrations de plats : SVG plats et colorés (viewBox 200 × 140), dessinés à la main,
 * sans image externe. Décoratives : le nom du plat est toujours affiché à côté.
 * Les couleurs d'illustration sont volontairement des couleurs « de nourriture » fixes
 * (pas de texte dessus, donc hors contrastes de l'interface).
 */

interface Palette {
  readonly bg: string;
}

const Backdrop = ({ bg }: Palette) => (
  <>
    <ellipse cx="100" cy="72" rx="96" ry="62" fill={bg} />
    <circle cx="26" cy="30" r="7" fill="#fff" opacity=".55" />
    <circle cx="178" cy="24" r="4.5" fill="#fff" opacity=".55" />
    <circle cx="170" cy="118" r="6" fill="#fff" opacity=".45" />
  </>
);

/** Assiette vue du dessus. */
const Plate = ({ r = 50 }: { r?: number }) => (
  <>
    <ellipse cx="100" cy="124" rx={r * 0.8} ry="5" fill="#000" opacity=".1" />
    <circle cx="100" cy="72" r={r} fill="#ffffff" />
    <circle cx="100" cy="72" r={r - 8} fill="none" stroke="#ece7df" strokeWidth="2" />
  </>
);

const Steam = ({ x = 100, y = 30 }: { x?: number; y?: number }) => (
  <g stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".85">
    <path d={`M${x - 14} ${y + 14} q-5 -7 0 -14 q5 -7 0 -14`} />
    <path d={`M${x} ${y + 16} q-5 -7 0 -14 q5 -7 0 -14`} />
    <path d={`M${x + 14} ${y + 14} q-5 -7 0 -14 q5 -7 0 -14`} />
  </g>
);

function Salade() {
  const leaves: [number, number, number, string][] = [
    [82, 58, -30, '#5dbb63'],
    [118, 58, 30, '#7ccf72'],
    [100, 50, 0, '#48a557'],
    [76, 80, -60, '#7ccf72'],
    [124, 82, 60, '#5dbb63'],
    [100, 92, 90, '#48a557'],
  ];
  return (
    <>
      <Backdrop bg="#d6f0d2" />
      <Plate />
      {leaves.map(([x, y, rotate, fill]) => (
        <ellipse
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          rx="20"
          ry="9"
          fill={fill}
          transform={`rotate(${rotate} ${x} ${y})`}
        />
      ))}
      <circle cx="92" cy="72" r="8" fill="#ef5b46" />
      <circle cx="90" cy="70" r="2.2" fill="#fff" opacity=".6" />
      <circle cx="113" cy="68" r="7" fill="#f26b52" />
      <circle cx="106" cy="86" r="9" fill="#e6f5c9" stroke="#9bd06b" strokeWidth="2.5" />
      <circle cx="106" cy="86" r="3.5" fill="#c4e79a" />
      <circle cx="80" cy="76" r="5" fill="#ffd54a" />
      <circle cx="123" cy="80" r="5" fill="#ffd54a" />
    </>
  );
}

function Bowl() {
  return (
    <>
      <Backdrop bg="#ffe6c4" />
      <ellipse cx="100" cy="124" rx="42" ry="5" fill="#000" opacity=".1" />
      <circle cx="100" cy="72" r="52" fill="#f4a259" />
      <circle cx="100" cy="72" r="44" fill="#fff6e6" />
      <path d="M100 72 L100 28 A44 44 0 0 1 138 50 Z" fill="#f6c453" />
      <path d="M100 72 L138 50 A44 44 0 0 1 138 94 Z" fill="#6cc070" />
      <path d="M100 72 L138 94 A44 44 0 0 1 100 116 Z" fill="#ef7b45" />
      <path d="M100 72 L100 116 A44 44 0 0 1 62 94 Z" fill="#b575c9" />
      <path d="M100 72 L62 94 A44 44 0 0 1 62 50 Z" fill="#fff0cf" />
      <path d="M100 72 L62 50 A44 44 0 0 1 100 28 Z" fill="#a8d86a" />
      <circle cx="100" cy="72" r="9" fill="#ffe08a" />
      <circle cx="100" cy="72" r="4" fill="#f4a259" />
    </>
  );
}

function Soupe() {
  return (
    <>
      <Backdrop bg="#ffe9c9" />
      <Steam y={22} />
      <ellipse cx="100" cy="126" rx="48" ry="5" fill="#000" opacity=".1" />
      <path d="M38 70 H162 Q160 118 100 120 Q40 118 38 70 Z" fill="#2f9e98" />
      <path
        d="M44 100 Q100 112 156 100"
        stroke="#fff"
        strokeWidth="2.5"
        opacity=".35"
        fill="none"
      />
      <ellipse cx="100" cy="70" rx="62" ry="14" fill="#2f9e98" />
      <ellipse cx="100" cy="70" rx="55" ry="11" fill="#f39a45" />
      <path
        d="M72 70 q14 -8 28 0 t28 0"
        stroke="#fff3df"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="82" cy="66" r="2" fill="#4caf50" />
      <circle cx="118" cy="72" r="2" fill="#4caf50" />
      <circle cx="104" cy="74" r="1.8" fill="#4caf50" />
    </>
  );
}

function Pates() {
  return (
    <>
      <Backdrop bg="#ffe3d6" />
      <Plate />
      <circle cx="100" cy="72" r="34" fill="#f5cd62" />
      {[28, 21, 14, 7].map((r) => (
        <circle key={r} cx="100" cy="72" r={r} fill="none" stroke="#e7b23f" strokeWidth="3" />
      ))}
      <path
        d="M78 60 q22 -20 44 0"
        stroke="#f5cd62"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="100" cy="66" r="15" fill="#e8523f" />
      <circle cx="95" cy="62" r="3" fill="#fff" opacity=".35" />
      <ellipse cx="92" cy="74" rx="8" ry="4" fill="#4caf50" transform="rotate(-25 92 74)" />
      <ellipse cx="108" cy="76" rx="7" ry="3.5" fill="#66bb6a" transform="rotate(20 108 76)" />
      <path
        d="M150 54 V100 M146 54 V70 M150 54 V70 M154 54 V70"
        stroke="#c7ccd1"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  );
}

function Riz() {
  const grains: [number, number][] = [];
  for (let i = 0; i < 46; i += 1) {
    const angle = i * 2.4;
    const radius = 4 + Math.sqrt(i) * 5.2;
    grains.push([100 + Math.cos(angle) * radius, 70 + Math.sin(angle) * radius * 0.85]);
  }
  return (
    <>
      <Backdrop bg="#fff1c4" />
      <Plate />
      <ellipse cx="100" cy="72" rx="38" ry="32" fill="#fffaf0" />
      {grains.map(([x, y], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="4.4"
          ry="2"
          fill="#f3e6c8"
          transform={`rotate(${i * 37} ${x} ${y})`}
        />
      ))}
      <circle cx="88" cy="62" r="3.4" fill="#6cc070" />
      <circle cx="110" cy="58" r="3.4" fill="#6cc070" />
      <circle cx="116" cy="80" r="3.4" fill="#6cc070" />
      <rect x="84" y="80" width="7" height="7" rx="2" fill="#f28c3a" />
      <rect x="104" y="72" width="7" height="7" rx="2" fill="#f28c3a" />
      <path
        d="M118 52 l8 -7 M120 58 l9 -2"
        stroke="#4caf50"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  );
}

function Curry() {
  return (
    <>
      <Backdrop bg="#ffe0b8" />
      <Steam x={92} y={14} />
      <ellipse cx="100" cy="126" rx="48" ry="5" fill="#000" opacity=".1" />
      <circle cx="100" cy="76" r="48" fill="#c9553d" />
      <circle cx="100" cy="76" r="41" fill="#f08a2e" />
      <path
        d="M70 70 q12 -14 26 -4 t22 6"
        stroke="#fff6e8"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="84" cy="88" r="6" fill="#f1d9a2" />
      <circle cx="106" cy="92" r="6" fill="#f1d9a2" />
      <circle cx="120" cy="76" r="6" fill="#f1d9a2" />
      <ellipse cx="96" cy="64" rx="10" ry="5" fill="#4a9d50" transform="rotate(-20 96 64)" />
      <ellipse cx="116" cy="94" rx="9" ry="4.5" fill="#5dbb63" transform="rotate(30 116 94)" />
      <path d="M142 70 a14 18 0 0 1 0 38 a30 30 0 0 0 0 -38 Z" fill="#fffdf6" />
      <circle cx="138" cy="86" r="2" fill="#efe3c6" />
      <circle cx="134" cy="98" r="2" fill="#efe3c6" />
    </>
  );
}

function Poisson() {
  return (
    <>
      <Backdrop bg="#d5ecf7" />
      <Plate />
      <path d="M58 76 Q60 52 98 50 Q132 50 142 70 Q136 92 98 94 Q62 96 58 76 Z" fill="#ff8d74" />
      <path
        d="M72 62 Q96 56 128 66 M70 74 Q98 68 134 78 M76 86 Q100 82 126 88"
        stroke="#ffd6c8"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M118 96 a22 22 0 0 0 28 -20 Z" fill="#ffe14d" />
      <path d="M122 92 a16 16 0 0 0 20 -14" stroke="#fff3a1" strokeWidth="2" fill="none" />
      <path
        d="M64 100 Q80 108 94 104 M68 106 Q82 112 96 110"
        stroke="#4caf50"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function Volaille() {
  return (
    <>
      <Backdrop bg="#ffe6cf" />
      <Plate />
      <path d="M52 98 L76 78" stroke="#fff8ee" strokeWidth="9" strokeLinecap="round" />
      <circle cx="49" cy="102" r="6" fill="#fff8ee" />
      <circle cx="55" cy="97" r="5" fill="#fff8ee" />
      <path d="M70 64 Q86 40 118 50 Q142 60 130 84 Q116 104 90 94 Q70 86 70 64 Z" fill="#c9772c" />
      <path
        d="M84 62 Q100 52 120 60"
        stroke="#e8a24a"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="108" cy="80" r="3" fill="#a8581c" />
      <circle cx="96" cy="74" r="2.2" fill="#a8581c" />
      <circle cx="136" cy="98" r="9" fill="#f4c95d" />
      <circle cx="120" cy="106" r="8" fill="#eebb4a" />
      <path
        d="M140 52 q6 8 14 6 M144 60 q4 8 12 8"
        stroke="#4caf50"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function Viande() {
  return (
    <>
      <Backdrop bg="#f9dcd2" />
      <Plate />
      <path d="M58 74 Q58 48 98 48 Q140 50 142 76 Q138 100 98 98 Q60 98 58 74 Z" fill="#c4553a" />
      <path
        d="M64 74 Q66 54 98 54 Q132 56 136 76"
        stroke="#e3a28f"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M78 62 L98 90 M96 58 L116 92 M114 60 L130 84"
        stroke="#7b2f1f"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M62 112 Q82 120 100 112 M70 118 Q88 124 108 118"
        stroke="#4caf50"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="140" cy="106" r="7" fill="#ffd54a" />
    </>
  );
}

function Oeufs() {
  return (
    <>
      <Backdrop bg="#fff0b8" />
      <Plate />
      <path d="M54 82 Q56 48 100 48 Q144 48 146 82 Q100 96 54 82 Z" fill="#ffd23f" />
      <path d="M54 82 Q100 96 146 82" stroke="#f0b61f" strokeWidth="3" fill="none" />
      <path
        d="M72 66 Q100 58 128 66"
        stroke="#ffe688"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="84" cy="72" r="2.4" fill="#4caf50" />
      <circle cx="104" cy="62" r="2.4" fill="#4caf50" />
      <circle cx="122" cy="74" r="2.4" fill="#4caf50" />
      <circle cx="96" cy="78" r="2.4" fill="#4caf50" />
      <ellipse cx="146" cy="108" rx="12" ry="9" fill="#fff" stroke="#efe9dd" strokeWidth="2" />
      <circle cx="146" cy="108" r="5" fill="#ffb21f" />
    </>
  );
}

function Legumineuses() {
  const beans: [number, number, string][] = [];
  for (let i = 0; i < 38; i += 1) {
    const a = i * 2.39996;
    const r = 5 + Math.sqrt(i) * 6;
    beans.push([
      100 + Math.cos(a) * r,
      74 + Math.sin(a) * r * 0.9,
      ['#c47a3a', '#e3a447', '#a95f28'][i % 3] ?? '#c47a3a',
    ]);
  }
  return (
    <>
      <Backdrop bg="#f6e3c3" />
      <ellipse cx="100" cy="126" rx="44" ry="5" fill="#000" opacity=".1" />
      <circle cx="100" cy="74" r="48" fill="#6a8fb8" />
      <circle cx="100" cy="74" r="41" fill="#fbf1de" />
      {beans.map(([x, y, fill], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="6"
          ry="4"
          fill={fill}
          transform={`rotate(${i * 53} ${x} ${y})`}
        />
      ))}
      <rect x="88" y="62" width="8" height="8" rx="2" fill="#f28c3a" />
      <rect x="110" y="84" width="8" height="8" rx="2" fill="#f28c3a" />
      <path
        d="M118 56 q6 -8 14 -4 M120 62 q8 -2 12 4"
        stroke="#4caf50"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function Tofu() {
  return (
    <>
      <Backdrop bg="#e2f0c8" />
      <Steam x={96} y={12} />
      <ellipse cx="100" cy="126" rx="46" ry="5" fill="#000" opacity=".1" />
      <path d="M144 84 L184 76 L184 86 L146 96 Z" fill="#8a6a4a" />
      <ellipse cx="96" cy="84" rx="54" ry="38" fill="#3b4048" />
      <ellipse cx="96" cy="80" rx="46" ry="30" fill="#4a5059" />
      <rect
        x="72"
        y="66"
        width="16"
        height="16"
        rx="3"
        fill="#fbeccb"
        transform="rotate(-12 80 74)"
      />
      <rect
        x="100"
        y="72"
        width="16"
        height="16"
        rx="3"
        fill="#fbeccb"
        transform="rotate(14 108 80)"
      />
      <circle cx="84" cy="92" r="9" fill="#5dbb63" />
      <circle cx="94" cy="96" r="7" fill="#48a557" />
      <circle cx="122" cy="68" r="8" fill="#5dbb63" />
      <circle cx="116" cy="94" r="7" fill="#f28c3a" />
      <circle cx="68" cy="84" r="6" fill="#f28c3a" />
      <path d="M96 60 l6 -4 M70 70 l-6 -2" stroke="#9bd06b" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function Gratin() {
  return (
    <>
      <Backdrop bg="#fde3c0" />
      <Steam y={14} />
      <ellipse cx="100" cy="126" rx="62" ry="5" fill="#000" opacity=".1" />
      <rect x="34" y="52" width="132" height="66" rx="18" fill="#5f87a8" />
      <rect x="24" y="72" width="18" height="12" rx="6" fill="#5f87a8" />
      <rect x="158" y="72" width="18" height="12" rx="6" fill="#5f87a8" />
      <rect x="44" y="60" width="112" height="50" rx="12" fill="#eab04a" />
      <circle cx="66" cy="76" r="7" fill="#c97d22" />
      <circle cx="96" cy="68" r="9" fill="#f5c76e" />
      <circle cx="124" cy="82" r="8" fill="#c97d22" />
      <circle cx="82" cy="94" r="8" fill="#f5c76e" />
      <circle cx="140" cy="68" r="5" fill="#f5c76e" />
      <circle cx="110" cy="98" r="6" fill="#c97d22" />
      <path
        d="M60 88 q4 -4 8 0 M120 66 q4 -4 8 0"
        stroke="#4caf50"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function Tarte() {
  const crust = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    return [100 + Math.cos(a) * 48, 72 + Math.sin(a) * 48] as const;
  });
  return (
    <>
      <Backdrop bg="#fbe5c4" />
      <ellipse cx="100" cy="124" rx="48" ry="5" fill="#000" opacity=".1" />
      {crust.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7.5" fill="#dfa95a" />
      ))}
      <circle cx="100" cy="72" r="46" fill="#e8b866" />
      <circle cx="100" cy="72" r="38" fill="#fbe39a" />
      <circle cx="84" cy="62" r="6" fill="#ef7c6b" />
      <circle cx="112" cy="58" r="5" fill="#ef7c6b" />
      <circle cx="116" cy="84" r="6" fill="#5dbb63" />
      <circle cx="88" cy="88" r="5" fill="#5dbb63" />
      <circle cx="100" cy="74" r="4" fill="#f4c95d" />
      <path d="M100 72 L146 50 A52 52 0 0 1 152 78 Z" fill="#fbe5c4" />
      <path
        d="M100 72 L146 50 M100 72 L152 78"
        stroke="#c9953f"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </>
  );
}

function PetitDejeuner() {
  return (
    <>
      <Backdrop bg="#ffe0e6" />
      <ellipse cx="96" cy="126" rx="42" ry="5" fill="#000" opacity=".1" />
      <circle cx="96" cy="74" r="46" fill="#f08aa0" />
      <circle cx="96" cy="74" r="39" fill="#fff8f0" />
      <circle cx="82" cy="62" r="8.5" fill="#e8445e" />
      <path
        d="M82 54 l-3 -4 M82 54 l3 -4"
        stroke="#4caf50"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="108" cy="64" r="8.5" fill="#e8445e" />
      <circle cx="96" cy="86" r="6" fill="#4a5fc4" />
      <circle cx="112" cy="84" r="5.5" fill="#5a6fd6" />
      <circle cx="80" cy="82" r="9" fill="#ffe27a" stroke="#f3c93f" strokeWidth="2" />
      <circle cx="96" cy="72" r="4" fill="#ffe27a" />
      <ellipse cx="124" cy="52" rx="9" ry="4" fill="#5dbb63" transform="rotate(30 124 52)" />
      <circle cx="158" cy="100" r="17" fill="#ff9f43" />
      <path
        d="M158 100 L158 83 M158 100 L172 92 M158 100 L172 108 M158 100 L158 117 M158 100 L144 108 M158 100 L144 92"
        stroke="#ffd29b"
        strokeWidth="2"
      />
    </>
  );
}

const DRAWINGS: Readonly<Record<DishFamily, () => ReactNode>> = {
  salade: Salade,
  bowl: Bowl,
  soupe: Soupe,
  pates: Pates,
  riz: Riz,
  curry: Curry,
  poisson: Poisson,
  volaille: Volaille,
  viande: Viande,
  oeufs: Oeufs,
  legumineuses: Legumineuses,
  tofu: Tofu,
  gratin: Gratin,
  tarte: Tarte,
  'petit-dejeuner': PetitDejeuner,
};

/** Dessin d'une famille de plats (contenu du SVG). */
export function DishDrawing({ family }: { readonly family: DishFamily }) {
  const Drawing = DRAWINGS[family];
  return <Drawing />;
}
