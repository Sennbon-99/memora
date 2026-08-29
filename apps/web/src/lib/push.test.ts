// apps/web/src/lib/push.test.ts

import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './push.js';

describe('urlBase64ToUint8Array', () => {
  it('decode une cle VAPID base64url', () => {
    // base64url remplace + par - et / par _ : sans cette conversion, atob
    // jette et l abonnement echoue sans message comprehensible.
    const octets = urlBase64ToUint8Array('BGY7-k9z_Vy');
    expect(octets).toBeInstanceOf(Uint8Array);
    expect(octets.length).toBeGreaterThan(0);
  });

  it('complete le remplissage manquant', () => {
    // Les cles VAPID sont transmises sans signes egal : sans ce rembourrage,
    // atob refuse une chaine dont la longueur n est pas un multiple de quatre.
    expect(() => urlBase64ToUint8Array('QQ')).not.toThrow();
    expect(() => urlBase64ToUint8Array('QUJD')).not.toThrow();
    expect(() => urlBase64ToUint8Array('QUJDRA')).not.toThrow();
  });

  it('rend les memes octets que le texte d origine', () => {
    expect([...urlBase64ToUint8Array('QUJD')]).toEqual([65, 66, 67]);
  });
});
