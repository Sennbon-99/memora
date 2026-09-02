#!/usr/bin/env python3
# scripts/bascule-domaine.py
# Fait passer Memora de son adresse provisoire a memora-app.fr, par l'API de
# Coolify. A lancer sur le serveur lui-meme — le terminal integre de Coolify
# suffit — ou depuis n'importe ou avec COOLIFY_URL.
#
#   COOLIFY_TOKEN=... python3 bascule-domaine.py            # montre le plan, ne touche a rien
#   COOLIFY_TOKEN=... python3 bascule-domaine.py --apply    # applique, puis verifie
#
# Variables :
#   COOLIFY_TOKEN   obligatoire — Coolify → Keys & Tokens → API tokens (droits d'ecriture)
#   COOLIFY_URL     par defaut http://localhost:8000
#   APPLE_TEAM_ID   facultatif — l'identifiant d'equipe Apple, pour les liens universels
#   --photos        passe aussi S3_ENDPOINT sur https://photos.memora-app.fr. A ne
#                   donner qu'une fois le domaine de MinIO deplace dans Coolify :
#                   avant, plus aucune photographie ne se chargerait. Le script
#                   le verifie de lui-meme et refuse d'ecrire si l'hote ne sert
#                   pas encore l'API S3.
#
# Le script ne devine rien : il lit les applications, les reconnait a ce
# qu'elles portent, montre ce qu'il va changer, et s'arrete si quelque chose
# ne colle pas. Le client et l'API sont exiges ; le travailleur est traite
# comme facultatif, parce qu'il peut simplement ne pas etre deploye.
# Sans --apply, il n'ecrit jamais. Aucune dependance hors de
# la bibliotheque standard — un serveur n'a pas forcement jq.

import json
import os
import sys
import time
import urllib.error
import urllib.request

DOMAINE = 'memora-app.fr'
PHOTOS = f'photos.{DOMAINE}'
# Le depot dont les applications portent la bascule. Sert a delimiter le
# perimetre avant toute reconnaissance de role — voir perimetre().
DEPOT = 'memora'
COOLIFY = os.environ.get('COOLIFY_URL', 'http://localhost:8000').rstrip('/')
TOKEN = os.environ.get('COOLIFY_TOKEN', '')
TEAM_ID = os.environ.get('APPLE_TEAM_ID', '').strip()
APPLIQUER = '--apply' in sys.argv[1:]
PHOTOS_AUSSI = '--photos' in sys.argv[1:]


# Les applications dont Coolify refuse de dire les variables, signalees une
# fois a la fin de la reconnaissance.
ILLISIBLES = []


class Refus(Exception):
    """Coolify a repondu une erreur. Portee pour que l'appelant decide si
    elle est fatale — lire les variables d'une application etrangere ne
    l'est pas, en poser une sur les notres l'est."""

    def __init__(self, code, detail):
        super().__init__(f'HTTP {code}')
        self.code, self.detail = code, detail


def api(methode, chemin, corps=None, fatal=True):
    """Un appel a l'API de Coolify. Une erreur montre la reponse entiere :
    c'est elle qui dit ce que Coolify a refuse, et pourquoi."""
    donnees = json.dumps(corps).encode() if corps is not None else None
    requete = urllib.request.Request(
        f'{COOLIFY}/api/v1{chemin}', data=donnees, method=methode,
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json',
                 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            texte = reponse.read().decode()
            return json.loads(texte) if texte else None
    except urllib.error.HTTPError as erreur:
        detail = erreur.read().decode(errors='replace')
        if not fatal:
            raise Refus(erreur.code, detail)
        raise SystemExit(f'\n{methode} {chemin} → HTTP {erreur.code}\n{detail}\n')
    except urllib.error.URLError as erreur:
        raise SystemExit(f"\nImpossible de joindre {COOLIFY} : {erreur.reason}\n"
                         "COOLIFY_URL doit porter l'adresse ou vous ouvrez Coolify "
                         "dans votre navigateur — par exemple https://coolify.mon-domaine "
                         "— ou http://localhost:8000 si vous etes sur le serveur.\n"
                         "L'API doit aussi etre activee : Coolify → Settings → API.\n")


def envs_de(uuid):
    """Les variables d'une application, ou rien si Coolify refuse de les dire.

    Un compte Coolify heberge souvent d'autres choses que le projet, et
    certaines font tomber ce point d'entree en erreur 500. Abandonner la
    au premier refus reviendrait a laisser une application etrangere
    empecher la bascule des notres : on la met de cote et on continue.
    Si le refus portait sur l'une des trois qui nous interessent, la
    reconnaissance echouera juste apres, en le disant.
    """
    try:
        return {e['key']: e for e in (api('GET', f'/applications/{uuid}/envs', fatal=False) or [])}
    except Refus as refus:
        ILLISIBLES.append((uuid, refus.code))
        return {}


def perimetre(applications):
    """Ne garde que les applications de Memora.

    Ce tri doit avoir lieu AVANT la reconnaissance des roles, et non
    l'inverse. Le critere de role le plus naturel — le chemin du Dockerfile,
    `/apps/web/Dockerfile` — est la convention de tous les monorepos d'un
    meme compte : sur ce Coolify, `tracly-web` le porte a l'identique. En
    balayant toutes les applications du compte, la reconnaissance donnait le
    role de client de Memora a `tracly-web`, et la bascule aurait pose
    memora-app.fr sur tracly.ulivry.com — en emportant au passage le domaine
    d'un autre site en production, sans jamais toucher memora-web.

    On part donc du depot, qui lui ne se confond avec rien, puis on elargit
    a son environnement Coolify : MinIO est deploye depuis une image et pas
    depuis le depot, un futur travailleur y sera aussi.
    """
    du_depot = [a for a in applications
                if (a.get('git_repository') or '').lower().rsplit('/', 1)[-1] == DEPOT]
    if not du_depot:
        raise SystemExit(f"\nAucune application construite depuis un depot « {DEPOT} » : "
                         "je ne sais pas quoi basculer. Rien n'a ete change.")
    environnements = {a.get('environment_id') for a in du_depot}
    if len(environnements) != 1:
        raise SystemExit(f"\nLes applications de « {DEPOT} » sont reparties sur "
                         f"{len(environnements)} environnements Coolify "
                         f"({sorted(map(str, environnements))}). Je ne saurais pas "
                         "laquelle basculer : rien n'a ete change.")
    (environnement,) = environnements
    return [a for a in applications if a.get('environment_id') == environnement]


def reconnaitre(applications):
    """Classe chaque application d'apres ce qu'elle porte, jamais d'apres son nom.

    A n'appeler que sur le perimetre de Memora. Deux applications qui
    revendiquent le role de client arretent tout : c'est le signe que le
    critere ne discrimine plus, et choisir au hasard entre deux candidats
    revient a poser un domaine de production sur le mauvais conteneur.
    """
    roles = {'web': None, 'api': None, 'worker': None}
    for app in applications:
        envs = envs_de(app['uuid'])
        app['_envs'] = envs
        dockerfile = (app.get('dockerfile_location') or '').lower()
        if 'API_UPSTREAM' in envs or dockerfile.endswith('apps/web/dockerfile'):
            if roles['web'] is not None:
                raise SystemExit(
                    f"\nDeux applications repondent au role de client : "
                    f"{roles['web']['name']} et {app['name']}. Rien n'a ete change.")
            roles['web'] = app
        elif 'CLIENT_URL' in envs and 'DATABASE_URL' in envs:
            if 'worker' in dockerfile:
                roles['worker'] = app
            elif roles['api'] is None:
                roles['api'] = app
            else:
                roles['worker'] = app
    return roles


def valeur(app, cle):
    e = app['_envs'].get(cle)
    return e['value'] if e else None


def poser_env(app, cle, val):
    """Cree ou met a jour une variable d'execution. Jamais de variable de
    construction : nginx et l'API les lisent au demarrage du conteneur.

    Ni POST ni PATCH n'acceptent `is_build_time` : Coolify 4.1.2 repond
    « This field is not allowed. » en HTTP 422. Le champ n'est donc pas
    envoye — l'absence de mention vaut variable d'execution, ce qui est
    exactement ce qu'on veut. Le declarer faisait echouer la bascule apres
    qu'elle avait deja pose les domaines, c'est-a-dire dans l'etat le plus
    inconfortable : le client bascule, l'API restee en arriere.
    """
    corps = {'key': cle, 'value': val, 'is_preview': False, 'is_literal': False}
    if cle in app['_envs']:
        api('PATCH', f"/applications/{app['uuid']}/envs", corps)
    else:
        api('POST', f"/applications/{app['uuid']}/envs", corps)


def deployer(app):
    reponse = api('GET', f"/deploy?uuid={app['uuid']}&force=false")
    return reponse


def sonder(url, secondes=10):
    """Un GET, certificat verifie. Rend (statut, type de contenu).

    Un certificat invalide leve, comme une panne : c'est voulu. La bascule
    ne doit pas s'appuyer sur un hote que le navigateur d'un invite
    refusera.
    """
    import ssl
    requete = urllib.request.Request(url, method='GET')
    try:
        with urllib.request.urlopen(requete, timeout=secondes,
                                    context=ssl.create_default_context()) as reponse:
            return reponse.status, reponse.headers.get('Content-Type', '')
    except urllib.error.HTTPError as erreur:
        return erreur.code, erreur.headers.get('Content-Type', '')


def souci_minio(hote):
    """Dit ce qui empeche de faire suivre S3_ENDPOINT sur `hote`, ou rien.

    Deux erreurs que ce controle attrape, et qui coutent cher parce qu'elles
    ne se voient qu'au premier invite qui ouvre un album :

    - le domaine pas encore pose, ou son certificat pas encore emis : plus
      rien ne repond ;
    - le port 9001 au lieu du 9000 : la console repond, en HTML, et
      S3_ENDPOINT pointerait alors sur une interface web au lieu de l'API
      S3. Les adresses signees seraient emises sans erreur, et aucune ne
      servirait une photographie.

    Dans les deux cas le kit est deja imprime quand on s'en apercoit.
    """
    try:
        statut, _ = sonder(f'https://{hote}/minio/health/live')
    except Exception as erreur:
        return f'https://{hote} ne repond pas ({erreur}).'
    if statut != 200:
        return (f'https://{hote}/minio/health/live → HTTP {statut} : '
                'un MinIO en bonne sante repond 200.')
    try:
        _, type_contenu = sonder(f'https://{hote}/')
    except Exception as erreur:
        return f'https://{hote} ne repond pas ({erreur}).'
    if 'html' in type_contenu.lower():
        return (f'https://{hote}/ rend du HTML : c\'est la console (port 9001), '
                'pas l\'API S3. Le domaine doit pointer sur le port 9000.')
    return None


def attendre_https(hote, secondes=180):
    """Attend que Traefik serve le domaine avec un certificat valide."""
    import ssl
    debut = time.time()
    while time.time() - debut < secondes:
        try:
            with urllib.request.urlopen(f'https://{hote}/', timeout=10,
                                        context=ssl.create_default_context()) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception:
            time.sleep(5)
    return None


def main():
    if not TOKEN:
        raise SystemExit('COOLIFY_TOKEN manquant : Coolify → Keys & Tokens → API tokens.')

    applications = perimetre(api('GET', '/applications') or [])
    roles = reconnaitre(applications)
    if ILLISIBLES:
        print(f"  ({len(ILLISIBLES)} application(s) dont Coolify refuse de lire les variables, "
              f"ignorees : {', '.join(f'{u} → HTTP {c}' for u, c in ILLISIBLES)})")

    # Le client et l'API sont indispensables : sans eux la bascule n'a pas
    # de sens. Le travailleur, lui, peut n'etre deploye nulle part — c'etait
    # le cas le jour de la bascule. Refuser d'ecrire pour cette raison
    # bloquerait le domaine sur un manque qui ne le concerne en rien : on le
    # dit, et on continue sans lui.
    manquants = [r for r in ('web', 'api') if roles[r] is None]
    if manquants:
        print('Applications trouvees :')
        for app in applications:
            print(f"  - {app.get('name')}  fqdn={app.get('fqdn')}  dockerfile={app.get('dockerfile_location')}")
        raise SystemExit(f"\nJe ne reconnais pas : {', '.join(manquants)}. Rien n'a ete change.")

    web, apiapp, worker = roles['web'], roles['api'], roles['worker']
    # Les applications qui portent CLIENT_URL et S3_ENDPOINT.
    arriere = [a for a in (apiapp, worker) if a is not None]
    s3_actuel = valeur(apiapp, 'S3_ENDPOINT')
    s3_cible = f'https://{PHOTOS}' if PHOTOS_AUSSI else s3_actuel

    # Le plan, tel qu'il sera applique.
    plan = [
        (web, 'domaines', web.get('fqdn'), f'https://{DOMAINE},https://www.{DOMAINE}'),
        (web, 'PUBLIC_HOST', valeur(web, 'PUBLIC_HOST'), DOMAINE),
        (web, 'APPLE_TEAM_ID', valeur(web, 'APPLE_TEAM_ID'), TEAM_ID or valeur(web, 'APPLE_TEAM_ID') or '(vide — a remplir plus tard)'),
    ]
    for app in arriere:
        plan.append((app, 'CLIENT_URL', valeur(app, 'CLIENT_URL'), f'https://{DOMAINE}'))
    for app in arriere:
        plan.append((app, 'S3_ENDPOINT', valeur(app, 'S3_ENDPOINT'), s3_cible))

    print(f"\nCoolify : {COOLIFY}")
    print(f"  client  : {web['name']}  ({web.get('fqdn')})")
    print(f"  api     : {apiapp['name']}")
    print(f"  worker  : {worker['name']}\n" if worker else
          "  worker  : aucun. Rien ne ferme les evenements a echeance ni ne purge\n"
          "            les medias a trente jours tant qu'il n'est pas deploye.\n")
    print('Plan :')
    for app, quoi, avant, apres in plan:
        marque = '  ' if avant == apres else '→ '
        print(f"  {marque}{app['name']:<24} {quoi:<14} {avant!s:<48} → {apres}")
    if not PHOTOS_AUSSI:
        print(f"\n  MinIO reste sur {s3_actuel} : donne --photos une fois son domaine"
              f" passe sur https://{PHOTOS} dans Coolify.")
    if not TEAM_ID and not valeur(web, 'APPLE_TEAM_ID'):
        print("\n  APPLE_TEAM_ID vide : tout marche sauf les liens universels, a remplir plus tard.")

    # --photos ne se donne qu'une fois MinIO deplace. On le verifie plutot
    # que de le rappeler : la panne qu'on evite ici est silencieuse cote
    # serveur — l'API signe des adresses parfaitement valides vers un hote
    # qui ne sert rien.
    souci = souci_minio(PHOTOS) if PHOTOS_AUSSI else None
    if souci:
        print(f"\n  --photos, mais {souci}")
        print(f"  Fais d'abord l'etape MinIO : domaine https://{PHOTOS} sur le port 9000,")
        print(f"  variable MINIO_SERVER_URL=https://{PHOTOS}, puis redeploiement.")
    elif PHOTOS_AUSSI:
        print(f"\n  https://{PHOTOS} sert l'API S3 avec un certificat valide : "
              'S3_ENDPOINT peut suivre.')

    if not APPLIQUER:
        print("\nRien n'a ete change. Relance avec --apply pour appliquer.")
        return

    if souci:
        raise SystemExit("\nRien n'a ete change : --photos ferait pointer S3_ENDPOINT sur un "
                         "hote qui ne sert pas les photographies.")

    print('\nApplication…')
    api('PATCH', f"/applications/{web['uuid']}", {'domains': f'https://{DOMAINE},https://www.{DOMAINE}'})
    poser_env(web, 'PUBLIC_HOST', DOMAINE)
    # Un identifiant deja pose n'est jamais efface par une relance sans la
    # variable : le script doit pouvoir etre rejoue sans rien perdre.
    if TEAM_ID:
        poser_env(web, 'APPLE_TEAM_ID', TEAM_ID)
    elif 'APPLE_TEAM_ID' not in web['_envs']:
        poser_env(web, 'APPLE_TEAM_ID', '')
    for app in arriere:
        poser_env(app, 'CLIENT_URL', f'https://{DOMAINE}')
        if PHOTOS_AUSSI:
            poser_env(app, 'S3_ENDPOINT', s3_cible)
    print('  variables et domaines poses.')

    # L'API et le worker d'abord, le client ensuite : le client relaie vers
    # l'API, autant qu'elle soit deja repartie quand il redemarre.
    for app in arriere + [web]:
        deployer(app)
        print(f"  redeploiement lance : {app['name']}")

    print(f"\nJ'attends que https://{DOMAINE} reponde avec un certificat valide…")
    attente = int(os.environ.get('BASCULE_ATTENTE', '180'))
    statut = attendre_https(DOMAINE, attente)
    if statut is None:
        print(f"  toujours rien apres {attente} s. Regarde le journal de deploiement du client dans Coolify.")
        return
    print(f"  https://{DOMAINE}/ → HTTP {statut}")
    try:
        with urllib.request.urlopen(f'https://{DOMAINE}/.well-known/apple-app-site-association', timeout=10) as r:
            print(f"  apple-app-site-association → {r.read().decode()[:120]}…")
    except Exception as e:
        print(f"  apple-app-site-association : {e}")
    print("\nTermine. Pense a retelecharger le kit imprimable : les anciens QR codes portent l'adresse provisoire.")


if __name__ == '__main__':
    main()
