import type { PlateBalance } from '@domain/recipe';
import { Gauge } from '../../components/Gauge';
import type { GaugeTone } from '../../components/Gauge';
import styles from './PlateGauges.module.css';

const PLATE_PARTS: readonly {
  readonly key: keyof PlateBalance;
  readonly label: string;
  readonly tone: GaugeTone;
}[] = [
  { key: 'vegetables', label: 'Légumes', tone: 'veg' },
  { key: 'proteins', label: 'Protéines', tone: 'protein' },
  { key: 'starches', label: 'Féculents', tone: 'starch' },
];

interface PlateGaugesProps {
  readonly plate: PlateBalance;
  /** Libellé, jauge et valeur sur une seule ligne (cartes compactes). */
  readonly inline?: boolean;
}

/**
 * Jauges d'assiette (légumes, protéines, féculents) d'après `plateBalance` : la part de
 * chaque famille dans l'assiette, jamais de calories.
 */
export function PlateGauges({ plate, inline = true }: PlateGaugesProps) {
  return (
    <div className={styles.plate} role="group" aria-label="Composition de l’assiette">
      {PLATE_PARTS.map((part) => {
        const percent = Math.round(plate[part.key] * 100);
        return (
          <Gauge
            key={part.key}
            label={part.label}
            tone={part.tone}
            count={percent}
            target={100}
            valueLabel={`${percent} %`}
            valueText={`${percent} pour cent de l’assiette`}
            inline={inline}
          />
        );
      })}
    </div>
  );
}
