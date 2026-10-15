# Monter son propre serveur — guide pas à pas

> **Règle du propriétaire, avant tout.** Aucun SQL de la 3.0 ne se joue sur la
> base de **production** tant que le propriétaire ne l'a pas décidé. La
> production (`matetcg.com`) est en **2.1.2** ; la 3.0 ne vit qu'en pré-prod
> (`matetcg.com/preprod/`), avec un faux serveur dans le navigateur
> (README § 1.2).
>
> Ce guide sert à monter **un autre** projet Supabase, neuf. Les clés déjà
> écrites dans `js/supabase-config.js` sont celles de la production : ne colle
> **jamais** `supabase/TOUT.sql` dans ce projet-là.

Ce guide part du principe que tu n'as jamais fait ça. Tu vas surtout cliquer,
copier et coller. Compte une heure tranquille.

À la fin, ton serveur aura des comptes (connexion par Discord), la collection
sauvegardée sur le compte, les échanges, les quêtes, la boutique et les
Combats : tout ce que fait le code de la branche (version 3.0.8 en cours).

**Une page t'accompagne :** `verif.html`, à la racine du site. Elle contrôle
l'installation et dit en clair ce qui est fait et ce qui reste. Dans le doute,
va la voir.

---

## Avant de commencer

**Ce qu'il te faut.** Un compte GitHub, un compte Discord, un navigateur, et
Python 3 pour servir le site sur ton ordinateur. Rien n'est payant.

**Servir le site en local.** Dans le dossier du jeu :

```bash
python3 -m http.server 8781
```

Puis ouvre `http://localhost:8781`. Laisse la commande tourner ; `Ctrl+C`
l'arrête. Un double-clic sur `index.html` ne suffit pas : la connexion Discord
doit revenir sur une adresse web.

**Ce que tu verras d'abord : « Projet annulé · Merci ».** C'est normal. Le
site affiche cette annonce à tout visiteur non connecté, parce que
`PORTE.active` vaut `true` (`js/gate.js`) : seuls les comptes **invités**
entrent. On s'invite soi-même à l'étape 6. Pour ouvrir le jeu à tout le monde,
voir « Ouvrir le jeu à tous », plus bas.

**Il n'y a plus de mode hors ligne.** Sans serveur, on ne joue pas : on ne
dépasse pas l'écran d'entrée.

> Supabase change parfois le nom de ses menus. Si tu ne trouves pas exactement
> le libellé indiqué, cherche le mot le plus important (*Authentication*,
> *Providers*, *API*) : il est toujours là, parfois rangé ailleurs.

---

## Étape 1 — Créer le projet Supabase

Supabase, c'est le serveur du jeu : il garde les comptes et applique toutes
les règles.

1. Va sur **[supabase.com](https://supabase.com)** et clique **Start your project**.
2. Connecte-toi avec GitHub.
3. Clique **New project**.
4. Remplis :
   - **Name** : ce que tu veux, par exemple `mate-tcg-test` ;
   - **Database Password** : clique **Generate a password**, puis **garde-le
     quelque part**. Ce guide n'en a pas besoin, mais il ne se réaffiche jamais ;
   - **Region** : au plus près des joueurs, par exemple `West EU (Ireland)` ou
     `Central EU (Frankfurt)`.
5. Clique **Create new project** et attends une à deux minutes.

> Un projet gratuit s'endort après une période sans activité. On le réveille
> depuis le tableau de bord ; rien n'est perdu.

---

## Étape 2 — Installer la base (un seul copier-coller)

Cette étape crée tout : les tables, les règles de sécurité, le catalogue des
cartes, les quêtes, la boutique et toutes les actions du jeu.

1. Dans Supabase, colonne de gauche : **SQL Editor**, puis **New query**.
2. Ouvre **`supabase/TOUT.sql`** (environ 6 100 lignes), sélectionne **tout**
   (`Ctrl+A`, ou `Cmd+A` sur Mac) et copie.
3. Colle dans la zone de Supabase, puis clique **Run**.

**Ce que tu dois voir :** `Success. No rows returned`.

**Si tu vois du rouge :** le message dit ce qui coince. Le fichier se rejoue
autant de fois qu'on veut : chaque ligne est mise à jour si elle existe déjà.
Il n'a ni `BEGIN` ni `COMMIT` ; l'éditeur de Supabase l'envoie d'un bloc, ce
qui devrait annuler tout le passage en cas d'erreur (supposé, pas vérifié).
Avec `psql`, ajoute `--single-transaction`.

**D'où vient ce fichier.** `TOUT.sql` est assemblé par
`python3 tools/build-sql.py` à partir des 21 fichiers de
`supabase/installation/` (`01_schema.sql` … `28_maitrise.sql`). Ne le modifie
jamais à la main : modifie les fichiers d'origine, puis relance le script.

**Ce que l'installation met en place**, en plus du jeu lui-même :

- **122 cartes d'extension**, et 106 autres cartes hors extension : 6 Promos,
  85 Reverses, 9 Essences Brillantes, 5 Secrètes et la carte unique ;
- **97 quêtes** et **32 articles** en boutique ;
- **l'événement Reflets**, ouvert pour **14 jours** à partir de
  l'installation (`21_reflets.sql`). Pour l'arrêter, voir « Les événements »,
  plus bas ;
- **la bêta fermée** : `beta_lancement()` vaut `'infinity'`, et seuls les
  comptes de la table `beta_invites` peuvent jouer. Cette table est **vide** :
  personne n'y est, pas même toi (étape 6) ;
- la chasse à la carte unique, **fermée**.

---

## Étape 3 — Brancher le site sur ton serveur

1. Dans Supabase : **Settings** (la roue dentée), puis **API**.
2. Copie deux valeurs :
   - **Project URL**, de la forme `https://abcdefgh.supabase.co`. Si
     l'adresse affichée finit par `/rest/v1/`, enlève cette partie ;
   - **la clé publique** : **Publishable key** (`sb_publishable_…`) sur les
     projets récents, **`anon` `public`** (`eyJ…`) sur les plus anciens. Les
     deux se collent au même endroit.
3. Ouvre **`js/supabase-config.js`** et **remplace** les deux valeurs déjà
   présentes (celles de la production) par les tiennes :

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xxxxxxxxxxxxxxxx';
```

4. Recharge `http://localhost:8781`. L'annonce « Projet annulé · Merci »
   doit maintenant montrer le lien **« J'ai déjà un accès »**. S'il manque,
   le site n'a pas trouvé ton serveur.

> ⚠️ **Ne copie jamais la clé secrète** : **Secret key** (`sb_secret_…`) ou
> **`service_role`** (`eyJ…`). Elle contourne toutes les sécurités, et ce
> fichier part en ligne avec le site. La clé publique, elle, est faite pour
> être publique : elle n'ouvre que ce que les règles autorisent.
>
> **Si une clé secrète a fuité** (dans un fichier, un message, une capture) :
> Supabase › **Settings › API Keys**, et révoque-la. `verif.html` te prévient
> si tu as collé la mauvaise.

---

## Étape 4 — Dire au serveur où renvoyer les gens

Après Discord, Supabase doit savoir vers quelle page revenir. Sans ça, le
retour tombe dans le vide.

1. Supabase › **Authentication** › **URL Configuration**.
2. **Site URL** : l'adresse publique du jeu. Pour l'instant,
   `http://localhost:8781`.
3. **Redirect URLs** › **Add URL** :
   ```
   http://localhost:8781/**
   ```
   Le jour où tu publies (étape 10), ajoute aussi l'adresse en ligne, suivie
   de `/**`.
4. **Save**.

Les deux étoiles veulent dire « et tout ce qui suit ».

---

## Étape 5 — La connexion Discord

C'est **la seule méthode de connexion** du jeu (`CONNEXION` dans
`js/config.js`). Aucun courriel n'est envoyé, donc aucun joueur ne reste
bloqué faute d'avoir reçu son lien ; le pseudo et l'avatar arrivent tout
faits. Le jeu demande à Discord le pseudo, l'avatar et l'adresse e-mail
(`identify email`) : l'adresse sert à reconnaître un invité et un
administrateur.

1. Supabase › **Authentication › Sign In / Providers › Discord** : active-le.
   Il affiche une **Callback URL** : copie-la.
2. Va sur **[discord.com/developers/applications](https://discord.com/developers/applications)**,
   **New Application**, donne-lui un nom, accepte, **Create**.
3. Menu de gauche › **OAuth2** :
   - **Redirects** › **Add Redirect** › colle la Callback URL › **Save Changes** ;
   - copie le **Client ID** ;
   - **Reset Secret** › confirme › copie le **Client Secret**.
4. Retour dans Supabase : colle le Client ID et le Client Secret, puis **Save**.

Dans l'onglet **General Information** de l'application Discord, mets l'icône
`assets/icon-512.png` et le nom du jeu : c'est ce que les joueurs verront sur
l'écran d'autorisation.

---

## Étape 5 bis — L'inscription par adresse *(facultative, déconseillée)*

Le code sait encore inscrire par adresse e-mail, mais elle est fermée
(`CONNEXION.email = false`). Et tant que `PORTE.active` vaut `true`, l'écran
d'entrée ne propose de toute façon que Discord : l'inscription par adresse
ne s'affiche que si le jeu est ouvert à tous.

Si tu la rouvres (`email: true` dans `CONNEXION`, et le fournisseur **Email**
activé dans Supabase) :

1. Supabase › **Authentication › Sign In / Providers › Email** : vérifie que
   **Confirm email** est **activé**. Sans lui, n'importe quelle adresse
   inventée passe.
2. Branche ton propre expéditeur : **Authentication › Emails › SMTP Settings**
   ([Resend](https://resend.com) ou [Brevo](https://www.brevo.com), par exemple).
   L'expéditeur fourni par Supabase est bridé à quelques courriels par heure :
   des joueurs ne recevraient jamais leur lien.

`CONNEXION` n'est qu'un affichage : ce sont les fournisseurs activés dans
Supabase qui décident vraiment. Les deux doivent être d'accord.

---

## Étape 6 — T'inviter, puis te connecter

La bêta est fermée pour toujours (`beta_lancement()` vaut `'infinity'`).
Toute action du jeu d'un compte absent de `beta_invites` est refusée par le
serveur (`BETA_FERMEE`, affiché « Le jeu n'est pas encore ouvert. »).
**Même l'administrateur doit y figurer.**

1. Supabase › **SQL Editor** › **New query**. Colle ceci, avec **l'adresse
   e-mail de ton compte Discord** (ou ton identifiant Discord) :

```sql
insert into public.beta_invites (cle, note) values ('ton.adresse@exemple.com', 'moi')
on conflict (cle) do update set note = excluded.note;
```

2. **Run**.
3. Ouvre le jeu, clique **« J'ai déjà un accès »**, autorise Discord. Ton
   profil est créé au retour, et tu arrives dans le jeu.

**Trouver son identifiant Discord** : dans Discord, Paramètres › Avancés ›
Mode développeur, puis clic droit sur ton nom › Copier l'identifiant.
L'identifiant est plus sûr que l'adresse si tu ne sais plus laquelle est liée
à ton compte Discord.

**Si l'écran dit « <ton pseudo> n'a pas d'accès au jeu »**, avec un champ
pour un code d'invitation : ton compte existe, mais la clé ne correspond pas.
Lance la partie 1 de `supabase/administration/beta.sql` (« Qui est déjà
entré ») : elle montre l'adresse et l'identifiant Discord de chaque compte, et
s'il est invité. Corrige la clé, puis recharge.

---

## Étape 7 — Te donner les droits d'administrateur

L'onglet **Labo** n'existe que pour les administrateurs. Le drapeau
`is_admin` ne se pose qu'en SQL : aucune action du jeu ne l'expose.

1. Connecte-toi une première fois (étape 6) : le profil doit exister.
2. Ouvre **`supabase/administration/admin.sql`**, remplace l'adresse
   d'exemple par celle de ton compte, colle le tout dans le **SQL Editor**,
   puis **Run**. La dernière requête liste les administrateurs : tu dois y
   être.
3. Recharge le jeu. **Labo** apparaît dans le menu du compte (on l'ouvre en
   touchant son avatar sur téléphone ; sur ordinateur, il est dans le rail de
   droite).

Pour retirer les droits à quelqu'un, la requête est en bas du même fichier.

---

## Étape 8 — Inviter des testeurs

Deux façons.

**Par la liste, en SQL.** `supabase/administration/beta.sql` ne se joue
**pas** en entier : seule la partie 1 (l'état des lieux) est active. Les
autres sont en commentaire : décommente la ligne voulue, complète-la, et
lance-la seule.

| Partie | Ce qu'elle fait |
|---|---|
| 1 | Liste les comptes, leur adresse, leur identifiant Discord, et s'ils sont invités |
| 2 | Invite par adresse e-mail ou par identifiant Discord (l'un suffit) |
| 3 | Invite d'un coup tous les comptes déjà créés |
| 4 | Retire une invitation (le compte, lui, reste) |
| 5 | Un compte de trop : le vider (`reset-profil.sql`) ou le supprimer |

**Par un code, dans le jeu.** Un joueur invité achète une **Invitation** en
boutique (2 000 Éclats, trois par joueur). Il reçoit un code `M8-XXXX-XXXX`,
valable une fois, et un lien `/?invitation=CODE`. Son ami se connecte avec
Discord et le code s'applique tout seul (ou il le saisit sur l'écran « n'a
pas d'accès au jeu »). L'invité entre avec 10 boosters et 1 000 Éclats.
**Un invité par code ne peut pas inviter à son tour.**

---

## Étape 9 — Tout vérifier avec `verif.html`

Ouvre `http://localhost:8781/verif.html`. Elle ne modifie rien et contrôle,
dans l'ordre :

1. les deux clés (et te prévient si c'est la clé secrète) ;
2. que le projet répond ;
3. le réglage des inscriptions ;
4. la connexion Discord ;
5. le catalogue ;
6. les actions du jeu (`me`) ;
7. les fonctions plus récentes : écran d'entrée, boîte de réception,
   recyclage, fabrication, classement, historique ;
8. la 3.0 : Combats, défis, Choc, Raid, maîtrise ;
9. les adresses de retour (à vérifier à la main : elle ne peut pas les lire) ;
10. ton compte, et s'il est administrateur (connecte-toi d'abord au jeu, dans
    le même navigateur).

**Les chiffres attendus** au point 5 : « 122 cartes d'extension et 106
autres cartes », 97 quêtes, 32 articles. Les 106, ce sont toutes les cartes
qui portent `promo = true` dans la base : 6 Promos, 85 Reverses, 9 Essences
Brillantes, 5 Secrètes et la carte unique.

Le point 9 reste toujours orange : c'est un rappel, pas une erreur.

---

## Étape 10 — Publier le site

Jusqu'ici, tout tournait sur ton ordinateur.

> **Pas dans le dépôt du projet.** Sur ce dépôt, `main` est le vrai site
> (`matetcg.com`) : on n'y pousse rien d'autre que `preprod/` (README § 2.5),
> et la branche de travail ne s'y fusionne jamais. Pour héberger ta copie,
> utilise **ton propre dépôt** (une copie du projet sur ton compte GitHub).

1. Dans ta copie :
   - **supprime le fichier `CNAME`** (il désigne `matetcg.com`), ou mets-y ton
     propre domaine ;
   - si tu publies ailleurs que sur `localhost` ou une adresse
     `*.github.io`, mets ton adresse dans **`SITE_URL`** (`js/config.js`).
     Sinon, le retour de Discord renvoie les joueurs sur `matetcg.com`
     (`retourURL()`, `js/backend.js`) ;
   - n'ajoute pas de fichier `.nojekyll` : il ferait publier `_demo/` et
     `_sources/`.
2. Pousse ta copie sur GitHub.
3. Sur GitHub, ton dépôt › **Settings** › **Pages**. **Source** :
   `Deploy from a branch`, puis la branche qui porte le code, dossier
   `/ (root)`. **Save**.
4. Attends une à deux minutes : GitHub affiche l'adresse du site.
5. **Retourne à l'étape 4** : ajoute cette adresse en **Site URL**, et la
   même suivie de `/**` dans **Redirect URLs**. Garde `localhost` à côté.
6. Ouvre `<ton-adresse>/verif.html`.

L'installation sur l'écran d'accueil et le service worker exigent **HTTPS**
(GitHub Pages le fournit).

---

## Brancher un nom de domaine

Le jeu fonctionne sans. Cette section sert le jour où tu veux une vraie
adresse.

### 1. Chez ton registrar (exemple : Namecheap)

*Domain List* › **Manage** › onglet **Advanced DNS**.

**D'abord, supprime les enregistrements de parking** posés par le registrar,
sinon les tiens n'auront aucun effet : l'`A Record` `@` vers une adresse du
registrar, le `CNAME Record` `www` vers sa page de parking, toute
`URL Redirect Record`. Un `TXT` de courrier (`v=spf1 …`) peut rester.

**Puis ajoute ces cinq lignes :**

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `185.199.108.153` | Automatic |
| A Record | `@` | `185.199.109.153` | Automatic |
| A Record | `@` | `185.199.110.153` | Automatic |
| A Record | `@` | `185.199.111.153` | Automatic |
| CNAME Record | `www` | `<ton-compte>.github.io.` | Automatic |

Les quatre adresses sont celles de GitHub Pages. Le `CNAME` du `www` pointe
vers ton compte GitHub, pas vers ton dépôt. Compte de quelques minutes à
quelques heures avant que ça circule.

### 2. Sur GitHub

*Settings* › **Pages** › **Custom domain** : ton domaine, puis **Save**. Tant
que le DNS n'est pas propagé, GitHub affiche une erreur : reviens plus tard.
Une fois la vérification passée, coche **Enforce HTTPS** (la case peut rester
grisée jusqu'à une heure).

GitHub écrit alors un fichier `CNAME` à la racine du dépôt : c'est lui qui
retient le domaine, **ne le supprime plus**.

### 3. Dans Supabase

*Authentication* › **URL Configuration** :

- **Site URL** : `https://tondomaine.com` ;
- **Redirect URLs** : ajoute `https://tondomaine.com/**` et
  `https://www.tondomaine.com/**`. Garde l'ancienne adresse GitHub pendant la
  transition, et `http://localhost:8781/**` pour développer.

### 4. Dans le jeu

Mets ton domaine dans `SITE_URL` (`js/config.js`), et dans les balises de
partage en haut d'`index.html` (`canonical`, `og:url`, `og:image`) : Discord
et les réseaux veulent des adresses complètes pour l'image d'aperçu.

`SITE_URL` ne s'applique ni sur `localhost` ni sur `*.github.io` : là, la
connexion Discord revient là d'où l'on est parti.

L'adresse de retour enregistrée chez Discord pointe vers Supabase, pas vers
ton site : elle ne bouge pas quand tu changes de domaine.

---

## Après : régler le jeu

Tout ce qui compte vit sur le serveur. **Rejoue toujours `TOUT.sql` en
entier** : certains fichiers, rejoués seuls, remplacent des fonctions par des
versions incomplètes (`03_rpc.sql` ou `06_social.sql` remplacent `me()` et
`player_profile()` par des versions courtes).

La marche à suivre : modifier le fichier de `supabase/installation/`, lancer
`python3 tools/build-sql.py`, recoller `supabase/TOUT.sql` dans le **SQL
Editor**, **Run**.

| Quoi | Où |
|---|---|
| Rythme et plafond de la réserve, délai entre deux échanges, chance de godpack, d'Essence Brillante et de carte unique, palier des Promos, recyclage et fabrication | `cfg()` dans `01_schema.sql` |
| Composition d'un booster et taux de la dernière carte | `open_pack()` dans `03_rpc.sql` |
| Quêtes et boutique | `04_seed.sql` |
| Cartes Promo, Reverses, Brillantes, carte unique | `03b_promos.sql` |

> **Une règle a trois copies** : le SQL (qui fait foi), le faux serveur de la
> pré-prod (`_demo/serveur.js`) et une constante du navigateur (affichage,
> Labo). Les taux de tirage, par exemple, sont dans `open_pack()`, dans
> `RATES` et `GOD` (`js/booster.js`) et dans `tirerPaquet()`
> (`_demo/serveur.js`). Change les trois ensemble (README § 9.8).
>
> **Les listes `delete … not in (…)`** de `04_seed.sql` effacent toute quête
> ou tout article qu'elles ne citent pas, avec sa progression. Une quête ou un
> article ajouté doit y entrer.

Le raisonnement derrière les valeurs (combien de boosters pour compléter la
collection, combien d'Éclats par jour, pourquoi une Promo coûte 5 000 Éclats)
est écrit en tête de `04_seed.sql`, et pour la 3.0 dans
`docs/economie-3.0.md`. Lis-le avant de changer un chiffre : ils se tiennent
les uns les autres.

### Les événements

Un événement est une ligne de la table `evenements` (README § 8). Les
commandes se jouent dans le **SQL Editor** :

```sql
-- Arrêter Reflets (créé par l'installation) sans montrer son récap :
update public.evenements
   set debut = now() - interval '4 days', fin = now() - interval '3 days'
 where code = 'reflets';

-- Ouvrir « Le Choc des Sections », l'événement de la 3.0, pour trois semaines :
insert into public.evenements (titre, texte, debut, fin, code) values (
  'Le Choc des Sections',
  'La version 3.0 : le Raid contre The French Sorcerer et l''Épreuve du jour.',
  now(), now() + interval '21 days', 'choc');

-- Ouvrir la chasse à la carte unique :
update public.chasse set active = true, ouvre_le = now() where id = 1;
```

Ne réutilise jamais le code d'un événement passé : ses soldes, son Pass et
ses quêtes sont rangés sous ce code. D'autres requêtes sont en fin de
`15_evenements.sql` et de `25_choc.sql`.

Le Raid se règle sans rien redéployer : ses seuils sont multipliés par
`raid_echelle` (1 par défaut). Pour un petit serveur :
`update public.parametres set raid_echelle = 0.5 where id = 1;`

### Quand tu ajoutes ou retires une carte

Le serveur tire les boosters dans **sa** liste de cartes. Après avoir touché
à `js/cards-data.js` :

```bash
python3 tools/gen-cards-sql.py     # écrit supabase/installation/02_cards.sql
node tools/illu-pixels.js          # écrit supabase/installation/21b_illu.sql (Devine l'illu)
python3 tools/build-sql.py         # réassemble supabase/TOUT.sql
```

Puis recolle `supabase/TOUT.sql` dans le **SQL Editor**. Sans ça, les
nouvelles cartes ne sortiront jamais d'un booster. `illu-pixels.js` a besoin
de Node et de Playwright (`npm i -g playwright`), car c'est Chromium qui lit
les images `.avif`. Les numéros 123 à 127 sont pris par les Secrètes.

### Remettre à zéro

Dans `supabase/administration/`, deux scripts écrits pour la 3.0, à coller
dans le **SQL Editor** :

- **`reset-profil.sql`** : remet **un** joueur à zéro (son pseudo est à
  écrire à deux endroits). Il garde le compte, le pseudo, les amis et les
  droits ;
- **`reset-tout.sql`** : remet **tout le monde** à zéro, le jour d'un vrai
  lancement. Il exige une confirmation écrite. Ferme le site et fais une
  sauvegarde avant (Supabase › **Database › Backups**).

Les deux refusent de tourner si une table qui appartient à un joueur leur
est inconnue. Leur en-tête dit exactement ce qui est effacé et ce qui est
gardé.

### Ouvrir le jeu à tous

Il faut les deux :

1. `PORTE.active` à `false` dans `js/gate.js` (l'annonce d'arrêt disparaît,
   l'écran de connexion la remplace) ;
2. une date passée dans `beta_lancement()` (`01_schema.sql`), puis
   `python3 tools/build-sql.py` et `TOUT.sql` rejoué. Passé cette date,
   `beta_invites` n'est plus consultée.

L'un sans l'autre ne suffit pas : l'écran seul n'est pas une serrure, et le
serveur seul n'enlève pas l'annonce.

---

## Est-ce que ça tiendra la charge ?

Pour un petit serveur, oui, très largement.

- **Le site** pèse surtout ses images de cartes : environ 15 Mo pour les
  127 cartes. Un joueur ne les télécharge qu'une fois, au fil de sa
  collection ; le service worker les garde ensuite.
- **La base** stocke du texte : quelques Ko par joueur, et un peu plus par
  booster ouvert (l'historique des tirages).
- **Le trafic** vers Supabase, c'est aussi du texte.

Les limites des offres gratuites de GitHub Pages et de Supabase changent :
vérifie-les sur leurs pages de tarifs. Ce guide ne les a pas mesurées en
charge réelle.

---

## Si ça coince

**Commence toujours par `verif.html`** : chaque point qui ne va pas dit quoi
faire.

| Ce que tu vois | Ce que c'est |
|---|---|
| L'annonce « Projet annulé · Merci » **sans** le lien « J'ai déjà un accès » | Le site n'a pas de serveur : les clés de l'étape 3 manquent ou sont mal formées, ou la bibliothèque Supabase n'a pas pu se charger (pas de réseau). |
| « <pseudo> n'a pas d'accès au jeu », avec un champ de code | Le compte n'est pas dans `beta_invites`, ou la clé ne correspond pas à son adresse ni à son identifiant Discord (étape 6). |
| De retour de Discord : « Ce compte n'a pas encore accès au jeu. Rendez-vous à l'ouverture ! » | Supabase a renvoyé une erreur au retour de Discord. Ce message s'affiche pour **toute** erreur de retour ; depuis que tout compte est créé, même non invité, la cause est probablement un réglage : Client ID ou Secret (étape 5), Callback URL, adresses de retour (étape 4). |
| Le retour de Discord tombe sur `matetcg.com` | `SITE_URL` n'a pas été changé (étape 10). |
| « Le serveur ne répond pas pour le moment » | Le projet s'est endormi (réveille-le depuis le tableau de bord), ou `TOUT.sql` n'est pas installé. |
| « Le jeu n'est pas encore ouvert. » sur une action | Le serveur refuse ce compte (`BETA_FERMEE`) : il n'est pas invité (étape 6). |
| Le Labo n'apparaît pas | `admin.sql` n'a pas été lancé, ou pas avec l'adresse du compte (étape 7). Recharge après l'avoir lancé. |
| Un onglet « Reflets » en tête du menu du compte | Normal : l'installation ouvre cet événement pour 14 jours. Pour l'arrêter : « Les événements », plus haut. |
| Les nouvelles cartes ne sortent jamais des boosters | Le catalogue du serveur est en retard : « Quand tu ajoutes ou retires une carte ». |
| « Ce pseudo est déjà pris. » | Il l'est (les majuscules ne comptent pas). |
| « Pseudo invalide : 3 à 16 caractères, lettres, chiffres, . _ - » | Le pseudo sort de ces règles. |
| Le site n'a pas changé après un `git push` | GitHub Pages publie en une à deux minutes et garde ses fichiers en cache une dizaine de minutes ; le service worker garde aussi les siens. Recharge en forçant (`Ctrl+Shift+R`, ou `Cmd+Shift+R`). Pour une vraie mise à jour, change la version : `python3 tools/version.py X.Y.Z` (README § 2.4). |
| Le domaine affiche la page de parking du registrar | Ses enregistrements de parking n'ont pas été supprimés : ils passent avant les tiens. |
| GitHub refuse le domaine : « DNS check unsuccessful » | Le DNS n'a pas fini de circuler. Réessaie dans une heure. |
