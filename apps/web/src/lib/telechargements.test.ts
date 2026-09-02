// apps/web/src/lib/telechargements.test.ts
// Les fichiers que l'hote telecharge : le kit imprimable et l'archive de
// l'album.
//
// Les deux etaient casses, et de la meme facon : l'ecran ouvrait l'adresse de
// l'API dans un onglet. Une navigation du navigateur ne porte aucun en-tete,
// or les deux routes sont derriere requireAuth, qui n'accepte qu'un
// « Authorization: Bearer ». Le serveur repondait donc UNAUTHORIZED « Jeton
// manquant » a chaque fois — et le kit est le seul objet physique du produit :
// sans lui, aucun invite ne peut entrer dans la soiree.
//
// Rien ne l'attrapait, parce qu'un appel qui part dans un onglet ne traverse
// aucun code testable. D'ou les deux verrous ci-dessous : un sur le
// comportement, un sur la forme des sources.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventApi, setAccessToken } from './api.js';

const SRC = resolve(import.meta.dirname, '..');

/** Tous les fichiers de source du client, chemin relatif a src/. */
function sources(dossier = SRC, prefixe = ''): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.isDirectory()) return sources(resolve(dossier, entree.name), chemin);
    return /\.tsx?$/.test(entree.name) && !entree.name.includes('.test.') ? [chemin] : [];
  });
}

/** Une reponse binaire credible, avec le nom de fichier que pose l'API. */
function reponseFichier(nom: string) {
  return new Response(new Blob(['%PDF-1.7']), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nom}"`,
    },
  });
}

describe('les telechargements portent l’authentification de l’hote', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it('le kit part avec le jeton dans l’en-tete', async () => {
    setAccessToken('jeton-de-test');
    const appel = vi.fn(async () => reponseFichier('memora-kit.pdf'));
    vi.stubGlobal('fetch', appel);

    const { nom } = await eventApi.qrKit('evt1', ['affiche-a3']);

    expect(appel).toHaveBeenCalledOnce();
    const [adresse, init] = appel.mock.calls[0] as unknown as [string, RequestInit];
    expect(adresse).toContain('/events/evt1/qr-kit');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jeton-de-test' });
    // Le nom vient du serveur : lui seul sait si la selection tient dans un
    // PDF ou demande une archive.
    expect(nom).toBe('memora-kit.pdf');
  });

  it('l’archive vise /archive, jamais /download', async () => {
    setAccessToken('jeton-de-test');
    const appel = vi.fn(async () => reponseFichier('album.zip'));
    vi.stubGlobal('fetch', appel);

    await eventApi.archive('evt1');

    const [adresse] = appel.mock.calls[0] as unknown as [string];
    // `/download` est le prefixe de montage du routeur cote API, pas une
    // route : l'ecran des reglages l'appelait tel quel et recevait un 404.
    expect(adresse).toContain('/events/evt1/archive');
    expect(adresse).not.toContain('/download');
  });

  it('un refus du serveur remonte comme une erreur, pas comme un fichier vide', async () => {
    setAccessToken('jeton-de-test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 'UNAUTHORIZED', message: 'Jeton manquant' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )));

    // Le renouvellement echoue lui aussi : on doit voir le refus, et non
    // recevoir une archive de zero octet que l'hote croirait valide.
    await expect(eventApi.qrKit('evt1', ['affiche-a3'])).rejects.toThrow('Jeton manquant');
  });
});

describe('aucun ecran n’ouvre une adresse de l’API dans un onglet', () => {
  it('window.open ne sert jamais a joindre /api', () => {
    const fautifs = sources()
      .map((f) => [f, readFileSync(resolve(SRC, f), 'utf-8')] as const)
      .filter(([, contenu]) => /window\.open\([^)]*\/api\//.test(contenu)
        || /window\.open\([^)]*Url\(/.test(contenu))
      .map(([f]) => f);

    // Un tel appel ne traverse aucun code testable : il quitte l'application
    // pour le navigateur, qui n'a ni le jeton ni le moyen de le poser. Le
    // telechargement doit passer par telecharger() dans lib/api.ts.
    expect(fautifs, 'ces fichiers ouvrent une adresse d’API dans un onglet').toEqual([]);
  });
});
