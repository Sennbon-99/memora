// apps/web/src/features/host/screens/EditSettingScreen.tsx
// Modification d'un reglage de la soiree, un ecran par reglage.
//
// Une regle metier gouverne cet ecran, et elle n'est pas cosmetique : le
// quota de vues n'est modifiable qu'en brouillon. Une fois la pellicule
// ouverte, chaque invite porte son compteur dans Redis. Le baisser de
// vingt-quatre a dix ne retirerait rien a ceux qui sont deja la, et
// creerait deux regles differentes dans la meme soiree. Le prolonger, en
// revanche, est toujours possible : l'heure de fermeture ne fait de mal
// a personne.

import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  PREVIEW_MODES, QUOTA_MAX, QUOTA_MIN, type PreviewMode,
} from '@memora/types';
import type { ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Segmented } from '../../../ui/Segmented.js';
import { Spinner } from '../../../ui/Spinner.js';
import { toDateTimeInput } from '../../../lib/datetime.js';
import { useEvent, useUpdateEvent } from '../useEvents.js';

type Setting = 'quota' | 'preview' | 'closes' | 'tables' | 'welcome' | 'color';

const PREVIEW_LABEL: Record<PreviewMode, string> = {
  NONE: 'Rien', BLURRED: 'Vignette floutée',
  FLASH: 'Aperçu 2,5 s', CONFIRM: 'Garder ou reprendre',
};
const PREVIEW_HINT: Record<PreviewMode, string> = {
  NONE: "Rien du tout, comme un vrai jetable. Un invité qui cache l'objectif ne s'en aperçoit jamais.",
  BLURRED: "Une vignette floutée une seconde : elle laisse vérifier le cadrage sans permettre de juger la photo.",
  FLASH: "La photographie s'affiche en grand deux secondes et demie. Vos invités commencent à composer.",
  CONFIRM: "Vos invités pourront refaire leurs photos. La soirée sera plus soignée, et moins spontanée.",
};

const COLORS = ['#C97C1E', '#7B3FE4', '#1FA97A', '#E0533D', '#2F6BE0'];

const TITLES: Record<Setting, string> = {
  quota: 'Vues par invité',
  preview: 'Aperçu après la photo',
  closes: 'Heure de fermeture',
  tables: 'Numéros de table',
  welcome: 'Mot d’accueil',
  color: 'Couleur de la soirée',
};

export function EditSettingScreen() {
  const { eventId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setting = (params.get('r') ?? 'quota') as Setting;

  const { data } = useEvent(eventId);
  const update = useUpdateEvent(eventId);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);

  if (!data) return <Spinner label="Chargement du réglage" />;
  const { event } = data;

  // Valeur courante, ou celle que l'hote vient de choisir.
  const value = <T,>(key: string, current: T): T => (draft?.[key] as T) ?? current;
  const set = (key: string, next: unknown) => setDraft({ ...draft, [key]: next });

  const locked = setting === 'quota' && event.state !== 'DRAFT';

  const save = () => {
    if (!draft) return navigate(-1);
    update.mutate(draft, { onSuccess: () => navigate(`/hote/${eventId}/reglages`) });
  };

  return (
    <Screen
      title={TITLES[setting]}
      subtitle={event.name}
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${event.quotaShots} VUES`,
        hautDroite: 'RÉGLAGE',
        basDroite: locked ? 'VERROUILLÉ' : 'MODIFIABLE',
      }}
      footer={
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <Button tone="ghost" className="flex-1" onClick={() => navigate(-1)}>Annuler</Button>
            <Button
              className="flex-1"
              disabled={locked || !draft || update.isPending}
              onClick={save}
            >
              {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          {update.error && (
            <p role="alert" className="rounded-carte bg-danger-doux p-3 text-sm text-danger">
              {(update.error as ApiError).message}
            </p>
          )}
        </div>
      }
    >
      <div className="mt-7 flex flex-col gap-5 pb-6">
        {locked && (
          <p className="rounded-champ border border-edge bg-pap-2 px-4 py-3.5 text-xs
            leading-relaxed text-ink-2">
            Le nombre de vues ne se modifie plus une fois la pellicule ouverte.
            Vos invités portent déjà leur compteur : le changer maintenant
            créerait deux règles dans la même soirée.
          </p>
        )}

        {setting === 'quota' && (
          <div className="flex items-center gap-3.5 rounded-carte border border-edge
            bg-pap-2 px-3.5 py-3">
            <button
              disabled={locked}
              onClick={() => set('quotaShots', Math.max(QUOTA_MIN, value('quotaShots', event.quotaShots) - 1))}
              aria-label="Une vue de moins"
              className="h-11 w-11 rounded-champ bg-pap-2 text-xl disabled:opacity-30"
            >−</button>
            <b className="min-w-14 text-center font-mono text-3xl font-medium tabular-nums
              text-a1">{value('quotaShots', event.quotaShots)}</b>
            <button
              disabled={locked}
              onClick={() => set('quotaShots', Math.min(QUOTA_MAX, value('quotaShots', event.quotaShots) + 1))}
              aria-label="Une vue de plus"
              className="h-11 w-11 rounded-champ bg-pap-2 text-xl disabled:opacity-30"
            >+</button>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em]
              text-ink-3">Vues</span>
          </div>
        )}

        {setting === 'preview' && (
          <>
            <Segmented
              label="Ce que l’invité voit après sa photo"
              value={value('previewMode', event.previewMode)}
              onChange={(next) => set('previewMode', next)}
              columns={2}
              options={PREVIEW_MODES.map((mode) => ({ value: mode, label: PREVIEW_LABEL[mode] }))}
            />
            <p className="rounded-champ border border-edge bg-a-doux px-3.5 py-3 text-xs
              leading-relaxed text-a1">
              {PREVIEW_HINT[value('previewMode', event.previewMode)]}
            </p>
          </>
        )}

        {setting === 'closes' && (
          <Field
            label="La pellicule ferme à"
            type="datetime-local"
            value={value('closesAt', toDateTimeInput(new Date(event.closesAt)))}
            onChange={(input) => set('closesAt', input.target.value)}
            hint="Prolonger est toujours possible. Les photographies prises avant
                  la fermeture arrivent encore pendant deux heures."
          />
        )}

        {setting === 'tables' && (
          <Segmented
            label="Numéros de table"
            value={value('useTableCodes', event.useTableCodes) ? 'oui' : 'non'}
            onChange={(next) => set('useTableCodes', next === 'oui')}
            columns={2}
            options={[
              { value: 'oui', label: 'Demander' },
              { value: 'non', label: 'Ne pas demander' },
            ]}
          />
        )}

        {setting === 'welcome' && (
          <Field
            label="Mot d’accueil"
            value={value('welcomeMessage', event.welcomeMessage ?? '')}
            onChange={(input) => set('welcomeMessage', input.target.value)}
            maxLength={280}
            placeholder="Photographiez ce que je ne verrai pas."
            hint="Affiché sur le premier écran de vos invités."
          />
        )}

        {setting === 'color' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink-2">Couleur de la soirée</span>
            <div className="flex gap-2.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  aria-label={`Couleur ${color}`}
                  aria-pressed={value('color', event.color) === color}
                  onClick={() => set('color', color)}
                  style={{ background: color }}
                  className={`h-10 w-10 rounded-full border-2 ${
                    value('color', event.color) === color ? 'border-edge' : 'border-edge'}`}
                />
              ))}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              Le changement est immédiat pour les invités déjà connectés.
            </p>
          </div>
        )}
      </div>
    </Screen>
  );
}
