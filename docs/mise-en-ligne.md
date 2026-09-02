# Mise en ligne : memora-app.fr et l'App Store

La notice complète, dans l'ordre où les choses doivent se faire. Chaque
étape dit ce qu'on touche, où, et comment vérifier qu'elle a pris.

## 0. Ce qui tourne aujourd'hui

Un serveur (`46.225.10.187`) sous **Coolify**, Traefik devant pour les
certificats. Trois conteneurs de l'application — `web` (nginx, qui sert le
client et relaie `/api/` vers l'API), `api`, `worker` — et trois services :
PostgreSQL, Redis, MinIO. Le tout répond sur l'adresse provisoire
`memora.46.225.10.187.sslip.io`, un domaine de commodité fourni par un tiers.

Ce qui porte le domaine, et donc ce qui change :

| Où | Quoi | Valeur |
|---|---|---|
| Coolify · `web` · Domaines | l'adresse publique | `https://memora-app.fr,https://www.memora-app.fr` |
| Coolify · `web` · Variables | `PUBLIC_HOST` | `memora-app.fr` |
| Coolify · `web` · Variables | `APPLE_TEAM_ID` | l'identifiant d'équipe Apple (10 caractères) |
| Coolify · `api` et `worker` · Variables | `CLIENT_URL` | `https://memora-app.fr` |
| Coolify · `api` et `worker` · Variables | `S3_ENDPOINT` | `https://photos.memora-app.fr` |
| Coolify · MinIO · Domaine | le stockage des photographies | `https://photos.memora-app.fr` (port 9000) |
| Stripe · Webhooks | le point d'entrée | `https://memora-app.fr/api/stripe/webhook` |
| `apps/web/.env.native` | l'origine de l'application installée | `VITE_API_ORIGIN=https://memora-app.fr` |
| `App.entitlements` | les liens universels | `applinks:memora-app.fr` (déjà fait) |

`CLIENT_URL` sert à trois choses : l'origine autorisée pour l'API (CORS et
Socket.io), le sujet VAPID des notifications web, et **l'adresse encodée
dans les QR codes du kit imprimable**. Un kit téléchargé avant la bascule
porte l'adresse provisoire : **retélécharger le kit après**.

## 1. Le DNS, chez Hostinger

hPanel → Domaines → memora-app.fr → DNS / Serveurs de noms → *Gérer les
enregistrements DNS*.

| Type | Nom | Valeur | TTL |
|---|---|---|---|
| A | `@` | `46.225.10.187` | 300 |
| A | `www` | `46.225.10.187` | 300 |
| A | `photos` | `46.225.10.187` | 300 |

Supprimer les enregistrements de parking posés par défaut : le `A @` vers
l'adresse de parking d'Hostinger et le `CNAME www`. Garder les `MX` si une
boîte mail Hostinger est utilisée. Aucun enregistrement n'est nécessaire
pour le certificat : Traefik le demande par HTTP, pas par DNS.

Vérifier, depuis n'importe quelle machine :

```
dig +short memora-app.fr        # → 46.225.10.187
dig +short www.memora-app.fr    # → 46.225.10.187
dig +short photos.memora-app.fr # → 46.225.10.187
```

Le TTL de 300 s rend une erreur corrigeable en cinq minutes. On pourra le
remonter à 3600 une fois que tout tient.

## 2. Coolify

Dans l'ordre : MinIO d'abord (l'API en dépend), puis l'API et le worker,
puis le client. Chaque changement de variable demande un redéploiement du
conteneur concerné — Coolify le propose.

**Le script fait 2b, 2c et les redéploiements à votre place**, par l'API
de Coolify, depuis son terminal intégré (Servers → localhost → Terminal) :

```
curl -fsSL https://raw.githubusercontent.com/Sennbon-99/memora/main/scripts/bascule-domaine.py -o bascule.py
COOLIFY_TOKEN=… APPLE_TEAM_ID=… python3 bascule.py            # montre le plan, ne touche à rien
COOLIFY_TOKEN=… APPLE_TEAM_ID=… python3 bascule.py --apply    # applique, redéploie, vérifie
```

Le jeton vient de Coolify → Keys & Tokens → API tokens (droits d'écriture),
et l'API doit être activée (Settings → API). Le script reconnaît les trois
applications à ce qu'elles portent, jamais à leur nom, et s'arrête sans rien
écrire s'il en manque une. Il ne touche pas à MinIO : une fois 2a fait à la
main, relancer avec `--photos` pour faire suivre `S3_ENDPOINT`.

`--photos` ne se croit pas sur parole : le script interroge d'abord
`https://photos.memora-app.fr` et refuse d'écrire si l'hôte ne répond pas,
si son certificat n'est pas valide, ou s'il rend du HTML — ce dernier cas
étant le domaine posé sur le port 9001 (la console) au lieu du 9000 (l'API
S3). C'est la panne la plus coûteuse de la bascule, parce qu'elle est
silencieuse côté serveur : l'API continue de signer des adresses
parfaitement valides, et pas une ne sert de photographie.

### 2a. MinIO → `photos.memora-app.fr`

Service MinIO → Domaines : `https://photos.memora-app.fr` sur le port
**9000** (l'API S3, pas la console 9001). Ajouter la variable
`MINIO_SERVER_URL=https://photos.memora-app.fr`. Redéployer.

Les adresses signées déjà émises portent l'ancien nom d'hôte : elles
expirent en quinze minutes, il n'y a rien à migrer. Le seau et son contenu
ne bougent pas.

Pourquoi bouger MinIO alors qu'il marche : parce qu'une adresse `sslip.io`
est une dépendance à un tiers. Si ce service tombe, plus aucune
photographie ne se charge — la veille d'un mariage, sans que rien dans
notre infrastructure ne soit en cause.

### 2b. L'API et le worker

Variables des deux applications :

```
CLIENT_URL=https://memora-app.fr
S3_ENDPOINT=https://photos.memora-app.fr
```

`VAPID_SUBJECT` peut rester vide : l'adresse du site sert alors de contact
(c'est ce que fait `sujetVapid()` dans `push.service.ts`). L'ancien défaut
pointait sur `memora.app`, un domaine qui n'est pas le nôtre.

Les variables APNs viennent à l'étape 4b.

### 2c. Le client

Application `web` → Domaines : `https://memora-app.fr,https://www.memora-app.fr`.
Variables :

```
PUBLIC_HOST=memora-app.fr
APPLE_TEAM_ID=XXXXXXXXXX
```

Ce sont des variables **d'exécution**, pas de construction : nginx les
lit au démarrage du conteneur (`envsubst`), l'image ne change pas. Ne pas
cocher « Build variable ».

Redéployer. Traefik obtient le certificat dans la minute qui suit, à
condition que le DNS réponde déjà — d'où l'ordre des étapes.

### 2d. Vérifier

```
curl -I https://memora-app.fr/
#   HTTP/2 200, et un en-tête strict-transport-security

curl -I https://www.memora-app.fr/
#   HTTP/2 301, location: https://memora-app.fr/

curl https://memora-app.fr/.well-known/apple-app-site-association
#   {"applinks":{"details":[{"appIDs":["XXXXXXXXXX.app.memora.client"], ...
#   avec le vrai identifiant, et content-type: application/json
```

Puis ce qu'Apple voit — son réseau de diffusion relit le fichier de son
côté, et c'est cette copie que l'iPhone consulte :

```
curl https://app-site-association.cdn-apple.com/a/v1/memora-app.fr
```

Enfin, ouvrir `https://memora-app.fr`, créer une soirée, **retélécharger le
kit**, scanner une pièce avec un téléphone : l'adresse doit être
`https://memora-app.fr/e/…`.

## 3. Stripe

Tableau de bord → Développeurs → Webhooks → *Ajouter un point de
terminaison* : `https://memora-app.fr/api/stripe/webhook`, événement
`checkout.session.completed` (le seul que l'API traite). Copier le secret
de signature (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET` de l'API, redéployer.

L'ancien point de terminaison sur l'adresse provisoire peut être supprimé
une fois le nouveau vérifié — Stripe permet d'envoyer un événement d'essai.

## 4. Apple

### 4a. L'identifiant de l'application

developer.apple.com → Certificates, Identifiers & Profiles → Identifiers →
**+** → App IDs → App :

- Description : `Memora`
- Bundle ID, *explicit* : `app.memora.client`
- Capabilities : **Push Notifications** et **Associated Domains**

Xcode sait le faire tout seul en signature automatique, mais le faire ici
évite de le découvrir au moment de l'archive. L'identifiant d'équipe
(*Team ID*, dix caractères) est dans *Membership details* : c'est lui qui va
dans `APPLE_TEAM_ID` et `APNS_TEAM_ID`.

### 4b. La clé APNs

Keys → **+** → nom `Memora APNs`, cocher *Apple Push Notifications service* →
Continue → Register → **télécharger le `.p8` maintenant : Apple ne le
redonne jamais.** Noter le *Key ID*.

Variables de l'API (et du worker, qui envoie aussi) :

```
APNS_KEY_ID=ABC123DEFG
APNS_TEAM_ID=XXXXXXXXXX
APNS_TOPIC=app.memora.client
APNS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT…\n-----END PRIVATE KEY-----
APNS_SANDBOX=false
```

`APNS_PRIVATE_KEY` : le contenu du `.p8` sur une seule ligne, les retours
à la ligne remplacés par `\n` — le code les rétablit.

`APNS_SANDBOX` : `false` pour TestFlight et l'App Store, qui utilisent le
serveur de production d'Apple. `true` seulement pour une application
lancée depuis Xcode sur un téléphone branché — un jeton du bac à sable
envoyé en production répond `BadDeviceToken`, et inversement.

### 4c. App Store Connect

appstoreconnect.apple.com → Mes apps → **+** → Nouvelle app :

- Plateforme iOS, nom `Memora`, langue principale Français
- Bundle ID : `app.memora.client` (créé en 4a)
- SKU : `memora-ios`

Avant de pouvoir soumettre, App Store Connect exige :

- **une adresse de politique de confidentialité**. L'application n'en a
  pas encore. Le texte existe en partie sur l'écran de consentement
  (conservation trente jours, suppression automatique, publication décidée
  par l'hôte) : une page `/confidentialite` qui le reprend suffit pour une
  première soumission.
- les **captures d'écran** iPhone 6,7" (et 6,5"). Le projet ne vise que
  l'iPhone (`TARGETED_DEVICE_FAMILY = 1`) : pas de captures iPad à fournir,
  pas de relecture sur iPad.
- la fiche *Confidentialité de l'app* : photographies (contenu utilisateur,
  liées à la soirée), prénom (facultatif), identifiant d'appareil (pour la
  pellicule). Rien n'est utilisé pour le suivi publicitaire.

### 4d. L'archive, sur le Mac

```
cd apps/web
cp .env.native.example .env.native    # VITE_API_ORIGIN=https://memora-app.fr
pnpm ios:sync                          # construit le client en mode natif, synchronise iOS
pnpm ios:open                          # ouvre Xcode
```

Dans Xcode, cible *App* → *Signing & Capabilities* : Team = ton équipe,
signature automatique. Les deux capacités *Push Notifications* et
*Associated Domains* (`applinks:memora-app.fr`) doivent apparaître — elles
viennent de `App.entitlements`.

Destination : *Any iOS Device (arm64)*. Product → **Archive**. À la fin,
l'Organizer s'ouvre : *Distribute App* → *App Store Connect* → *Upload*.
Laisser les options par défaut (gestion automatique de la signature,
symboles inclus).

L'archive met `aps-environment` à `production` d'elle-même : le
`development` de `App.entitlements` est celui des lancements depuis Xcode.

### 4e. TestFlight, puis la relecture

Dix minutes après l'envoi, la version apparaît dans App Store Connect →
TestFlight. Ajouter son propre compte comme testeur interne, installer,
et vérifier sur le téléphone :

1. scanner un QR code du kit avec l'appareil photo → **l'application
   s'ouvre** sur la soirée, pas Safari ;
2. accepter les notifications, faire déclencher un moment fort par l'hôte
   → la notification arrive, la toucher ouvre la soirée ;
3. couper le réseau, prendre deux poses, le remettre → elles partent.

Pour la relecture Apple, dans *Notes pour l'équipe de vérification* :

- l'adresse d'une soirée de démonstration ouverte (`https://memora-app.fr/e/…`)
  et un compte hôte de démonstration, sinon le relecteur ne voit qu'un
  écran d'entrée ;
- une phrase qui explique qu'**il n'y a pas d'aperçu après la pose, et que
  c'est voulu** — sans elle, un relecteur croit l'appareil photo cassé ;
- ce que l'application fait de natif : appareil photo, notifications,
  file d'attente hors ligne, aucun compte demandé. La règle 4.2 d'Apple
  refuse les applications qui ne sont qu'un site dans une fenêtre ; il
  faut que ce ne soit pas ce qu'il voit.

## 5. Ce qui reste hors de portée d'un écran

Imprimer le kit et scanner sur trois téléphones, dont un Android d'entrée
de gamme, sous l'éclairage d'une salle des fêtes. L'écran de lancement
natif (`Splash.imageset`) porte encore les couleurs de l'ancienne charte :
à refaire aux couleurs du carnet de la marque, ce qui demande des images.
