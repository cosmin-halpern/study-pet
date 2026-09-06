import { ART, type SpeciesId, type Mood } from '@/lib/creatures';

export function Pet({
  species,
  level,
  face,
  color,
  size = 170,
}: {
  species: SpeciesId;
  level: number;
  face: Mood;
  color: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ ['--mood' as string]: color }}
      dangerouslySetInnerHTML={{ __html: ART[species](level, face) }}
    />
  );
}