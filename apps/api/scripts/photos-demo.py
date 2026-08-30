#!/usr/bin/env python3
"""Produit les photographies de demonstration du jeu d'essai.

Ces images alimentent le seed et la repetition generale. Elles sont
synthetiques et non photographiees : aucun visage reel, aucune licence, et
le depot ne porte que des fichiers qu'il sait reproduire.

Le premier jeu etait trop sombre. Dans une interface elle-meme sombre, une
vignette a dominante brune se confond avec son fond : l'ecran de tri
paraissait vide alors qu'il affichait bien les photographies. La luminosite
est donc etalee volontairement, des scenes tamisees aux scenes au flash.

Usage : python3 apps/api/scripts/photos-demo.py
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SORTIE = Path(__file__).resolve().parent.parent / 'prisma' / 'photos'
COMBIEN = 24
LARGEUR, HAUTEUR = 1200, 1600

# Ambiances d'une soiree. Le troisieme nombre est la luminosite visee, de la
# piste de danse a peine eclairee au flash direct.
AMBIANCES = [
    ('tamise',   (74, 52, 30),   0.42),
    ('bougies',  (96, 64, 32),   0.55),
    ('dorée',    (122, 86, 40),  0.68),
    ('flash',    (168, 150, 128), 0.88),
    ('piste',    (52, 46, 88),   0.50),
    ('néons',    (96, 52, 86),   0.62),
]

LUMIERES = [
    (255, 226, 170), (255, 208, 140), (255, 240, 214),
    (198, 214, 255), (255, 176, 138), (236, 200, 255),
]


def melange(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def fond(image, base, clarte):
    """Degrade radial : la source lumineuse est hors champ, en haut."""
    dessin = ImageDraw.Draw(image)
    haut = melange(base, (255, 255, 255), clarte * 0.45)
    bas = melange(base, (0, 0, 0), 0.45)
    for y in range(HAUTEUR):
        t = (y / HAUTEUR) ** 1.25
        dessin.line([(0, y), (LARGEUR, y)], fill=melange(haut, bas, t))


def bokeh(image, clarte, alea):
    """Cercles flous : ce que devient une guirlande hors de la mise au point."""
    calque = Image.new('RGB', (LARGEUR, HAUTEUR), (0, 0, 0))
    dessin = ImageDraw.Draw(calque)
    for _ in range(alea.randint(16, 30)):
        r = alea.randint(26, 130)
        x = alea.randint(-r, LARGEUR + r)
        y = alea.randint(-r, int(HAUTEUR * 0.72))
        ton = alea.choice(LUMIERES)
        force = alea.uniform(0.35, 1.0) * (0.55 + clarte * 0.6)
        dessin.ellipse([x - r, y - r, x + r, y + r],
                       fill=melange((0, 0, 0), ton, min(force, 1.0)))
    calque = calque.filter(ImageFilter.GaussianBlur(alea.randint(10, 26)))
    return Image.blend(image, Image.blend(image, calque, 0.62), 0.85)


def silhouettes(image, alea):
    """Deux ou trois personnes de dos, au premier plan, en contre-jour."""
    dessin = ImageDraw.Draw(image)
    for _ in range(alea.randint(2, 3)):
        largeur = alea.randint(230, 400)
        x = alea.randint(-120, LARGEUR - 120)
        y = alea.randint(int(HAUTEUR * 0.52), int(HAUTEUR * 0.72))
        tete = largeur * 0.34
        # Le corps, en capsule.
        dessin.rounded_rectangle(
            [x, y, x + largeur, HAUTEUR + 60],
            radius=int(largeur * 0.3), fill=(16, 13, 10))
        # La tete.
        cx = x + largeur / 2
        dessin.ellipse([cx - tete / 2, y - tete * 1.15, cx + tete / 2, y + tete * 0.1],
                       fill=(16, 13, 10))
    return image.filter(ImageFilter.GaussianBlur(1.6))


def grain(image, alea, force=9):
    """Le grain d'un capteur pousse en basse lumiere."""
    bruit = Image.effect_noise((LARGEUR, HAUTEUR), force).convert('L')
    return Image.composite(image, Image.blend(image, bruit.convert('RGB'), 0.16), bruit.point(lambda v: 255 - v))


def produire(indice):
    alea = random.Random(1000 + indice)
    nom, base, clarte = AMBIANCES[indice % len(AMBIANCES)]
    # Chaque image s'ecarte un peu de son ambiance : deux photographies d'une
    # meme soiree ne sont jamais exposees pareil.
    clarte = min(max(clarte + alea.uniform(-0.09, 0.12), 0.3), 0.95)

    image = Image.new('RGB', (LARGEUR, HAUTEUR))
    fond(image, base, clarte)
    image = bokeh(image, clarte, alea)
    if alea.random() < 0.7:
        image = silhouettes(image, alea)
    image = grain(image, alea)
    # Une legere rotation de teinte evite que les vingt-quatre se ressemblent.
    return image, nom


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    for i in range(COMBIEN):
        image, nom = produire(i)
        chemin = SORTIE / f'{i:02d}.jpg'
        image.save(chemin, 'JPEG', quality=82, optimize=True)
        print(f'  {chemin.name}  ambiance {nom}')
    print(f'{COMBIEN} photographies de demonstration produites dans {SORTIE}')


if __name__ == '__main__':
    main()
