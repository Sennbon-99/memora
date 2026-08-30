// apps/web/src/features/host/screens/LoginScreen.tsx
// Connexion et creation de compte, sur un seul ecran.
//
// Deux formulaires separes obligeraient l'hote a choisir avant de savoir
// s'il a deja un compte. Une bascule suffit, et le champ de nom apparait
// seulement quand il sert.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, registerSchema, type RegisterInput } from '@memora/types';
import { ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { presentationVue } from '../../onboarding/Onboarding.js';
import { useLogin, useRegister } from '../useAuth.js';

export function LoginScreen() {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const login = useLogin();
  const register = useRegister();
  const busy = login.isPending || register.isPending;

  const form = useForm<RegisterInput>({
    resolver: zodResolver(creating ? registerSchema : loginSchema),
  });

  const submit = form.handleSubmit(async (values) => {
    const action = creating ? register : login;
    await action.mutateAsync(values);
    // Un compte tout juste cree n'a rien a retrouver : c'est le seul moment
    // ou la presentation tombe juste. Une connexion, elle, ramene l'hote la
    // ou il allait.
    const suite = creating && !presentationVue('hote')
      ? '/hote/decouvrir'
      : location.state?.from ?? '/hote';
    navigate(suite, { replace: true });
  });

  // Le serveur renvoie le meme message que le compte existe ou non : on
  // n'aide pas quelqu'un a decouvrir quelles adresses sont inscrites.
  const failure = (login.error ?? register.error) as ApiError | null;

  return (
    <Screen
      title={creating ? 'Créer un compte' : 'Votre espace'}
      subtitle={
        creating
          ? 'Un compte suffit pour toutes vos soirées.'
          : 'Vos invités, eux, n’ont besoin de rien.'
      }
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: 'ESPACE HÔTE',
        hautDroite: creating ? 'INSCRIPTION' : 'CONNEXION',
      }}
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={submit} disabled={busy}>
            {busy ? 'Un instant…' : creating ? 'Créer mon compte' : 'Se connecter'}
          </Button>
          <Button
            tone="ghost"
            full
            onClick={() => { setCreating((was) => !was); form.clearErrors(); }}
          >
            {creating ? "J'ai déjà un compte" : 'Créer un compte'}
          </Button>
          {/* Beaucoup d'invites arrivent ici par le lien d'une application
              installee ou par une adresse tapee de travers, et se voient
              reclamer un compte que le produit leur promet de ne jamais
              demander. Cette sortie les remet sur leur pellicule. */}
          <button
            type="button"
            onClick={() => navigate(presentationVue('invite') ? '/scan' : '/decouvrir')}
            className="mx-auto py-1 text-sm text-paper/45 underline underline-offset-4
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Je suis un invité
          </button>
        </div>
      }
    >
      <form className="mt-9 flex flex-col gap-4" onSubmit={submit}>
        {creating && (
          <Field
            label="Votre nom"
            autoComplete="name"
            placeholder="Léa Tordjman"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
        )}
        <Field
          label="Adresse électronique"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="lea@exemple.fr"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          error={form.formState.errors.password?.message}
          hint={creating ? 'Douze caractères au moins.' : undefined}
          {...form.register('password')}
        />

        {failure && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3.5 text-sm text-red-300">
            {failure.message}
          </p>
        )}
      </form>
    </Screen>
  );
}
