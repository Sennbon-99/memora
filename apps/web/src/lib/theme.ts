// apps/web/src/lib/theme.ts
// Application de la couleur choisie par l'hote.
//
// C'est le principe cameleon du dossier, rendu litteral : la marque est
// neutre, la couleur appartient a l'evenement. Un seul point d'injection,
// et toute l'interface suit.

/** Convertit #RRGGBB en composantes, pour deriver les variantes. */
function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Luminance relative, selon la formule des criteres d'accessibilite WCAG.
 * Elle sert a decider si le texte pose sur cette couleur doit etre clair
 * ou sombre : une couleur d'evenement jaune vif et une couleur bleu nuit
 * n'appellent pas le meme contraste.
 */
export function relativeLuminance(hex: string): number {
  const channels = parseHex(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Couleur de texte lisible sur un fond donne. */
export function readableTextOn(hex: string): '#FFFFFF' | '#131313' {
  return relativeLuminance(hex) > 0.45 ? '#131313' : '#FFFFFF';
}

/** Variante translucide, pour les fonds discrets. */
function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/**
 * Pose la couleur de l'evenement sur l'element racine.
 * Tailwind consomme ensuite ces variables comme n'importe quel jeton.
 */
export function applyEventTheme(color: string): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-text', readableTextOn(color));
  root.style.setProperty('--accent-soft', withAlpha(color, 0.12));
  root.style.setProperty('--accent-border', withAlpha(color, 0.35));

  // La barre du navigateur suit aussi : sur telephone, elle occupe une bande
  // visible en haut de l'ecran.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
