// apps/web/src/ui/Spinner.tsx
// Indicateur d'attente. Le role status le fait annoncer aux lecteurs d'ecran.

export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-8">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-white/20
          border-t-[var(--accent)]"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
