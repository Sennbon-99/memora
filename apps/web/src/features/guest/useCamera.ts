// apps/web/src/features/guest/useCamera.ts
// Acces a la camera, et capture d'une image.
//
// Le flux est ouvert une seule fois et garde tant que le viseur est affiche :
// le rouvrir a chaque pose provoquerait un temps noir d'une seconde entre
// deux photographies, ce qui est inacceptable pendant une soiree.

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable';

export type PhotoShape = 'SQUARE' | 'FULL';

/**
 * Camera arriere en priorite, definition la plus haute que l'appareil accepte.
 *
 * Deux dimensions egales ne demandent pas une image de 2048 pixels de cote :
 * pour getUserMedia, c'est une demande de rapport 1:1, et le navigateur
 * recadre le capteur pour l'honorer. C'est voulu pour le carre. En plein
 * ecran on demande au contraire le format natif du capteur, le plus large
 * disponible, et le recadrage a la forme de l'ecran est fait a la capture.
 */
function constraints(shape: PhotoShape): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: 'environment' },
      ...(shape === 'SQUARE'
        ? { width: { ideal: 2048 }, height: { ideal: 2048 } }
        : { width: { ideal: 2048 }, height: { ideal: 1536 } }),
    },
    audio: false,
  };
}

export function useCamera(shape: PhotoShape = 'SQUARE') {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }

    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints(shape));
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('ready');
    } catch (error) {
      // NotAllowedError est un refus de l'invite, les autres sont des pannes
      // materielles. Les deux ecrans de secours ne disent pas la meme chose.
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      setState(denied ? 'denied' : 'unavailable');
    }
  }, [shape]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setState('idle');
  }, []);

  // Le flux est libere au demontage : sans cela la diode de la camera
  // resterait allumee apres la fin de la pellicule.
  useEffect(() => stop, [stop]);

  /**
   * Saisit l'image courante du flux.
   * createImageBitmap depuis l'element video est instantane : il lit la trame
   * deja decodee, sans repasser par un encodage intermediaire.
   */
  const capture = useCallback(async (): Promise<ImageBitmap> => {
    const video = videoRef.current;
    if (!video || state !== 'ready') throw new Error('Camera non prete');
    return createImageBitmap(video);
  }, [state]);

  return { videoRef, state, start, stop, capture };
}
