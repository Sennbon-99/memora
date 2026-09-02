// apps/web/src/lib/deploiement.test.ts
// La coherence des quatre fichiers qui doivent dire le meme domaine et le
// meme identifiant d'application pour qu'un lien universel fonctionne.
//
// Un lien universel qui ne marche pas ne dit jamais pourquoi : l'iPhone
// ouvre Safari, sans erreur, sans journal. Les causes classiques sont
// toutes des desaccords entre fichiers que personne ne relit ensemble — un
// domaine dans l'entitlement, un autre dans nginx ; un identifiant de
// paquet ici, un autre la ; un JSON avec une virgule de trop, que nginx
// sert tel quel puisqu'il ne le lit pas. Ce test les relit ensemble.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import capacitor from '../../capacitor.config.js';

const ICI = resolve(import.meta.dirname, '../..');
const nginx = readFileSync(resolve(ICI, 'nginx.conf.template'), 'utf-8');
const dockerfile = readFileSync(resolve(ICI, 'Dockerfile'), 'utf-8');
const entitlements = readFileSync(resolve(ICI, 'ios/App/App/App.entitlements'), 'utf-8');

/** Le domaine par defaut de l'image, celui que nginx sert sans reglage. */
const domaine = dockerfile.match(/^ENV PUBLIC_HOST=(\S+)$/m)?.[1];

/** Le JSON que nginx renvoie, tel qu'envsubst le produirait. */
function aasa(teamId: string): unknown {
  const bloc = nginx.match(/apple-app-site-association \{[\s\S]*?return 200 '([^']+)';/);
  expect(bloc, 'le bloc apple-app-site-association manque dans nginx').not.toBeNull();
  return JSON.parse((bloc as RegExpMatchArray)[1]!.replace('${APPLE_TEAM_ID}', teamId));
}

describe('les liens universels', () => {
  it("l'image a un domaine par defaut, sinon nginx refuserait de demarrer", () => {
    expect(domaine).toBeDefined();
    expect(dockerfile).toMatch(/^ENV APPLE_TEAM_ID=/m);
  });

  it("l'entitlement declare le meme domaine que l'image", () => {
    expect(entitlements).toContain(`<string>applinks:${domaine}</string>`);
  });

  it('nginx sert un JSON valide qui porte le bon identifiant de paquet', () => {
    const document = aasa('ABCDE12345') as {
      applinks: { details: { appIDs: string[]; components: { '/': string }[] }[] };
    };
    const [detail] = document.applinks.details;
    expect(detail?.appIDs).toEqual([`ABCDE12345.${capacitor.appId}`]);

    // Les trois portes de l'invite, et jamais l'espace de l'hote.
    const chemins = detail?.components.map((c) => c['/']);
    expect(chemins).toEqual(['/e/*', '/album/*', '/p/*']);
    expect(chemins?.some((c) => c.startsWith('/hote'))).toBe(false);
  });

  it('nginx renvoie le fichier en JSON, sans passer par la page du client', () => {
    // Sans un bloc « location = », la regle de repli du client repondrait
    // index.html avec un 200, et Apple lirait du HTML la ou il attend du
    // JSON — sans jamais le dire.
    expect(nginx).toMatch(/location = \/\.well-known\/apple-app-site-association \{\s*default_type application\/json;/);
  });

  it('www renvoie vers la racine, et non vers un domaine ecrit en dur', () => {
    expect(nginx).toContain('server_name www.${PUBLIC_HOST};');
    expect(nginx).toContain('return 301 https://${PUBLIC_HOST}$request_uri;');
  });
});
