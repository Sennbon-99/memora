import { useNavigate } from 'react-router-dom';
import { Button } from '../../../ui/Button.js';
import { Icon } from '../../../ui/Icon.js';
import { Screen } from '../../../ui/Screen.js';
import { presentationVue } from '../../onboarding/Onboarding.js';

export function EntryScreen() {
  const navigate = useNavigate();
  const rejoindre = () => navigate(presentationVue('invite') ? '/scan' : '/decouvrir');

  return (
    <Screen title="Memora" hideTitle footer={
      <div className="flex flex-col gap-3">
        <Button full onClick={rejoindre}><Icon nom="qr" />Scanner le QR code</Button>
        <p className="text-center text-petit text-ink-3">Sans compte · Rejoignez votre soirée</p>
        <Button tone="ghost" full onClick={() => navigate('/hote')}>J’organise une soirée</Button>
      </div>
    }>
      <div className="flex flex-1 flex-col gap-7 pb-3">
        <p className="text-sous-titre font-bold tracking-tight">memora<span className="text-a1">.</span></p>
        <div className="studio-welcome-art" aria-hidden="true">
          <span className="studio-print"><span><Icon nom="etoile" taille={38} /></span></span>
          <span className="studio-print"><span><Icon nom="photographe" taille={38} /></span></span>
        </div>
        <div>
          <p className="mb-3 text-mini font-semibold tracking-wider text-a1">LES PETITS MOMENTS, ENSEMBLE</p>
          <h2 className="decoupe text-affiche">La soirée passe.<br />Les souvenirs restent.</h2>
          <p className="mt-4 max-w-sm text-lecture leading-relaxed text-ink-2">
            Capturez votre regard sur la soirée. Retrouvez les photos une fois l’album publié.
          </p>
        </div>
      </div>
    </Screen>
  );
}
