export function Stats({
  streak,
  best,
  total,
  caught,
}: {
  streak: number;
  best: number;
  total: number;
  caught: number;
}) {
  const tiles = [
    { value: streak, label: 'day streak' },
    { value: best, label: 'best run' },
    { value: total, label: 'days total' },
    { value: `${caught}/5`, label: 'caught' },
  ];

  return (
    <div className="grid w-full grid-cols-4 divide-x divide-navy/15 rounded-lg border border-navy/15">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col items-center gap-1 py-4">
          <span className="font-display text-2xl">{t.value}</span>
          <span className="text-xs text-navy/60">{t.label}</span>
        </div>
      ))}
    </div>
  );
}