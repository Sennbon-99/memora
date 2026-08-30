// apps/web/src/features/onboarding/routes.tsx
// Les deux presentations, branchees sur leur adresse.
//
// Chacune est un ecran a part entiere plutot qu'un panneau superpose : on
// peut y revenir depuis les reglages, et le bouton Precedent du telephone y
// fait ce qu'on attend au lieu de fermer une couche invisible.

import { useNavigate } from 'react-router-dom';
import { Onboarding } from './Onboarding.js';

export function DecouverteInvite() {
  const navigate = useNavigate();
  return <Onboarding role="invite" onDone={() => navigate('/scan', { replace: true })} />;
}

export function DecouverteHote() {
  const navigate = useNavigate();
  return <Onboarding role="hote" onDone={() => navigate('/hote', { replace: true })} />;
}
