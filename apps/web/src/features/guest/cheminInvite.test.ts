// apps/web/src/features/guest/cheminInvite.test.ts
// Un QR code est un contenu que n'importe qui peut imprimer et poser sur une
// table. Le filtre qui decide si l'application le suit est donc la seule
// partie du scan qui merite des tests : le reste n'est que du decodage.

import { describe, expect, it } from 'vitest';
import { cheminInvite } from './screens/ScanScreen.js';

const ORIGINE = 'https://memora.example';

describe('cheminInvite', () => {
  it('accepte une adresse de pellicule de cette origine', () => {
    expect(cheminInvite(`${ORIGINE}/e/mariage-lea-2026`, ORIGINE))
      .toBe('/e/mariage-lea-2026');
  });

  it('conserve le jeton de table', () => {
    // Sans lui, l'invite rejoint la soiree mais perd sa table, et l'hote ne
    // sait plus d'ou vient la photographie.
    expect(cheminInvite(`${ORIGINE}/e/soiree?t=table-4`, ORIGINE))
      .toBe('/e/soiree?t=table-4');
  });

  it('refuse une autre origine', () => {
    // Le cas qui justifie la fonction : un QR code imprime par un tiers,
    // pose sur une table, qui menerait l'invite sur un faux Memora.
    expect(cheminInvite('https://memora.exemple.attaque/e/soiree', ORIGINE)).toBeNull();
  });

  it('refuse un chemin qui n’est pas une pellicule', () => {
    expect(cheminInvite(`${ORIGINE}/hote/connexion`, ORIGINE)).toBeNull();
    expect(cheminInvite(`${ORIGINE}/e/`, ORIGINE)).toBeNull();
  });

  it('refuse ce qui n’est pas une adresse', () => {
    expect(cheminInvite('bonjour', ORIGINE)).toBeNull();
    expect(cheminInvite('', ORIGINE)).toBeNull();
  });

  it('refuse les protocoles qui ne servent pas a naviguer', () => {
    // javascript: et data: ne portent pas d'origine comparable, mais on
    // verifie explicitement : c'est le genre de trou qu'on ne decouvre pas
    // deux fois.
    expect(cheminInvite('javascript:alert(1)', ORIGINE)).toBeNull();
    expect(cheminInvite('data:text/html,<script>', ORIGINE)).toBeNull();
  });
});
