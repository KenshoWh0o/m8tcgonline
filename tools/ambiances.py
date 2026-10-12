#!/usr/bin/env python3
"""Version 3.0 : les fonds d'ambiance de chaque écran.

Chaque onglet a sa lumière : une illustration du jeu, très floutée et
assombrie, posée derrière le contenu (css/base.css, « Fond »). Le flou est
calculé ici, une fois pour toutes, et non par le navigateur : une image de
quelques kilo-octets agrandie en plein écran ne coûte rien, un `filter:blur()`
de cette taille recalculé à chaque défilement coûterait cher sur un téléphone.

    python3 tools/ambiances.py

Écrit assets/ambiance/<onglet>.webp. Les sources sont les illustrations des
cartes (cards/), des boosters et des sections du Choc : changer une source se
fait dans AMBIANCES, ci-dessous.
"""
import os
from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'ambiance')

# La zone de l'illustration sur une carte : le cadre, le nom et le texte des
# règles n'apportent que du gris.
ILLU = (0.08, 0.1, 0.92, 0.56)


def carte(nom):
    im = Image.open(os.path.join(ROOT, 'cards', nom)).convert('RGB')
    w, h = im.size
    return im.crop((int(w * ILLU[0]), int(h * ILLU[1]), int(w * ILLU[2]), int(h * ILLU[3])))


def image(chemin, boite=None):
    im = Image.open(os.path.join(ROOT, chemin))
    if im.mode == 'RGBA':
        fond = Image.new('RGB', im.size, (10, 7, 31))
        fond.paste(im, mask=im.split()[3])
        im = fond
    im = im.convert('RGB')
    if boite:
        w, h = im.size
        im = im.crop((int(w * boite[0]), int(h * boite[1]), int(w * boite[2]), int(h * boite[3])))
    return im


def mosaique(images, colonnes=2):
    """Plusieurs illustrations côte à côte : une ambiance à plusieurs couleurs."""
    t = 300
    lignes = (len(images) + colonnes - 1) // colonnes
    m = Image.new('RGB', (t * colonnes, t * lignes))
    for i, im in enumerate(images):
        m.paste(im.resize((t, t)), ((i % colonnes) * t, (i // colonnes) * t))
    return m


AMBIANCES = {
    'boosters': lambda: image('assets/boosters/booster-01.webp', (0.05, 0.15, 0.95, 0.75)),
    'collection': lambda: mosaique([carte('113_L_Joueur_Rose_Kampai.avif'),
                                    carte('118_L_Joueur_Mauve_Gotaga-Dance.avif'),
                                    carte('115_L_Moment-Instant_Orange_Champions-Du-Monde.avif'),
                                    carte('120_L_Joueur_Neutre_BrawksSaga.avif')]),
    'combats': lambda: carte('116_L_Joueur_Mauve_The-French-Sorcerer.avif'),
    'choc': lambda: mosaique([image('assets/combat/sections/deter.webp'),
                              image('assets/combat/sections/toxique.webp')], 2),
    'quetes': lambda: carte('112_E_Joueur_Neutre_M8-Resilience.avif'),
    'social': lambda: carte('074_C_Joueur_Neutre_Grand-Respect.avif'),
    'boutique': lambda: carte('122_L_Objet-Lien_Neutre_La-Luxueuse-III.avif'),
    'classement': lambda: carte('028_E_Moment-Instant_Rose_Championnes-d_Europe.avif'),
    'profil': lambda: carte('117_L_Joueur_Mauve_La-Releve.avif'),
}


def flouter(im):
    """Petite, très floue, plus saturée, plus sombre : une lumière, pas une image."""
    im = im.copy()
    im.thumbnail((360, 360))
    # Un bord généreux avant le flou, sinon les coins tirent vers le noir.
    w, h = im.size
    marge = 40
    grand = Image.new('RGB', (w + 2 * marge, h + 2 * marge))
    grand.paste(im.resize((w + 2 * marge, h + 2 * marge)), (0, 0))
    grand.paste(im, (marge, marge))
    grand = grand.filter(ImageFilter.GaussianBlur(15))
    grand = grand.crop((marge, marge, marge + w, marge + h))
    grand = ImageEnhance.Color(grand).enhance(1.35)
    grand = ImageEnhance.Brightness(grand).enhance(0.62)
    return grand.resize((240, int(240 * h / w)), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for nom, source in AMBIANCES.items():
        im = flouter(source())
        chemin = os.path.join(OUT, nom + '.webp')
        im.save(chemin, 'WEBP', quality=62, method=6)
        print(f'{chemin}  {im.size[0]}x{im.size[1]}  {os.path.getsize(chemin) // 1024 + 1} Ko')


if __name__ == '__main__':
    main()
