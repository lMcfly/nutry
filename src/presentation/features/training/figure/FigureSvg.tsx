import type { MovementDef } from './library';
import { frameShapes } from './model';
import type { FrameOptions, ViewBox } from './model';
import type { Pose } from './rig';
import styles from './ExerciseFigure.module.css';

interface FigureSvgProps {
  readonly def: MovementDef;
  readonly pose: Pose;
  readonly options: FrameOptions;
  readonly box: ViewBox;
  /** Largeur en pixels (sinon fixée par la feuille de style). */
  readonly width?: number | undefined;
}

/** Une image du mannequin (décorative : le nom accessible est porté par le conteneur). */
export function FigureSvg({ def, pose, options, box, width }: FigureSvgProps) {
  const shapes = frameShapes(def, pose, options, box);
  const viewBox = `${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.width.toFixed(1)} ${box.height.toFixed(1)}`;
  const mirror = def.mirrored
    ? `translate(${(2 * box.x + box.width).toFixed(1)} 0) scale(-1 1)`
    : undefined;
  return (
    <svg
      className={styles.svg}
      data-figure=""
      viewBox={viewBox}
      width={width ?? Math.round(box.width * 2)}
      height={
        width === undefined
          ? Math.round(box.height * 2)
          : Math.round((width * box.height) / box.width)
      }
      aria-hidden="true"
      focusable="false"
    >
      <g transform={mirror}>
        {shapes.map((shape, i) => (
          <path
            // Liste figée pour une pose donnée : l'ordre de dessin sert de clé.
            key={i}
            d={shape.d}
            className={shape.far ? `${styles[shape.tone]} ${styles.far}` : styles[shape.tone]}
          />
        ))}
      </g>
    </svg>
  );
}
