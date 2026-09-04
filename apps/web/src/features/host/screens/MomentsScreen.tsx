// apps/web/src/features/host/screens/MomentsScreen.tsx
// Les moments forts.
//
// C'est le seul ecran que l'hote ouvre en pleine fete, debout, une main
// occupee. Trois consequences sur la conception :
//
//   - declencher tient en une touche, sans boite de dialogue. Une
//     confirmation demande de viser deux fois de suite, ce qui est
//     precisement ce qu'on ne sait pas faire en dansant.
//   - un declenchement par erreur coute des vues offertes a deux cents
//     invites : il faut donc pouvoir revenir en arriere, d'ou le bouton
//     de cloture immediate sur le moment en cours.
//   - la fenetre ouverte doit se voir sans lire : elle occupe le haut de
//     l'ecran, cernee d'or, avec son decompte en gros chiffres.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EVENT_TYPES, type CreateMomentInput, type EventType } from '@memora/types';
import type { ApiError, Moment } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { EmptyState } from '../../../ui/EmptyState.js';
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
  const waiting = moments.filter((moment) => !moment.active);

  const submit = () => {
    const input: CreateMomentInput = { label: label.trim(), bonusShots, durationMinutes };
    create.mutate(input, { onSuccess: () => { setAdding(false); setLabel(''); } });
  };

  return (
    <Screen
      title="Moments forts"
      subtitle="Une fenêtre courte pendant laquelle chaque invité reçoit des vues en plus."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${moments.length} PRÉPARÉS`,
        hautDroite: 'MOMENTS',
        basDroite: running ? 'EN COURS' : 'EN VEILLE',
      }}
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
        <p className="mt-6 rounded-champ border border-edge bg-pap-2 px-4 py-3.5 text-xs
          leading-relaxed text-ink-3">
          {eventData?.event.state === 'DRAFT'
            ? 'Préparez vos moments dès maintenant : vous pourrez les déclencher une fois la pellicule ouverte.'
            : 'La soirée est terminée. Les moments forts ne se déclenchent que pendant la prise de vue.'}
        </p>
      )}

      {failure && (
        <p role="alert" className="mt-4 rounded-champ bg-danger-doux p-3.5 text-sm leading-relaxed
          text-danger">
          {failure.message}
        </p>
      )}

      {/* Le moment en cours occupe le haut, cerne d'or : sur ce fond, la
          clarte hierarchise mieux qu'un aplat de couleur, qui noyait le
          decompte — la seule chose qu'on vient lire ici. */}
      {running && (
        <div className="mt-6 rounded-carte border border-a1 bg-a-doux p-5">
          <p className="font-mono text-etiquette uppercase tracking-[0.16em] text-a1">
            En cours
          </p>
          <p className="mt-1.5 decoupe text-titre leading-none text-ink">{running.label}</p>
          {/* Le decompte seul en gros chiffres : c'est ce qu'on vient lire.
              Le mot « Encore » en corps de titre le diluait. */}
          {(() => {
            const left = secondsLeft(running);
            return left === null ? (
              <p className="mt-3 text-base text-ink-2">Fenêtre terminée</p>
            ) : (
              <p className="mt-3 font-mono text-2xl leading-none font-medium tabular-nums text-a1">
                {formatCountdown(left)}
                <span className="ml-2 font-sans text-mini font-normal text-ink-3">restant</span>
              </p>
            );
          })()}
          <p className="mt-2.5 text-mini text-ink-3">
            <span className="font-mono tabular-nums">{running.photoCount}</span> photo
            {running.photoCount > 1 ? 's' : ''} reçue{running.photoCount > 1 ? 's' : ''}
          </p>
          <button
            onClick={() => close.mutate(running.id)}
            disabled={close.isPending}
            className="mt-4 h-10 w-full rounded-champ border border-a1 text-note
              font-bold text-a1 transition active:bg-appui"
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
                  className="rounded-full border border-edge px-3 py-1.5 text-xs text-ink-2
                    transition active:bg-appui"
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
            note={bonusShots === 0 ? 'aucune vue en plus' : `${bonusShots} par invité`}
          />
          <Stepper
            label="Durée de la fenêtre"
            value={durationMinutes}
            min={1}
            max={60}
            onChange={setDuration}
            note={`${durationMinutes} minutes`}
          />

          <p className="rounded-champ border border-edge bg-pap-2 px-3.5 py-3 text-xs
            leading-relaxed text-ink-3">
            Les vues offertes expirent avec la fenêtre. Celles qui n’ont pas
            été utilisées ne sont pas reportées.
          </p>
        </div>
      ) : (
        <div className="pb-6">
          {moments.length === 0 ? (
            <EmptyState>
              Aucun moment préparé.<br />
              Préparez-les avant la soirée : le jour J, une touche suffira.
            </EmptyState>
          ) : waiting.length > 0 ? (
            <>
              <h2 className="mt-8 px-1 font-mono text-etiquette uppercase tracking-[0.16em]
                text-ink-3">
                Préparés
              </h2>
              {/* Des rangees separees par un filet : une carte par moment
                  donnait douze objets de meme poids, ou seul le bouton
                  « Déclencher » comptait. */}
              <ul className="mt-1 flex flex-col">
                {waiting.map((moment, index) => {
                  const done = moment.startedAt !== null;
                  return (
                    <li
                      key={moment.id}
                      className="flex items-center gap-3 border-b border-edge-2 px-1 py-3
                        last:border-b-0 animate-[rise_.3s_ease_backwards]
                        motion-reduce:animate-none"
                      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-note font-bold">{moment.label}</span>
                        <span className="block text-mini text-ink-3">
                          <span className="font-mono tabular-nums">{moment.bonusShots}</span> vue
                          {moment.bonusShots > 1 ? 's' : ''} offerte
                          {moment.bonusShots > 1 ? 's' : ''} ·{' '}
                          <span className="font-mono tabular-nums">{moment.durationMinutes}</span> min
                          {done && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums">{moment.photoCount}</span> photos
                            </>
                          )}
                        </span>
                      </span>

                      {done ? (
                        <span className="shrink-0 rounded-full bg-pap-2 px-2.5 py-1 text-micro
                          font-bold text-ink-3">terminé</span>
                      ) : (
                        // Une touche, sans confirmation : on ne vise pas deux
                        // fois de suite en dansant. Le retour en arriere est la
                        // fermeture immediate, en haut de l'ecran.
                        <button
                          onClick={() => trigger.mutate(moment.id)}
                          disabled={trigger.isPending || running !== null || !live}
                          className="h-10 shrink-0 rounded-champ bg-a1 px-4 text-petit
                            font-bold text-on-a1 disabled:opacity-35"
                        >
                          Déclencher
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {running && (
            <p className="mt-4 text-center text-mini text-ink-3">
              Un seul moment à la fois. Fermez celui en cours pour en lancer un autre.
            </p>
          )}

          <button
            onClick={() => navigate(`/hote/${eventId}/reglages`)}
            className="mt-6 w-full text-center text-xs text-ink-3"
          >
            ‹ Retour aux réglages
          </button>
        </div>
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
      <span className="text-sm font-semibold text-ink-2">{label}</span>
      <div className="flex items-center gap-3.5 rounded-carte bg-pap-2 shadow-[var(--ombre-tirage)]
        px-3.5 py-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`${label} : diminuer`}
          className="h-11 w-11 rounded-champ bg-pap-2 text-xl active:bg-appui"
        >−</button>
        <b className="min-w-12 text-center font-mono text-2xl font-medium tabular-nums
          text-a1">{value}</b>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`${label} : augmenter`}
          className="h-11 w-11 rounded-champ bg-pap-2 text-xl active:bg-appui"
        >+</button>
        <span className="ml-auto text-right text-mini leading-tight text-ink-3">{note}</span>
      </div>
    </div>
  );
}
