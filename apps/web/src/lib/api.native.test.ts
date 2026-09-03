// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { nativeRequest } = vi.hoisted(() => ({ nativeRequest: vi.fn() }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: { request: nativeRequest },
}));

vi.stubEnv('VITE_API_ORIGIN', 'https://memora-app.fr/');

const { publicAppOrigin, uploadPhoto } = await import('./api.js');

describe('transport natif', () => {
  beforeEach(() => nativeRequest.mockReset());

  it("encode le fichier pour Capacitor sans réencoder l'URL signée", async () => {
    nativeRequest.mockResolvedValue({ status: 200, data: '', headers: {}, url: '' });
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const signed = 'https://stockage.example/photo?X-Amz-Signature=a%2Fb%2Bc';

    await uploadPhoto(signed, photo);

    expect(nativeRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: signed,
      method: 'PUT',
      data: 'AQID',
      dataType: 'file',
      shouldEncodeUrlParams: false,
      headers: { 'Content-Type': 'image/jpeg' },
    }));
  });

  it("utilise le domaine public pour les liens, pas l'origine locale de Capacitor", () => {
    expect(publicAppOrigin()).toBe('https://memora-app.fr');
  });
});
