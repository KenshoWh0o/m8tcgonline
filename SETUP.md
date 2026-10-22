# Mettre le jeu en ligne — guide pas à pas

Ce guide part du principe que tu n'as jamais fait ça. Rien à installer, rien à
programmer : **tu vas cliquer, copier et coller.** Compte une demi-heure tranquille.

À la fin, le jeu aura des vrais comptes, la collection sera sauvegardée en ligne, et les
échanges entre joueurs marcheront.

**Une page t'accompagne :** ouvre `verif.html` du site à n'importe quel moment. Elle
contrôle tout et dit en clair ce qui est fait et ce qu'il reste. Quand tu doutes, va la
voir.

---

## Avant de commencer — trois choses à savoir

**Tu n'as pas besoin d'héberger le site pour faire ce guide.** Tout marche depuis ton
Mac. Lance cette commande dans le dossier du jeu :

```bash
python3 -m http.server 8765
```

Puis ouvre `http://localhost:8765` dans ton navigateur. Laisse la commande tourner tant
que tu développes ; pour l'arrêter, `Ctrl+C`.

**Tu n'as pas besoin de payer.** Tout ce qui suit est gratuit, sans carte bancaire.

**Tu ne peux rien casser.** Le jeu fonctionne déjà tout seul en mode hors ligne. Si une
étape échoue, tu reviens simplement à l'état d'avant.

> Supabase change parfois le nom de ses menus d'une version à l'autre. Si tu ne trouves
> pas exactement le libellé indiqué, cherche le mot le plus important — *Authentication*,
> *Providers*, *API* — il est toujours là, éventuellement rangé autrement.

---

## Étape 1 — Créer le projet Supabase

Supabase, c'est le serveur du jeu : il garde les comptes et les collections. Tu n'auras
rien à administrer, juste à le créer.

1. Va sur **[supabase.com](https://supabase.com)** et clique **Start your project**.
2. Connecte-toi avec GitHub (tu as déjà un compte, c'est le plus rapide).
3. Clique **New project**.
4. Remplis :
   - **Name** : `mate-tcg`
   - **Database Password** : clique **Generate a password**, puis **copie-le quelque part**.
     Tu n'en auras pas besoin pour ce guide, mais il ne se réaffiche jamais.
   - **Region** : `West EU (Ireland)` ou `Central EU (Frankfurt)` — au plus près des joueurs.
5. Clique **Create new project**, et laisse-le se monter (une à deux minutes).

> **Bon à savoir :** un projet gratuit s'endort après une semaine sans activité. Il suffit
> de le rouvrir depuis le tableau de bord pour le réveiller. Ça ne supprime rien.

---

## Étape 2 — Installer la base (un seul copier-coller)

C'est l'étape qui fait tout le travail : elle crée les tables, les règles de sécurité et
toutes les actions du jeu.

1. Dans Supabase, colonne de gauche, clique **SQL Editor** (icône `>_`).
2. Clique **New query** en haut.
3. Ouvre le fichier **`supabase/TOUT.sql`** du dossier du jeu, sélectionne **tout**
   (`Cmd+A`), copie (`Cmd+C`).
4. Colle dans la grande zone de Supabase (`Cmd+V`).
5. Clique **Run** en bas à droite (ou `Cmd+Entrée`).

**Ce que tu dois voir :** `Success. No rows returned`, en bas.

**Si tu vois du rouge :** copie le message d'erreur et envoie-le-moi, il dit exactement ce
qui coince. Tu peux relancer ce fichier autant de fois que tu veux, ça ne crée pas de
doublons.

---

## Étape 3 — Brancher le jeu sur le serveur

1. Dans Supabase, colonne de gauche, tout en bas : **Settings** (la roue dentée).
2. Clique **API**.
3. Tu vois deux choses à copier :
   - **Project URL** — ressemble à `https://abcdefgh.supabase.co`.
     Si Supabase t'affiche plutôt une adresse finissant par `/rest/v1/`, **enlève cette
     partie** : on ne garde que jusqu'au `.co`.
   - **La clé publique.** Selon l'âge du projet, elle s'appelle :
     - **Publishable key**, et commence par `sb_publishable_` *(projets récents)*
     - ou **`anon` `public`**, et commence par `eyJ` *(projets plus anciens)*

     Les deux se collent au même endroit, ça ne change rien.
4. Ouvre le fichier **`js/supabase-config.js`** du dossier du jeu et colle les deux valeurs
   entre les apostrophes :

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xxxxxxxxxxxxxxxx';
```

5. Recharge `http://localhost:8765`. **L'écran de connexion doit apparaître.**

> ⚠️ **Ne copie jamais la clé secrète.** Elle est juste en dessous, et s'appelle
> **Secret key** (`sb_secret_…`) ou **`service_role`** (`eyJ…`). Elle contourne toutes les
> sécurités, et ce fichier part en ligne avec le site. La clé publique, elle, est faite
> pour être publique : elle n'ouvre que ce que les règles autorisent.
>
> **Si tu as exposé une clé secrète par accident** (collée dans un fichier, un message, une
> capture d'écran) : Supabase › **Settings › API Keys**, et révoque-la. Tant qu'elle n'est
> pas révoquée, elle reste valable pour qui la possède.
>
> La page `verif.html` te prévient si tu te trompes de clé.

**Va voir `http://localhost:8765/verif.html`** : les trois premiers points doivent être
verts.

---

## Étape 4 — Dire au serveur où renvoyer les gens

Quand quelqu'un clique le lien reçu par courriel, le serveur doit savoir vers quelle page
le renvoyer. Sans ça, le lien tombe dans le vide.

1. Supabase › **Authentication** › **URL Configuration**.
2. **Site URL** : l'adresse publique du jeu. Pour l'instant, mets
   `http://localhost:8765`.
3. **Redirect URLs** › **Add URL**, une par ligne :
   ```
   http://localhost:8765/**
   ```
   Et, le jour où tu publies, ajoute aussi l'adresse en ligne avec `/**` à la fin.
4. **Save**.

Les deux étoiles à la fin veulent dire « et tout ce qui suit ».

---

## Étape 5 — La connexion Discord

**C'est la seule méthode de connexion ouverte par défaut** (réglage `CONNEXION` en haut de
`js/config.js`). Pas de courriel à envoyer, donc aucun joueur bloqué faute d'avoir reçu son
lien — et le pseudo comme l'avatar arrivent tout faits.

1. Supabase › **Authentication › Sign In / Providers › Discord** : active-le.
   Il affiche alors une **Callback URL** — copie-la.
2. Va sur **[discord.com/developers/applications](https://discord.com/developers/applications)**,
   **New Application**, nomme-la `Mate TCG Online`, accepte, **Create**.
3. Menu de gauche › **OAuth2** :
   - **Redirects** › **Add Redirect** › colle la Callback URL › **Save Changes**
   - copie le **Client ID**
   - **Reset Secret** › **Yes, do it!** › copie le **Client Secret**
4. Retour dans Supabase : colle le Client ID et le Client Secret, puis **Save**.

Onglet **General Information** de l'application Discord : mets-y l'icône
`assets/icon-512.png` et le nom du jeu. C'est ce que les gens verront sur l'écran
d'autorisation.

---

## Étape 5 bis — L'inscription par adresse *(facultative)*

Le jeu ne la propose pas. Pour la rouvrir, passe `email` à `true` dans `CONNEXION`
(`js/config.js`) — l'écran de connexion s'adapte tout seul.

Si tu le fais, lis ce qui suit.

1. Supabase › **Authentication › Sign In / Providers › Email**.
2. Vérifie que **Confirm email** est **activé** : c'est ce qui oblige à cliquer le lien
   reçu avant de pouvoir jouer. Sans ça, n'importe quelle adresse inventée passerait.

> 🔴 **Le point qui lâche en premier.** L'expéditeur fourni par Supabase est bridé à
> **quelques courriels par heure**. Ça suffit pour se tester seul, pas pour dix joueurs qui
> s'inscrivent le même soir. Avant de partager le lien, va dans
> **Authentication › Emails › SMTP Settings** et branche ton propre expéditeur
> ([Resend](https://resend.com) ou [Brevo](https://www.brevo.com), gratuits tous les deux).
> Sans ça, des gens ne recevront jamais leur lien et croiront que le site est cassé.
>
> **C'est précisément ce problème que la connexion Discord seule fait disparaître.**
>
> Tant que tu y es, **Authentication › Emails** te laisse traduire les messages en
> français et y mettre ton logo.

---

## Étape 6 — Créer ton compte et te donner les droits d'administrateur

Ouvre le jeu, clique **Continuer avec Discord**, autorise. Ton profil est créé.

Puis :

L'onglet **Labo** n'existe que pour les administrateurs. Maintenant que ton compte
existe, donne-toi les droits.

1. Supabase › **SQL Editor** › **New query**.
2. Colle ceci, en remplaçant l'adresse par la tienne :

```sql
update public.profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('ton.adresse@exemple.com');
```

3. **Run**. Tu dois voir `Success`.
4. Recharge le jeu : **Labo** apparaît dans le menu du compte.

Pour donner l'accès à quelqu'un d'autre, remplace l'adresse et relance.

---

## Étape 7 — Changer de méthode de connexion plus tard

Tout tient dans une ligne, en haut de `js/config.js` :

```js
const CONNEXION = { discord: true, email: false };
```

Passe `email` à `true` pour rouvrir l'inscription par adresse (et lis l'étape 5 bis), ou
`discord` à `false` pour la fermer. L'écran de connexion se redessine tout seul, il n'y a
rien d'autre à toucher.

> Ce réglage n'est qu'un affichage : c'est Supabase qui décide vraiment, via les
> fournisseurs activés dans **Authentication › Sign In / Providers**. Les deux doivent
> être d'accord.

---

## Étape 8 — Publier le site

Jusqu'ici tout tournait sur ton Mac. Pour que d'autres puissent jouer :

1. Dans le dossier du jeu :
   ```bash
   git add -A && git commit -m "Mate TCG Online v2" && git push
   ```
2. Sur GitHub, ton dépôt › **Settings** › **Pages**.
3. **Source** : `Deploy from a branch`. **Branch** : `main`, dossier `/ (root)`. **Save**.
4. Attends deux minutes. GitHub affiche l'adresse du site en haut de la page.
5. **Retourne à l'étape 4** et ajoute cette adresse en **Site URL**, plus la même avec
   `/**` dans **Redirect URLs**. Garde `localhost` à côté pour continuer à développer.
6. Ouvre `<ton-adresse>/verif.html` : tout doit être vert.

### Est-ce que ça tiendra la charge ?

Oui, très largement. Pour 200 joueurs :

| | Consommation | Limite |
|---|---|---|
| GitHub Pages | ~14 Mo par joueur qui complète la collection, une seule fois (les images se chargent au fur et à mesure, puis restent en cache) · soit ~3 Go/mois | 100 Go/mois |
| Supabase — base | quelques Ko par joueur | 500 Mo |
| Supabase — trafic | négligeable (du texte, pas d'images) | 5 Go/mois |
| Supabase — comptes | 200 | 50 000 |

Tu es à environ **3 % de la limite la plus serrée**. Il faudrait quelques milliers de
joueurs très actifs avant d'avoir à changer quoi que ce soit. Le seul point qui lâche
avant tout le reste, c'est l'envoi des courriels — voir l'étape 5.

---

## Brancher un nom de domaine

Le jeu fonctionne sans. Cette section sert le jour où tu veux une vraie adresse.

### 1. Chez ton registrar (exemple : Namecheap)

*Domain List* › **Manage** › onglet **Advanced DNS**.

**D'abord, supprime les enregistrements de parking** que le registrar a posés tout
seul — sans ça, les tiens n'auront aucun effet :

- `A Record` `@` vers une adresse du registrar
- `CNAME Record` `www` vers `parkingpage.namecheap.com`
- toute `URL Redirect Record`

Un `TXT` de courrier (`v=spf1 …`) peut rester : il ne gêne pas le site.

**Puis ajoute ces cinq lignes :**

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `185.199.108.153` | Automatic |
| A Record | `@` | `185.199.109.153` | Automatic |
| A Record | `@` | `185.199.110.153` | Automatic |
| A Record | `@` | `185.199.111.153` | Automatic |
| CNAME Record | `www` | `kenshowh0o.github.io.` | Automatic |

Les quatre adresses sont celles de GitHub Pages, identiques pour tout le monde. Le
`CNAME` du `www` renvoie vers ton compte GitHub, pas vers ton dépôt.

Compte de quelques minutes à quelques heures avant que ça circule.

### 2. Sur GitHub

*Settings* › **Pages** › **Custom domain** : ton domaine, puis **Save**. GitHub
vérifie le DNS ; tant qu'il n'est pas propagé, il affiche une erreur — c'est normal,
il suffit de revenir plus tard.

Une fois la vérification passée, coche **Enforce HTTPS**. La case peut rester grisée
jusqu'à une heure, le temps que le certificat soit émis.

GitHub ajoute alors un fichier `CNAME` à la racine du dépôt : c'est lui qui retient le
domaine, **ne le supprime pas**.

### 3. Dans Supabase

*Authentication* › **URL Configuration** :

- **Site URL** : `https://tondomaine.com`
- **Redirect URLs** : ajoute `https://tondomaine.com/**` et
  `https://www.tondomaine.com/**`. Garde l'ancienne adresse GitHub pendant la
  transition, et `http://localhost:8765/**` pour développer.

### 4. Dans le jeu

Renseigne `SITE_URL` en haut de `js/config.js`, et mets à jour les balises de partage
en haut de `index.html` (`og:url`, `og:image`, `twitter:image`, `canonical`) : Discord
et Twitter veulent des adresses complètes pour l'image d'aperçu, un chemin relatif ne
suffit pas toujours.

`SITE_URL` ne s'applique pas sur `localhost` ni sur `*.github.io` : la connexion
Discord continue de revenir là d'où tu es parti quand tu développes.

### Rien à changer côté Discord

L'adresse de retour de Discord pointe vers Supabase, pas vers ton site. Elle ne bouge
pas quand tu changes de domaine.

---

## Après : régler le jeu sans rien redéployer

Tout ce qui touche à l'équilibrage vit sur le serveur. Tu le modifies dans le **SQL
Editor**, et c'est pris en compte immédiatement, sans toucher au site.

| Quoi | Où |
|---|---|
| Rythme de recharge, plafond de la réserve, délai entre deux échanges, chance de godpack, palier des Promos | fonction `cfg()` dans `supabase/01_schema.sql` |
| Composition d'un booster et taux de la dernière carte | fonction `open_pack()` dans `supabase/03_rpc.sql` |
| Quêtes : objectifs et récompenses | `supabase/04_seed.sql` |
| Boutique : articles et prix | `supabase/04_seed.sql` |
| Cartes Promo : catalogue et paliers d'obtention | `supabase/03b_promos.sql` |
| L'Échauffement (2.1.4) : dates de la saison, défis, indices | tables `ech_saison`, `ech_defis`, `ech_indices` (`supabase/22b_echauffement.sql`) ; la requête des dates est aussi dans le Labo |
| Fin du récap d'un événement | colonne `recap_jusqua` de `evenements` (vide : trois jours après la fin) |

Modifie le fichier, colle-le dans le SQL Editor, **Run**. C'est tout.

> **`TOUT.sql` se rejoue autant de fois qu'on veut.** Chaque ligne est mise à
> jour si elle existe déjà, et le ménage du catalogue épargne les cartes Promo —
> elles sont créées par un autre fichier, et deux d'entre elles sont vendues en
> boutique. Sans ce garde-fou, la deuxième exécution s'arrêtait sur
> `violates foreign key constraint "shop_items_carte_id_fkey"`.
>
> Si une exécution échoue quand même, relance-la après correction : l'éditeur SQL
> de Supabase joue le script d'un bloc, donc un échec annule tout ce qui
> précède. Puis ouvre `verif.html` pour contrôler l'état réel de la base.

> Le raisonnement derrière les valeurs actuelles — combien de boosters pour
> compléter la collection, combien d'Éclats par jour, pourquoi une carte Promo
> coûte 10 000 — est écrit en tête de `supabase/04_seed.sql`. Lis-le avant de
> changer un chiffre : ils se tiennent les uns les autres.

> **Deux endroits pour les taux de tirage.** `open_pack()` fait le vrai tirage ;
> `RATES` dans `js/booster.js` ne sert qu'aux ouvertures de test du Labo. Si tu
> changes l'un, change l'autre, sinon le Labo montre autre chose que le jeu.

### Quand tu ajoutes ou retires une carte

Le serveur tire les boosters dans **sa** liste de cartes. Après avoir touché à
`js/cards-data.js` :

```bash
python3 supabase/gen-cards-sql.py && python3 tools/build-sql.py
```

Puis recolle `supabase/TOUT.sql` dans le SQL Editor. Sans ça, les nouvelles cartes ne
sortiront jamais d'un booster.

---

## Si ça coince

**Commence toujours par `verif.html`.** Elle dit lequel des huit points ne va pas.

| Ce que tu vois | Ce que c'est |
|---|---|
| « Serveur injoignable : tu joues hors ligne » | L'adresse ou la clé de l'étape 3 sont fausses, ou le projet Supabase s'est endormi — rouvre-le depuis le tableau de bord. |
| Le lien du courriel donne une page blanche | Les adresses de l'étape 4 ne correspondent pas à l'adresse réelle du site. |
| Aucun courriel ne part | La limite de l'expéditeur Supabase est atteinte. Attends une heure, ou branche ton propre SMTP (étape 5). |
| « La connexion Discord n'est pas activée » | L'étape 7 n'est pas finie, ou le Client Secret a été régénéré sans être recollé. |
| Les boosters ne donnent que des communes | La liste de cartes du serveur est en retard : voir « Quand tu ajoutes une carte ». |
| « Ce pseudo est déjà pris » | Il l'est vraiment (les majuscules ne comptent pas), ou il sort de 3 à 16 caractères : lettres, chiffres, point, tiret, souligné. |
| Le site n'a pas changé après un `git push` | GitHub Pages met une à deux minutes. Ensuite, recharge en forçant : `Cmd+Shift+R`. |
| Le domaine perso affiche la page de parking du registrar | Ses enregistrements de parking n'ont pas été supprimés : ils passent avant les tiens. |
| GitHub refuse le domaine : « DNS check unsuccessful » | Le DNS n'a pas fini de circuler. Réessaie dans une heure. |
