// apps/web/src/features/guest/screens/IdentityScreen.tsx
// Prenom et table, tous deux facultatifs.
//
// Le prenom ne sert qu'a deux choses : afficher un mot de bienvenue, et
// retrouver la pellicule depuis un autre appareil. L'invite peut passer :
// c'est le seul moyen de tenir la promesse d'anonymat du produit.

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { joinEventSchema, type JoinEventInput } from '@memora/types';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { useIdentity } from '../useGuestSession.js';

interface IdentityScreenProps {
  slug: string;
  useTableCodes: boolean;
  onDone: () => void;
}

export function IdentityScreen({ slug, useTableCodes, onDone }: IdentityScreenProps) {
  const identity = useIdentity(slug);
  // Le meme schema Zod valide ici et sur le serveur : une regle changee
  // dans @memora/types se propage aux deux cotes a la compilation.
  const { register, handleSubmit, formState } = useForm<JoinEventInput>({
    resolver: zodResolver(joinEventSchema),
  });

  const submit = handleSubmit(async (values) => {
    await identity.mutateAsync(values);
    onDone();
  });

  return (
    <Screen
      title="Comment vous appeler ?"
      subtitle="Facultatif. Cela sert seulement a retrouver vos photos si vous changez de telephone."
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
          <span className="text-sm font-medium text-white/70">Prenom</span>
          <input
            {...register('firstName')}
            autoComplete="given-name"
            placeholder="Camille"
            className="h-12 rounded-2xl bg-white/8 px-4 text-base text-paper
              placeholder:text-white/25 focus:outline-2 focus:outline-[var(--accent)]"
          />
          {formState.errors.firstName && (
            <span role="alert" className="text-xs text-red-300">
              {formState.errors.firstName.message}
            </span>
          )}
        </label>

        {useTableCodes && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white/70">Numero de table</span>
            <input
              {...register('tableId')}
              inputMode="numeric"
              placeholder="7"
              className="h-12 rounded-2xl bg-white/8 px-4 text-base text-paper
                placeholder:text-white/25 focus:outline-2 focus:outline-[var(--accent)]"
            />
          </label>
        )}
      </form>
    </Screen>
  );
}
