// apps/web/capacitor.config.ts
// Configuration de l'application native.
//
// Capacitor emballe exactement le meme client que la version web : il n'y a
// pas deux bases de code a maintenir, seulement deux emballages. C'est ce
// qui rend la promesse du dossier tenable pour une personne seule.
//
// L'application native existe pour une raison precise et une seule : sur
// iPhone, une application web ne recoit aucune notification tant qu'elle
// n'a pas ete ajoutee a l'ecran d'accueil, et beaucoup d'invites ne le
// feront jamais. L'application installee, elle, les recoit.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.memora-app.client',
  appName: 'Memora',
  webDir: 'dist',

  // Le client parle a l'API par des adresses relatives. En natif il n'y a
  // pas d'origine commune : on la donne ici, et le meme code fonctionne
  // sans condition sur la plateforme.
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },

  plugins: {
    // Les requetes partent du natif et non de la WKWebView. C'est la seule
    // facon de conserver les cookies d'authentification : la page est servie
    // depuis capacitor://localhost, l'API vit sur un autre domaine, et un
    // cookie SameSite=Strict n'est jamais envoye entre deux sites. Le client
    // HTTP natif possede son propre magasin de cookies, indexe par domaine,
    // auquel cette regle de navigateur ne s'applique pas.
    CapacitorHttp: { enabled: true },
  },

  ios: {
    // La barre d'etat se superpose au contenu : les ecrans utilisent deja
    // les zones sures, et le viseur doit occuper toute la hauteur.
    contentInset: 'never',
    // Le fond visible avant que la page ne soit chargee : celui du carnet
    // de la marque (--color-pap de papier.css). Avec l'ancien brun sombre,
    // chaque ouverture a froid passait du noir au papier en un eclair.
    backgroundColor: '#f5f2ea',
  },
};

export default config;
