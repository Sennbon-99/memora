// apps/web/src/features/host/screens/CreateEventScreen.tsx
// Creation d'une soiree, en trois temps.
//
// Neuf reglages sur un seul ecran de telephone seraient illisibles. Le
// decoupage n'est pas arbitraire, il raconte l'ordre dans lequel on pense
// une soiree : l'essentiel, la pellicule, l'allure.
//
// Regle tenue partout : on ne demande jamais de choisir dans le vide. Chaque
// reglage affiche la consequence de sa valeur, en francais et pas en jargon.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EVENT_TYPES, FREE_TIER, PREVIEW_MODES, QUOTA_DEFAULT, QUOTA_MAX, QUOTA_MIN,
  type CreateEventInput, type EventType, type PreviewMode,
} from '@memora/types';
import { ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Segmented } from '../../../ui/Segmented.js';
import { applyEventTheme } from '../../../lib/theme.js';
import { defaultClosing, toDateInput, toDateTimeInput } from '../../../lib/datetime.js';
import { useCreateEvent, useEvents } from '../useEvents.js';

/** Ce que le nombre de poses veut dire, plutot que le nombre seul. */
function quotaMeaning(shots: number): string {
  if (shots <= 8) return 'pour une petite soirée';
  if (shots <= 15) return 'pour un cocktail';
  if (shots <= 27) return 'comme un jetable classique';
  if (shots <= 40) return 'pour une longue soirée';
  return 'très généreux';
}

/** La consequence de chaque mode d'apercu, ecrite pour un hote. */
const PREVIEW_HINT: Record<PreviewMode, string> = {
  NONE: "Rien du tout, comme un vrai jetable. Le plus fidèle, mais un invité qui cache l'objectif ne s'en aperçoit jamais.",
  BLURRED: "Une vignette floutée une seconde. Elle laisse vérifier que le pouce n'était pas sur l'objectif, sans permettre de juger la photo.",
  FLASH: "La photographie s'affiche en grand deux secondes et demie. Vos invités voient ce qu'ils prennent — et commencent à composer.",
  CONFIRM: "Vos invités pourront refaire leurs photos. La soirée sera plus soignée, et beaucoup moins spontanée.",
};

const TYPE_LABEL: Record<EventType, string> = {
  MARIAGE: 'Mariage', ANNIVERSAIRE: 'Anniversaire', ENTREPRISE: 'Entreprise',
};
const PREVIEW_LABEL: Record<PreviewMode, string> = {
  NONE: 'Rien', BLURRED: 'Vignette floutée', FLASH: 'Aperçu 2,5 s', CONFIRM: 'Garder ou reprendre',
};

const COLORS = ['#C97C1E', '#7B3FE4', '#1FA97A', '#E0533D', '#2F6BE0'];

/** Date du jour et 2 h du matin le lendemain, au format des champs natifs. */
function defaultDates() {
  return {
    eventDate: toDateInput(new Date()),
    closesAt: toDateTimeInput(defaultClosing()),
  };
}

export function CreateEventScreen() {
  const navigate = useNavigate();
  const create = useCreateEvent();
  const dates = defaultDates();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [type, setType] = useState<EventType>('MARIAGE');
  const [eventDate, setEventDate] = useState(dates.eventDate);
  const [closesAt, setClosesAt] = useState(dates.closesAt);
  const [quotaShots, setQuotaShots] = useState(QUOTA_DEFAULT);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('BLURRED');
  const [color, setColor] = useState(COLORS[0]!);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [useTableCodes, setUseTableCodes] = useState(true);

  const { data: existing } = useEvents();
  const nameTooShort = name.trim().length < 3;
  // La premiere soiree d'un compte est offerte, mais plafonnee en poses.
  const isFirst = (existing?.events.length ?? 0) === 0;

  const submit = async () => {
    const input: CreateEventInput = {
      name: name.trim(),
      type,
      eventDate: new Date(eventDate),
      closesAt: new Date(closesAt),
      quotaShots,
      previewMode,
      color,
      useTableCodes,
      ...(welcomeMessage.trim() ? { welcomeMessage: welcomeMessage.trim() } : {}),
    };
    const { event } = await create.mutateAsync(input);
    navigate(`/hote/${event.id}/kit`, { replace: true });
  };

  const failure = create.error as ApiError | null;

  return (
    <Screen
      title={{ 1: "L'essentiel", 2: 'La pellicule', 3: "L'allure" }[step]}
      subtitle={{
        1: 'Ce que vos invités verront en scannant.',
        2: 'Combien de photographies chacun peut prendre, et ce qu’il voit après.',
        3: 'La couleur habille leur application. La nôtre disparaît.',
      }[step]}
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex gap-2.5">
            <Button
              tone="ghost"
              className="flex-1"
              onClick={() => (step === 1 ? navigate('/hote') : setStep((s) => (s - 1) as 1 | 2))}
            >
              Retour
            </Button>
            <Button
              className="flex-1"
              disabled={(step === 1 && nameTooShort) || create.isPending}
              onClick={() => (step === 3 ? void submit() : setStep((s) => (s + 1) as 2 | 3))}
            >
              {step === 3 ? (create.isPending ? 'Création…' : 'Créer la soirée') : 'Continuer'}
            </Button>
          </div>
          {failure && (
            <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
              {failure.message}
            </p>
          )}
        </div>
      }
    >
      {/* Trois traits plutot que « étape 2 sur 3 » : on voit d'un coup d'oeil
          ce qui reste, sans avoir a lire. */}
      <div className="mt-6 flex gap-1.5" aria-label={`Étape ${step} sur 3`}>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-[var(--accent)]' : 'bg-white/12'}`}
          />
        ))}
      </div>

      <div className="mt-7 flex flex-col gap-5 pb-6">
        {step === 1 && (
          <>
            <Field
              label="Nom de la soirée"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mariage de Léa & Tom"
              autoFocus
              error={name.length > 0 && nameTooShort ? 'Trois caractères au moins.' : undefined}
            />
            <Segmented
              label="Type"
              value={type}
              onChange={setType}
              options={EVENT_TYPES.map((value) => ({ value, label: TYPE_LABEL[value] }))}
            />
            <Field
              label="Date de la soirée"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <Field
              label="La pellicule ferme à"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              hint="Après cette heure, les photographies prises avant la fermeture arrivent
                    encore pendant deux heures — le temps qu’un invité retrouve du réseau."
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-white/60">Poses par invité</span>
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setQuotaShots((q) => Math.max(QUOTA_MIN, q - 1))}
                  aria-label="Une pose de moins"
                  className="h-11 w-11 rounded-xl bg-white/8 text-xl active:bg-white/14"
                >−</button>
                <b className="min-w-14 text-center font-mono text-3xl font-semibold
                  tabular-nums text-[var(--accent)]">{quotaShots}</b>
                <button
                  onClick={() => setQuotaShots((q) => Math.min(QUOTA_MAX, q + 1))}
                  aria-label="Une pose de plus"
                  className="h-11 w-11 rounded-xl bg-white/8 text-xl active:bg-white/14"
                >+</button>
                <span className="text-xs leading-snug text-white/35">{quotaMeaning(quotaShots)}</span>
              </div>
            </div>

            <Segmented
              label="Ce que l’invité voit après sa photo"
              value={previewMode}
              onChange={setPreviewMode}
              columns={2}
              options={PREVIEW_MODES.map((value) => ({ value, label: PREVIEW_LABEL[value] }))}
            />
            <p className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]
              px-3.5 py-3 text-xs leading-relaxed text-[#E8C79A]">
              {PREVIEW_HINT[previewMode]}
            </p>

            {/* Le palier gratuit plafonne la premiere soiree. Le dire ici
                evite qu'un hote choisisse 24 poses et en obtienne 10 sans
                comprendre pourquoi. */}
            {isFirst && quotaShots > FREE_TIER.shots && (
              <p className="rounded-2xl border border-white/12 bg-white/5 px-3.5 py-3
                text-xs leading-relaxed text-white/55">
                Votre première soirée est offerte, et limitée à {FREE_TIER.shots} poses
                par invité. Vous en avez choisi {quotaShots} : les soirées suivantes
                les accepteront toutes.
              </p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-white/60">Couleur de la soirée</span>
              <div className="flex gap-2.5">
                {COLORS.map((value) => (
                  <button
                    key={value}
                    aria-label={`Couleur ${value}`}
                    aria-pressed={value === color}
                    onClick={() => { setColor(value); applyEventTheme(value); }}
                    style={{ background: value }}
                    className={`h-9 w-9 rounded-xl border-2 ${
                      value === color ? 'border-white' : 'border-transparent'}`}
                  />
                ))}
              </div>
            </div>

            <Field
              label="Mot d’accueil"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Photographiez ce que je ne verrai pas."
              maxLength={280}
              hint="Facultatif. Affiché sur le premier écran de vos invités."
            />

            <Segmented
              label="Numéros de table"
              value={useTableCodes ? 'oui' : 'non'}
              onChange={(v) => setUseTableCodes(v === 'oui')}
              columns={2}
              options={[
                { value: 'oui', label: 'Demander' },
                { value: 'non', label: 'Ne pas demander' },
              ]}
            />
          </>
        )}
      </div>
    </Screen>
  );
}
