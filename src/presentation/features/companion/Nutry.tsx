import { useId } from 'react';
import { COMPANION_ACCESSORIES, COMPANION_COLORS, COMPANION_EYES } from '@domain/companion';
import type { AccessoryId, CompanionLook, CompanionMood, EyeId } from '@domain/companion';
import { AccessoryLayer } from './Accessories';
import { NUTRY_TINTS, SPECIAL_STOPS } from './palette';
import styles from './Nutry.module.css';

export type NutrySize = 's' | 'm' | 'l';

interface NutryProps {
  readonly look: CompanionLook;
  readonly mood?: CompanionMood;
  readonly size?: NutrySize;
  readonly className?: string;
}

const MOOD_PHRASES: Readonly<Record<CompanionMood, string>> = {
  joyeux: 'il est joyeux',
  content: 'il est content',
  sieste: 'il fait la sieste',
};

const INK = '#2a2438';
const MOUTH = '#5a1f2d';

/** Phrase qui décrit l'apparence et l'humeur (alternative textuelle du SVG). */
function describeNutry(look: CompanionLook, mood: CompanionMood): string {
  const color = COMPANION_COLORS.find((c) => c.id === look.color)?.label ?? look.color;
  const eyes = COMPANION_EYES.find((e) => e.id === look.eyes)?.label ?? look.eyes;
  const worn = Object.values(look.accessories)
    .map((id) => COMPANION_ACCESSORIES.find((a) => a.id === id)?.label)
    .filter((label): label is string => label !== undefined)
    .map((label) => label.toLowerCase());
  return [
    'Nutry, la petite boule',
    `couleur ${color.toLowerCase()}`,
    `yeux ${eyes.toLowerCase()}`,
    worn.length > 0 ? `avec ${worn.join(', ')}` : 'sans accessoire',
    MOOD_PHRASES[mood],
  ].join(', ');
}

function Eye({ style, x, y, side }: { style: EyeId; x: number; y: number; side: -1 | 1 }) {
  switch (style) {
    case 'ronds':
      return (
        <g>
          <circle cx={x} cy={y} r="5.2" fill={INK} />
          <circle cx={x + 1.6} cy={y - 1.9} r="1.7" fill="#fff" />
        </g>
      );
    case 'rieurs':
      return (
        <path
          d={`M${x - 6.5} ${y + 2.5} Q${x} ${y - 7} ${x + 6.5} ${y + 2.5}`}
          stroke={INK}
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'brillants':
      return (
        <g>
          <ellipse cx={x} cy={y} rx="6.2" ry="7.2" fill={INK} />
          <circle cx={x + 2} cy={y - 2.8} r="2.3" fill="#fff" />
          <circle cx={x - 2} cy={y + 2.6} r="1.2" fill="#fff" />
        </g>
      );
    case 'malicieux':
      return (
        <g>
          <ellipse cx={x} cy={y + 1} rx="5.6" ry="3.4" fill={INK} />
          <path
            d={`M${x - 7 * side} ${y - 4 + (side === 1 ? 1 : -2)} L${x + 6 * side} ${y - 8 + (side === 1 ? -2 : 1)}`}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      );
    case 'doux':
      return (
        <g>
          <circle cx={x} cy={y} r="5.6" fill={INK} />
          <circle cx={x + 1.8} cy={y - 2} r="2.2" fill="#fff" />
          <path
            d={`M${x - 7.5} ${y - 6} Q${x} ${y - 10} ${x + 7.5} ${y - 6}`}
            stroke={INK}
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
  }
}

function ClosedEye({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 6.5} ${y} Q${x} ${y + 6} ${x + 6.5} ${y}`}
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Mouth({ mood }: { mood: CompanionMood }) {
  if (mood === 'joyeux') {
    return (
      <g>
        <path
          d="M49 80 Q60 98 71 80 Q60 84 49 80 Z"
          fill={MOUTH}
          stroke={MOUTH}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M54 89 Q60 85 66 89 Q60 95 54 89 Z" fill="#ff8fa3" />
      </g>
    );
  }
  if (mood === 'content') {
    return (
      <path
        d="M52 82 Q60 91 68 82"
        stroke={MOUTH}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return <ellipse cx="60" cy="85" rx="3.2" ry="2.6" fill={MOUTH} opacity=".85" />;
}

/**
 * Nutry : petite boule douce, personnalisable (teinte, yeux, accessoires) et expressive
 * (humeur). SVG pur, animé par CSS (flottement, clignement, rebond) ; les animations sont
 * coupées par `prefers-reduced-motion`.
 */
export function Nutry({ look, mood = 'content', size = 'm', className }: NutryProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bodyId = `nutry-body-${uid}`;
  const shineId = `nutry-shine-${uid}`;
  const clipId = `nutry-clip-${uid}`;
  const tint = NUTRY_TINTS[look.color];
  const asleep = mood === 'sieste';
  const accessories = look.accessories;
  const layer = (id: AccessoryId | undefined) =>
    id === undefined ? null : <AccessoryLayer id={id} clipId={clipId} />;

  return (
    <svg
      viewBox="0 0 120 134"
      className={[styles.nutry, styles[size], mood === 'joyeux' ? styles.hop : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={describeNutry(look, mood)}
      data-mood={mood}
      data-color={look.color}
    >
      <defs>
        {tint.special === undefined ? (
          <radialGradient id={bodyId} cx="35%" cy="28%" r="80%">
            <stop offset="0" stopColor={tint.light} />
            <stop offset="0.55" stopColor={tint.mid} />
            <stop offset="1" stopColor={tint.dark} />
          </radialGradient>
        ) : (
          <linearGradient id={bodyId} x1="0.1" y1="0" x2="0.9" y2="1">
            {SPECIAL_STOPS[tint.special].map((color, index, all) => (
              <stop key={color} offset={index / (all.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
        )}
        <radialGradient id={shineId} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          <ellipse cx="60" cy="76" rx="44" ry="42" />
        </clipPath>
      </defs>

      <ellipse cx="60" cy="123" rx="30" ry="5" fill="#000" opacity=".12" />

      <g className={styles.float}>
        {/* petits pieds */}
        <ellipse cx="44" cy="117" rx="9" ry="5" fill={tint.dark} />
        <ellipse cx="76" cy="117" rx="9" ry="5" fill={tint.dark} />

        <ellipse cx="60" cy="76" rx="44" ry="42" fill={`url(#${bodyId})`} />
        {tint.special === 'cosmos' && (
          <g clipPath={`url(#${clipId})`} className={styles.stars} fill="#fff">
            <circle cx="30" cy="52" r="1.6" />
            <circle cx="88" cy="48" r="2" />
            <circle cx="96" cy="84" r="1.4" />
            <circle cx="24" cy="86" r="1.2" />
            <circle cx="70" cy="108" r="1.6" />
            <path d="M82 62 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" />
            <path d="M34 70 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 Z" />
          </g>
        )}
        {/* reflet */}
        <ellipse
          cx="42"
          cy="50"
          rx="17"
          ry="10"
          fill={`url(#${shineId})`}
          transform="rotate(-28 42 50)"
        />

        {layer(accessories.corps)}

        {/* joues */}
        <ellipse cx="34" cy="78" rx="7" ry="4.5" fill={tint.cheek} opacity=".55" />
        <ellipse cx="86" cy="78" rx="7" ry="4.5" fill={tint.cheek} opacity=".55" />

        <g className={asleep ? undefined : styles.eyes}>
          {asleep ? (
            <>
              <ClosedEye x={46} y={68} />
              <ClosedEye x={74} y={68} />
            </>
          ) : (
            <>
              <Eye style={look.eyes} x={46} y={68} side={-1} />
              <Eye style={look.eyes} x={74} y={68} side={1} />
            </>
          )}
        </g>
        <Mouth mood={mood} />

        {layer(accessories.cou)}
        {layer(accessories.visage)}
        {layer(accessories.tete)}

        {asleep && (
          <g className={styles.zzz} fontWeight="800" fontFamily="system-ui, sans-serif">
            <text x="86" y="40" fontSize="14">
              z
            </text>
            <text x="97" y="27" fontSize="10">
              z
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
