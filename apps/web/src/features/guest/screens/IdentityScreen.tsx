// apps/web/src/features/guest/screens/IdentityScreen.tsx
// Prenom et table, tous deux facultatifs.
//
// Le prenom ne sert qu'a deux choses : afficher un mot de bienvenue, et
// retrouver la pellicule depuis un autre appareil. L'invite peut passer :
// c'est le seul moyen de tenir la promesse d'anonymat du produit.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { joinEventSchema, type JoinEventInput } from '@memora/types';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { useIdentity } from '../useGuestSession.js';

interface IdentityScreenProps {
  slug: string;
  useTableCodes: boolean;
  /** Les tables de la soiree, telles que l'hote les a creees. */
  tables: { id: string; label: string }[];
  onDone: () => void;
}

export function IdentityScreen({ slug, useTableCodes, tables, onDone }: IdentityScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const identity = useIdentity(slug);
  // Le meme schema Zod valide ici et sur le serveur : une regle changee
  // dans @memora/types se propage aux deux cotes a la compilation.
  const { register, handleSubmit, formState } = useForm<JoinEventInput>({
    resolver: zodResolver(joinEventSchema),
  });

  const submit = handleSubmit(async (values) => {
    await identity.mutateAsync(selected ? { ...values, tableId: selected } : values);
    onDone();
  });

  return (
    <Screen
      title="Comment vous appeler ?"
      subtitle="Facultatif. Cela sert seulement à retrouver vos photos si vous changez de téléphone."
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={submit} disabled={identity.isPending}>
            Continuer
          </Button>
          <Button tone="ghost" full onClick={onDone}>
            Passer, rester anonyme
          </Button>
        </div>
      }
    >
      <form className="mt-10 flex flex-col gap-5" onSubmit={submit}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-paper/70">Prénom</span>
          <input
            {...register('firstName')}
            autoComplete="given-name"
            placeholder="Camille"
            className="h-12 rounded-lg bg-paper/8 px-4 text-base text-paper
              placeholder:text-paper/25 focus:outline-2 focus:outline-[var(--accent)]"
          />
          {formState.errors.firstName && (
            <span role="alert" className="text-xs text-red-300">
              {formState.errors.firstName.message}
            </span>
          )}
        </label>

        {/* Une liste et non un champ libre : le serveur attend l'identifiant
            d'une table existante, pas un numero tape a la main. Un champ
            libre echouait a la validation a tous les coups. */}
        {useTableCodes && tables.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-paper/70">Votre table</legend>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {tables.map((table) => {
                const chosen = table.id === selected;
                return (
                  <button
                    key={table.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    onClick={() => { setSelected(chosen ? null : table.id); }}
                    className={`h-11 rounded-xl border text-[13px] transition
                      ${chosen
                        ? 'border-[var(--accent)] bg-[var(--accent)] font-bold text-[var(--accent-text)]'
                        : 'border-gold/18 text-paper/55'}`}
                  >
                    {table.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </form>
    </Screen>
  );
}
