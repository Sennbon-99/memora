// apps/web/src/ui/Segmented.tsx
// Choix parmi quelques options mutuellement exclusives.
//
// Des boutons plutot qu'un menu deroulant : sur telephone, un menu natif
// masque l'ecran et cache la consequence du choix, qu'on veut justement
// afficher juste en dessous.

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Passe a deux colonnes quand les libelles sont longs. */
  columns?: 1 | 2 | 3;
}

export function Segmented<T extends string>({
  label, options, value, onChange, columns = 3,
}: SegmentedProps<T>) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[columns];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink-2">{label}</span>
      <div role="radiogroup" aria-label={label} className={`grid ${grid} gap-1.5`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`h-11 rounded-champ border px-2 text-[13px] transition
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-a1
                ${selected
                  ? 'border-a1 bg-a1 font-bold text-on-a1'
                  : 'border-edge text-ink-2 active:bg-appui'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
