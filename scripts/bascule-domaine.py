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
#                   avant, plus aucune photographie ne se chargerait.
#
# Le script ne devine rien : il lit les applications, les reconnait a ce
# qu'elles portent, montre ce qu'il va changer, et s'arrete si quelque chose
# ne colle pas. Sans --apply, il n'ecrit jamais. Aucune dependance hors de
# la bibliotheque standard — un serveur n'a pas forcement jq.

import json
import os
import sys
import time
import urllib.error
import urllib.request

DOMAINE = 'memora-app.fr'
PHOTOS = f'photos.{DOMAINE}'
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


def reconnaitre(applications):
    """Classe chaque application d'apres ce qu'elle porte, jamais d'apres son nom."""
    roles = {'web': None, 'api': None, 'worker': None}
    for app in applications:
        envs = envs_de(app['uuid'])
        app['_envs'] = envs
        dockerfile = (app.get('dockerfile_location') or '').lower()
        if 'API_UPSTREAM' in envs or dockerfile.endswith('apps/web/dockerfile'):
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
    construction : nginx et l'API les lisent au demarrage du conteneur."""
    corps = {'key': cle, 'value': val, 'is_preview': False, 'is_build_time': False,
             'is_literal': False}
    if cle in app['_envs']:
        api('PATCH', f"/applications/{app['uuid']}/envs", corps)
    else:
        api('POST', f"/applications/{app['uuid']}/envs", corps)


def deployer(app):
    reponse = api('GET', f"/deploy?uuid={app['uuid']}&force=false")
    return reponse


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

    applications = api('GET', '/applications') or []
    roles = reconnaitre(applications)
    if ILLISIBLES:
        print(f"  ({len(ILLISIBLES)} application(s) dont Coolify refuse de lire les variables, "
              f"ignorees : {', '.join(f'{u} → HTTP {c}' for u, c in ILLISIBLES)})")

    manquants = [r for r, app in roles.items() if app is None]
    if manquants:
        print('Applications trouvees :')
        for app in applications:
            print(f"  - {app.get('name')}  fqdn={app.get('fqdn')}  dockerfile={app.get('dockerfile_location')}")
        raise SystemExit(f"\nJe ne reconnais pas : {', '.join(manquants)}. Rien n'a ete change.")

    web, apiapp, worker = roles['web'], roles['api'], roles['worker']
    s3_actuel = valeur(apiapp, 'S3_ENDPOINT')
    s3_cible = f'https://{PHOTOS}' if PHOTOS_AUSSI else s3_actuel

    # Le plan, tel qu'il sera applique.
    plan = [
        (web, 'domaines', web.get('fqdn'), f'https://{DOMAINE},https://www.{DOMAINE}'),
        (web, 'PUBLIC_HOST', valeur(web, 'PUBLIC_HOST'), DOMAINE),
        (web, 'APPLE_TEAM_ID', valeur(web, 'APPLE_TEAM_ID'), TEAM_ID or valeur(web, 'APPLE_TEAM_ID') or '(vide — a remplir plus tard)'),
        (apiapp, 'CLIENT_URL', valeur(apiapp, 'CLIENT_URL'), f'https://{DOMAINE}'),
        (worker, 'CLIENT_URL', valeur(worker, 'CLIENT_URL'), f'https://{DOMAINE}'),
        (apiapp, 'S3_ENDPOINT', s3_actuel, s3_cible),
        (worker, 'S3_ENDPOINT', valeur(worker, 'S3_ENDPOINT'), s3_cible),
    ]

    print(f"\nCoolify : {COOLIFY}")
    print(f"  client  : {web['name']}  ({web.get('fqdn')})")
    print(f"  api     : {apiapp['name']}")
    print(f"  worker  : {worker['name']}\n")
    print('Plan :')
    for app, quoi, avant, apres in plan:
        marque = '  ' if avant == apres else '→ '
        print(f"  {marque}{app['name']:<24} {quoi:<14} {avant!s:<48} → {apres}")
    if not PHOTOS_AUSSI:
        print(f"\n  MinIO reste sur {s3_actuel} : donne --photos une fois son domaine"
              f" passe sur https://{PHOTOS} dans Coolify.")
    if not TEAM_ID and not valeur(web, 'APPLE_TEAM_ID'):
        print("\n  APPLE_TEAM_ID vide : tout marche sauf les liens universels, a remplir plus tard.")

    if not APPLIQUER:
        print("\nRien n'a ete change. Relance avec --apply pour appliquer.")
        return

    print('\nApplication…')
    api('PATCH', f"/applications/{web['uuid']}", {'domains': f'https://{DOMAINE},https://www.{DOMAINE}'})
    poser_env(web, 'PUBLIC_HOST', DOMAINE)
    # Un identifiant deja pose n'est jamais efface par une relance sans la
    # variable : le script doit pouvoir etre rejoue sans rien perdre.
    if TEAM_ID:
        poser_env(web, 'APPLE_TEAM_ID', TEAM_ID)
    elif 'APPLE_TEAM_ID' not in web['_envs']:
        poser_env(web, 'APPLE_TEAM_ID', '')
    for app in (apiapp, worker):
        poser_env(app, 'CLIENT_URL', f'https://{DOMAINE}')
        if PHOTOS_AUSSI:
            poser_env(app, 'S3_ENDPOINT', s3_cible)
    print('  variables et domaines poses.')

    # L'API et le worker d'abord, le client ensuite : le client relaie vers
    # l'API, autant qu'elle soit deja repartie quand il redemarre.
    for app in (apiapp, worker, web):
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
