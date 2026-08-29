// apps/web/src/features/host/screens/DashboardScreen.test.ts
// La phrase d'etat est la seule logique de cet ecran, et elle a produit une
// contradiction visible a l'ecran : « En cours · pellicule fermee ».

import { describe, expect, it } from 'vitest';
import { stateSentence } from './DashboardScreen.js';

describe('stateSentence', () => {
  it('annonce le temps restant en heures et minutes', () => {
    expect(stateSentence('OPEN', 154)).toBe('En cours · ferme dans 2 h 34');
  });

  it('omet les minutes quand il n y en a pas', () => {
    expect(stateSentence('OPEN', 120)).toBe('En cours · ferme dans 2 h');
  });

  it('passe aux minutes seules sous une heure', () => {
    expect(stateSentence('OPEN', 42)).toBe('En cours · ferme dans 42 min');
  });

  it('nomme la fermeture en retard sans se contredire', () => {
    // Un evenement encore OPEN dont l'heure est passee : la tache planifiee
    // ne l'a pas encore traite. Dire « pellicule fermee » serait faux.
    const phrase = stateSentence('OPEN', 0);
    expect(phrase).toBe('En cours · heure de fermeture dépassée');
    expect(phrase).not.toContain('pellicule fermée');
  });

  it('distingue le brouillon de la soiree close', () => {
    expect(stateSentence('DRAFT', 0)).toBe('Brouillon · pellicule pas encore ouverte');
    expect(stateSentence('CLOSED', 0)).toBe('Pellicule fermée');
    expect(stateSentence('PUBLISHED', 0)).toBe('Pellicule fermée');
  });
});
