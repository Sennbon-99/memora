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
      <span className="text-sm font-semibold text-ink-2">{label}</span>
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={`h-12 rounded-champ bg-pap-2 px-4 text-base text-ink
          border border-edge placeholder:text-ink-3
          focus:outline-none focus:border-a1
          aria-[invalid=true]:border-danger ${className}`}
        {...props}
      />
      {hint && !error && <span className="text-xs leading-relaxed text-ink-3">{hint}</span>}
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </label>
  );
});
