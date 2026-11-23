import type { AccessoryId } from '@domain/companion';

/**
 * Calques d'accessoires de Nutry, dessinés dans le repère du SVG (0 0 120 130) : boule
 * centrée en (60, 76), yeux à y = 68. Un calque par emplacement (tête, visage, cou, corps).
 * `clipId` : découpe à la forme de la boule (tablier, écharpe).
 */
interface AccessoryProps {
  readonly clipId: string;
}

function Leaf() {
  return (
    <g>
      <path
        d="M60 38 C60 30 61 26 63 22"
        stroke="#3f8f4a"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M62 30 C64 14 80 8 90 12 C90 26 78 34 62 30 Z" fill="#4caf50" />
      <path
        d="M62 30 C70 22 78 17 86 14"
        stroke="#2f7d3a"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M60 34 C50 24 38 24 32 18 C36 8 54 12 60 34 Z" fill="#7bc96f" />
    </g>
  );
}

function ChefHat() {
  return (
    <g stroke="#dcd6cc" strokeWidth="1.2">
      <circle cx="44" cy="22" r="10" fill="#fff" />
      <circle cx="60" cy="15" r="12" fill="#fff" />
      <circle cx="76" cy="22" r="10" fill="#fff" />
      <rect x="42" y="26" width="36" height="14" rx="4" fill="#fff" />
      <path d="M42 36 H78" stroke="#e9e3d8" />
    </g>
  );
}

function Beanie() {
  return (
    <g>
      <path d="M31 46 C30 20 46 12 60 12 C74 12 90 20 89 46 Z" fill="#ec6a5a" />
      <path
        d="M44 16 C40 26 39 36 39 46 M60 12 V46 M76 16 C80 26 81 36 81 46"
        stroke="#d24e3f"
        strokeWidth="2"
        fill="none"
      />
      <rect x="28" y="40" width="64" height="12" rx="6" fill="#c94a3c" />
      <path
        d="M36 42 V50 M46 42 V50 M56 42 V50 M66 42 V50 M76 42 V50 M86 42 V50"
        stroke="#a83a2e"
        strokeWidth="1.5"
      />
      <circle cx="60" cy="10" r="7" fill="#fff4e6" />
    </g>
  );
}

function FruitCrown() {
  return (
    <g>
      <path
        d="M33 46 Q60 18 87 46"
        stroke="#4c9a55"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M44 33 l-6 -6 M76 33 l6 -6" stroke="#4c9a55" strokeWidth="3" strokeLinecap="round" />
      <circle cx="38" cy="42" r="6" fill="#e0457a" />
      <circle cx="49" cy="31" r="6.5" fill="#ff9a3c" />
      <circle cx="60" cy="27" r="7" fill="#e8404a" />
      <circle cx="71" cy="31" r="6.5" fill="#8a5bd6" />
      <circle cx="82" cy="42" r="6" fill="#ffd23c" />
      <circle cx="60" cy="25" r="1.8" fill="#fff" opacity=".7" />
    </g>
  );
}

function Glasses() {
  return (
    <g fill="#ffffff" fillOpacity=".25" stroke="#3a2f4d" strokeWidth="2.6">
      <circle cx="46" cy="68" r="11" />
      <circle cx="74" cy="68" r="11" />
      <path d="M57 67 Q60 64 63 67" fill="none" />
      <path d="M35 66 L28 63 M85 66 L92 63" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Scarf({ clipId }: AccessoryProps) {
  return (
    <g>
      <g clipPath={`url(#${clipId})`}>
        <path d="M10 94 Q60 112 110 94 V108 Q60 126 10 108 Z" fill="#e8564b" />
        <path
          d="M24 99 L28 114 M44 104 L47 119 M64 106 L66 121 M84 104 L85 118"
          stroke="#ffd3cc"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <path d="M78 108 L92 106 L97 128 L84 130 Z" fill="#cf3f35" />
      <path
        d="M82 118 L95 116 M83 124 L96 122"
        stroke="#ffd3cc"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  );
}

function Apron({ clipId }: AccessoryProps) {
  return (
    <g>
      <g clipPath={`url(#${clipId})`}>
        <path d="M34 106 Q60 100 86 106 L96 130 H24 Z" fill="#ffffff" />
        <path d="M34 106 Q60 100 86 106" stroke="#d9d3c8" strokeWidth="1.5" fill="none" />
        <rect
          x="48"
          y="111"
          width="24"
          height="12"
          rx="4"
          fill="#fff7ec"
          stroke="#e5ddd0"
          strokeWidth="1.2"
        />
      </g>
      <path
        d="M38 105 Q60 96 82 105"
        stroke="#e8c38a"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** Calque d'un accessoire (dessin dans le repère de Nutry). */
export function AccessoryLayer({
  id,
  clipId,
}: {
  readonly id: AccessoryId;
  readonly clipId: string;
}) {
  switch (id) {
    case 'feuille':
      return <Leaf />;
    case 'toque-de-chef':
      return <ChefHat />;
    case 'bonnet':
      return <Beanie />;
    case 'couronne-de-fruits':
      return <FruitCrown />;
    case 'lunettes-rondes':
      return <Glasses />;
    case 'echarpe':
      return <Scarf clipId={clipId} />;
    case 'tablier':
      return <Apron clipId={clipId} />;
  }
}
