// apps/web/src/features/host/screens/MomentsScreen.tsx
// Les moments forts.
//
// C'est le seul ecran que l'hote ouvre en pleine fete, debout, une main
// occupee. Trois consequences sur la conception :
//
//   - declencher tient en une touche, sans boite de dialogue. Une
//     confirmation demande de viser deux fois de suite, ce qui est
//     precisement ce qu'on ne sait pas faire en dansant.
//   - un declenchement par erreur coute des poses offertes a deux cents
//     invites : il faut donc pouvoir revenir en arriere, d'ou le bouton
//     de cloture immediate sur le moment en cours.
//   - la fenetre ouverte doit se voir sans lire : elle occupe le haut de
//     l'ecran, en couleur, avec son decompte.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EVENT_TYPES, type CreateMomentInput, type EventType } from '@memora/types';
import type { ApiError, Moment } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useEvent } from '../useEvents.js';
import { formatCountdown, secondsLeft, useMomentActions, useMoments } from '../useMoments.js';

/**
 * Moments proposes selon le type de soiree.
 *
 * Un hote qui cree sa premiere soiree ne sait pas ce qu'est un moment fort.
 * Lui montrer les trois qu'il aurait choisis lui-meme vaut mieux qu'un
 * champ vide : c'est aussi ce qui donne un sens au type d'evenement, qui
 * ne changeait jusqu'ici que le vocabulaire.
 */
export const SUGGESTIONS: Record<EventType, string[]> = {
  MARIAGE: ['Entrée des mariés', 'Ouverture du bal', 'Pièce montée'],
  ANNIVERSAIRE: ['Les bougies', 'Le discours', 'Photo de groupe'],
  ENTREPRISE: ['Photo d’équipe', 'Remise des prix', 'Cocktail'],
};

/** Un moment en cours, ou rien. Un seul peut etre ouvert a la fois. */
export function activeMoment(moments: Moment[]): Moment | null {
  return moments.find((moment) => moment.active) ?? null;
}

export function MomentsScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending, refetchInterval } = useMoments(eventId);
  const { data: eventData } = useEvent(eventId);
  const { create, trigger, close } = useMomentActions(eventId);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [bonusShots, setBonusShots] = useState(5);
  const [durationMinutes, setDuration] = useState(10);

  // Le decompte avance a la seconde : sans ce battement, l'hote verrait un
  // nombre fige et douterait que quelque chose se passe.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!refetchInterval) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [refetchInterval]);

  if (isPending || !data) return <Spinner label="Chargement des moments" />;

  const moments = data.moments;
  const running = activeMoment(moments);
  // Un moment ne se declenche que pendant la soiree. Le dire et desactiver
  // le bouton vaut mieux que laisser l'hote toucher dans le vide et se
  // demander si l'application est cassee.
  const live = eventData?.event.state === 'OPEN';
  const failure = (trigger.error ?? close.error ?? create.error) as ApiError | null;
  const type = eventData?.event.type ?? 'MARIAGE';
  const proposals = SUGGESTIONS[EVENT_TYPES.includes(type) ? type : 'MARIAGE']
    .filter((name) => !moments.some((moment) => moment.label === name));

  const submit = () => {
    const input: CreateMomentInput = { label: label.trim(), bonusShots, durationMinutes };
    create.mutate(input, { onSuccess: () => { setAdding(false); setLabel(''); } });
  };

  return (
    <Screen
      title="Moments forts"
      subtitle="Une fenêtre courte pendant laquelle chaque invité reçoit des vues en plus."
      footer={
        adding ? (
          <div className="flex gap-2">
            <Button tone="ghost" className="flex-1" onClick={() => setAdding(false)}>Annuler</Button>
            <Button
              className="flex-1"
              disabled={label.trim().length < 3 || create.isPending}
              onClick={submit}
            >
              {create.isPending ? 'Création…' : 'Préparer'}
            </Button>
          </div>
        ) : (
          <Button full tone="ghost" onClick={() => setAdding(true)}>Préparer un moment</Button>
        )
      }
    >
      {!live && !adding && (
        <p className="mt-6 rounded-lg border border-gold/18 bg-paper/5 px-4 py-3.5 text-xs
          leading-relaxed text-paper/50">
          {eventData?.event.state === 'DRAFT'
            ? 'Préparez vos moments dès maintenant : vous pourrez les déclencher une fois la pellicule ouverte.'
            : 'La soirée est terminée. Les moments forts ne se déclenchent que pendant la prise de vue.'}
        </p>
      )}

      {failure && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3.5 text-sm leading-relaxed
          text-red-300">
          {failure.message}
        </p>
      )}

      {/* Le moment en cours occupe le haut, en couleur : il doit se voir
          d'un coup d'oeil, sans lecture. */}
      {running && (
        <div className="mt-6 rounded-xl bg-[var(--accent)] p-5 text-[var(--accent-text)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
            En cours
          </p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">{running.label}</p>
          <p className="mt-1.5 text-sm font-semibold tabular-nums">
            {(() => {
              const left = secondsLeft(running);
              return left === null ? 'Fenêtre terminée' : `Encore ${formatCountdown(left)}`;
            })()}
            {' · '}
            {running.photoCount} photo{running.photoCount > 1 ? 's' : ''} reçue
            {running.photoCount > 1 ? 's' : ''}
          </p>
          <button
            onClick={() => close.mutate(running.id)}
            disabled={close.isPending}
            className="mt-4 h-10 w-full rounded-xl bg-black/20 text-[13px] font-bold"
          >
            {close.isPending ? 'Fermeture…' : 'Fermer maintenant'}
          </button>
        </div>
      )}

      {adding ? (
        <div className="mt-7 flex flex-col gap-5 pb-6">
          <Field
            label="Nom du moment"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ouverture du bal"
            autoFocus
          />

          {proposals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {proposals.map((name) => (
                <button
                  key={name}
                  onClick={() => setLabel(name)}
                  className="rounded-full border border-gold/18 px-3 py-1.5 text-xs text-paper/55"
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <Stepper
            label="Vues offertes à chacun"
            value={bonusShots}
            min={0}
            max={10}
            onChange={setBonusShots}
            note={bonusShots === 0 ? 'aucune pose en plus' : `${bonusShots} par invité`}
          />
          <Stepper
            label="Durée de la fenêtre"
            value={durationMinutes}
            min={1}
            max={60}
            onChange={setDuration}
            note={`${durationMinutes} minutes`}
          />

          <p className="rounded-lg border border-gold/18 bg-paper/5 px-3.5 py-3 text-xs
            leading-relaxed text-paper/50">
            Les poses offertes expirent avec la fenêtre. Celles qui n’ont pas
            été utilisées ne sont pas reportées.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2 pb-6">
          {moments.length === 0 && (
            <p className="mt-10 text-center text-sm leading-relaxed text-paper/45">
              Aucun moment préparé.<br />
              Préparez-les avant la soirée : le jour J, une touche suffira.
            </p>
          )}

          {moments.filter((moment) => !moment.active).map((moment, index) => {
            const done = moment.startedAt !== null;
            return (
              <li
                key={moment.id}
                className="animate-[rise_.3s_ease_backwards] motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                <div className="flex items-center gap-3 rounded-lg border border-gold/18
                  bg-paper/4 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">{moment.label}</span>
                    <span className="block text-[11px] text-paper/45">
                      {moment.bonusShots} pose{moment.bonusShots > 1 ? 's' : ''} offerte
                      {moment.bonusShots > 1 ? 's' : ''} · {moment.durationMinutes} min
                      {done && ` · ${moment.photoCount} photos`}
                    </span>
                  </span>

                  {done ? (
                    <span className="rounded-full bg-paper/8 px-2.5 py-1 text-[10px]
                      font-bold text-paper/45">terminé</span>
                  ) : (
                    // Une touche, sans confirmation : on ne vise pas deux
                    // fois de suite en dansant. Le retour en arriere est la
                    // fermeture immediate, en haut de l'ecran.
                    <button
                      onClick={() => trigger.mutate(moment.id)}
                      disabled={trigger.isPending || running !== null || !live}
                      className="h-10 shrink-0 rounded-xl bg-[var(--accent)] px-4 text-[12px]
                        font-bold text-[var(--accent-text)] disabled:opacity-35"
                    >
                      Déclencher
                    </button>
                  )}
                </div>
              </li>
            );
          })}

          {running && (
            <p className="mt-2 text-center text-[11px] text-paper/35">
              Un seul moment à la fois. Fermez celui en cours pour en lancer un autre.
            </p>
          )}

          <button
            onClick={() => navigate(`/hote/${eventId}/reglages`)}
            className="mt-4 text-center text-xs text-paper/35"
          >
            ‹ Retour aux réglages
          </button>
        </ul>
      )}
    </Screen>
  );
}

/** Compteur a deux boutons : plus fiable qu'un curseur avec un pouce. */
function Stepper({ label, value, min, max, onChange, note }: {
  label: string; value: number; min: number; max: number;
  onChange: (value: number) => void; note: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-paper/60">{label}</span>
      <div className="flex items-center gap-3.5">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`${label} : diminuer`}
          className="h-11 w-11 rounded-xl bg-paper/8 text-xl active:bg-paper/14"
        >−</button>
        <b className="min-w-12 text-center font-mono text-2xl font-semibold tabular-nums
          text-[var(--accent)]">{value}</b>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`${label} : augmenter`}
          className="h-11 w-11 rounded-xl bg-paper/8 text-xl active:bg-paper/14"
        >+</button>
        <span className="text-xs text-paper/35">{note}</span>
      </div>
    </div>
  );
}
