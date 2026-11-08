# Feuille de route

> **Ce fichier existe en deux copies identiques**, une sur `version-3.0` et une à la racine de `main` (la branche `version-2.5`, qui la portait, a été supprimée par le propriétaire le 2 novembre 2026). Toute modification se fait aux deux endroits, dans la même session : copier le fichier (`git show origin/version-3.0:docs/feuille-de-route.md > docs/feuille-de-route.md` dans un clone de `main`, ou l'inverse), puis vérifier que `git diff origin/main origin/version-3.0 -- docs/feuille-de-route.md` est vide une fois les deux poussées. Ni l'une ni l'autre n'est publiée sur matetcg.com depuis le 2 novembre 2026 (`_config.yml`).

Mise à jour : mardi 3 novembre 2026 (la 3.0.16).

## 1. Ce que le propriétaire a dicté

Mot pour mot. Rien de ce qui suit n'est à faire sans sa demande : c'est une trace, pas un ordre de travail.

**Le 23 octobre 2026 :**

> **2.5 (dimanche soir minuit)** : rajout de quelques petits trucs pour pas tourner uniquement la version autour de l'event, event échauffement, pendant 7 jours, puis continuité de l'event en mode infini et avec moins de récompense (mais pas comme devine l'illu, ça reste un event) du temps qu'on pourra pas publier la 3.0, puis dès qu'on sait la date de sortie de celle-ci on commencera le teasing final avant de faire une maintenance et faire l'update
>
> **3.0** : peaufinage de l'onglet d'event et globalement de l'interface, intégration des VRAIES règles de combat (lorsqu'on les aura), intégration des visuels des P03/P04, refonte des icones du site bannière etc en accord avec la nouvelle DA,…

Le « … » final est du propriétaire : la liste de la 3.0 n'est pas close.

**Le 24 octobre 2026 :**

> tu as mon accord pour coller MAJ-2.5.sql
>
> pour le mode infini de l'échauffement, il commence le 4 novembre après le rattrapage. en gros, il y aura la page de récap d'event sur l'onglet booster (comme actuellement pour reflets), et dans l'onglet combat le mode infini (ça sera expliqué dans un pop-up et dans l'onglet de récap).
>
> on y joue des adversaires plus ou moins durs, je te laisse t'en occuper. mais pas de difficulté croissante comme sur l'event du coup.
>
> il rapporte des récompenses équilibrées, comme le devine l'illu devenu permanent
>
> en fait y a un problème là, la 2.5 ne fait pas assez update, c'est juste un mini mode de jeu.
>
> il va falloir que tu me crées un truc à la hauteur de reflets et le choc, et que tu me donnes des idées de ce qu'on peut mettre en plus dans cette 2.5
>
> brainstorme moi tout ça, il faut que la 2.5 soit stylée, quitte à rework un peu l'écchauffement
>
> la ligne qui montre les fragments dans la collection n'est pas la même dans l'onglet classique et reverses. mets celle de classique partout
>
> l'onglet récompense de l'échaufffement est pas très beau

**Le 25 octobre 2026 :**

> alors, la règle de l'écran qui tient sans scroll, c'est pour éviter les écrans où il faut juste scroll un tout petit peu alors que ça pourrait tenir en un screen. pour les choses détaillés, y a pas de soucis si il faut scroll. là c'est moche, et pas du tout en accord avec la DA ni de la 2.0 ni de la 3.0. je suis d'accord de faire un mix, mais il faut que ça reste quand même cohérent avec l'écran reflet.
>
> ensuite, fais un pass plus cohérent stp, avec des paliers significatifs (pk le cadre est en 9 ?), et enlève l'essence brillante, c'est qu'un mini event.
>
> je te laisse bosser sur une fin de combat plus spectaculaire comme tu l'évoques
>
> au global, travaille un peu mieux la chose, et trouve d'autres idées

Puis, dans la nuit du 25 :

> vasy publie sur main et fais le sql, pense aussi à faire les modifs conséquentes pour la 3.0 (nouveaux cadres etc). pas le mode Infini par contre, c'est juste pour patienter ça

**Le 30 octobre 2026**, pour la 3.0 (mot pour mot ; les puces sont celles du propriétaire) :

> Avant toute chose, pense à relire TOUTE la doc de TOUTES les branches stp.
> 3.0 :
> * Il manque les cadres de la 2.5 dans l'onglet profil j'ai l'impression
> * Collection : L'onglet classique affiche 122/122 alors que j'ai toute les secrètes, il devrait afficher 127/122. Et cela devrait être adapté en conséquence sur ma fiche de profil également.
> * Onglet choc : La tuile "Les Secrètes" : Mets les 5 secrètes en flou pour la cohérence / La tuile "Le Cadre Secrète" : Remplace le par l'échange des Essence Brillantes, que tu rends désormais possible / Tapis "Le Choc" : Brawks est toujours mal cadré, avec une vieille bande violette sur le haut du tapis
> * Calendrier : Vérifie bien que l'épreuve du jour est parée pour les 3 semaines d'event, une épreuve par jour pendant 21 jours / Le raid dure 2 semaines, il y aura donc un nouveau raid 1 semaine avant la fin de l'event, prépare-le stp. D'ailleurs pk le French Sorcerer s'appelle "saison 2" alors que c'est le premier raid ?
> * Interface : Pk sur mobile y a un faded de flou en haut de l'écran ? Ca fait bizarre un peu / Les gens commencent à avoir ouvert beaucoup de boosters, il va falloir commencer à optimiser l'ouverture de ceux-ci pour que les animations soient moins frustrantes. / Refaire les icônes du site, la bannière, etc., selon la nouvelle DA (« Graphite et lavande », docs/design-3.0.md de la 3.0)
> * Mastery de cartes : Tout d'abord, l'interface de mastery dans la collection est complètement buggé. Quand tu changes d'onglet ça déplace la carte, ça lag. Répare tout ça. / Surtout, les masterys sont décevantes. L'esthétique est soit trop sobre soit too much et trop cheap. Genre le diamant à la mastery 5 est horrible. Fais un refonte entière des masterys, avec une vraie esthétique. / Btw, les animations je les ai pas testés donc intègre ça dans le labo. Et surtout, pour les joueurs c'est bien beau, mais si tu augmentes la mastery d'un objet, d'un moment ou d'un coach, les animations y a pas du coup, t'as pas pensé à ça. / Pour la carte fétiche d'ailleurs, c'est presque ça. Refonte un peu, mais change surtout les icones de mastery (I, II, V,…) pour qu'ils correspondent à la DA, ce jaune est moche là.
> * Pour finir, fais une auto-critique du site, en analysant l'interface, les différentes boucles, les différents game design, et améliore au plus possible. Enfin, tu me feras des suggestions de ce qu'il manque à cette 3.0

**Le 30 octobre 2026, l'après-midi** (après la 3.0.11), pour la 3.0, avec les règles officielles du jeu en pièce jointe (`regles_gentle_mates_tcg.md`, recopiées sans modification dans `docs/regles-officielles.md` de la 3.0) ; mot pour mot :

> @regles_gentle_mates_tcg.md Liste pas forcément dans l'ordre, je te laisse t'organiser
> * fais une simu pour l'économie de la maitrise
> * implémente un historique des combats, mais oublie les replays par contre, juste un historique tour par tour à la rigueur
> * fais une passe complète sur la DA
> * élabore un écran de maintenance que je pourrais visualiser dans le labo, il servira lors du déploiement de la 3.0
> * je te joins les REGLES OFFICIELLES du tcg qu'on a enfin, il faut donc que tu les implémentes et que tu modifies tout ce qu'il y a actuellement en conséquence. respecte ces règles au pied de la lettre, n'essaye pas d'inventer toi-même tes propres nuances
> * dans la collection, c'est toujours laggy quand tu changes d'onglet sur une carte (infos/maitrise/gérer). et ça recentre la carte quand tu changes de niveau de maitrise. fix bien cet interface. btw j'ai un peu du mal avec le liseré ça dénature un peu la carte. essaye de mieux taffer ce système de maitrise pour qu'il reste utile et remarquable sans virer au moche
> * le "tout ouvrir" c'est un coup à miss click et perdre le shoot de dopamine. je pense pas qu'on devrait offrir cette opportunité, enlève ça.
> * puisqu'on a les règles des combats, on rentre dans le final rush. c'est donc le moment d'élaborer le meilleur interface de combat possible. déjà, le tuto doit être clair, compréhensible sans embrouiller le joueur mais en décrivant tout de même le max d'aspects du jeu. pour l'interface, il doit rester dans la DA du site, être beau et compréhensible, chaque action doit avoir son animation qui fait bien comprendre ce qu'il se passe. mets un maximum d'effort dans cela, tout en l'optimisant pour pas que ça lag.
> * après cela, il restera seulement les visuels des deux promos et des secrètes manquantes à implémenter. ITS THE FINAL COUNTDOWN, FAIS MOI LA MEILLEURE 3.0 POSSIBLE, SOIS IRREPROCHABLE. rien ne doit être laggy, on doit être au niveau d'une application de luxe.
> ton compte rendu doit contenir ce qu'il reste à faire, ce que tu penses qu'on devrait rajouter, sois exhaustif.

**Le 31 octobre 2026** (après la 3.0.12), pour la 3.0, avec cinq captures d'écran (« Image 1 » à « Image 5 ») ; mot pour mot :

> * Je te fournirai les visuels des cartes manquantes et les contenus des deux starter decks plus tard.
> * Quand tu parles d'un écran aujourd'hui, c'est en mode un écran qui te dit ce qu'il te reste à faire aujour'hui ? en soit pk pas mais faut trouver un moyen de bien l'intégrer, parce qu'il y a déjà beaucoup d'onglets sur le site
> * La règle du "qui commence" oublie-la, joue tout le temps ça au pile ou face
> * implémente des statistiques de combats au profil. d'ailleurs, quand tu crées un decks, tu dois pouvoir décider si tu le rends public ou pas. si tu le fais, il s'affiche sur ton profil.
> * je pense qu'il est donc nécessaire de faire une refonte graphique du profil et de la fiche, car c'est un peu le bordel, y a beaucoup de choses. il faut que ça soit plus épuré, quitte à sacrifier des choses ou offrir plus de personnalisation.
> * pareil pour l'interface de création de decks. il est très fonctionnel, mais très peu accessible, y a beaucoup de texte entassé et mal organisé. il faut que cette étape soit vraiment compréhensible et intuitive
> * il faut changer le godpack :
>    * 3 épiques, 2 légendaires et 1 secrète
> * Pour la mastery, plusieurs choses à régler :
>    * Il faut un certain nombre d'exemplaire et de fragments pour monter le niveau, et ce nombre d'exemplaire et de fragments dépend de la rareté. Il n'est pas possible de compenser un manque d'exemplaire avec des fragments. Quand tu montes la mastery, les exemplaires sont CONSOMMES. Il faut que monter la mastery soit une tâche ardue, c'est un peu l'endgame du jeu.
>    * Il faut que tout ça soit bien plus clair. Les conditions requises, les exemplaires consommés, etc...
>    * Au global, l'esthétique ne me plait pas du tout. Je t'en supplie concentre toi sur cette mastery, les upgrades sont moches
> * Dans la collection, la jauge de reverse à une couleur différente, fais de même pour la jauge des spéciales, ou homogénise.
> * Image 1 : quand tu surlignes un case de carte, tu changes le format en le rendant plus rectangulaire. rectifie ce bug. c'est pas le seul moment ou tu rectangulises quelque chose que tu surlignes, c'est pas cohérent (image 2)
> * Le système de flèche pour savoir ce que vise une carte n'est pas très esthétique, trouve mieux
> * Image 3/4 : petit bug graphique, le surlignage dépasse, et est croppé tout moche
> * Image 5 : Majuscule à défense ? Mais pas à attaque ?
> * Au global, l'interface de combat est 1) pas trop accessible et confortable 2) un peu laggy sur certaines animations. Mets un maximum d'effort dans l'élaboration de ce système, il faut qu'il soit irréprochable et bluffant esthétiquement
>
> Globalement, toutes les tâches que tu exécutes doivent être très précises et dans l'optique de rendre le site confortable, accessible et cohérent. Prends du recul sur ce que tu fais, et rends le site accessible au maximum. D'ailleurs prête une attention particulière à la non mention d'IA, même de manière implicite (formulation bizarre, longs pavés explicatifs adressé à la deuxième personne faisant penser à une IA, ...). Par exemple, le qu'est-ce qu'un bon deck fait très rédigé par IA. Va droit au but.
> Enfin, état des lieux sur l'accessibilité et refonte nécessaire en conséquence.

**Le 1er novembre 2026**, pour la 3.0, avec quatre photos (P03 « Brawks Déter » et P04 « Squeezie le Toxique » sur la feuille de règles, sous pochette ; les Secrètes 124 « Brawks Trop Déter », 127 « Paris Gentle Mates », et 126 « GP Explorer II » dans un cadre) ; mot pour mot :

> reprends là où tu t'es arreté. par ailleurs, je rajoute quelques trucs :
>
> * serait-il pas mieux de mettre le choc à une durée de 2 semaines, et d'équilibrer les récompenses en conséquence ? comme ça quand l'event finit, on enchaine direct sur le marionnetiste.
> * d'ailleurs, ne mentionne pas le marionetiste avant sa sortie, juste le fait que les raids sont périodiques.
> * je te joins des photos qu'on a des secrètes et promos manquantes, mais je pense pas qu'elles soient exploitables ? devrait-on attendre qu'on ait des visuels plus cleans ? ou peut-on faire quelque chose ?

**Le 1er novembre 2026, le soir** (après la 3.0.13), avec cinq images (le nouveau visuel de P06 ; des avatars mal rognés dans « Nouvel échange » ; une rangée de filtres ; le surlignage rectangulaire du tutoriel autour d'un avatar rond ; la lueur de « Jouer ce Moment » coupée en rectangle) ; mot pour mot, sauf le code d'accès de la démo, retiré de cette copie (`docs/` est publié sur `main`) :

> ok on va rentrer dans un des derniers chantiers : 
>
> * La copie d'un starter n'est pas possible si la personne ne possède pas les cartes correspondantes.
> * Le serveur doit évidemment vérifier les résultats des combats
> * Dans les nouveautés dans l'onglet de l'event, remplace l'atelier de decks par la refonte du profil
> * Pour la mastery, l'esthétique est parfait. pOur l'équilibrage, c'est à revoir. 2 ans pour maxer une secrète c'est un peu too much. Reste raisonnable, tout en rendant la chose assez ardue.
> * Voici un nouveau visuel pour la Promo du Marionnetiste, plus clean.
> * Lors du choix du starter deck, enlève "Deux Sections, comme les deux Starter Decks.", et enlève les phrases en dessous de leur nom "Engager l'adversaire..." c'est guez
> * Equilibre bien le raid pour un serveur avec une dizaine de joueurs actifs, et rends la tache pas trop facile, finir la dernière phase doit etre ressenti comme un vrai exploit. Ajuste les récompenses en conséquences. L'interface du raid peut-etre soigné d'ailleurs, il est assez peu clair et fait très vibe coded.
> * J'aime bien le nouvel interface de création de deck. Mais sur PC tu l'as pas adapté, des trucs sont cliquables sans servir à rien. 
> * Meme si c'est pas mal, je pense qu'il peut encore etre amélioré, etre plus joli et mieux compréhensible tout en offrant le plus de ressources pour créer le meilleur deck
> * D'ailleurs, la fonction "Compléter pour moi" doit etre optimisée voir repensée, histoire de pouvoir créer son deck personnalisé sans forcément full theorycraft. Genre un assistant qui fait le deck selon tes préférences, mais qui fait un vrai deck optimisé et fort tout en respectant les préférences.
> * Dans les échanges, les avatars sont mal croppés (image 2)
> * Image 3 : Y a beaucoup de menu de ce genre qui ne sont pas swipable sur pc (filtres du deck, dans les échanges, ...). C'est un gros problème
> * L'espace "aujourd'hui" dans les quetes est vraiment moche est pas intuitif. Il doit etre bien designé et doit pousser l'envie de faire ses quotis, sans forcément etre envahissant.
> * L'onglet profil est sympa, mais ne permets plus de visualiser sa fiche, règle moi ça
> * L'onglet réglage fait vachement entassé, découpe le en section, et n'hésite pas à le repenser vu que beaucoup de choses ont changés. Genre rajouter des choses ou jsp
> * Dans le tutoriel, le surlignage rectangulaire est très moche. Adapte la forme aux autres formes. Ca crée des choses horribles (Image 4)
> * Image 5 : Les lueurs sont croppés rectangulairement c'est moche
> * Ne propose pas de soutenir si l'attaque seule suffit à vaincre une carte. Tu incites juste le joueur à commettre une mauvaise décision qu'il ne prendra jamais
> * Revoit les icones des buffs, effets etc, pour qu'ils soient plus jolis et esthétiques. Là c'est juste des pictogrammes
> * Quand on décide de changer de main, il n'y a pas d'animation de redistribution du deck
> * Les combats abandonnés comptent comme une défaite seulement en online ou en raid. Et ils n'aident pas à avancer des quetes.
> * La branche 2.5 est-elle toujours utile ? je crois pas donc puis-je la supprimer ?
>
> Ok maintenant on part sur autre chose :
>
> * Arrete de mettre à jour le fichier demo dans le repo et enlève le de partout, on va implémenter une démo sur un URL : matetcg.com/demo, et restreindre l'accès avec un code : [code retiré de cette copie]
> * Cette démo va devoir etre traitée différemment, puisque je vais l'envoyer à M8 pour leur montrer le projet et demander leur accord pour le publier, ou alors publier seulement un site pour faire les combats si l'ouverture de boosters pose problème
> * Il faut donc enlever toute mention d'update ou d'avancée du projet : il est à son état 0. Pas de 3.0, pas de patch note, l'évènement du choc est juste un event ponctuel
> * A la première connexion, un pop-up qui explique le fonctionnement du jeu. Il faut que le site soit vraiment traité comme une présentation intuitive du projet. L'enjeu est gros.
> * Le labo doit plus etre la pour permettre un testage optimisé du site que pour expérimenter des choses comme je le fais.
> * Réajuste les faux utilisateurs pour qu'ils soit vraiment utiles dans la valorisation du site.
> * En parallèle de tout ça, il me faudrait un vrai document qui présente le projet si ils ont la flemme d'aller voir le site. Soit plusieurs images que je mets dans le mail en vue directe, soit une diapo en pdf. FAIS LE PLUS D'EFFORT POSSIBLE
> * Evidemment, aucune mention de l'ia
> * Il faut refaire l'écran du "merci" quand on a pas d'accès au jeu, pour le mettre dans la DA de la 3.0, et pour bien stipuler que le projet ne verra pas le jour. Tu enlève le "déjà" dans "j'ai déjà un accès", tu enlèves "Ce compte n'a pas encore accès au jeu. Rendez-vous à l'ouverture !" et mets juste qu'il n'a pas accès au jeu. Cette modif tu l'as fait sur main évidemment, c'est immédiat.

**Le 2 novembre 2026**, après la publication de la démo (§ 4, la 3.0.14) ; mot pour mot, sans les jurons (« […] ») :

> […] pourquoi t'as enlevé le site de la preprod ?
>
> […] le .demo c'est pour envoyer à M8, le .preprod c'est pour tester la 3.0 que je vais publier pour les 10 utilisateurs du site. Là t'as supprimé tout ce qui mentionnait les nouveautés etc ça va pas l'faire
>
> oui la démo autonome en zip tu la dégages.
> le document de présentation : oublie-le, ça fait too much. finit ce que t'étais entrain de faire, la doc et le compte-rendu.
> enfin, question : M8 avait déjà refusé que je publie le site (d'où l'écran "Merci"). Je me demande si c'est car ils bossent sur un projet similaire, si ils trouvent que mon projet était bancal ou juste pour des raisons légales. Devrais-je donc leur envoyer le demo/ ? Et leur demander si cette version leur conviendrait ? Ou alors faire un site où seulement les combats sont jouables, sans ouverture de booster etc...

Il y joignait le message de Gentle Mates de septembre (non recopié ici). Ce qu'il en ressort : le référencement des cartes, la base de données et le showcase des plus belles cartes leur conviennent ; l'ouverture de boosters virtuels et les échanges entre joueurs, non (leur propriété intellectuelle, celle d'une trentaine d'artistes, et la structure de leur jeu), et ils demandaient de retirer ces fonctionnalités. Les combats n'y sont pas évoqués : ils n'existaient pas encore. La réponse de la session à la question est dans son compte rendu du 2 novembre.

**Le 2 novembre 2026, le soir**, en réponse à ce compte rendu (« l'option a et b » : `_config.yml`, qui retire la doc et le code serveur de matetcg.com, et un code d'accès sur `preprod/` et `prebuild/`) ; mot pour mot :

> * En fait je me rends compte que l'assistant de deck ruine tout l'aspect création et plaisir de créer. Retire cette fonctionnalité, et ne remet pas la complétion automatique (seulement pour les essences). Compense ce manque par un meilleur feedback (le système des 3 étoiles est cool), juste theorycraft un peu mieux pour donner les meilleurs clés pour créer un bon deck, sans trop prendre par la main. Le joueur doit être aidé sans se sentir sur un rail.
> * Pour ce que le site montre à tout le monde, fais l'option a et b, il est hors de question que le code et la doc soit public
> * je vais leur envoyer un message pour savoir si ça serait possible, avant de dev quoi que ce soit
> * j'ai supprimé la branche 2.5, je te laisse donc supprimer le prebuild/ puisqu'on ne va plus toucher à la 2.x, la 3.0 étant imminente
> * le nouvel interface de raid est un peu mieux, mais fait un peu cheapos, essaye de rendre le truc à la hauteur du reste de l'interface stp. sachant que c'est une nouveauté majeure, ça doit être à la hauteur. d'ailleurs, le mode infini je crois que t'as mal compris. certes il sert à insister sur la perf individuelle, mais les paliers d'avancement doivent être commun. le but est d'aller le plus loin tous ensemble, de se souder. et btw essaye de rendre lesystème de raid assez simple et intuitif, le but est pas de se casser la tête.
> * dans la boutique de l'event, le cadre et le tapis devrait être dans la même rangée (dernière rangée)
> * je pense qu'on déploiera la 3.0 début de semaine prochaine, parce que j'ai déjà bientôt atteint ma limite de Claude (70%). sauf si tu penses qu'il reste très peu de choses à faire et que ça peut passer ?
> * pour la liste des règles non résolues, je te laisse trancher car je n'en saurai pas plus que toi.

**Le 2 novembre 2026, dans la nuit** (après la 3.0.15) ; mot pour mot :

> * les 5 clés du decks sont très confusantes, oublie ça et laisse juste le système des 3 étoiles, quitte à le moduler
> * l'interface du filtrage dans la création de decks n'est pas du tout clean. "trier" est pareil que "numéro" "cout" ..., les pastilles sont moches etc
> * enlève le système de côte, ça discrimine des cartes et les met de côté implicitement, c'est au joueur de trouver quelle carte est meilleure
> * l'image qui illustre les combats (le médaillon) me dérange un peu, elle est pas très belle (dans les nouveautés du choc et dans l'onglet combats). remplace par l'illu du chevalier rose (et bien cadré stp)
> * fais une vraie review de l'écran du raid, prends du recul et critique, je le trouve encore bancal. rends le beau bordel et intuitif
> * pk on peut pas mettre de secrète en bannière de profil ?
>
> sur le vrai site (main) :
> * rajoute dans le récap de l'échauffement (qui arrive dans 24h) la date de sortie de la 3.0 : maintenance lundi 9 novembre SOIR à minuit, sortie de la version mardi 10 novembre SOIR à minuit.
> * on a donc le planning officiel. dans ton compte-rendu, dis-moi ce qu'il reste à faire avant ces deadlines. quel est notre planning.

**Le 3 novembre 2026**, une liste en PDF (« TCG 3.0 », quatre pages, avec des captures d'un iPhone : la fiche d'une carte en combat qui sort de l'écran à droite, une carte tenue au doigt dans un carré blanc, la lueur du paquet sur l'écran Boosters), ajoutée à la précédente (« reprends où tu t'es arrêté, et rajoute ça dans ta to-do liste ») ; le texte, mot pour mot, sans les captures :

> * Retirer le flou en haut de l'écran
> * Visualisation de cartes cassée sur mobile (et beaucoup trop grosse). Globalement tout est mal centré (la chronologie au milieu de l'arène, etc)
> * Mauvais comportements d'attaque, il faut review toutes les attaques (ex : Namifique, son attaque “engagez un joueur adverse” compte comme une attaque au CEO au lieu de juste offrir le choix de désangager quelqu'un
> * Saisir une carte la crop en carré avec des bords moches
> * Pk les adversaires peuvent cibler des cartes, alors que le joueur vise automatiquement le CEO ? Que disent les règles ? Est-il obligatoire de viser le CEO ?
> * Les icones des combats dans la campagne cligotent et ça rend le truc moche (laisse apparaître le tracé derrière)
> * L'historique des cartes jouées n'est pas refermable en swipant
> * Effet de surbrillance buggé sur mobile sur l'onglet boosters
> * Pas de bouton “tout récupérer” dans l'onglet saisonnier des quêtes
> * Le raid est beaucoup trop compliqué, surtout en mode infini, facilite-le un chouille histoire de s'amuser et de pas niquer le ratio W-L des joueurs
> * Il faudrait ajouter un chargement des ressources au lancement du site afin d'éviter tout bug et tout chargement dégueulasse

**Lecture des dates de la 3.0 (2 novembre, dans la nuit).** « lundi 9 novembre SOIR à minuit » est lu comme la nuit du lundi 9 au mardi 10 novembre à 0 h (heure de Paris), et « mardi 10 novembre SOIR à minuit » comme la nuit du mardi 10 au mercredi 11 à 0 h ; en UTC, lundi 9 et mardi 10 à 23 h. C'est ce que le récap affiche (« lundi 9 nov. au soir, à minuit ») : à corriger dans `PROCHAINE` (`js/config.js` de `main`) si ce n'est pas la bonne lecture.

**Lecture de « le fichier demo » (1er novembre au soir).** La session l'a d'abord pris pour `preprod/`, et a retiré `preprod/` et `prebuild/` de `main` (environ une heure, le 2 novembre) ; c'était la démo autonome en zip (`python3 tools/demo.py` sans option), confirmé par le propriétaire le 2. Tout est remis (§ 7).

**Lecture des deux dictées sur le mode sans fin.** Le 23 disait « avec moins de récompense (mais pas comme devine l'illu, ça reste un event) » ; le 24 dit « des récompenses équilibrées, comme le devine l'illu devenu permanent ». Le plus récent a été suivi : le niveau de récompense de Devine l'illu (120 Éclats au plus par jour), dans un mode qui garde des atours d'événement (l'onglet Combats, un classement, une série, un titre). C'est une interprétation : à confirmer par le propriétaire.

## 2. Le calendrier (heure de Paris)

| Quand | Quoi | Où c'est réglé |
|---|---|---|
| ven. 23 oct., minuit (sam. 24, 0 h, heure d'été) | Fin de Reflets ; son récap commence, avec le teasing de la 2.5 | `evenements.fin` (calendrier-2.5.sql) |
| nuit du sam. 24 au dim. 25 | Changement d'heure (3 h d'été → 2 h d'hiver) | — |
| **dim. 25 oct., minuit (lun. 26, 0 h, heure d'hiver)** | **Sortie de la 2.5** : fin du récap de Reflets, L'Échauffement (défi 1) et son événement (Braises, Pass, quêtes, boutique, classement), Reverses recyclables et fabricables, numéro « 2.5 », fenêtre des nouveautés | `evenements.recap_jusqua`, `ech_saison.debut` (la ligne d'événement `echauffement` la suit), `parametres.reverses_des`, `parametres.sorties` ; `SORTIE` dans `js/config.js` |
| lun. 26 → dim. 1er nov., chaque jour à 0 h | Un défi de plus (2 le mardi 27… 7 le dimanche 1er) ; les quêtes du jour de l'événement se renouvellent | `ech_jour_ouvert()` (24 h depuis `ech_saison.debut`) |
| lun. 2 et mar. 3 nov. | Pas de nouveau défi : on rattrape (trois essais par défi et par jour, jours passés jouables) | — |
| **mer. 4 nov., 0 h** (+ une heure de grâce pour un essai commencé) | Fin de la saison et de l'événement ; **le récap** commence (bandeau sur Boosters, sous-onglet « Le récap » de Combats, une fenêtre qui explique la suite), et annonce **la 3.0** (ses deux dates, le temps qui reste avant sa sortie) ; **le mode sans fin** commence : un défi par jour, le même pour tous | `ech_saison.fin` ; `evenements.recap_jusqua` (fin + 3 jours) ; `ech_sf_premier()` ; `PROCHAINE` dans `js/config.js` |
| sam. 7 nov., 0 h | Fin du récap de L'Échauffement | `evenements.recap_jusqua` |
| ensuite, chaque jour à 0 h | Un nouvel adversaire du mode sans fin (21 adversaires, puis on recommence), sans date de fin, jusqu'à la 3.0 (qui le ferme) | `ech_sf_adversaires`, `22f_sans-fin.sql` |
| **lun. 9 nov., minuit (mar. 10, 0 h)** | **Maintenance de la 3.0** : le jour J commence (README de la 3.0, § 2.7) | le propriétaire et la session ; l'annonce : `PROCHAINE.maintenance` |
| **mar. 10 nov., minuit (mer. 11, 0 h)** | **Sortie de la 3.0** ; le mode sans fin s'arrête | l'annonce : `PROCHAINE.sortie` |

En UTC : la sortie de la 2.5 tombe le **dimanche 25 octobre à 23 h 00 UTC** ; la fin de Reflets, le vendredi 23 à 22 h 00 UTC ; la fin de la saison, le mardi 3 novembre à 23 h 00 UTC ; la maintenance de la 3.0, le **lundi 9 novembre à 23 h 00 UTC** ; sa sortie, le **mardi 10 novembre à 23 h 00 UTC**.

## 3. La 2.5

**Fait** (branche `version-2.5`) :
- L'Échauffement (sept défis, coup d'éclat, indices), sous le nom 2.1.4 jusqu'au 23 octobre ; en ligne sur `main` depuis le 23 octobre, en attente de sa sortie ;
- les Reverses recyclables et fabricables (400 / 500 / 2 400 Fragments), reportées de la fin de Reflets à la sortie de la 2.5 ;
- la sortie datée : le site se montre en « 2.1.3 » jusqu'à la minute dite, puis bascule seul (README, « Version 2.5 · La sortie datée ») ;
- la fenêtre des nouveautés de la 2.5 ; le teasing de la 2.5 dans le récap de Reflets ;
- l'indice 3 corrigé : 127 cartes (122 + 5 Secrètes), et non 128 ;
- les marques de cache à empreinte (`tools/version.py`) ;
- **le Labo refait** (README, « Administrateurs ») : le serveur (le calendrier en frise, aller à un état — jusqu'au mode sans fin —, avancer d'un jour, les Reverses, remettre L'Échauffement à zéro), son compte (sauvegarde et restauration, master set, ressources, cosmétiques, ses étoiles), les joueurs, les aperçus ;
- **24 octobre, à la demande du propriétaire** (§ 1) :
  - **L'Échauffement devient un événement** à la hauteur de Reflets (`22e_echauffement-evenement.sql`) : sa monnaie, les **Braises** (étoiles des défis, quêtes du jour et de l'événement : 1 225 au plus) ; un **Pass** de 20 paliers (refait le 25, voir plus bas) ; 13 **quêtes** ; une **boutique** (boosters, Fragments, Reverse Rare, titre « Entraîneur ») ; un **classement** ; un **récap** de trois jours. Six sous-onglets dans Combats (Défis, Pass, Quêtes, Boutique, Classement, Indices) ; l'ancien « Récompenses » (« pas très beau ») est remplacé par le Pass ;
  - **le mode sans fin** (`22f_sans-fin.sql`), à partir du 4 novembre : un défi par jour, le même pour tous, parmi 21 adversaires de niveaux mêlés (Facile, Moyen, Difficile, Redoutable), sans difficulté qui monte ; trois essais par jour ; 30 / 30 / 60 Éclats (120 au plus, comme une illu trouvée du premier coup) ; le titre « Infatigable » après dix jours gagnés ; une série et un classement ; expliqué par une fenêtre et par l'onglet du récap ;
  - la ligne des Fragments de la Collection, la même dans Classiques et Reverses ;
  - au profil, les cadres Braise et Ardeur verrouillés disent d'où ils viennent ;
  - **la mise à jour de la vraie base, prête mais pas appliquée** (§ 6) : l'accord est donné ; l'envoi du 24 au soir attendait une confirmation du propriétaire dans l'outil Supabase, qui n'est pas venue à temps.
- **25 octobre, à la demande du propriétaire** (§ 1) :
  - **l'onglet refait sur la charpente de l'écran Reflets** : la première version (graphite et lavande, tassée pour ne jamais défiler) était « moche, et pas du tout en accord avec la DA ni de la 2.0 ni de la 3.0 ». Les composants sont ceux de Reflets (en-tête, sous-onglets, tuiles, piste du Pass, boutique, classement, récap, bandeau), comme Le Choc de la 3.0 les reprend ; seules les couleurs changent : la braise et la lavande à la place du rose, sur les fonds, les textes et les boutons du site ;
  - **la règle 8 précisée** (`CLAUDE.md`) : pas de page qui défile « d'un tout petit peu » ; une page détaillée (Défis, Quêtes, Pass) défile franchement. Mesuré aux quatre tailles : toutes les vues courtes à 0 px de dépassement, les pages longues de 595 à 1 169 px ;
  - **le Pass refait** : vingt paliers en quatre blocs de cinq, un cosmétique tous les cinq (5 : titre « Premier round », 10 : cadre « Braise », 15 : titre « Feu sacré », 20 : cadre « Ardeur ») ; **plus d'Essence Brillante** ; 10 boosters, 700 Éclats, 1 000 Fragments, 2 Reverses Rares ; seuils de 40 à 1 050 Braises. Un joueur qui fait tout le finit vers le huitième jour, un joueur régulier atteint le palier 16 environ, un joueur de passage le 8 (calcul en tête de `22e`) ;
  - **la fin de combat en scène** : le verdict, les étoiles qui se posent une à une avec leur note, le tampon « Parfait » à trois étoiles, les gains qui défilent ;
- **25 octobre, de la session** (« au global, travaille un peu mieux la chose ») : l'**entrée du combat en face-à-face** (l'adversaire, un bandeau avec le défi et sa règle, l'équipe qui monte ; 1,75 s, un toucher l'abrège) ; « Bloqué » lisible, un tintement, et le coup qui suit le coup d'éclat fait trembler la scène ; **la révélation des 21 étoiles** (les sept indices en éventail, le dernier mot qui se retourne) ; le récap qui tient dans l'écran avec son podium ; le niveau « Redoutable » qui débordait de sa tuile. À valider par le propriétaire : ce sont des choix de la session ;
- **25 octobre, la mise à jour de la vraie base** : les trois envois refaits avec le nouveau Pass ; leur contrôle vérifie aussi le contenu du Pass, des quêtes et de la boutique de l'événement ; `tools/maj-2.5/essai.sh` les rejoue sur deux copies du modèle de la vraie base (§ 6).
- **25 octobre, dans la nuit : la 2.5 est en ligne, site et base** (accord du propriétaire, § 1). Le site : `version-2.5` fusionnée dans `main` (`e9f0c36`), servie à 02 h 22 UTC ; elle se montre en « 2.1.3 » jusqu'à lundi 0 h. La base : `MAJ-2.5.sql` collé par le propriétaire vers 02 h 35 UTC (l'outil Supabase n'a pas reçu ses confirmations), fins de ligne Windows corrigées (`fix-crlf.sql`), puis vérifiée : identique à une installation neuve (§ 6, et README, « La mise en ligne »).

- **1er novembre** (le propriétaire, § 1) : l'écran « Merci » dans la DA de la 3.0, sur cet écran seulement ; « M8 TCG Online ne verra pas le jour. » en évidence, « J'ai un accès », plus de « pas encore » ni de « Rendez-vous à l'ouverture » ; publié sur `main` le jour même. Reporté dans la 3.0 le 2 novembre (§ 5).
- **3 novembre** (le propriétaire, § 1) : **le récap de L'Échauffement annonce la 3.0** — dans le sous-onglet « Le récap » (une carte « La version 3.0 » : la maintenance, la sortie, le temps qui reste avant la sortie) et dans la fenêtre de fin (une ligne) ; les dates sont dans `PROCHAINE` (`js/config.js`), lues à l'heure du serveur ; plus rien une fois la 3.0 sortie. Pour que le récap tienne encore dans l'écran (règle 8), sur téléphone les trois chiffres de second plan du bilan (indices, combats, quêtes) passent en pastilles d'une ligne, et le défi du jour a une phrase plus courte sur les écrans bas ; mesuré dans Chromium : 0 px de débordement aux quatre tailles (marge de 7 à 24 px), la fenêtre aussi. Publié sur `main` le jour même.
- **2 novembre** (le propriétaire, § 1) : la démo autonome en zip retirée (`tools/demo.py` sans option, `_demo/LISEZMOI.txt`), sur les deux branches. Le même jour, `prebuild/` a été retiré de `main` par erreur pendant environ une heure, puis remis tel quel (§ 7).

**Décidé le 24 octobre sur le mode sans fin** (les quatre questions laissées ouvertes le 23) :
- *quand il commence* : le mercredi 4 novembre, après le rattrapage (le propriétaire) ;
- *ce qu'on y joue* : des adversaires « plus ou moins durs », « pas de difficulté croissante » (le propriétaire) ; le détail — 21 adversaires, un par jour dans un ordre qui mélange les niveaux, jamais la même règle deux jours de suite, chaque Défense calibrée par simulation — est un choix de la session (tableau dans `22f_sans-fin.sql`) ;
- *ce qu'il rapporte* : « des récompenses équilibrées, comme le devine l'illu devenu permanent » (le propriétaire, et § 1 pour la lecture) ; les montants, le titre, la série et le classement sont des choix de la session ;
- *les indices* : ils se relisent (sous-onglet « Indices ») ; le mode sans fin n'en donne pas de nouveaux (choix de la session).

**Idées pour étoffer la 2.5, première série** (demandées par le propriétaire le 24 octobre, « brainstorme moi tout ça » ; **une seule est faite, la 3**, demandée le 25 ; les autres ne sont ni faites ni décidées). Ce sont des propositions de la session, pas une liste exhaustive de ce qui est possible ; les durées sont des estimations, pas des mesures. Contrainte commune : rien de ce qui est déjà la 3.0 (règle 1 ; voir la fin de la liste), et ce qui n'est pas propre à la 2.x devra être reporté dans la 3.0 (§ 5).

*Faisables avant la sortie (lundi 0 h), sans risque pour le reste :*
1. **Un cadeau de sortie** (par exemple 3 boosters et 500 Fragments) par Labo › Joueurs › « Offrir un cadeau », qui existe déjà : chacun ouvre un paquet à sa visite suivante. Aucun code ; un geste du propriétaire sur le vrai site, après la publication. Pour : marque la mise à jour, et les Fragments servent tout de suite aux Reverses qui ouvrent. Limite : une décision d'économie (3 boosters, c'est une demi-journée de réserve). Rien à reporter.
2. **Une recharge accélérée pendant l'événement** (« un booster toutes les 3 h » pendant les sept jours de défis, ou le seul week-end) : la ligne d'événement a déjà sa colonne `ticket_minutes`, que `minutes_recharge()` suit. Une ligne de SQL, plus une heure pour vérifier que le bandeau de l'événement le dit. Pour : plus de boosters, donc plus de doublons pour les Fragments et les Reverses. Limite : à 3 h au lieu de 4 h, c'est +33 % de boosters pendant sept jours (environ 14 de plus pour un joueur régulier) : la dose est à décider. Rien à reporter.
3. **Fait le 25 octobre** (le propriétaire : « je te laisse bosser sur une fin de combat plus spectaculaire »). **Une scène de fin de combat plus spectaculaire** : les étoiles qui tombent une à une, chacune avec son son, un jaillissement de braises à trois étoiles, le tampon « Parfait ». Deux à quatre heures. Pour : c'est le « stylé » demandé, vu à chaque combat. Limite : la scène doit rester courte (on rejoue) et tenir à 375 × 667. Rien à reporter (propre à L'Échauffement).
4. **Des succès de la 2.5** : gagner un défi, un défi à trois étoiles, les 21 étoiles, dix coups d'éclat qui frappent, dix défis du jour, une Reverse fabriquée. Calculés à la volée comme les autres (`succes_de()`), noms dans `SUCCES`. Deux à trois heures avec les tests. Pour : ils restent au profil après l'événement. Limite : **à reporter dans la 3.0** (sinon ils disparaissent des profils à sa sortie).

*Pendant l'événement (une 2.5.1, dans la semaine) :*
5. **Partager un combat en image**, comme un booster (`js/partage.js`) : l'équipe, l'adversaire, les étoiles, les tours, le pseudo. Trois à cinq heures. Pour : chacun montre ses trois étoiles sur le Discord. Limite : l'image dévoile une équipe gagnante (c'est aussi s'entraider). Rien à reporter.
6. **La liste de souhaits** : marquer les cartes qu'on cherche ; « Chez tes amis », la fiche d'un ami et la composition d'un échange les mettent en avant. Cinq à huit heures (une table, deux fonctions, Collection, Social, la démo). Pour : sert les échanges, le cœur du jeu entre amis, et dure après l'événement. Limite : sans lien avec l'événement ; **à reporter dans la 3.0**.
7. **La contre-proposition d'échange** : répondre à une demande par une autre carte au lieu de la refuser. Quatre à six heures. Pour : moins d'échanges qui meurent. Limite : **à reporter dans la 3.0**.
8. **Les week-ends du mode sans fin** : le samedi et le dimanche, un adversaire Redoutable qui paie double. Une à deux heures. Pour : garde le mode sans fin vivant. Limite : une variation à valider (ce n'est pas une difficulté qui monte, mais c'est un rythme). Rien à reporter.
9. **Le bilan de la communauté** : chaque jour, pour le défi de la veille (jamais celui du jour), l'équipe la plus jouée et le taux de victoire. Trois à quatre heures. Pour : de la vie entre joueurs. Rien à reporter.
10. **Les valeurs de combat dans la visionneuse** d'un Joueur (Défense, attaques, coût en élan) et ses meilleurs résultats en défi. Deux à trois heures. Pour : aide à composer une équipe. Rien à reporter (propre à L'Échauffement).

*Écartées par la session, à dire au propriétaire :*
- **Tout ce qui est déjà la 3.0** (règle 1, et les indices l'annoncent) : decks, deux Sections, maîtrise, Versus entre amis, Raid, cartes Secrètes, la DA « Graphite et lavande » partout, tapis et sleeves.
- **Une offre du jour en boutique** : faisable, mais elle déplace l'économie des Éclats (calculée dans `04_seed.sql`) ; à simuler d'abord.
- **Un second mini-jeu quotidien** (un quiz sur les cartes) : un rendez-vous de plus à côté de Devine l'illu et du défi du jour, qui tourne à la corvée.

*L'avis de la session, le 24 (une opinion, pas un fait) :* pour lundi, 1, 2 et 3 ; dans la semaine, 5 ; 6 si le propriétaire veut une nouveauté qui dure au-delà de l'événement.

**Idées pour étoffer la 2.5, seconde série** (demandée par le propriétaire le 25 octobre, « trouve d'autres idées » ; **aucune n'est faite ni décidée**). Même statut que la première : des propositions de la session, pas une liste exhaustive de ce qui est possible ; les durées sont des estimations, pas des mesures. Mêmes contraintes : rien de ce qui est déjà la 3.0, et ce qui n'est pas propre à la 2.x se reporte (§ 5).

*Autour des combats :*

11. **Le record de chaque défi** : le moins de tours pour le gagner, dans toute la communauté et parmi ses amis (« Record : 3 tours, Lumen »), sur l'écran du défi, et « Nouveau record » dans la fin de combat. Pour : une raison de rejouer un défi déjà à trois étoiles, de la compétition sans affrontement. Coût : trois à quatre heures (une fonction SQL sur `ech_scores` et `ech_essais`, l'affichage, la démo). Limite : les ex æquo (le premier arrivé garde le record) ; le pseudo du détenteur se voit de tous, comme au classement. Rien à reporter.
12. **Rejouer pour le plaisir** un défi déjà à trois étoiles : sans essai compté ni gain, joué dans la page comme l'aperçu du Labo. Pour : essayer d'autres équipes sans toucher à l'économie. Coût : une à deux heures. Limite : seulement les défis déjà à trois étoiles (sinon on chercherait l'équipe gagnante sans limite d'essais) ; avec l'idée 11, ces combats-là ne comptent pas pour le record. Rien à reporter.
13. **Les défis à contrainte** : pour chaque défi, un objectif en plus, facultatif (trois couleurs différentes, sans coup d'éclat, en quatre tours au plus, avec une Reverse…), qui donne une médaille et 15 Braises. Pour : de la variété, et une façon d'apprendre les règles. Coût : six à huit heures (le serveur vérifie la contrainte sur le combat qu'il rejoue ; une simulation pour s'assurer que chacune est faisable avec une collection moyenne ; l'écran du défi doit encore tenir à 375 × 667). Limite : jusqu'à 105 Braises de plus, le Pass se finit un peu plus tôt ; une ligne de plus sur un écran déjà plein. Rien à reporter.
14. **Les Joueurs en forme du mode sans fin** : chaque jour, trois Joueurs (les mêmes pour tous) frappent plus fort au défi du jour. Pour : les 21 adversaires reviennent, mais pas deux fois pareils, et les équipes varient. Coût : cinq à huit heures (la règle dans `ech_combat` et sa copie JS, la parité, les Défenses à recalibrer). Limite : c'est toucher au combat, avec tous les tests que ça demande ; avant le 4 novembre, ou pas du tout. Rien à reporter.

*Autour de l'événement :*

15. **L'objectif commun** : une jauge « Ensemble » pendant la saison, les étoiles de tous les joueurs additionnées ; à 25, 50, 75 et 100 %, chacun de ceux qui ont joué reçoit un cadeau (un booster, des Fragments). Pour : l'événement devient collectif, et le joueur de passage y contribue. Coût : cinq à sept heures (une fonction qui compte, les paliers, la réclamation, une tuile dans Défis et le bandeau). Limite : le seuil dépend du nombre de joueurs actifs, connu seulement sur la vraie base (le Labo l'affiche) ; ne pas le présenter comme un raid (la 3.0 en a un, et l'indice 7 l'annonce). Rien à reporter.
16. **Le classement entre amis** : « Tous / Amis » sur les classements de l'événement et du défi du jour. Pour : le top 10 est hors de portée pour la plupart ; entre amis, chacun a une place à prendre. Coût : deux à trois heures. Limite : aucune règle nouvelle. **À reporter dans la 3.0** (ses classements en profiteraient de même).
17. **La boîte de réception, voix de l'événement** : un message le jour où un défi s'ouvre (« Le défi 4 est ouvert : Gotaga Pose, Affinité Rose »), un rappel deux jours avant la fin du rattrapage, un à l'ouverture du récap ; écrits par le serveur à la première visite du jour (`notifier()`, `11_boite.sql`), une fois chacun. Pour : moins de jours manqués. Coût : deux à trois heures. Limite : trois sortes de messages au plus, sinon c'est du bruit. La méthode serait à reporter dans la 3.0 si elle plaît.
18. **« Ton Échauffement » en image** : à la fin de la saison, une image à partager (son Joueur le plus joué, sa meilleure équipe, ses étoiles, ses coups d'éclat, son rang), comme celle d'un booster (`js/partage.js`). Pour : la fin de saison circule sur le Discord. Coût : quatre à six heures. Limite : à livrer avant le 4 novembre pour servir. Proche de l'idée 5 (partager un combat). Rien à reporter.
19. **Partager un indice en image** (la carte retournée et son titre) : le teasing de la 3.0 porté par les joueurs. Pour : c'est le rôle des indices, et le propriétaire prévoit un teasing. Coût : deux à trois heures. Limite : rien de plus n'est dévoilé que le texte de l'indice, qui ne promet rien d'incertain (règle 9). Rien à reporter.
20. **Le bestiaire du mode sans fin** : les 21 adversaires en grille (cachés tant qu'on ne les a pas affrontés), une médaille par adversaire battu à trois étoiles, un titre aux 21. Pour : le mode sans fin gagne un but au long cours, dans l'esprit d'un jeu de collection. Coût : quatre à six heures. Limite : idéalement avant le 4 novembre (il peut aussi lire après coup les combats déjà joués). Rien à reporter : la 3.0 ferme le mode.

*Autour de la collection :*

21. **Fabriquer en lot** : « Fabriquer les 12 Reverses Communes qui manquent : 4 800 Fragments », avec le récapitulatif et la confirmation à trois secondes du recyclage. Pour : les Reverses ouvrent lundi, après des semaines de Fragments mis de côté ; 85 fabrications une à une, c'est fastidieux. Coût : trois à quatre heures (une fonction SQL en une transaction, la fiche, la démo). Limite : un geste qui dépense beaucoup d'un coup, d'où la confirmation. **À reporter dans la 3.0** (les mêmes Reverses s'y fabriquent).
22. **Les Reverses complètes** : trois quêtes saisonnières (toutes les Reverses Communes, Peu communes, Rares), comme les raretés complètes des classiques, et un titre aux 85. Pour : un but au long cours pour les Reverses qui s'ouvrent. Coût : une à deux heures (`04_seed.sql`, `sync_collection_quests`). Limite : une décision d'économie (les récompenses) ; `tools/equilibre-reverses.py` donne les durées. **À reporter dans la 3.0**.

*Pour l'arrivée de la 3.0 :*

23. **Un écran de maintenance** : le propriétaire prévoit une maintenance avant la 3.0, et rien n'existe (voir « Prévu » plus bas). Un réglage serveur (un message, une heure de retour), lu par `porte()` et `me()` ; le site montre un écran d'attente avec le lien du Discord ; les administrateurs passent. Coût : trois à cinq heures avec `verif.html` et la démo. Limite : à essayer d'abord dans le prébuild ; c'est la 2.x qui l'affichera (le site en place pendant la maintenance). Rien à reporter.
24. **Un compte à rebours réglable depuis le Labo** (un texte, une date, un bandeau sur Boosters) : le jour où la date de la 3.0 est connue, le teasing final se pose sans toucher au code. Coût : deux à trois heures. Limite : le texte est celui du propriétaire (règle 9). Rien à reporter.

*Écartées par la session, à dire au propriétaire :*
- **Rendre les indices lisibles par tous après la saison** : ce serait retirer leur valeur à ceux qui les ont gagnés ; une ligne de SQL si le propriétaire le veut.
- **Des revanches des défis de la saison dans le mode sans fin**, pour rattraper les indices : même raison, et le mode sans fin n'en donne pas (décidé le 24).
- **Une suggestion d'équipe automatique** : elle trouverait l'équipe à trois étoiles à la place du joueur.

*L'avis de la session, le 25 (une opinion, pas un fait) :* pour lundi, 21 seulement, si le propriétaire veut une nouveauté de plus le jour où les Reverses ouvrent ; pendant l'événement (une 2.5.1), 11 et 12 ensemble, puis 15 et 19 ; avant le 4 novembre, 20 ou 14, pas les deux ; dès que la date de la 3.0 est connue, 23 et 24. De la première série, 1 et 2 restent les moins chères (aucun code).

**Prévu par le propriétaire, pas encore fait :**
- ~~Dès que la date de sortie de la 3.0 est connue : le teasing final~~ : **la date est connue** (le propriétaire, 2 novembre au soir : maintenance dans la nuit du lundi 9 au mardi 10 novembre à 0 h, sortie dans la nuit du mardi 10 au mercredi 11 à 0 h) et **le récap de L'Échauffement l'annonce** depuis le 3 novembre (plus haut). Reste la **maintenance**, puis la mise à jour 3.0 : la maintenance est celle de la 3.0 (une base 2.x qui a des joueurs y entre d'office en recevant son `TOUT.sql`, et l'écran vient de son code) ; la 2.x n'a pas d'écran de maintenance et n'en aura pas. Le mode sans fin s'arrête avec la 3.0 (son `29_labo.sql` en retire les fonctions).

## 4. La 3.0

**Où elle en est** : branche `version-3.0`, démo publiée sur `main` dans `preprod/` (matetcg.com/preprod/), version 3.0.14 depuis le 2 novembre (plus bas ; la 3.0.13, le 1er novembre ; la 3.0.12, le 31 octobre ; la 3.0.11, le 30). Depuis le 2 novembre aussi, **une démo pour Gentle Mates** à `matetcg.com/demo/` (plus bas, la 3.0.14). La 3.0.10 (24 octobre : les reports de la 2.5, et son propre Labo refait — le Choc d'un état à l'autre, le Raid à une phase, son compte, sa sauvegarde, le master set à la limite de deck pour tester les combats). Le même jour, au soir : les titres et cadres de L'Échauffement de la 2.5, la fermeture de son mode sans fin, et ses deux remises à zéro réparées (elles s'arrêtaient sur `labo_sauvegardes`) ; la `preprod/` publiée n'a pas été refaite pour si peu (rien n'y change à l'écran). Le 25 : les paliers des titres et cadres de L'Échauffement suivent le Pass refait de la 2.5 (5, 10, 15, 20 ; `1116081`). Puis, dans la nuit, à la demande du propriétaire (« les modifs conséquentes pour la 3.0 (nouveaux cadres etc). pas le mode Infini ») : les Braises (nom, icône) pour une 3.0 qui sortirait pendant L'Échauffement ou son récap ; la compatibilité refaite avec la 2.5 finale ; les leçons de la mise à jour de la vraie base (son `CLAUDE.md`, son README § 13 point 33, `supabase/administration/fix-crlf.sql`). Les cadres et titres de la 2.5 y étaient déjà dans les sources (24 octobre), mais **pas dans la pré-prod publiée** : l'affirmation du 24 (« rien n'y change à l'écran ») et celle du 25 (« visibles au profil de la démo ») étaient fausses — le Profil montre tous les cadres, possédés ou non, et le 30 le propriétaire ne les voyait pas. Règle consignée au README de la 3.0 (§ 13, point 36) : toute modification visible se publie.

**La 3.0.11** (30 octobre, à la demande du propriétaire, § 1) : les cadres de la 2.5 au Profil ; les Secrètes comptées au-delà du total (« 127 / 122 ») dans la Collection et la fiche ; l'onglet du Choc (Secrètes toutes floutées, l'échange des Essences Brillantes à la place du cadre Secrète, tapis « Le Choc » recadré) ; **deux raids** comptés depuis le premier jour du Choc — raid 1 The French Sorcerer, raid 2 Le Marionnettiste quatorze jours plus tard (une semaine avant la fin), réglé par simulation pour être aussi dur que le Sorcier — et plus de « saison 2 » ; **21 Épreuves numérotées** et un calendrier des règles sur trois semaines ; l'en-tête net au lieu du fondu flou ; l'ouverture des boosters plus rapide et « Tout ouvrir » ; les icônes, le favicon et l'image de partage en graphite et lavande ; **la maîtrise refaite** (finitions Satin, Liseré, Holo, Lumière, Légende ; insigne ✦ sans jaune ; la fiche qui ne déplace plus la carte et tourne à 60 images par seconde au lieu d'environ 20 ; la montée d'un niveau ; la maîtrise des Moments, Coachs et Objets en combat ; les aperçus au Labo) ; la carte fétiche retouchée ; « Tout récupérer » sur les quêtes. Puis, le même jour (« améliore au plus possible ») : **les bugs connus** de son README (§ 14.1), sauf ceux des decks — `RM()` aveugle au réglage « Animations réduites », la vitesse de combat qui se perdait, les raccourcis de l'application installée, la pastille de l'événement sur l'avatar, le titre « PRÉ-PROD », « Nouvelle version » par-dessus une fenêtre, Target Missed contre Invitation, les actions perdues d'un défi entre amis (la partie reprend telle que le serveur l'a notée), le repli de rareté du Labo, et côté serveur les tapis comptés parmi les titres, le cadre et l'avatar de `set_profile`, les tapis et sleeves de `combat_reglages` ; **plusieurs quêtes finies ensemble** font une seule notification au lieu d'une pile ; **« Tout ouvrir »** sur les coffres du Raid. Son README dit tout ce qui est fait.

**La 3.0.12** (30–31 octobre, la dictée de l'après-midi du 30, § 1). Le détail est au § 15 du README de la 3.0 ; ce qui suit dit ce qui est fait et comment c'est vérifié.
- **Les règles officielles dans le moteur**, au pied de la lettre : Club de 40, trois exemplaires par nom et couleur, Réserve de 10 ; 4 PV posés après la main et le mulligan, puis qui commence ; l'entretien pioche aussi pour le premier CEO ; autant de Joueurs qu'on veut, un remplacement par tour quand les trois cases sont prises ; Objets sans limite ; un Coach par tour ; la restriction par couleur ; plus d'Instant en phase de Combat ; les attaques sur le CEO, le soutien d'un Joueur adjacent ; plus de Banc (« bench », c'est la défausse) ; défausse à 5 en fin de tour ; Club vide, partie perdue ; **le perdant commence la partie suivante** (contre le même adversaire de l'IA, retenu dans le navigateur ; entre amis, par le serveur). Les effets, l'IA, les Starters (recomposés à 40 : leurs listes officielles ne sont pas connues), le SQL et les variantes de l'Épreuve, de la campagne et du Raid suivent. `docs/regles-3.0.md` est réécrit : chaque règle et son code, et **13 points que le texte ne tranche pas** (§ 11 : la lecture retenue, et l'autre), à faire valider. Vérifié : 54 tests du moteur, les tests SQL (`tools/tests-sql/`, désormais dans le dépôt).
- **L'arène et le tutoriel** : chaque étape a son animation (la donne, le mulligan, les PV, qui commence — une pièce qui tourne pour un tirage, qui se pose quand le perdant commence —, l'entretien, les quatre phases, le soutien, le duel « Attaque ≥ Défense », ce qui part à la défausse, le remplacement) ; un Joueur engagé tourne d'un quart de tour ; mesuré à 55,6 images par seconde, processeur ralenti quatre fois, 99 % des images sous 50 ms. Le tutoriel est une partie guidée de cinq tours (22 étapes), joué de bout en bout dans Chromium ; le Guide et son glossaire sont réécrits.
- **« Tout ouvrir » retiré** (boosters et coffres du Raid) ; les ouvertures plus rapides de la 3.0.11 restent.
- **La fiche de carte** : changer d'onglet ou de niveau ne fait plus sauter la vue ni recentrer la carte ; mesuré, processeur ralenti quatre fois : aucune image au-delà de 50 ms en changeant d'onglet ou de niveau (la toute première ouverture d'une fiche en fait une de 68 ms). **Le niveau II de maîtrise devient l'Écrin** : un fin cadre de métal posé *autour* de la carte, qui ne touche plus son bord imprimé (le « liseré qui dénature la carte »). À valider par le propriétaire.
- **L'historique des combats**, tour par tour, sans replay (Combats › Historique : les trente derniers, contre l'IA et entre amis, environ 1,2 Ko chacun).
- **L'écran de maintenance** (Labo › Serveur › Maintenance, et son aperçu) : une base 2.x qui a des joueurs entre d'office en maintenance en recevant la 3.0 ; l'écran revient tout seul à la levée. Et un résultat de combat refusé (une maintenance, le réseau) ne se perd plus : l'accueil propose de l'envoyer.
- **La simulation de l'économie de la maîtrise** (`tools/equilibre-maitrise.py`, `docs/economie-3.0.md` § 3 ter) : la maîtrise avant la collection retarde les 122 de 25 jours en médiane ; la Légende d'une Légendaire demande un quatrième exemplaire ; d'où un rappel dans la fiche tant qu'il manque des cartes.
- **La passe complète sur la DA** (`docs/design-3.0.md` § 10 quater) : les couleurs de l'interface prennent leurs jetons, le choisi est blanc, l'or ne sert qu'aux récompenses, un seul rose pour les favoris, un seul vert pour Toxique ; deux questions au propriétaire (README de la 3.0, § 14.3 : `--warn` a la valeur de l'or ; les Étincelles en or).
- **Corrigés en chemin** : la fin d'un défi pouvait ne jamais envoyer le dernier coup à l'ami ; avec « Animations réduites », la pièce du tirage montrait la mauvaise face ; « Tour adverse » pendant la mise en place ; deux textes restés aux anciennes règles (« Trente cartes », « deux de chaque ») ; et, mesuré le 31 sur un réseau lent (« 3G rapide », cache vide), la main de départ qui s'affichait vide pendant près de 4 s, le mulligan à décider devant des cartes sans image : ses images se chargent désormais avant la donne, la feuille du mulligan les attend, et ce qui va se montrer bientôt se charge en fond quand la page est au repos (la fluidité mesurée ne bouge pas).
- **Vérifié, et pas vérifié** : Chromium aux quatre tailles (aucune page ne déborde en largeur, aucune erreur sur les treize onglets), PostgreSQL 16 local. **Rien sur un vrai téléphone, rien dans Safari (WebKit), rien sur un vrai Supabase** (aucune base 3.0 n'existe), et le Versus seulement contre les amis simulés de la démo.

**La 3.0.13** (31 octobre – 1er novembre, les dictées du 31 et du 1er, § 1). Le détail est au § 15 du README de la 3.0.
- **Qui commence** : pile ou face, à chaque partie (le propriétaire) ; la mémoire du perdant est retirée (navigateur et serveur).
- **Le godpack** : trois Épiques, deux Légendaires, une Secrète, en dernier.
- **La maîtrise** : les exemplaires en trop sont consommés, selon la rareté (jusqu'à la Légende : C 20, PC 16, R 12, E 9, L 7, Secrète 5 ; et de 2 000 à 20 000 Fragments) ; un exemplaire qui manque ne se remplace plus par des Fragments. La fiche dit ce qu'il faut et ce qui sera consommé, et demande confirmation. Les finitions refaites une quatrième fois : la lumière, jamais un trait (Satin, Reflet, Holo, Lumière, Légende). Simulation refaite (`tools/equilibre-maitrise.py`) : une fois la collection complète, un joueur régulier mène une Commune en Légende en une semaine, une Épique en quatre mois, une Légendaire en dix, une Secrète en deux ans environ.
- **Le profil** : le profil et la fiche d'un joueur ne font plus qu'une carte de visite (1 280 px de haut au lieu de 3 900 sur téléphone), les réglages dans une feuille « Personnaliser » ; les statistiques de combat (victoires, solo, entre amis, série et record, campagne) ; les decks montrés sur le profil, au choix du joueur (un deck complet).
- **L'atelier de decks** refait : une tête collée en haut, trois onglets avec leur jauge (Cartes, Club, Réserve), une ligne pour l'étape suivante, la Réserve qui tient dans l'écran ; « Un bon deck » réécrit, court.
- **L'arène** : la flèche de visée remplacée par un trait de lumière puis une mire sur la cible ; plus fluide (mesuré, processeur ralenti quatre fois : les tâches longues d'un déploiement passent de 14 à 8) ; jouable au clavier, racontée aux lecteurs d'écran.
- **Les images 1 à 5** : le surlignage garde la forme de ce qu'il entoure et ne déborde plus ; « Attaque » et « Défense » ; la jauge des Spéciales a sa couleur.
- **Le Choc en deux semaines** (le propriétaire, 1er novembre) : Pass de vingt paliers, quêtes et boutique aux deux tiers ; le raid 2 commence le lendemain de la fin. Le boss suivant n'est nommé nulle part avant son arrivée (seul le Labo le nomme). Corrigé en chemin : le Labo finissait le Choc à 23 h à travers le passage à l'heure d'hiver.
- **P03, P04 et les Secrètes 124, 126, 127** : textes, catégories, couleurs et effets, d'après les photos ; les visuels sont les photos redressées (`tools/redresser-photo.js`), en attendant des scans. P03 est la Promo de la Section Déter, P04 celle de Toxique (l'inverse des provisoires). Les Starters prennent la vraie Promo de leur Section ; leur équilibre ne bouge pas (le Toxique 68,5 % sur 400 parties, avant comme après).
- **Les textes** : plus directs ; le mot « IA » n'apparaît plus à l'écran (« Adversaire », « Difficulté », « en solo »).
- **L'accessibilité** : état des lieux par axe-core (31 vues, deux tailles) et à la main ; corrigés : le zoom interdit, le contraste des pastilles et du bouton principal, les fenêtres (nom, focus, Échap), les onglets au clavier, des attributs ARIA, la refusion à 320 px ; après, plus aucune violation automatique. Ce qui reste : README de la 3.0, § 4.13.
- **« Aujourd'hui »** en tête des Quêtes : les rendez-vous du jour, sans onglet ni pastille de plus.
- **Vérifié, et pas vérifié** : 58 tests du moteur, les tests SQL (dont `choc.sql` et `cartes-13.sql`, nouveaux), Chromium aux quatre tailles pour ce qui a changé. Toujours rien sur un vrai téléphone, ni dans Safari, ni avec un lecteur d'écran, ni sur un vrai Supabase.

**La 3.0.15** (2 novembre, le soir, la dictée du même soir, § 1). Le détail est au § 15 du README de la 3.0.
- **L'assistant de deck retiré**, pas de complétion automatique sauf pour les Essences (« Régler d'après mes attaques ») ; **cinq clés chiffrées** sous les trois étoiles (`Decks.cles`) : le départ, les Essences, la régularité, la tenue, les PV — des chances de pioche exactes et un repère mesuré sur le catalogue, sans jamais dire quelle carte mettre. Les choix des clés sont de la session : à valider.
- **Le Raid** : la page refaite (le boss en grand et sa vie, ton combat, le chemin du serveur, toi, le classement, l'aide en trois lignes) ; **l'Infini commun** : des paliers de 400 dégâts que tout le serveur fait tomber, chacun avec un coffre d'un booster pour qui a combattu ; le même combat pour tous ; plus de classement Infini à part, le rang aux dégâts. Le pas (400) et le coffre (1 booster) sont de la session : à valider ; avec une dizaine de joueurs actifs, la simulation de la 3.0.14 abat la sixième phase le dernier jour une saison sur deux, donc l'Infini ne s'ouvrira que rarement.
- **Les 16 points de règles tranchés** (`docs/regles-3.0.md` § 11) : un seul change le moteur — un Coach joué par « Jouez cette carte » compte dans la limite d'un Coach par tour, comme ce « jouer » respecte déjà la restriction par couleur.
- **La boutique du Choc** : le titre en 4, le tapis en 5, le cadre en 6 ; sur deux colonnes, le tapis et le cadre sur la dernière rangée.
- **Ce que matetcg.com montre** : `_config.yml` (à la racine de `main`, et sur cette branche pour que la 3.0 le garde) retire `CLAUDE.md`, `README.md`, `SETUP.md`, `docs/`, `tools/`, `supabase/`, `presse/` (vérifié en ligne : 404) ; **la pré-prod derrière un code**, distinct de celui de la démo (`PORTES`, `tools/demo.py`) ; la porte ne s'ouvre plus en recopiant l'empreinte publiée dans la page (le code est retenu et revérifié). Ce qui reste téléchargeable par nature : le code des pages qui tournent.
- **Côté 2.x** : `prebuild/` retiré de `main` ; la branche `version-2.5` (supprimée par le propriétaire, comme `claude/interface-ux-fixes-o92u4a` et `teaser-2.x`) : la doc de la racine de `main` le dit.
- **Corrigé en chemin** : les decks publics des joueurs simulés de la démo étaient construits par l'assistant : la démo aurait planté au chargement. Ils sont tirés dans leur couleur.
- **Vérifié** : moteur 69 sur 69 (un test de plus pour le point 5) ; Deno 17 sur 17 ; tous les tests SQL (dont `raid.sql`, qui gagne l'Infini commun ; `maintenance.sql` par `maintenance.sh`) ; Chromium aux quatre tailles : le Raid (phase 1, phase 4, Infini, coffres à ouvrir), l'atelier et la feuille du bilan, la boutique du Choc, les portes de la démo et de la pré-prod ; la démo relue écran par écran (52 vues) : aucune mention d'IA. **Pas vérifié** : toujours rien sur un vrai téléphone, dans Safari, avec un lecteur d'écran, ni sur un vrai Supabase.

**La 3.0.14** (1er – 2 novembre, la dictée du 1er au soir et celle du 2, § 1). Le détail est au § 15 du README de la 3.0.
- **Les decks** : un Starter ne se duplique qu'avec ses propres cartes (le propriétaire) ; sinon sa fiche dit ce qui manque.
- **Le serveur rejoue chaque combat avant de le payer** (le propriétaire : « Le serveur doit évidemment vérifier les résultats des combats ») : `js/combat/verif.js` rebâtit la partie avec ce que le serveur a noté à l'ouverture (le deck, la graine) et la rejoue ; la fonction `supabase/functions/combat-verifier` (Deno) paie ou refuse ; `combat_fin` et `defi_fin` retirées ; le Versus ne déclare plus son gagnant ; les combats refusés se lisent au Labo. Éprouvé : 17 essais Deno (la passe la plus longue sous 0,7 s, pour une limite de 2 s), une triche refusée au bon coup dans la démo. **Pas déployée** : aucune base 3.0 n'existe ; le jour J, la fonction se déploie avant `TOUT.sql` (README de la 3.0, § 2.7).
- **Le soutien** ne se propose que s'il change l'issue (le propriétaire).
- **La maîtrise allégée en haut de l'échelle** (le propriétaire : « 2 ans pour maxer une secrète c'est un peu too much ») : un exemplaire gardé au lieu de trois, plus ceux de ses decks et de ses échanges ; Légendaire 5 exemplaires, Secrète 2 ; médianes simulées, joueur régulier à collection complète : Épique 91 jours, Légendaire 133, Secrète 191 (au lieu de 770).
- **Les abandons** (le propriétaire) : ils ne font avancer aucune quête, et ne comptent comme une défaite qu'au Raid et en Versus.
- **Le Raid réglé pour une dizaine de joueurs actifs** (le propriétaire : « finir la dernière phase doit être ressenti comme un vrai exploit ») : seuils de 100 à 1 400, le Marionnettiste à 80 % de vie ; simulé (`tools/equilibre-raid.js`) : dix joueurs actifs abattent la sixième phase le dernier jour, une saison sur deux. Le dernier coffre : une Légendaire qui manque et le titre « Héros du Raid ». La page refaite.
- **L'atelier sur ordinateur** (plus rien de cliquable pour rien, l'analyse à l'écran), **la cote de chaque carte** (mesurée sur 6 000 parties) et **l'assistant de deck** qui remplace « Compléter pour moi » (couleurs et style au choix ; mesuré : 43 à 93 % de victoires selon la couleur, contre 25 à 47 % pour l'ancien).
- **Les bandes qui défilent de côté** se tirent à la souris et défilent à la molette sur ordinateur (le propriétaire : « C'est un gros problème »).
- **« Ta journée »** en tête des Quêtes (un anneau, ce qu'il reste à gagner, la série) et **les Réglages en quatre sections** (Jeu, Affichage, Compte, À propos), avec « Demander avant de finir un tour » (la suggestion 13).
- **Le reste de la dictée** : « Ma fiche » au Profil ; la refonte du profil à la place de l'atelier dans les nouveautés du Choc ; le choix de la Section sans phrase d'intro ni devises ; le visuel propre de P06 ; les avatars des échanges ; le surlignage du tutoriel qui épouse les formes ; les lueurs non coupées ; l'animation du changement de main (une entrée en double l'écrasait) ; les effets en combat en médaillons.
- **L'écran « Merci »** du vrai site (1er novembre) reporté dans la 3.0, qui l'avait oublié (2 novembre).
- **La démo pour Gentle Mates** (`demo/`, `matetcg.com/demo/` ; le propriétaire : « je vais l'envoyer à M8 pour leur montrer le projet ») : un code d'accès (seule son empreinte est dans la page ; il tient à l'écart un visiteur de passage, pas quelqu'un de déterminé) ; le jeu à son premier jour (ni version, ni nouveautés, ni traces des événements passés : le mode `DEMO`, qui n'existe que dans `demo/`) ; une présentation en sept écrans à la première visite ; le Labo en console de test (`?labo=complet` rend le Labo entier) ; douze joueurs simulés aux profils complets. Vérifié dans Chromium aux quatre tailles. Le document de présentation, demandé le même soir, est abandonné (le propriétaire, 2 novembre : « ça fait too much »).
- **La démo autonome en zip retirée** (le propriétaire, 2 novembre), sur les deux branches.
- **Vérifié, et pas vérifié** : 68 tests du moteur, 17 essais Deno, les tests SQL (dont `raid.sql` et `abandon.sql`, nouveaux), Chromium aux quatre tailles pour ce qui a changé. Toujours rien sur un vrai téléphone, ni dans Safari, ni avec un lecteur d'écran, ni sur un vrai Supabase ; la fonction de vérification n'a tourné que dans Deno, en local, et dans le faux serveur.

**L'auto-critique du 30 octobre** (demandée, § 1 : « analysant l'interface, les différentes boucles, les différents game design »). Chaque point dit s'il est **mesuré ou lu dans le code** (fait) ou si c'est un **avis** de la session. Ce n'est pas un audit complet : la session a regardé ce qui suit, pas tout.

- *Interface.* Fait : aucune page ne déborde en largeur et la console reste vide sur 13 onglets aux quatre tailles (audit du 30 octobre, pré-prod 3.0.11). Fait : les écarts à la DA listés au § 14.3 de son README restent (`--cta` réécrit seize fois, des couleurs en dur au lieu des jetons, des restes de la palette 2.x, le « choisi » en lavande au lieu du blanc, l'or hors des récompenses, trois roses pour le cœur des favoris). Fait : un nouveau joueur trouve cinq onglets en bas, huit entrées dans le tiroir pendant le Choc, et dans Combats Solo et Versus, puis Campagne, Arcade, Raid, Decks, Missions et Guides. Avis : c'est beaucoup à découvrir d'un coup ; le tutoriel et les guides expliquent chaque mode, mais rien ne dit « par où commencer aujourd'hui ».
- *Boucles.* Fait : pendant le Choc, jusqu'à **huit rendez-vous quotidiens à plafond** — la réserve de boosters, les quêtes du jour, Devine l'illu, l'Épreuve (3 essais), le Raid (3 tentatives), l'Arcade (5 victoires payées), le Versus (3 défis payés), les quêtes du jour de l'événement. Avis : c'est la limite au-delà de laquelle un jeu de collection tourne à la corvée (la même raison avait fait écarter un second mini-jeu quotidien de la 2.5, § 3). Fait : les Fragments ont trois débouchés concurrents — fabriquer les classiques, fabriquer les Reverses (400 à 2 400), la maîtrise (1 500 à 15 000 par carte) — et aucune simulation ne mesure encore ce que la maîtrise retarde de la collection (son README, § 14.5). Fait : le Versus ne se joue qu'en direct (60 s par tour, les deux joueurs en ligne). Avis : avec une communauté d'invités, deux amis en ligne au même moment, c'est rare ; c'est le mode le plus coûteux à faire vivre.
- *Game design.* Fait : le serveur ne fait pas tourner le moteur et croit le navigateur sur le résultat d'un combat, dans des plafonds (son README, § 7.11). Déduit, pas essayé : un joueur qui sait se servir de la console peut déclarer ses victoires et ses dégâts au Raid dans ces plafonds, et les classements du Raid et de l'Épreuve n'en sont pas protégés. Avis : acceptable entre invités, pas pour un jeu ouvert. Fait : le Marionnettiste n'est rendu égal au Sorcier que dans la page (le serveur compte ses dégâts aux PV de la phase) : choix de la session, à valider (§ 7). Fait : une copie modifiée d'un Starter ne s'enregistre pas sans ses cartes, alors que le guide dit qu'on peut le dupliquer pour le modifier : question de jeu, au propriétaire (son README, § 14.1).
- *Le vrai site.* Fait : trois des bugs corrigés dans la 3.0 existent aussi dans la 2.x (lu dans le code de `version-2.5`) : l'avatar non borné de `set_profile`, `RM()` aveugle au réglage du jeu, les raccourcis `?onglet=` non lus. Non corrigés : la 2.x n'évolue qu'à la demande du propriétaire, et son SQL ne se joue que collé par lui (règles 1 et 7 de son `CLAUDE.md`).

**Ce qu'il manque à la 3.0 : suggestions de la session (30 octobre).** Le 31 octobre : **4 fait sans les replays** (le propriétaire : « oublie les replays »), **5, 6 et 9 faits** (3.0.12, plus haut) ; les autres ne sont ni faits ni décidés. Ce sont des propositions, pas une liste exhaustive de ce qui manque ; les durées sont des estimations, pas des mesures. Ce que le propriétaire a déjà prévu (les vraies règles, P03 et P04, l'onglet d'événement) n'est pas répété.

1. **Le Versus en différé** : un défi joué sur des heures ou des jours, un coup quand on peut, avec « À toi de jouer » dans la boîte de réception. Pour : l'infrastructure existe (les actions numérotées et rangées par le serveur, rejouées par chaque navigateur ; depuis la 3.0.11, une action perdue fait reprendre le défi). Coût : quatre à six heures (un délai par tour en heures, une liste « à toi de jouer », le message). Limite : il faut une règle pour l'abandon par inactivité.
2. **Valider les combats côté serveur** : rejouer le combat (graine et actions) dans une fonction Edge de Supabase, qui exécute le même JavaScript, et ne payer que ce que le moteur confirme. Pour : protège les récompenses et les classements ; le moteur est déjà déterministe (son README, § 13, point 37), et le faux serveur rejoue déjà les défis ainsi. Coût : une à deux journées. Limite : un service de plus à déployer et à surveiller ; les combats contre l'IA devraient envoyer leurs actions, ce qu'ils ne font pas.
3. **Un écran « Aujourd'hui »** : une ligne par rendez-vous du jour (boosters prêts, quêtes, illu, Épreuve, Raid, Arcade, Versus), où on en est, un toucher pour y aller. Pour : moins de « penser à tout », rien de changé à l'économie. Coût : trois à quatre heures. Limite : il doit remplacer des pastilles, pas s'y ajouter.
4. **L'historique et les replays des combats** : les derniers combats (quelques Ko chacun), rejouables pas à pas et partageables entre amis. Pour : apprendre, montrer un beau coup, trancher un désaccord de Versus (le serveur le note déjà). Coût : quatre à six heures. Limite : la même que le point 2 pour les combats contre l'IA.
5. **Simuler l'économie de la maîtrise** (`tools/equilibre-maitrise.py`, sur le modèle de celui des Reverses) : combien de temps pour maîtriser ses cartes, et ce que ça retarde de la collection. Coût : deux à trois heures. Limite : les habitudes réelles des joueurs ne sont pas connues.
6. **Une passe sur la DA** : les écarts du § 14.3 de son README. Coût : une demi-journée avec les captures aux quatre tailles. Limite : beaucoup de petites retouches, à revoir écran par écran.
7. **Les notifications du téléphone** (Web Push) : « à toi de jouer », une phase du Raid abattue, l'Épreuve du jour. Coût : une journée (clés, une fonction Edge, l'abonnement, un réglage pour les couper). Limite : sur iPhone, seulement pour l'application installée (iOS 16.4 et plus).
8. **Répéter la mise à jour 3.0 sur une copie des vraies données** : la 2.5 n'a été essayée que sur le modèle de la vraie base, sans ses lignes (README de la 2.x, « La mise en ligne »), et la 3.0 touche aux inventaires, aux quêtes et aux combats. Il faudrait un export de la vraie base, fait par le propriétaire, rejoué sur le banc local avant le jour J. Coût : deux à trois heures une fois l'export en main. Limite : il contient des données de joueurs, à garder hors du dépôt.
9. **L'écran de maintenance** (idée 23 de la 2.5, § 3) : le propriétaire prévoit une maintenance avant la 3.0, et rien n'existe. Coût : trois à cinq heures. Limite : c'est la 2.x qui l'affichera.
10. **L'accessibilité de l'arène** : des libellés pour les lecteurs d'écran, une taille de texte réglable, les couleurs d'Essence vérifiées pour les daltoniens. Coût : une demi-journée pour un premier état des lieux. Limite : l'arène restera très visuelle.

*L'avis de la session (une opinion, pas un fait) :* avant la sortie, 8, et 2 ou au moins aucune récompense sur les classements de combat ; puis 1 et 3 ; 5 avant que la maîtrise ne serve à tous.

**Prévu par le propriétaire** (§ 1) :
- peaufiner l'onglet d'événement et l'interface en général ;
- intégrer les **vraies** règles de combat : **fait le 30 octobre** (3.0.12, plus haut), les 13 points qu'elles ne tranchent pas restant à valider (`docs/regles-3.0.md` § 11) ;
- intégrer les visuels des Promos P03 et P04, et ceux des **Secrètes manquantes** (le 30 : « il restera seulement les visuels des deux promos et des secrètes manquantes ») : **fait le 1er novembre** à partir des photos du propriétaire (textes, effets, visuels redressés), en attendant des scans propres ; le propriétaire fournira aussi les listes des deux Starter Decks (31 octobre) ;
- refaire les icônes du site, la bannière, etc., selon la nouvelle DA (« Graphite et lavande », `docs/design-3.0.md` de la 3.0) : **fait le 30 octobre** pour les icônes de l'app, le favicon et l'image de partage (« la bannière » a été lue comme cette image, celle qu'on voit quand le lien est partagé : à confirmer) ;
- une démo pour Gentle Mates, à `matetcg.com/demo` derrière un code (1er novembre) : **faite le 2 novembre** (la 3.0.14, plus haut) ;
- « … » : la liste reste ouverte.

**La 3.0.16** (3 novembre ; la dictée du 2 novembre au soir et la liste du 3, avec ses captures) : le Raid allégé (combats plus doux, l'Infini comme la sixième phase, seuils 115 … 1 620 : dix joueurs actifs abattent la sixième phase le 14ᵉ jour, 98 % des saisons contre le Sorcier, 88 % contre le Marionnettiste) et hors du bilan victoires-défaites ; sa page refaite (le bouton « Affronter » dans le premier écran) ; l'atelier sans les clés ni la cote, les étoiles par demies, les filtres étiquetés et le tri à part ; Le Chevalier Rose à la place du médaillon ; les Secrètes en fond de profil ; un écran de chargement ; et les onze points de la liste du 3 (README de la 3.0, § 7.9 et l'historique des versions). Vérifié : 70 tests du moteur, 17 essais Deno, les tests SQL, Chromium ; **pas** Safari ni un vrai téléphone.

**Le planning officiel** (le propriétaire, 2 novembre) : maintenance dans la nuit du lundi 9 au mardi 10 novembre, 0 h (lundi 9, 23 h UTC) ; sortie de la 3.0 dans la nuit du mardi 10 au mercredi 11, 0 h (mardi 10, 23 h UTC). D'ici là, dans l'ordre : les validations du propriétaire (point 4) ; un export de la vraie base pour répéter la mise à jour (point 7) ; les essais sur de vrais téléphones (point 9) ; le jour J (point 8). Le récap de L'Échauffement disparaît du vrai site le samedi 7 novembre, 0 h : du 7 au 9, la 2.x n'a plus d'événement en cours.

**Ce qu'il reste avant la sortie de la 3.0 (2 novembre ; la date est fixée depuis le soir : maintenance dans la nuit du lundi 9 au mardi 10 novembre, sortie dans la nuit du mardi 10 au mercredi 11, à 0 h).** La liste de ce que la session connaît ; d'autres choses peuvent se révéler à l'usage. Pour chaque point : qui le fait.
1. ~~Des scans propres~~ : **faits** — les Secrètes 124, 126 et 127 depuis le 3 novembre (la 127 refaite le 8, avec « S »), P03 et P04 le 8 novembre. Les photos redressées font l'affaire en attendant (126, prise sous un cadre, est la plus terne) ; un scan les remplace sous un autre nom de fichier (`fichier`, `js/promos-data.js`), sans rien d'autre à changer.
2. ~~Les listes officielles des Starter Decks~~ : **dans le jeu depuis le 8 novembre** (3.0.17). Mesuré : le Toxique gagne 271 parties sur 400 face au Déter (68 %, adversaire du jeu au niveau 3 des deux côtés), comme les listes reconstituées d'avant — un écart des decks officiels eux-mêmes, à connaître. Avant : le Toxique gagne 68,5 % des parties face au Déter (274 sur 400, IA de même niveau), avant comme après l'arrivée des vraies Promos ; quinze variantes essayées ne le corrigent pas (`docs/economie-3.0.md`).
3. ~~Les lectures des règles~~ : **tranchées par la session le 2 novembre au soir**, à la demande du propriétaire (`docs/regles-3.0.md` § 11 ; un seul point change le moteur). Ce qui suit était la liste : la Provocation, une attaque sans valeur, le soutien, la Riposte, un Coach joué par Résilience, « Jouez cette carte » et la couleur, le mélange des piles, le remplacement, l'Essence qui entre désengagée, l'ordre du mulligan, piocher plus que le Club ; et, depuis le 1er novembre, GP Explorer II, Paris Gentle Mates et « Sermont » (l'attaque de Brawks Trop Déter, peut-être une coquille de « Serment »). Le point 8 (qui commence) est tranché : pile ou face. Chaque lecture se change en un endroit du moteur.
4. **Les validations en attente** — le propriétaire : les étoiles par demies de l'atelier (3.0.16, à la place des clés de la 3.0.15) ; le Raid allégé et ses seuils (3.0.16) ; l'Infini commun du Raid, son pas et son coffre (3.0.15) ; les finitions de la maîtrise et son barème (une Secrète en Légende : six mois environ depuis la 3.0.14) ; le Raid réglé (seuils, le Marionnettiste à 80 % de vie) et son dernier coffre (une Légendaire et un titre) ; la cote des cartes montrée aux joueurs ; « Ta journée » et les Réglages ; ce que la démo pour Gentle Mates montre et cache (la présentation, les joueurs simulés, la chasse ouverte, pas d'invitations) ; le Choc en deux semaines et ses récompenses aux deux tiers ; « Aujourd'hui » dans les Quêtes ; le mot « IA » retiré de l'écran ; les deux teintes changées pour les contrastes (pastilles, bouton principal) ; le Marionnettiste comme second boss et son réglage qui n'existe que dans la page (§ 7) ; « la bannière » lue comme l'image de partage ; les deux questions de DA (README de la 3.0, § 14.3) ; et, pour la 2.5, la lecture des récompenses du mode sans fin (§ 1).
5. ~~La copie d'un Starter~~ : **tranché le 1er novembre** (le propriétaire : seulement avec ses propres cartes), fait en 3.0.14.
6. ~~La sécurité des récompenses de combat~~ : **faite en 3.0.14** (le serveur rejoue chaque combat, plus haut) ; reste à déployer sa fonction le jour J (point 8).
7. **Répéter la mise à jour sur une copie des vraies données** (suggestion 8 du 30) — un export par le propriétaire, puis la session.
8. **Le jour J** (README de la 3.0, § 2.7) — l'accord et la date du propriétaire, puis la session : comparer la base, publier le code, déployer la fonction `combat-verifier`, coller `TOUT.sql` (la maintenance s'allume d'elle-même), vérifier, lever la maintenance.
9. **Essayer sur de vrais téléphones, et avec un lecteur d'écran** (iPhone avec Safari et VoiceOver, Android avec Chrome et TalkBack) — le propriétaire ou des invités : la session n'a vérifié que dans Chromium, téléphone simulé ; Safari (WebKit) n'a jamais été essayé, ni le son sur téléphone, ni le zoom au doigt en combat (permis depuis la 3.0.13).
10. **Côté 2.x**, sans lien avec la 3.0 mais en attente : vérifier le vrai site après le lundi 26, 0 h, puis le 4 novembre (§ 6) ; les branches `version-2.5`, `claude/interface-ux-fixes-o92u4a` et `teaser-2.x` sont **supprimées** (le propriétaire, 2 novembre) et `prebuild/` retiré ; si la 3.0 sortait entre le 4 et le 7 novembre, le récap de L'Échauffement (§ 5) — le propriétaire vise le début de la semaine du 9 novembre.
11. **La question de Gentle Mates** — le propriétaire leur écrit d'abord, « pour savoir si ça serait possible, avant de dev quoi que ce soit » (2 novembre au soir). Rien n'est construit d'ici leur réponse. La démo montre l'ouverture de boosters et les échanges, que Gentle Mates avait demandé de retirer.
12. **La date de sortie** — le propriétaire : « je pense qu'on déploiera la 3.0 début de semaine prochaine » (la semaine du 9 novembre). L'avis de la session est dans son compte rendu du 2 au soir.

**Ce que la session propose d'ajouter (31 octobre, revu le 1er novembre).** Des propositions, pas une liste exhaustive ; les durées sont des estimations. Les suggestions du 30 qui restent (1 Versus en différé, 7 notifications, 8 répétition) tiennent toujours ; 2 (la validation côté serveur) est faite en 3.0.14 ; 3 (« Aujourd'hui ») est fait, dans les Quêtes ; 10 (l'accessibilité) l'est en partie (README de la 3.0, § 4.13). S'y ajoutent :
11. **Des tests d'interface versionnés** : les scripts Playwright des sessions (le tutoriel joué de bout en bout, l'arène, la maintenance, l'historique, qui commence, la fiche de carte, l'audit des débordements) vivent hors du dépôt ; les y verser, comme les tests SQL de la 3.0.12, permettrait à toute session de tout revérifier d'une commande. Deux à trois heures.
12. ~~« Qui commence » côté serveur~~ : sans objet, chaque partie se tire à pile ou face (le propriétaire, 31 octobre).
13. ~~Une confirmation avant « Fin du tour »~~ : **faite en 3.0.14** (Réglages › Jeu, « Demander avant de finir un tour », activée par défaut ; la question vient quand un Joueur peut encore attaquer, jamais dans le tutoriel).
14. ~~Les images des cartes chargées avant le combat~~ : **fait le 31 octobre** après mesure (la 3.0.12, plus haut, « Corrigés en chemin »).
15. **Des statistiques de combattant au profil** : **fait en partie** (3.0.13 : victoires, solo, entre amis, série et record, campagne). Restent le Joueur le plus joué et le deck préféré, qui demandent des compteurs (l'historique ne garde que trente combats). Deux à trois heures.
16. **Les vibrations** aux moments forts du combat (une touche, une victoire), sur Android : iPhone ne les permet pas dans une page web. Une heure, avec un réglage pour les couper.
17. **Le texte des cartes dans la Collection, pour un lecteur d'écran** (1er novembre) : une case ne dit que le nom ; la fiche donne tout le texte, mais il faut l'ouvrir. Y ajouter le texte en description de la case. Une à deux heures.

*L'avis de la session (une opinion, pas un fait) :* avant la sortie, 1 à 9 de « Ce qu'il reste » dans cet ordre ; parmi les suggestions, 11 d'abord ; le reste après la sortie.

## 5. Ce qui passe de la 2.x à la 3.0

**Règle** (dans les deux `CLAUDE.md`) : tout changement de la 2.x qui n'est pas propre à la 2.x se reporte dans la 3.0, dans la même session si possible ; sinon il est inscrit ici, « à reporter ». La 3.0 ne se fusionne jamais dans `main`, et la 2.x ne se fusionne pas dans `version-3.0` (leurs fichiers ont trop divergé) : on reporte à la main, fichier par fichier, et on teste dans la 3.0.

| Changement de la 2.x | Date | Dans la 3.0 |
|---|---|---|
| Reverses : recyclage et fabrication datés (`parametres.reverses_des`, `reverses_ouvertes()`), prix 400 / 500 / 2 400 (`prix_reverse()`), `me()` › `parametres.reverses`, la page | 22-23 oct. | **reporté** (3.0.10, 24 oct.) : `supabase/installation/22c_reverses.sql`, même corps de fichier |
| Fin du récap réglable (`evenements.recap_jusqua`) | 22 oct. | **reporté** (3.0.10) |
| Marques de cache à empreinte (`tools/version.py`) | 23 oct. | **reporté** (3.0.10) |
| Les milliers en espace insécable (`fmtN`) | 22 oct. | **reporté** (3.0.10) |
| Sortie datée d'une version (`SORTIE`, `parametres.sorties`) | 23 oct. | à décider : la 3.0 sortira après une maintenance, pas forcément ainsi |
| L'Échauffement (`ech_*`), l'indice 127 | 22-23 oct. | propre à la 2.x : la 3.0 a ses propres combats. Sa base doit seulement ne pas casser les tables `ech_*` à la sortie (README de la 3.0, « Pièges ») |
| Labo de la 2.5 | 23 oct. | la 3.0 a son propre Labo, refait sur le même modèle (3.0.10, `29_labo.sql`) : il remplace celui de la 2.5 sur la base le jour de la sortie |
| La ligne des Fragments, la même dans Classiques et Reverses | 24 oct. | **reporté** (24 oct.) |
| L'Échauffement devenu événement (`22e` : ligne d'événement, Braises, Pass, 13 quêtes, boutique) | 24 oct. | propre à la 2.x ; la 3.0 doit seulement le supporter : **testé** (24 oct.) — la 3.0 rejouée deux fois sur une base où deux joueurs l'ont joué retire ses quêtes et sa boutique sans casser les inventaires |
| Ses titres et cadres (`t_echauffe`, `t_ech_round`, `t_ech_feu`, `t_ech_entraineur`, `t_ech_infatigable`, `f_braise`, `f_ardeur`) | 22-24 oct. | **reporté** (24 oct.) : `TITRES`, `FRAMES`, `CADRE_SOURCE`, les deux SVG, `css/reflets.css`, `tools/cadres.py` ; ceux qui les ont les gardent (inventaire) |
| Le mode sans fin (`22f`), « en attendant la 3.0 » | 24 oct. | **fermé par la 3.0** (24 oct.) : `29_labo.sql` retire ses neuf fonctions et le déclencheur de `22e` ; ses tables restent et se vident aux remises à zéro |
| Une quête d'événement ne compte que pendant son événement (`bump_quests`) | 24 oct. | rien à reporter : la 3.0 l'avait déjà (`01_schema.sql`) |
| Monnaie d'événement générique (`MONNAIES_EV`, `evIco`), classement (`evenement_etat` › `rang`, `joueurs`) | 24 oct. | rien à reporter : la 2.5 les a repris de la 3.0 |
| Les remises à zéro de la 3.0 ne connaissaient pas `labo_sauvegardes` | (3.0.10) | **corrigé dans la 3.0** (24 oct.) : gardée par `reset-profil.sql`, effacée par `reset-tout.sql` |
| Si la 3.0 sort pendant le récap de L'Échauffement (4-7 novembre) | — | **à reprendre ce jour-là** : son `evenement_recap` n'a pas le bloc propre à la 2.5 (étoiles, défis) |
| Le Pass refait : les titres et cadres aux paliers 5, 10, 15, 20 | 25 oct. | **reporté** (25 oct., `1116081`) : les commentaires de `TITRES` et `FRAMES`, `CADRE_SOURCE` |
| L'onglet sur la charpente de Reflets, la fin de combat en scène, l'entrée en face-à-face, la révélation des 21 étoiles, le récap resserré, et leurs sons (`etoile`, `tampon`, `vs`, `bloque`, `impact`) | 25 oct. | propres à L'Échauffement : rien à reporter (la 3.0 a ses propres combats et son propre écran d'événement) |
| Les envois contrôlés et leur essai (`tools/maj-2.5/` : empreintes, droits, contenu) | 24-25 oct. | propres à la mise à jour 2.5 ; la méthode servira à la sortie de la 3.0 : à reprendre ce jour-là |
| La monnaie de L'Échauffement dans les écrans communs (`MONNAIES_EV.echauffement`, `braiseIco`, `evIco`) | 24 oct. | **reporté** (25 oct.) : une 3.0 qui sortirait pendant l'événement ou son récap (jusqu'au 7 novembre) dirait « Braises », pas « Prismes » |
| Les leçons de la mise à jour de la vraie base : le propriétaire colle le fichier, on vérifie en lecture seule ; les fins de ligne Windows (`fix-crlf.sql`) ; les comparaisons en `jsonb` | 25 oct. | **reporté** (25 oct.) : `CLAUDE.md`, README § 13 point 33, `supabase/administration/fix-crlf.sql` |
| La 2.5 finale (le Pass refait du 25) face à la 3.0 | 25 oct. | **testé** (25 oct.) : la 3.0 rejouée deux fois sur une base 2.5 où un joueur a gagné les titres et cadres du nouveau Pass ; il les garde, `titres_de` les donne, le mode sans fin est fermé |
| L'écran « Merci » dans la DA de la 3.0, et ses textes (« J'ai un accès », plus de « pas encore ») | 1er nov. | **reporté** (2 nov., `17b97e0`) : la 3.0 l'avait oublié, et l'aurait défait le jour de sa sortie |
| La démo autonome en zip retirée (`tools/demo.py` sans option, `_demo/LISEZMOI.txt`) | 2 nov. | **retirée aussi** (2 nov., `034bd78`) |
| `_config.yml` : la doc, le SQL, les outils et le kit presse ne sont plus publiés sur matetcg.com | 2 nov., le soir | **reporté** (le même fichier sur `version-3.0`, pour que la 3.0 le garde en sortant) |
| `prebuild/` retiré de `main` ; la branche `version-2.5` supprimée (le propriétaire) | 2 nov., le soir | rien à reporter : la doc de la 3.0 ne renvoie plus à `version-2.5` |
| La date de la 3.0 dans le récap de L'Échauffement (`PROCHAINE`, `vEchSuite30`) | 3 nov. | propre à la 2.x : rien à reporter (la 3.0 ferme L'Échauffement) |

## 6. Dimanche 25 octobre : publier la 2.5 (fait, sauf les contrôles d'après minuit)

**Fait dans la nuit du 25 (étapes 1 à 3) : voir « Ce qui s'est passé » à la fin du paragraphe.** L'ordre comptait : le site d'abord, la base ensuite. La base mise à jour crée la ligne d'événement `echauffement`, que le site publié le 23 octobre ne connaît pas : il rouvrirait une fois à chaque joueur la fenêtre des nouveautés de la 2.1, puis, à la sortie, appellerait les Braises « Prismes », compterait les quêtes de l'événement dans la pastille de Quêtes sans les montrer, et n'aurait ni Pass ni boutique de l'événement. La dernière `version-2.5` est faite pour marcher avec et sans la mise à jour (sans : ni événement ni mode sans fin, Labo « fonction absente ») ; c'est vérifié avec (prébuild), et seulement à la lecture du code sans.

1. **L'accord du propriétaire pour publier sur la racine de `main`** la dernière 2.5 (celle du 25 octobre, règle 1) ; s'il retient des idées du § 3, elles d'abord, sur `version-2.5`, essayées dans le prébuild (`python3 tools/demo.py --prebuild`, puis reporter `prebuild/` sur `main`).
2. **Le site** : `python3 tools/version.py 2.5` (en dernier, après toute autre modification des CSS et des JS), commit, `version-2.5` fusionnée dans `main`, poussée. Contrôle : le site dit toujours « version 2.1.3 », le récap de Reflets est là.
3. **La base** (accord donné le 24 octobre) :
   - comparer d'abord la vraie base au modèle (`tools/maj-2.5/agregat.sql`, en lecture seule) : `C|210|281c441b…`, `F|87|eb557b19…`, `T|33|669f1168…` (rien n'est passé) ; ou `C|214|f2c0e67e…`, `F|105|bb6ab1e2…`, `T|34|feaad1e2…` (l'envoi tenté le 24 au soir est passé après coup : les envois ci-dessous conviennent aussi) ; tout autre résultat : s'arrêter et chercher ;
   - les trois envois, par l'outil Supabase, chacun avec la confirmation du propriétaire (ils contiennent `delete from` et `drop`) : `_build/maj-2.5/envoi-1.sql`, `-2`, `-3`, refaits au besoin par `bash tools/maj-2.5/banc.sh` puis `python3 tools/maj-2.5/envois.py`, et essayés par `bash tools/maj-2.5/essai.sh` (deux copies du modèle, chaque envoi joué deux fois : refait le 25 avec le nouveau Pass, les deux finissent identiques à une installation neuve) ; chacun s'annule entier au moindre écart d'empreinte, de droits, ou de contenu (le Pass, les quêtes, la boutique de l'événement) ;
   - à défaut de l'outil : coller `supabase/MAJ-2.5.sql` d'un bloc dans le SQL Editor (rejouable) ;
   - contrôle final : `C|236|8236f2bf…`, `F|118|e44e662b…`, `T|37|7ace681b…` (une installation neuve de la branche).
4. **Contrôle** : `verif.html` tout vert (y compris L'Échauffement et le mode sans fin) ; le site dit « version 2.1.3 » ; aucune fenêtre ne se rouvre.
5. **Après minuit** : le site dit « version 2.5 », la fenêtre des nouveautés s'ouvre, le défi 1 se joue et paie ses Braises, le Pass, les quêtes et la boutique de l'événement répondent, une Reverse se fabrique.
6. **Mercredi 4 novembre, 0 h** : la saison se termine, le récap (bandeau, fenêtre, sous-onglet) et le défi du jour apparaissent. **Samedi 7, 0 h** : fin du récap.

**Ce qui s'est passé, le 25 dans la nuit.**
- Étapes 1 et 2 : accord du propriétaire ; `tools/version.py 2.5` (marque `2.5-198119`) ; `version-2.5` fusionnée dans `main` (`e9f0c36`, seul conflit `prebuild/index.html`, pris de `version-2.5` ; `preprod/` et `CNAME` intacts) ; chargé dans Chromium sans erreur (« 2.1.3 », l'écran d'entrée) ; servi par GitHub Pages à 02 h 22 UTC.
- Étape 3 : la base, comparée d'abord, était exactement le modèle (`C|210|281c441b…`, `F|87|eb557b19…`, `T|33|669f1168…`) : l'envoi du 24 n'était jamais passé. L'envoi 1 tenté deux fois par l'outil : la confirmation n'est pas parvenue au propriétaire dans la minute, l'outil a tout annulé (base relue entre les deux : inchangée). Le propriétaire a collé `MAJ-2.5.sql` lui-même (vers 02 h 35 UTC). Relue : tout comme une installation neuve, sauf 79 fonctions en fins de ligne Windows (`F|118|6fcb5c2e…`, la copie depuis le navigateur ; diagnostic reproduit sur le banc ; sans effet sur le jeu). `tools/maj-2.5/fix-crlf.sql`, essayé sur le banc, envoyé (sans confirmation : ni `delete` ni `drop`). Relue : `C|236|8236f2bf…`, `F|118|e44e662b…`, `T|37|7ace681b…`, 11 règles d'accès, 1 déclencheur, le contenu (`tools/maj-2.5/donnees.sql`) identique au banc. `me()`, `ech_etat()`, `ech_sf_etat()`, `evenement_etat()`, `labo_etat()`, `ech_admin()` appelées en administrateur, dans un bloc annulé à la fin : sans erreur, avec les bonnes dates.
- Étape 4 : `verif.html` n'a pas été ouvert sur le vrai site (il faut un administrateur connecté) : au propriétaire.
- Restent les étapes 5 (après minuit) et 6 (le 4 novembre).

## 7. Décisions récentes, et pourquoi

- **22 oct.** La vraie base était restée au SQL de la 2.1.0 : la mise à jour rattrape la 2.1.1. Règle ajoutée : comparer la base avant toute mise à jour.
- **22 oct.** Prix des Reverses fabriquées : 400 / 500 / 2 400 et non le double d'une classique (simulation, `tools/equilibre-reverses.py`).
- **23 oct.** La 2.1.4 devient la **2.5**, une mise à jour à part entière (fenêtre, numéro), qui sort à la fin du récap de Reflets.
- **23 oct.** Les Reverses ouvrent avec la 2.5, et non à la fin de Reflets.
- **23 oct.** L'indice 3 dit **127** (122 + 5 Secrètes).
- **23 oct.** Branches : `version-2.5` remplace `claude/interface-ux-fixes-o92u4a` et `teaser-2.x` (toutes deux contenues dans `version-2.5` et `main`). Leur suppression est à faire par le propriétaire : le proxy GitHub des sessions Claude Code refuse de supprimer une branche.
- **23 oct.** Le Labo est refait : ce qui touche le serveur est réel et se confirme, ce qui touche son compte se sauvegarde et se restaure, les aperçus restent locaux. L'onglet « Affichage » (des changements « affichage seulement ») disparaît.
- **24 oct.** La 3.0 reçoit les reports de la 2.5 et son Labo refait (3.0.10). La session de travail tournait dans un conteneur remplacé sans prévenir : le travail de la 3.0, testé mais pas encore commité, a été perdu puis refait. Règle ajoutée aux deux `CLAUDE.md` : commiter et pousser au fur et à mesure.
- **24 oct.** « La 2.5 ne fait pas assez update » (le propriétaire) : L'Échauffement devient un événement sur la charpente de Reflets, sans toucher aux règles du combat ; les montants (Braises, Pass, boutique) sont calculés en tête de `22e_echauffement-evenement.sql`.
- **24 oct.** Le mode sans fin commence le 4 novembre, après le rattrapage ; son récap passe par Boosters, lui par Combats (le propriétaire) ; 21 adversaires de niveaux mêlés, pas de difficulté qui monte, le niveau de récompense de Devine l'illu.
- **24 oct.** Le sous-onglet « Récompenses » cède la place au Pass ; la ligne des Fragments est la même dans Classiques et Reverses (le propriétaire).
- **24 oct.** Règle 8 de `CLAUDE.md` élargie : toutes les vues de l'événement tiennent dans l'écran (les six sous-onglets pendant la saison, puis le défi du jour, son classement, les indices et le récap).
- **24 oct.** La mise à jour de la vraie base attend : l'accord est donné, mais l'outil Supabase demande au propriétaire une confirmation pour chaque envoi qui efface ou retire (`delete from`, `drop`), et celle du 24 au soir n'est pas venue dans la minute. Elle est prête en trois envois contrôlés (`tools/maj-2.5/`), à faire **après** la publication du site (§ 6).
- **24 oct.** La 3.0 fermera le mode sans fin à sa sortie (« du temps qu'on pourra pas publier la 3.0 ») : sinon ses appels continueraient de verser des Éclats.
- **25 oct.** Règle 8 précisée (le propriétaire) : elle vise les écrans qui défilent « d'un tout petit peu » alors qu'ils pourraient tenir ; les pages détaillées peuvent défiler. La règle du 24 (« toutes les vues tiennent ») avait produit un écran tassé, « moche ».
- **25 oct.** L'onglet de L'Échauffement reprend la charpente de l'écran Reflets, avec les couleurs de l'événement (le propriétaire : « un mix », « cohérent avec l'écran reflet ») ; plus d'écran en graphite et lavande à part.
- **25 oct.** Le Pass : des paliers significatifs (un cosmétique tous les cinq), sans Essence Brillante, « c'est qu'un mini event » (le propriétaire).
- **25 oct.** La fin de combat en scène (le propriétaire) ; l'entrée en face-à-face, la révélation des 21 étoiles et le récap resserré (la session) : à valider par le propriétaire.
- **25 oct.** Le banc de la mise à jour : le calendrier du 22 y échouait sans bruit depuis le 23 au soir (une installation neuve lance Reflets « maintenant ») ; sans effet sur les empreintes, corrigé. L'essai des envois était décrit comme fait « sur une copie de la base de production » : c'était le modèle de la vraie base, ce que le README dit désormais.
- **25 oct., dans la nuit.** La 2.5 publiée à la racine de `main`, puis la base mise à jour (le propriétaire : « vasy publie sur main et fais le sql »). La confirmation de l'outil Supabase n'ayant jamais atteint le propriétaire (trois fois sur trois, les 24 et 25), la voie retenue pour la base est désormais celle de la règle 7 : le propriétaire colle le fichier, la session vérifie en lecture seule (`CLAUDE.md`). Deux pièges consignés : les fins de ligne Windows d'un collage (`fix-crlf.sql`), et l'ordre des colonnes de la vraie base, qui fausse une comparaison en `row_to_json` (on compare en `jsonb`).
- **25 oct., dans la nuit.** Le mode sans fin ne passe pas dans la 3.0 (« c'est juste pour patienter ») : la 3.0 le ferme déjà à sa sortie (§ 5).
- **30 oct.** Les raids se comptent depuis le premier jour du Choc (et non plus depuis le 12 octobre) : le premier raid de l'événement est le raid 1. Le second boss est **Le Marionnettiste** (#121) : un choix de la session, à valider par le propriétaire. À phases égales, il était bien plus dur que le Sorcier (mesuré) : il a un PV et une Essence d'avance de moins que la phase, ce qui égalise les victoires et les dégâts (README de la 3.0, § 7.9).
- **30 oct.** L'Épreuve du jour : numérotée (« Épreuve 5 sur 21 ») et un calendrier des règles sur trois semaines ; le Choc doit s'ouvrir à minuit (heure de Paris) pour faire exactement 21 Épreuves ; le Labo pose un jour à minuit.
- **30 oct.** La maîtrise : les finitions refaites ne s'animent que par `transform` et `opacity` (la 3.0.8 faisait tomber la fiche à 20 images par seconde) ; une carte maîtrisée entre en combat avec sa maîtrise à tous les niveaux et quel que soit son type. Les noms des niveaux changent (Satin, Liseré, Holo, Lumière, Légende) ; les montants, non.
- **30 oct., l'après-midi.** Les règles officielles font foi, au pied de la lettre (le propriétaire : « n'essaye pas d'inventer toi-même tes propres nuances ») : là où le texte ne tranche pas, la lecture retenue et l'autre sont écrites (`docs/regles-3.0.md` § 11, 13 points), sans règle « maison » de plus.
- **30 oct.** « Tout ouvrir » retiré, des boosters comme des coffres du Raid (le propriétaire : « un coup à miss click »).
- **30 oct.** Le niveau II de maîtrise devient l'Écrin, un cadre posé autour de la carte (le propriétaire : le liseré « dénature un peu la carte » ; la forme est un choix de la session, à valider).
- **31 oct.** L'historique des combats, sans replay (le propriétaire) : trente combats par joueur, environ 1,2 Ko chacun ; le déroulé est résumé par la page et ne peut pas empêcher de payer un combat.
- **31 oct.** Une base 2.x qui a des joueurs entre d'office en maintenance en recevant la 3.0 (choix de la session) : sans cela, entre le collage du SQL et la levée, des pages 2.5 encore ouvertes écriraient dans une base 3.0.
- **31 oct.** « Le perdant commence la partie suivante » : entre amis, le serveur le décide (le dernier défi joué, s'il a un gagnant) ; contre l'IA, le navigateur s'en souvient (choix de la session ; ce qu'est « la partie suivante » est le point 8 du § 11 des règles). **Remplacé le jour même** (plus bas).
- **31 oct., au soir.** Qui commence : pile ou face à chaque partie (le propriétaire) ; la mémoire du perdant est retirée, dans le navigateur et sur le serveur.
- **31 oct.** Le godpack : trois Épiques, deux Légendaires, une Secrète (le propriétaire).
- **31 oct.** La maîtrise consomme des exemplaires, selon un barème par rareté, sans Fragments pour les remplacer (le propriétaire) ; les nombres (C 20 … Secrète 5 exemplaires, 2 000 à 20 000 Fragments) sont de la session, d'après simulation : à valider.
- **31 oct.** Le profil et la fiche d'un joueur ne font plus qu'une carte de visite, les réglages passent dans une feuille (la session, sur « plus épuré, quitte à sacrifier des choses ou offrir plus de personnalisation »).
- **1er nov.** Le Choc dure deux semaines (le propriétaire) ; ses récompenses passent aux deux tiers (la session).
- **1er nov.** Le boss suivant n'est pas nommé avant son arrivée (le propriétaire) ; le Labo, réservé aux administrateurs, le nomme toujours.
- **1er nov.** Les photos des cartes servent de visuels en attendant des scans (la session, sur « peut-on faire quelque chose ? ») : leurs textes se lisent et suffisent au jeu ; les images sont nettes à la taille d'une case, moins en grand.
- **1er nov.** Le mot « IA » quitte l'écran (la session, sur « la non mention d'IA, même de manière implicite ») : « Adversaire », « Difficulté », « en solo ».
- **1er nov.** « Aujourd'hui » vit en tête des Quêtes (la session, sur « il y a déjà beaucoup d'onglets »).
- **1er nov.** Le zoom au doigt est permis ; la pastille et le bouton principal changent de teinte pour les contrastes (la session, sur « rends le site accessible au maximum »).
- **1er nov., le soir.** Un Starter ne se copie qu'avec ses propres cartes ; le serveur vérifie les combats ; le Raid est réglé pour une dizaine de joueurs actifs, sa dernière phase « un vrai exploit » ; la maîtrise est moins longue en haut de l'échelle ; un abandon ne compte perdu qu'au Raid et en Versus, et n'avance aucune quête (le propriétaire). Les montants et réglages qui en découlent sont de la session, mesurés ou simulés : à valider (§ 4, la 3.0.14).
- **1er nov., le soir.** Une démo pour Gentle Mates, à `matetcg.com/demo`, derrière un code, le jeu « à son état 0 » (le propriétaire) ; la session y a mis une présentation en sept écrans, un Labo de test, douze joueurs simulés, la chasse à la carte unique ouverte, pas d'invitations : à valider.
- **2 nov.** « Le fichier demo » à arrêter et à retirer de partout était la démo autonome en zip, pas la pré-prod. `preprod/` et `prebuild/` ont été retirés de `main` par erreur pendant environ une heure, puis remis. La pré-prod sert au propriétaire à tester la 3.0 qu'il publiera pour les joueurs du vrai site ; la démo, à Gentle Mates. Règle ajoutée au `CLAUDE.md` de la 3.0 : une consigne ambiguë qui retire quelque chose de publié se demande avant.
- **2 nov.** Le document de présentation pour Gentle Mates est abandonné (le propriétaire : « ça fait too much »).
- **2 nov., le soir.** L'assistant de deck est retiré, sans retour de la complétion automatique sauf pour les Essences ; l'aide devient un retour chiffré (les clés) qui ne dit jamais quelle carte mettre (le propriétaire). Le choix des cinq clés est de la session.
- **2 nov., le soir.** L'Infini du Raid devient commun : les paliers se franchissent ensemble, la performance de chacun se lit au classement (le propriétaire). Le pas de 400 dégâts et le coffre d'un booster sont de la session.
- **2 nov., le soir.** Les règles non tranchées sont tranchées par la session, à la demande du propriétaire ; le principe : le texte au plus près, et un même mot lu de la même façon partout.
- **2 nov., le soir.** La doc et le code serveur quittent matetcg.com (`_config.yml`), la pré-prod passe derrière son propre code (le propriétaire). Le code de la pré-prod a été choisi par la session et donné au propriétaire en conversation, jamais écrit dans le dépôt.
- **2 nov., le soir.** `prebuild/` est retiré : le propriétaire a supprimé `version-2.5`, « on ne va plus toucher à la 2.x ».
- **2 nov., dans la nuit.** La date de la 3.0 (le propriétaire) : maintenance dans la nuit du lundi 9 au mardi 10 novembre, sortie dans la nuit du mardi 10 au mercredi 11, à 0 h ; « lundi soir à minuit » est lu comme la nuit du lundi au mardi (la session, § 1). Le récap de L'Échauffement l'annonce ; pour qu'il tienne encore sur téléphone, ses trois chiffres de second plan passent en pastilles (la session).
