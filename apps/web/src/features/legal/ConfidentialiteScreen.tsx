// apps/web/src/features/legal/ConfidentialiteScreen.tsx
// La politique de confidentialite, a une adresse publique et stable.
//
// App Store Connect refuse la soumission sans l'URL d'une telle page : c'est
// a ce titre qu'elle existe. Mais elle sert d'abord l'invite, qui confie des
// photographies de lui a une application ou il n'a pas de compte et ou il ne
// peut donc rien consulter apres coup.
//
// Elle ne decrit que ce que le code fait : les durees viennent de
// RETENTION_DAYS et de purge.job.ts, les champs conserves de roll.prisma et
// photo.prisma. Toute phrase qui promettrait davantage serait une phrase
// fausse — et une politique de confidentialite fausse est pire qu'absente.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RETENTION_DAYS } from '@memora/types';
import { Screen } from '../../ui/Screen.js';

/**
 * Adresse a laquelle s'exercent les droits.
 *
 * A CONFIRMER avant la soumission : cette boite doit exister et etre relevee.
 * Une politique de confidentialite qui renvoie vers une adresse morte prive
 * l'invite du seul moyen d'exercer ses droits, et c'est le genre de detail
 * qu'un relecteur verifie. Elle figure aussi telle quelle dans la fiche App
 * Store : la changer ici ne suffit pas, il faut la reporter dans App Store
 * Connect.
 */
const CONTACT = 'contact@memora-app.fr';

/** Derniere revision de fond, affichee en clair : une politique sans date ne se verifie pas. */
const DERNIERE_MISE_A_JOUR = '2 septembre 2026';

/** Un intertitre, dans le meme registre que le reste de l'application. */
function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
        {titre}
      </h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function ConfidentialiteScreen() {
  return (
    <Screen
      title="Confidentialité"
      subtitle="Ce que Memora garde, combien de temps, et comment le faire effacer."
      titreRepliable
      code={{ hautGauche: 'MEMORA 400', basGauche: 'CONFIDENTIALITE' }}
    >
      <p className="mt-6 px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
        Mise à jour du {DERNIERE_MISE_A_JOUR}
      </p>

      <Section titre="En bref">
        <p>
          Memora est un appareil photo jetable pour une soirée. Un invité n'a ni
          compte, ni mot de passe, ni adresse électronique à donner : il scanne un
          QR code, il photographie. Les photographies appartiennent à la soirée, et
          disparaissent avec elle.
        </p>
      </Section>

      <Section titre="Qui est responsable">
        <p>
          Le responsable du traitement est Ziane Hamdaoui, éditeur de Memora.
          Toute question relative à vos données, et toute demande d'exercice de vos
          droits, se fait à l'adresse{' '}
          <a href={`mailto:${CONTACT}`} className="underline underline-offset-2 text-ink">
            {CONTACT}
          </a>
          .
        </p>
      </Section>

      <Section titre="Ce qui est collecté, côté invité">
        <p>
          Les <strong className="font-medium text-ink">photographies</strong> que vous
          prenez, avec leur date de prise de vue, leurs dimensions et leur poids.
        </p>
        <p>
          Un <strong className="font-medium text-ink">identifiant d'appareil</strong>,
          déposé dans un cookie signé. Il ne dit pas qui vous êtes : il sert à
          retrouver votre pellicule, à tenir votre compte de poses et à garder la
          trace de votre acceptation du droit à l'image.
        </p>
        <p>
          Votre <strong className="font-medium text-ink">prénom</strong>, si vous
          choisissez d'en donner un. Il est facultatif, limité à trente caractères,
          et sert uniquement à signer vos photographies auprès des autres invités.
        </p>
        <p>
          Si vous acceptez les notifications, l'adresse technique fournie par votre
          navigateur ou par Apple pour vous les envoyer.
        </p>
      </Section>

      <Section titre="Ce qui n'est pas collecté">
        <p>
          <strong className="font-medium text-ink">Les données cachées de vos
          photographies</strong> — position GPS, modèle de téléphone, réglages de
          l'appareil — sont effacées sur votre téléphone, avant l'envoi. Elles
          n'atteignent jamais nos serveurs.
        </p>
        <p>
          Aucun compte, aucun nom de famille, aucune adresse électronique, aucun
          numéro de téléphone ne vous est demandé.
        </p>
        <p>
          Memora ne contient ni publicité, ni mesure d'audience, ni traceur tiers.
          Rien de ce que vous faites ici n'est revendu, croisé, ni utilisé pour du
          ciblage publicitaire.
        </p>
      </Section>

      <Section titre="Ce qui est collecté, côté organisateur">
        <p>
          L'organisateur d'une soirée a, lui, un compte : son adresse électronique
          et son mot de passe, qui n'est jamais conservé en clair. S'il souscrit une
          formule payante, le paiement est traité par Stripe, qui reçoit ses
          coordonnées bancaires directement — Memora ne les voit ni ne les conserve.
        </p>
      </Section>

      <Section titre="Pourquoi, et sur quelle base">
        <p>
          Les photographies sont traitées sur la base de votre{' '}
          <strong className="font-medium text-ink">consentement</strong>, recueilli
          au premier écran, avant que le viseur n'existe. Le refuser ferme la page
          et ne conserve rien.
        </p>
        <p>
          Le compte de l'organisateur et son éventuel paiement relèvent de
          l'exécution du contrat qui le lie à Memora.
        </p>
      </Section>

      <Section titre="Qui les voit">
        <p>
          Vos photographies sont visibles par l'organisateur de la soirée. Elles ne
          deviennent visibles par les autres invités que s'il décide de les publier.
          Tant qu'il ne l'a pas fait, personne d'autre que lui n'y a accès.
        </p>
      </Section>

      <Section titre="Combien de temps">
        <p>
          Les photographies et tout ce qui s'y rattache sont supprimés{' '}
          <strong className="font-medium text-ink">
            {RETENTION_DAYS} jours après la fermeture de la soirée
          </strong>
          . La suppression est effective : les fichiers sont retirés du stockage et
          les enregistrements de la base de données. Ce n'est pas un simple
          marquage, et rien n'est conservé en archive.
        </p>
      </Section>

      <Section titre="Où elles sont hébergées">
        <p>
          Sur un serveur loué à Hetzner Online GmbH, situé en Allemagne. Vos
          photographies ne quittent pas l'Union européenne.
        </p>
      </Section>

      <Section titre="Vos droits">
        <p>
          Vous pouvez demander le retrait d'une photographie{' '}
          <strong className="font-medium text-ink">à tout moment et sans attendre</strong>,
          directement depuis la soirée : chaque photographie porte une demande de
          retrait, adressée à l'organisateur.
        </p>
        <p>
          Vous disposez par ailleurs des droits d'accès, de rectification,
          d'effacement, de limitation, d'opposition et de portabilité, et du droit
          de retirer votre consentement. Écrivez à{' '}
          <a href={`mailto:${CONTACT}`} className="underline underline-offset-2 text-ink">
            {CONTACT}
          </a>
          .
        </p>
        <p className="text-ink-3">
          Une précision utile : sans compte, nous ne pouvons pas vous reconnaître.
          Pour retrouver vos photographies, indiquez la soirée concernée et
          présentez votre demande depuis le téléphone qui les a prises — c'est lui
          qui porte votre pellicule.
        </p>
        <p>
          Si une réponse ne vous satisfait pas, vous pouvez saisir la Commission
          nationale de l'informatique et des libertés (CNIL), 3 place de Fontenoy,
          75007 Paris.
        </p>
      </Section>

      <div className="mb-12 mt-12 border-t border-edge pt-6">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
          ← Retour
        </Link>
      </div>
    </Screen>
  );
}
