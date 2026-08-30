#!/usr/bin/env python3
"""Produit l'icone de l'application et son ecran de lancement.

L'icone etait celle de Capacitor par defaut, et l'ecran de lancement etait
blanc : le premier signal qu'un utilisateur recoit disait « inacheve ».

Le motif est un diaphragme, pas deux cercles concentriques : un objectif
generique est le symbole le plus employe de la categorie, alors que les
lamelles d'un iris disent l'ouverture, donc la prise de vue. Les deux bandes
perforees rappellent la pellicule qui borde l'application.

Usage : python3 apps/web/scripts/icone.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
NUIT = (20, 16, 25)
BANDE = (11, 8, 16)
OR = (201, 169, 97)

# On dessine huit fois trop grand puis on reduit : c'est ce qui donne des
# bords nets sans avoir a gerer l'anticrenelage a la main.
ECHELLE = 8


def diaphragme(dessin, cx, cy, rayon, lames=9, ouverture=0.3):
    """Les lamelles d'un iris, en couronne.

    Neuf lamelles et une ouverture serree : a six lamelles grandes ouvertes,
    le creux central prenait une forme d etoile et le motif ne se lisait
    plus comme un objectif.
    """
    sombre = tuple(int(c * 0.72) for c in OR)
    for i in range(lames):
        a0 = (2 * math.pi / lames) * i
        a1 = a0 + (2 * math.pi / lames)
        interieur = rayon * ouverture
        points = [
            (cx + math.cos(a0) * rayon, cy + math.sin(a0) * rayon),
            (cx + math.cos(a1) * rayon, cy + math.sin(a1) * rayon),
            (cx + math.cos(a1) * interieur, cy + math.sin(a1) * interieur),
        ]
        dessin.polygon(points, fill=OR if i % 2 == 0 else sombre)


def dessiner(taille, avec_bandes=True, marge=0.0):
    """marge : proportion de vide autour du motif, pour l'icone masquable."""
    t = taille * ECHELLE
    image = Image.new('RGB', (t, t), NUIT)
    d = ImageDraw.Draw(image)

    if avec_bandes:
        largeur = int(t * 0.115)
        d.rectangle([0, 0, largeur, t], fill=BANDE)
        d.rectangle([t - largeur, 0, t, t], fill=BANDE)
        # Perforations : six par bord, arrondies comme celles d'un film.
        pw, ph = int(largeur * 0.42), int(t * 0.072)
        perfo = tuple(int(c * 0.55) for c in OR)
        for i in range(6):
            y = int(t * (0.075 + i * 0.172))
            for x in (int(largeur * 0.29), t - largeur + int(largeur * 0.29)):
                d.rounded_rectangle([x, y, x + pw, y + ph],
                                    radius=int(pw * 0.28), fill=perfo)

    rayon = t * (0.30 - marge)
    diaphragme(d, t / 2, t / 2, rayon)
    # Le creux central : c'est lui qui fait lire « ouverture » et non « roue ».
    creux = int(rayon * 0.42)
    d.ellipse([t / 2 - creux, t / 2 - creux, t / 2 + creux, t / 2 + creux], fill=NUIT)

    return image.resize((taille, taille), Image.LANCZOS)


def lancement(largeur, hauteur):
    """Ecran de lancement : le meme motif, sur le fond de l'application."""
    image = Image.new('RGB', (largeur, hauteur), NUIT)
    cote = min(largeur, hauteur)
    motif = dessiner(int(cote * 0.3), avec_bandes=False)
    image.paste(motif, ((largeur - motif.width) // 2, (hauteur - motif.height) // 2))
    d = ImageDraw.Draw(image)
    bande = int(largeur * 0.028)
    d.rectangle([0, 0, bande, hauteur], fill=BANDE)
    d.rectangle([largeur - bande, 0, largeur, hauteur], fill=BANDE)
    return image


def main():
    ios = RACINE / 'ios' / 'App' / 'App' / 'Assets.xcassets'
    pwa = RACINE / 'public'
    pwa.mkdir(parents=True, exist_ok=True)
    sorties = []

    icone_ios = ios / 'AppIcon.appiconset' / 'AppIcon-512@2x.png'
    if icone_ios.parent.exists():
        dessiner(1024).save(icone_ios)
        sorties.append(icone_ios)

    splash = ios / 'Splash.imageset'
    if splash.exists():
        for nom in ('splash-2732x2732.png',
                    'splash-2732x2732-1.png',
                    'splash-2732x2732-2.png'):
            chemin = splash / nom
            lancement(2732, 2732).save(chemin)
            sorties.append(chemin)

    for taille in (192, 512):
        chemin = pwa / f'icone-{taille}.png'
        dessiner(taille).save(chemin)
        sorties.append(chemin)

    # Icone masquable : le systeme peut la rogner en cercle, le motif doit
    # tenir dans les quatre-vingts pour cent centraux.
    masquable = pwa / 'icone-512-masquable.png'
    dessiner(512, avec_bandes=False, marge=0.055).save(masquable)
    sorties.append(masquable)

    for c in sorties:
        print(f'  {c.relative_to(RACINE)}')
    print(f'{len(sorties)} fichiers produits')


if __name__ == '__main__':
    main()
