// apps/web/src/features/guest/screens/ScanScreen.tsx
// Lecture du QR code depuis l'application.
//
// Le geste normal reste l'appareil photo du telephone : il reconnait les QR
// codes et ouvre l'adresse tout seul. Cet ecran sert le cas ou l'invite a
// deja Memora ouvert — application installee, lancee depuis l'ecran d'accueil
// — et n'a aucune envie de sortir pour y revenir. Sans lui, l'invite arrive
// sur la connexion de l'hote et se voit demander un compte qu'il n'aura
// jamais.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Icon } from '../../../ui/Icon.js';
import { Screen } from '../../../ui/Screen.js';
import { useCamera } from '../useCamera.js';

/** Cote de l'image analysee. Au-dela, jsQR coute plus qu'il ne rapporte. */
const ANALYSE = 480;

/**
 * Le decodeur, charge a la demande.
 *
 * jsQR pese une trentaine de kilo-octets et ne sert qu'ici. L'invite type ne
 * voit jamais cet ecran — son appareil photo ouvre le lien tout seul — et il
 * charge l'application sur le reseau d'une salle de fete. Le decodeur ne doit
 * donc pas voyager dans le paquet principal.
 */
let decodeur: typeof import('jsqr').default | null = null;

async function chargerDecodeur() {
  decodeur ??= (await import('jsqr')).default;
  return decodeur;
}

/**
 * Extrait le chemin d'invite d'un contenu scanne.
 *
 * Seules les adresses de cette origine sont suivies. Un QR code est un
 * contenu que n'importe qui peut imprimer et poser sur une table : le suivre
 * aveuglement ferait de l'application un vecteur d'hameconnage. On retourne
 * un chemin relatif, jamais une adresse absolue, pour que la navigation reste
 * interne quoi qu'il arrive.
 */
export function cheminInvite(contenu: string, origine: string): string | null {
  let adresse: URL;
  try {
    adresse = new URL(contenu, origine);
  } catch {
    return null;
  }
  if (adresse.origin !== origine) return null;
  if (!/^\/e\/[A-Za-z0-9_-]+\/?$/.test(adresse.pathname)) return null;
  return adresse.pathname + adresse.search;
}

export function ScanScreen() {
  const navigate = useNavigate();
  const { videoRef, state, start } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [code, setCode] = useState('');
  const [refuse, setRefuse] = useState(false);

  useEffect(() => { void start(); }, [start]);

  // La camera indisponible n'est pas une impasse : le champ de saisie prend
  // le relais, et le code figure en toutes lettres sous chaque QR imprime.
  useEffect(() => {
    if (state === 'denied' || state === 'unavailable') setSaisie(true);
  }, [state]);

  const rejoindre = useCallback((chemin: string) => {
    navigate(chemin, { replace: true });
  }, [navigate]);

  // Boucle d'analyse. Elle tourne sur requestAnimationFrame plutot que sur un
  // intervalle : le navigateur la suspend quand l'onglet passe en arriere-plan,
  // ce qui evite de decoder dans le vide et de vider la batterie en soiree.
  useEffect(() => {
    if (state !== 'ready') return;
    let vivant = true;
    let image = 0;

    // Le chargement est lance des l'ouverture de la camera : il se termine
    // pendant que l'invite vise, et la premiere analyse le trouve pret.
    void chargerDecodeur();

    const analyser = () => {
      if (!vivant) return;
      requestAnimationFrame(analyser);

      // Une trame sur quatre : le decodage coute une dizaine de millisecondes
      // et l'invite ne bouge pas assez vite pour qu'on rate le code.
      if (image++ % 4 !== 0) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const contexte = canvas.getContext('2d', { willReadFrequently: true });
      if (!contexte) return;

      canvas.width = ANALYSE;
      canvas.height = ANALYSE;
      // On analyse le carre central du flux : c'est la zone que le reticule
      // designe, et la reduire accelere d'autant le decodage.
      const cote = Math.min(video.videoWidth, video.videoHeight);
      contexte.drawImage(
        video,
        (video.videoWidth - cote) / 2, (video.videoHeight - cote) / 2, cote, cote,
        0, 0, ANALYSE, ANALYSE,
      );

      // Tant que le module n'est pas arrive, on laisse passer la trame :
      // rien ne sert de mettre les images en file, la suivante sera meilleure.
      if (!decodeur) return;

      const trouve = decodeur(
        contexte.getImageData(0, 0, ANALYSE, ANALYSE).data, ANALYSE, ANALYSE,
        { inversionAttempts: 'dontInvert' },
      );
      if (!trouve) return;

      const chemin = cheminInvite(trouve.data, window.location.origin);
      if (chemin) {
        vivant = false;
        rejoindre(chemin);
      } else {
        setRefuse(true);
      }
    };

    requestAnimationFrame(analyser);
    return () => { vivant = false; };
  }, [state, videoRef, rejoindre]);

  const valider = () => {
    // L'invite tape le code seul, sans l'adresse qui l'entoure.
    const propre = code.trim().replace(/^.*\/e\//, '').replace(/[^A-Za-z0-9_-]/g, '');
    if (propre) rejoindre(`/e/${propre}`);
  };

  return (
    <Screen
      title="Rejoindre une soirée"
      subtitle={
        saisie
          ? 'Le code figure sous le QR code, sur votre table.'
          : 'Visez le QR code posé sur votre table.'
      }
      code={{ hautGauche: 'MEMORA 400', basGauche: 'INVITÉ', hautDroite: 'SCAN' }}
      footer={
        <div className="flex flex-col gap-3">
          {saisie ? (
            <Button full onClick={valider} disabled={!code.trim()}>
              Rejoindre
            </Button>
          ) : (
            <Button tone="ghost" full onClick={() => setSaisie(true)}>
              Saisir le code à la main
            </Button>
          )}
          <Button tone="ghost" full onClick={() => navigate('/')}>
            Retour
          </Button>
        </div>
      }
    >
      <div className="mt-8 flex flex-1 flex-col">
        {saisie ? (
          <Field
            label="Code de la soirée"
            placeholder="mariage-lea-2026"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        ) : (
          <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-carte bg-well">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* Le reticule : quatre angles plutot qu'un cadre ferme. Un cadre
                complet se confond avec le bord du QR code et l'invite ne sait
                plus lequel viser. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-6">
              {/* Huit pixels, hors du systeme, et volontairement : ce sont des
                  equerres de visee, pas des cartes. A --radius-carte, soit deux
                  pixels, l'angle redevient droit et l'equerre cesse de se lire
                  comme un cadrage. */}
              {(['left-0 top-0 border-l-2 border-t-2 rounded-tl-lg',
                 'right-0 top-0 border-r-2 border-t-2 rounded-tr-lg',
                 'left-0 bottom-0 border-b-2 border-l-2 rounded-bl-lg',
                 'right-0 bottom-0 border-b-2 border-r-2 rounded-br-lg'] as const).map((coin) => (
                <span key={coin} className={`absolute size-9 border-a1 ${coin}`} />
              ))}
            </div>
            {state === 'starting' && (
              <p className="absolute inset-0 grid place-items-center text-sm text-ink-well-2">
                Ouverture de la caméra…
              </p>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {refuse && (
          <p className="mt-6 flex items-start gap-2 text-note leading-relaxed text-warn">
            <Icon nom="alerte" taille={16} className="mt-0.5" />
            Ce QR code ne mène pas à une soirée Memora.
          </p>
        )}
      </div>
    </Screen>
  );
}
