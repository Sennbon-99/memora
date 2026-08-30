// apps/web/src/ui/Photo.tsx
// Une photographie qui se revele.
//
// Elle n'apparait pas, elle monte : sombre et molle d'abord, puis la densite
// et le contraste viennent. C'est le bain de revelateur, et c'est le seul
// endroit de l'application ou l'attente du reseau raconte quelque chose au
// lieu de la subir — une planche contact de quatre-vingts vignettes met
// plusieurs secondes a se remplir, et pendant ces secondes l'invite regarde
// des rectangles gris.
//
// La revelation ne remplace pas le chargement paresseux : les deux se
// completent. Le navigateur decide quand telecharger, ce composant decide de
// quoi ca a l'air quand ca arrive.

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

type PhotoProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Texte alternatif : impose, une photographie sans description n'existe pas. */
  alt: string;
};

export function Photo({ alt, className = '', onLoad, ...props }: PhotoProps) {
  const [revelee, setRevelee] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  // Une image deja en cache est complete avant que React n'attache onLoad :
  // sans ce rattrapage, elle resterait sombre pour toujours. Le cas se
  // produit systematiquement au retour sur la planche contact.
  useEffect(() => {
    if (ref.current?.complete) setRevelee(true);
  }, []);

  return (
    <img
      ref={ref}
      alt={alt}
      onLoad={(evenement) => {
        setRevelee(true);
        onLoad?.(evenement);
      }}
      className={`transition-[filter,opacity] duration-700 ease-out
        motion-reduce:transition-none
        ${revelee ? 'opacity-100 blur-0 brightness-100 contrast-100'
                  : 'opacity-0 blur-[6px] brightness-50 contrast-75'}
        ${className}`}
      {...props}
    />
  );
}
