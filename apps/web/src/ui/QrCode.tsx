// apps/web/src/ui/QrCode.tsx
// Un vrai QR code, rendu a l'ecran.
//
// Il existe parce qu'un faux en tenait la place : un damier de degrades
// coniques, pose a cote de la phrase « Scannez le QR code ». Il ressemblait a
// un code et n'en etait pas un — personne ne pouvait le lire, et personne ne
// comprenait pourquoi.
//
// Le meme paquet que le serveur, volontairement : l'ecran et le papier
// encodent alors exactement la meme chose, et il n'y a pas deux encodeurs a
// garder d'accord.

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/**
 * Le code reste noir sur blanc quel que soit l'habillage de l'ecran.
 *
 * Ce n'est pas un oubli de theme : un code colore sur un fond colore perd le
 * contraste dont un appareil photo a besoin, et l'inversion clair sur sombre
 * est refusee par une partie des lecteurs. Ce qui porte l'identite, c'est le
 * cadre autour et l'obturateur au centre — jamais le code lui-meme.
 */
const ENCRE = '#1A1A18';
const PAPIER = '#FFFFFF';

interface QrCodeProps {
  /** Ce que le code encode. Une adresse, jamais un texte libre. */
  value: string;
  /** Cote du code en pixels CSS. */
  size?: number;
  /** Texte lu par un lecteur d'ecran a la place de l'image. */
  label: string;
}

/**
 * L'obturateur, au centre du code.
 *
 * Il ne couvre qu'environ cinq pour cent de la surface, tres en deca des
 * trente pour cent que le niveau de correction H tolere — mesure en decodant
 * le resultat, pas estime. C'est lui qui rend le code reconnaissable avant
 * d'etre lu.
 */
function drawObturateur(ctx: CanvasRenderingContext2D, cote: number): void {
  const centre = cote / 2;
  const r = cote * 0.105;
  const disques: [number, string][] = [
    [r * 1.24, PAPIER], [r, ENCRE], [r * 0.54, PAPIER], [r * 0.24, ENCRE],
  ];
  for (const [rayon, couleur] of disques) {
    ctx.beginPath();
    ctx.arc(centre, centre, rayon, 0, Math.PI * 2);
    ctx.fillStyle = couleur;
    ctx.fill();
  }
}

export function QrCode({ value, size = 200, label }: QrCodeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cible = canvas.current;
    if (!cible) return;

    // Le rendu est asynchrone : un composant demonte entre-temps ne doit pas
    // dessiner sur un canvas detache.
    let annule = false;

    // Niveau H comme sur le papier : c'est ce qui autorise l'obturateur.
    // Marge de quatre modules, le minimum de la specification — un code colle
    // au bord de son cadre devient illisible pour une partie des telephones.
    void QRCode.toCanvas(cible, value, {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: size * Math.min(window.devicePixelRatio || 1, 3),
      color: { dark: ENCRE, light: PAPIER },
    }).then(() => {
      if (annule) return;
      const ctx = cible.getContext('2d');
      if (ctx) drawObturateur(ctx, cible.width);
    }).catch(() => {
      // Un echec d'encodage ne doit pas casser l'ecran : le code reste vide,
      // et le texte a cote continue de dire quoi faire.
    });

    return () => { annule = true; };
  }, [value, size]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="rounded-sm bg-white"
    />
  );
}
