/* Les Guides (version 3.0) : les règles du combat, expliquées aux joueurs,
   section par section.

   C'est la version à lire en jouant. La version à vérifier — chaque règle
   avec sa source sur les cartes, ou la mention « maison » — est dans
   docs/regles-3.0.md. Les deux doivent dire la même chose ; les nombres
   viennent de REGLE (js/combat/moteur.js), jamais écrits en dur ici. */
"use strict";

const GUIDES = (() => {
  const R = () => Combat.REGLE;
  const ess = k => (typeof essIcon === 'function' ? essIcon(k) : '');
  const kw = (nom, txt) => `<div class="gd-kw"><b>${nom}</b><p>${txt}</p></div>`;
  const note = txt => `<p class="gd-note">${txt}</p>`;

  return [
    {
      id: 'essentiel', titre: 'L\'essentiel', ico: 'star',
      resume: 'Le but, en trente secondes.',
      html: () => `
        <p class="gd-lead">Deux <b>CEO</b> s'affrontent avec leur Club de cartes. Chacun a <b>${R().PV} PV</b> : des cartes posées face cachée.</p>
        <ol class="gd-etapes">
          <li><b>Déploie des Joueurs</b> sur tes trois lignes.</li>
          <li><b>Engage des Essences</b> pour payer leurs attaques.</li>
          <li><b>Attaque le CEO adverse</b> : chaque touche lui fait récupérer un PV.</li>
          <li>Un CEO touché alors qu'il n'a <b>plus de PV</b> a perdu.</li>
        </ol>
        <div class="gd-schema">
          <div class="gd-camp lui"><i></i><i class="eng"></i><i></i></div>
          <div class="gd-ligne-milieu"><span>la frontière</span></div>
          <div class="gd-camp moi"><i></i><i></i><i class="vide"></i></div>
          <p>Trois lignes par camp, face à face. Un Joueur <b>engagé</b> est tourné de côté.</p>
        </div>
        ${note('Ces règles sont reconstituées à partir des cartes : la version officielle n\'est pas encore publiée. Ce qui a été inventé pour combler les vides est listé dans la section « Ce qui est maison ».')}`
    },
    {
      id: 'cartes', titre: 'Les cartes', ico: 'cards',
      resume: 'Joueurs, Coachs, Moments, Objets, Essences.',
      html: () => `
        <div class="gd-types">
          <div><b>Joueur</b><p>Se déploie sur une ligne. Il a une <b>Défense</b>, une ou deux <b>attaques</b>, et parfois un <b>talent</b>.</p></div>
          <div><b>Coach</b> <small>Instant</small><p>Un effet, puis à la défausse. <b>Un seul Coach par tour.</b></p></div>
          <div><b>Moment</b> <small>Instant</small><p>Un effet, puis à la défausse. Autant que tu veux.</p></div>
          <div><b>Objet</b> <small>Lien</small><p>Se <b>lie</b> à un de tes Joueurs et reste avec lui : « Ce Joueur », c'est celui qui le porte. ${R().OBJETS} au plus par Joueur.</p></div>
          <div><b>Essence</b><p>Elle ne va pas dans ton Club : elle vit dans ta <b>Réserve</b>, une pile à part. En jeu, on l'engage pour payer les attaques.</p></div>
        </div>
        <h3>Attaque ou talent ?</h3>
        <p>Une <b>attaque</b> a un coût : les Essences dessinées devant elle. ${ess('rose')}${ess('neutre')} = une Essence Rose et une Essence de n'importe quelle couleur.</p>
        <p>Une ligne <b>sans Essence devant</b> n'est pas une attaque : c'est un <b>talent</b>. Il ne se paie pas.</p>
        <p>Une attaque <b>sans nombre</b> (Omniscience, Rêverie…) n'a que son effet : elle ne vise personne et ne se défend pas.</p>
        <h3>Jouer une carte ne coûte rien</h3>
        <p>Seules les attaques coûtent des Essences. Ce qui limite le reste : <b>un Joueur déployé par tour</b>, <b>un Coach par tour</b>, et trois lignes.</p>`
    },
    {
      id: 'tour', titre: 'Un tour', ico: 'clock',
      resume: 'Dans quel ordre tout se passe.',
      html: () => `
        <ol class="gd-etapes num">
          <li><b>Désengagement</b> : tes Joueurs et tes Essences se redressent.</li>
          <li><b>Le Banc revient</b> dans ta main.</li>
          <li><b>Pioche</b> une carte.</li>
          <li><b>Réserve</b> : la première Essence de ta Réserve entre en jeu.</li>
          <li><b>Phase de jeu</b> : déploie un Joueur, lie des Objets, joue des Instants — dans l'ordre que tu veux.</li>
          <li><b>Phase de Combat</b> : tes Joueurs attaquent, un par un. Tu peux encore jouer des Instants, plus de Joueur ni d'Objet.</li>
          <li><b>Fin du tour</b> : les effets « jusqu'à la fin du tour » s'éteignent.</li>
        </ol>
        <p>Ta première attaque fait passer en phase de Combat : déploie et lie <b>avant</b> d'attaquer.</p>
        <h3>Le début de partie</h3>
        <ul>
          <li>Pile ou face : le jeton désigne qui commence.</li>
          <li>Chacun pioche ${R().MAIN} cartes, et peut une fois changer de main.</li>
          <li>Chacun pose ${R().PV} cartes du dessus de son Club, face cachée : ses PV.</li>
          <li>Celui qui commence ne pioche pas et n'attaque pas à son premier tour. L'autre joue <b>${R().ESSENCES_P2} Essences</b> à son premier tour.</li>
        </ul>
        <p>Club vide au moment de piocher ? Tu pioches dans tes PV : ton CEO est touché.</p>`
    },
    {
      id: 'attaquer', titre: 'Attaquer', ico: 'sword',
      resume: 'Payer, viser, frapper.',
      html: () => `
        <h3>Payer</h3>
        <p>Engage autant d'Essences que de symboles. Un symbole de couleur veut une Essence de sa couleur ; le symbole <b>Neutre</b> ${ess('neutre')} prend n'importe laquelle. Les Essences se redressent au début de ton tour.</p>
        <h3>S'engager</h3>
        <p>Le Joueur qui attaque <b>s'engage</b> (il est tourné de côté). Un Joueur engagé ne peut plus attaquer — sauf si un effet le désengage.</p>
        <h3>Viser</h3>
        <p>Une attaque vise <b>le CEO adverse</b>, ou <b>un Joueur adverse engagé</b>, sur n'importe quelle ligne.</p>
        <ul>
          <li>Un Joueur désengagé ne peut pas être visé : il est sur ses gardes.</li>
          <li><b>Provocation</b> : l'attaquant <i>de sa ligne</i> doit le viser, même désengagé.</li>
          <li><b>Jus de bagarre</b> permet de viser le Joueur adverse de sa ligne.</li>
        </ul>
        <h3>Frapper</h3>
        <div class="gd-duel">
          <div><b>Contre un Joueur</b><p>Si l'<b>Attaque</b> est au moins égale à sa <b>Défense</b>, il est <b>vaincu</b>. Sinon, l'attaque est repoussée et il ne garde aucune trace.</p></div>
          <div><b>Contre le CEO</b><p>Il est <b>touché</b> : il récupère son premier PV dans sa main. La valeur de l'attaque ne compte pas — une touche, un PV.</p></div>
        </div>
        <p>Attaquer expose : ton Joueur reste engagé pendant le tour adverse, et pourra être visé.</p>`
    },
    {
      id: 'defendre', titre: 'Défendre', ico: 'garde',
      resume: 'Qui peut s\'interposer.',
      html: () => `
        <p>Quand on t'attaque, tu peux <b>déclarer un défenseur</b>. Il devient la cible de l'attaque, et il <b>s'engage</b>.</p>
        <ul>
          <li>Peut défendre : ton Joueur <b>désengagé</b> de la <b>ligne de l'attaquant</b>.</li>
          <li>Un Joueur avec <b>Garde</b> défend n'importe quelle ligne.</li>
          <li>On défend une attaque qui vise ton CEO comme une attaque qui vise un de tes Joueurs.</li>
        </ul>
        <p>L'écran te dit d'avance si ton défenseur <b>tient</b> (Défense plus haute que l'Attaque) ou s'il sera <b>vaincu</b>.</p>
        <h3>Bien défendre</h3>
        <p>Un défenseur qui tient ne perd rien… sauf qu'il est maintenant engagé, et que les attaques suivantes pourront le viser. Garder des Joueurs désengagés, c'est garder des défenseurs.</p>`
    },
    {
      id: 'pv', titre: 'PV et Résilience', ico: 'coeur',
      resume: 'Ce qui se passe quand tu es touché.',
      html: () => `
        <p>Tes PV sont des cartes de ton Club, posées face cachée. Quand ton CEO est touché, tu <b>récupères ton premier PV</b> : la carte va dans ta main.</p>
        <h3>La Résilience</h3>
        <p>Beaucoup de Coachs, Moments et Objets ont une <b>Résilience</b>. Si la carte que tu récupères en a une, tu peux la <b>jouer aussitôt, gratuitement</b> — en plein tour adverse — au lieu de la garder en main. La carte part ensuite à la défausse.</p>
        <p>« <b>Jouez cette carte</b> » : la carte fait son effet normal (un Objet se lie à un de tes Joueurs).</p>
        ${note('Être touché n\'est donc pas qu\'une perte : chaque PV récupéré est une carte de plus, ou un coup de théâtre.')}
        <h3>La fin</h3>
        <p>Un CEO touché alors qu'il n'a <b>plus aucun PV</b> a perdu.</p>`
    },
    {
      id: 'motscles', titre: 'Mots-clés', ico: 'quest',
      resume: 'Provocation, Garde, Shield, Riposte, Légion, Buff, Signature.',
      html: () => `
        ${kw('Provocation', 'L\'attaquant face à ce Joueur doit le cibler — même s\'il est désengagé.')}
        ${kw('Garde', 'Ce Joueur peut défendre n\'importe quelle attaque, sur n\'importe quelle ligne.')}
        ${kw('Shield', 'Tant qu\'il est en jeu, ce Joueur ignore la première attaque qu\'il subit.')}
        ${kw('Riposte', 'Quand il est vaincu, tu peux déclencher une de ses attaques, pour un coût diminué de 1, contre le Joueur qui l\'a vaincu. Elle se paie avec tes Essences encore désengagées : en garder pour le tour adverse, c\'est garder une Riposte.')}
        ${kw('Légion', 'Quand il est vaincu, tu peux défausser une carte pour le reprendre en main.')}
        ${kw('Buff', 'Il renforce tes autres Joueurs (+10 Attaque, +20 Attaque, +10 Défense…).')}
        ${kw('Signature', 'Le talent propre à un Joueur. Trois sortes, selon son icône : <b>★</b> un <b>effet d\'entrée</b>, qui se joue quand il arrive sur le plateau ; <b>⚡</b> un effet qui <b>se déclenche</b> quand sa condition arrive (« Lorsque… ») ; sans icône, un effet <b>permanent</b> (« Si… »).')}
        <h3>Le vocabulaire</h3>
        <dl class="gd-voc">
          <dt>Engager / désengager</dt><dd>Tourner une carte de côté (elle a servi) / la redresser.</dd>
          <dt>Déployé</dt><dd>Sur le plateau.</dd>
          <dt>Vaincu</dt><dd>Battu par une attaque : à la défausse, avec ses Objets.</dd>
          <dt>Bench (le Banc)</dt><dd>La carte quitte le jeu un moment : elle revient dans la main de son propriétaire au début de son prochain tour. Un Joueur benché emporte ses Objets. Être benché n'est pas être vaincu.</dd>
          <dt>Détruire</dt><dd>Mettre à la défausse.</dd>
          <dt>Lier</dt><dd>Attacher un Objet à un Joueur.</dd>
          <dt>Touché</dt><dd>Un CEO frappé par une attaque. Il récupère un PV.</dd>
          <dt>Club, Réserve</dt><dd>Ta pioche, et ta pile d'Essences.</dd>
        </dl>`
    },
    {
      id: 'deck', titre: 'Construire un deck', ico: 'cards',
      resume: 'Club, Réserve, et les limites.',
      html: () => `
        <ul>
          <li><b>Club : ${R().CLUB} cartes</b> — Joueurs, Coachs, Moments, Objets.</li>
          <li><b>${R().COPIES} exemplaires au plus</b> d'une même carte ; <b>${R().COPIES_RARES}</b> pour une Légendaire, une Secrète, une Promo ou l'Unique. Une Reverse compte comme sa carte.</li>
          <li><b>Réserve : ${R().RESERVE} Essences</b>, des couleurs que tu veux. Tu n'as pas besoin de les posséder.</li>
          <li>Les Essences Brillantes que tu possèdes apparaissent brillantes en combat.</li>
        </ul>
        <h3>Conseils</h3>
        <ul>
          <li>Une quinzaine de Joueurs, sinon tu manqueras de monde sur tes lignes.</li>
          <li>Accorde ta Réserve à tes attaques : un deck Rose veut des Essences Roses. Le bouton « Réserve auto » le fait pour toi.</li>
          <li>Les cartes à Résilience rendent tes PV utiles : quelques-unes, et chaque touche peut se retourner.</li>
          <li>Les Starter Decks des Sections sont prêtés : tu peux les jouer sans en avoir les cartes, et t'en inspirer.</li>
        </ul>`
    },
    {
      id: 'modes', titre: 'Les modes', ico: 'trophy',
      resume: 'Campagne, PvE infini, défis entre amis.',
      html: () => `
        <h3>Les Sections</h3>
        <p>En entrant dans les Combats, tu rejoins une <b>Section</b> : Toxique ou Déter, comme les deux Starter Decks. Tu reçois sa Promo et son Starter Deck, et la campagne te fait affronter l'autre Section.</p>
        <h3>Campagne</h3>
        <p>Tu affrontes la Section adverse, de plus en plus fort. La finir te donne la Promo de l'autre Section. Elle se rejoue autant qu'on veut — pour le plaisir, la récompense est plus petite.</p>
        <h3>PvE infini</h3>
        <p>Choisis la difficulté : l'IA reçoit un deck tiré au sort. Plus c'est dur, plus ça rapporte — dans la limite d'un nombre de victoires récompensées par jour.</p>
        <h3>Défis entre amis</h3>
        <p>Pas de recherche d'adversaire : tu défies un de tes amis, il accepte, et vous jouez en direct.</p>`
    },
    {
      id: 'maison', titre: 'Ce qui est « maison »', ico: 'flask',
      resume: 'Ce que les cartes ne disent pas.',
      html: () => `
        <p>Les règles officielles ne sont pas publiées. Tout ce qui précède est déduit des cartes — sauf ce qui suit, inventé pour que le jeu tourne. Ces points changeront quand les vraies règles seront connues.</p>
        <ul class="gd-maison">
          <li>Les nombres : ${R().LIGNES} lignes, ${R().PV} PV, ${R().MAIN} cartes en main au départ, un Club de ${R().CLUB}, une Réserve de ${R().RESERVE}, une Essence par tour, ${R().OBJETS} Objets par Joueur.</li>
          <li>Un Joueur et un Coach par tour ; les Moments et les Objets sans limite.</li>
          <li>Ce qu'on peut viser : le CEO, ou un Joueur engagé.</li>
          <li>La défense : désengagé pour défendre, et défendre engage.</li>
          <li>Le seuil : Attaque ≥ Défense, et aucune trace pour qui survit ; une touche = un PV contre le CEO.</li>
          <li>Le Banc : retour en main au début de son prochain tour.</li>
          <li>La victoire au PV manquant, la pioche dans les PV quand le Club est vide.</li>
          <li>Qui commence, et la compensation du second (${R().ESSENCES_P2} Essences au premier tour).</li>
          <li>Les limites d'exemplaires dans un deck.</li>
          <li>Les listes des Starter Decks, et les Promos P03 et P04, provisoires.</li>
        </ul>
        ${note('La liste complète, règle par règle, avec les cartes qui appuient chaque déduction, est tenue à jour avec le jeu.')}`
    }
  ];
})();
