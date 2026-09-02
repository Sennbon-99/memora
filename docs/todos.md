# À attaquer ensuite

Trois défauts trouvés en préparant la mise en ligne, laissés de côté pour ne
pas élargir les chantiers en cours. Rangés par ce qu'ils coûtent le soir
d'une vraie soirée.

---

## 1. Le Web Push est muet

**Où** : `apps/web/vite.config.ts`, stratégie `generateSW` sans `importScripts`.

Le service worker produit n'a **aucun gestionnaire `push`**. L'API envoie
bien la notification (`push.service.ts`, charge utile `{title, body, url}`),
le client s'abonne bien (`lib/push.ts`, `userVisibleOnly: true`) — mais à la
réception, rien n'appelle `showNotification`. Chrome affiche alors son
message générique « Ce site a été mis à jour en arrière-plan », et Firefox
peut révoquer l'abonnement après plusieurs envois silencieux.

C'est le canal par défaut partout sauf l'application iPhone installée. Donc
aujourd'hui, un moment fort déclenché par l'hôte **ne prévient que les
invités qui ont déjà l'écran sous les yeux** — ceux-là le reçoivent par
socket.io (`moment:started`), qui fonctionne. Les autres, c'est-à-dire la
plupart : rien. Sur iPhone le canal APNs prendrait le relais, mais ses clés
ne sont pas encore configurées non plus.

À faire : un script complémentaire chargé par `workbox.importScripts` (ou
passer en `injectManifest`), qui sur `push` lit `event.data.json()` et
affiche la notification, et sur `notificationclick` ouvre ou focalise une
fenêtre sur `data.url`. Plus un test qui relit `dist/sw.js` après build et
vérifie que les deux gestionnaires y sont — sinon une modification de la
configuration les fera disparaître en silence.

## 2. La notification « moment fort » mène nulle part

**Où** : `apps/api/src/features/moments/moment.controller.ts`, l'appel à
`notifyEvent` avec `url: /e/${routeParam(req, 'id')}`.

Ce paramètre est l'**identifiant** de l'événement (route hôte
`/events/:id/moments`). Or le parcours invité est `/e/:slug`, et l'API
invité résout par slug (`guest.service.ts` : `findUnique({ where: { slug } })`).

Un invité qui touche la notification arrive donc sur une adresse que
personne ne sait résoudre, et lit « Événement introuvable » — précisément
au moment où l'hôte vient de lui offrir trois poses.

À faire : charger le slug et le mettre dans l'URL. Vérifier au passage les
deux appels de `publication.controller.ts` (`/hote/album`, `/album/<jeton>`),
a priori sains. Un test qui vérifie que l'URL transmise porte le slug, vu
tomber sur le code actuel avant d'être adopté.

Note : ce défaut est invisible tant que le point 1 n'est pas corrigé —
personne ne reçoit la notification pour cliquer dessus. Les deux se
réparent ensemble ou pas du tout.

## 3. La page de confidentialité

**Où** : elle n'existe pas. Aucune route `/confidentialite` dans
`router.tsx`.

App Store Connect **refuse la soumission** sans une URL de politique de
confidentialité. C'est donc un bloquant dur pour l'App Store, pas un confort.

La matière existe déjà, dispersée : l'écran de consentement dit la
conservation trente jours, la suppression automatique, et que la publication
est décidée par l'hôte. Il reste à dire qui est responsable du traitement,
sur quelle base légale, et comment exercer ses droits.

À faire une fois le domaine branché, pour que l'adresse soit la bonne du
premier coup.

---

## Ce qui n'est pas ici, et pourquoi

**L'écran de lancement natif** (`Splash.imageset`) porte encore les couleurs
de l'ancienne charte. C'est un travail d'images, pas de code.

**Le blanc au bas des affiches** (25 % de la feuille) : mesuré, délibérément
laissé. Un pied de page en petit corps au bord bas est une composition
d'affiche défendable. Si le bloc doit descendre, c'est une décision, pas une
correction.

**Imprimer le kit et le scanner sur trois téléphones**, dont un Android
d'entrée de gamme, sous l'éclairage d'une salle des fêtes. Aucun écran ne
peut valider ça, et tant que ce n'est pas fait, le kit n'est pas livré.
