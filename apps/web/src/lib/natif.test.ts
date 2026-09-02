// apps/web/src/lib/natif.test.ts

import { describe, expect, it } from 'vitest';
import { cheminASuivre } from './natif.js';

const ORIGINE = 'https://memora-app.fr';

describe('cheminASuivre', () => {
  it("suit un chemin relatif, tel que l'API en met dans une notification", () => {
    expect(cheminASuivre('/e/mariage-lea-2026', ORIGINE)).toBe('/e/mariage-lea-2026');
    expect(cheminASuivre('/album/jeton', ORIGINE)).toBe('/album/jeton');
  });

  it('suit un lien universel de notre domaine, en gardant la requete', () => {
    expect(cheminASuivre('https://memora-app.fr/e/lea?t=jeton', ORIGINE)).toBe('/e/lea?t=jeton');
  });

  it("refuse une adresse d'un autre domaine", () => {
    expect(cheminASuivre('https://pirate.example/e/lea', ORIGINE)).toBeNull();
    // Le sous-domaine www n'est pas declare comme lien universel : il
    // redirige vers la racine avant meme que l'application soit sollicitee.
    expect(cheminASuivre('https://www.memora-app.fr/e/lea', ORIGINE)).toBeNull();
  });

  it('refuse ce qui ressemble a un chemin sans en etre un', () => {
    // « //pirate.example » est une adresse relative au protocole, pas un
    // chemin : suivie telle quelle, elle quitterait le site.
    expect(cheminASuivre('//pirate.example/e/lea', ORIGINE)).toBeNull();
    expect(cheminASuivre('javascript:alert(1)', ORIGINE)).toBeNull();
    expect(cheminASuivre('http://memora-app.fr/e/lea', ORIGINE)).toBeNull();
    expect(cheminASuivre('pas une adresse', ORIGINE)).toBeNull();
  });
});
