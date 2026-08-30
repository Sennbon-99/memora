// apps/web/src/ui/Field.tsx
// Champ de saisie, etiquette et message d'erreur au meme endroit.
//
// L'erreur est rendue dans un role alert : un lecteur d'ecran l'annonce des
// qu'elle apparait, sans que l'utilisateur ait a la chercher.

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className = '', ...props },
  ref,
) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-paper/60">{label}</span>
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={`h-12 rounded-lg bg-paper/7 px-4 text-base text-paper
          border border-transparent placeholder:text-paper/22
          focus:outline-none focus:border-[var(--accent)]
          aria-[invalid=true]:border-red-400/60 ${className}`}
        {...props}
      />
      {hint && !error && <span className="text-xs leading-relaxed text-paper/35">{hint}</span>}
      {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
    </label>
  );
});
