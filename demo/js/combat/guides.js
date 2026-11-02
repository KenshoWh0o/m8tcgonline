/* Les Guides (version 3.0) : les règles du combat, expliquées aux joueurs,
   section par section.

   Depuis la 3.0.12, ce sont les règles officielles du Gentle Mates TCG
   (docs/regles-officielles.md), dites avec les mots du jeu. La version à
   vérifier — chaque règle, sa phrase officielle, son code, et ce que le
   texte ne tranche pas — est docs/regles-3.0.md. Les deux doivent dire la
   même chose ; les nombres viennent de REGLE (js/combat/moteur.js), sauf
   ceux écrits en toutes lettres (« trois cases », « un Coach par tour »,
   « une fois par tour ») : ceux-là sont à reprendre à la main si REGLE
   change. */
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
        <p class="gd-lead">Deux <b>CEO</b> s'affrontent, chacun avec son Club de cartes et <b>${R().PV} Points de Victoire</b> (PV) : des cartes posées face cachée.</p>
        <ol class="gd-etapes">
          <li><b>Déploie des Joueurs</b> sur tes trois cases.</li>
          <li><b>Engage des Essences</b> pour payer leurs attaques.</li>
          <li><b>Attaque le CEO adverse</b> : s'il ne défend pas, il est touché et prend un PV en main.</li>
          <li>Tu gagnes en <b>touchant le CEO adverse quand il n'a plus de PV</b>, ou s'il doit piocher dans un Club vide.</li>
        </ol>
        <div class="gd-schema">
          <div class="gd-camp lui"><i></i><i class="eng"></i><i></i></div>
          <div class="gd-ligne-milieu"><span>les lignes</span></div>
          <div class="gd-camp moi"><i></i><i></i><i class="vide"></i></div>
          <p>Trois cases par camp, face à face : une case et celle d'en face forment une <b>ligne</b>. Un Joueur <b>engagé</b> est tourné de côté.</p>
        </div>
        ${note('Ce sont les règles officielles du Gentle Mates TCG. Les rares points qu\'elles ne tranchent pas sont dans le dernier chapitre.')}`
    },
    {
      id: 'cartes', titre: 'Les cartes', ico: 'cards',
      resume: 'Joueurs, Objets, Moments, Coachs, Essences.',
      html: () => `
        <div class="gd-types">
          <div><b>Joueur</b><p>Déployé sur une case. Il a une <b>Défense</b> (la valeur à atteindre pour le vaincre), des <b>attaques</b>, et parfois des <b>capacités</b> (mots-clés, Signature).</p></div>
          <div><b>Objet</b><p>Se <b>lie</b> à un de tes Joueurs : « ce Joueur », c'est celui qui le porte. <b>Pas de limite</b> par Joueur. Quand son Joueur quitte le Terrain, l'Objet part à la défausse.</p></div>
          <div><b>Moment</b><p>Un effet immédiat, puis à la défausse. Autant que tu veux.</p></div>
          <div><b>Coach</b><p>Un effet immédiat, puis à la défausse. <b>Un seul Coach par tour.</b></p></div>
          <div><b>Essence</b><p>Elle ne va pas dans ton Club : elle vit dans ta <b>Réserve</b>. En jeu, on l'engage pour payer les attaques.</p></div>
        </div>
        <h3>Jouer une carte ne coûte rien</h3>
        <p>Seules les <b>attaques</b> se paient en Essences. Deux règles limitent le reste : <b>un Coach par tour</b>, et la <b>restriction par couleur</b>.</p>
        <h3>La restriction par couleur</h3>
        <p>Un <b>Objet</b>, un <b>Coach</b> ou un <b>Moment</b> d'une couleur ne se joue que si tu as une <b>Essence de cette couleur</b> en jeu (engagée ou non : ce n'est pas un coût). Une carte Neutre ${ess('neutre')} se joue toujours. Les Joueurs n'y sont pas soumis.</p>
        <h3>Les effets</h3>
        <p>Un effet <b>immédiat</b> (★) se joue quand la carte arrive ; un effet <b>persistant</b> (sans icône) vaut tant qu'elle est en jeu ; un effet <b>réactif</b> (⚡, « Lorsque… ») se déclenche quand sa condition arrive.</p>`
    },
    {
      id: 'tour', titre: 'Un tour', ico: 'clock',
      resume: 'Les quatre phases, dans l\'ordre.',
      html: () => `
        <ol class="gd-etapes num">
          <li><b>Entretien</b> : pioche une carte, désengage toutes tes cartes, joue la première Essence de ta Réserve.</li>
          <li><b>Action</b> : joue autant de Joueurs, d'Objets et de Moments que tu veux, et un Coach, dans l'ordre que tu veux.</li>
          <li><b>Combat</b> : déclenche les attaques de tes Joueurs, dans l'ordre de ton choix. On n'y joue plus que des attaques.</li>
          <li><b>Fin de tour</b> : défausse jusqu'à garder <b>${R().MAIN_MAX} cartes en main</b> au plus.</li>
        </ol>
        <p>Ta première attaque ouvre la phase de Combat : joue tes cartes <b>avant</b> d'attaquer.</p>
        <h3>Déployer un Joueur</h3>
        <p>Sur une case libre. Si tes trois cases sont prises, tu peux, <b>une fois par tour</b>, bench un de tes Joueurs <b>non engagés</b> (il part à la défausse) pour poser le nouveau à sa place. Un Joueur peut attaquer dès le tour où il arrive.</p>
        <h3>Le début de partie</h3>
        <ul>
          <li>Chacun mélange son Club et sa Réserve.</li>
          <li>Chacun pioche ${R().MAIN} cartes. Une fois, il peut les remélanger dans son Club et en piocher ${R().MAIN} autres.</li>
          <li>Chacun pose les ${R().PV} cartes suivantes face cachée : ses PV. On ne les regarde pas.</li>
          <li>Un pile ou face désigne qui commence, à chaque partie.</li>
          <li>Au tout premier tour de la partie, celui qui commence <b>n'a pas de phase de Combat</b>. Il pioche quand même.</li>
        </ul>`
    },
    {
      id: 'attaquer', titre: 'Attaquer', ico: 'sword',
      resume: 'Payer, déclarer, soutenir, frapper.',
      html: () => `
        <h3>Payer et s'engager</h3>
        <p>Engage autant d'Essences que de symboles devant l'attaque. Un symbole de couleur veut une Essence de sa couleur ; le symbole <b>Neutre</b> ${ess('neutre')} prend n'importe laquelle. Puis le Joueur <b>s'engage</b> (tourné de côté) : il ne pourra plus attaquer ni défendre avant ton prochain entretien.</p>
        <h3>Sur le CEO</h3>
        <p>Une attaque se déclare <b>sur le CEO adverse</b>. Deux exceptions : la <b>Provocation</b> du Joueur d'en face, qui impose d'être ciblé, et des cartes comme Jus de bagarre.</p>
        <h3>La défense, puis le soutien</h3>
        <p>L'adversaire peut déclarer un défenseur : son Joueur <b>désengagé</b> de la <b>même ligne</b> (ou un Joueur avec Garde). S'il le fait, tu peux engager l'attaque d'un de tes Joueurs <b>voisins</b> de l'attaquant, en payant ses Essences : c'est un <b>soutien</b>, et sa valeur <b>s'ajoute</b> à la tienne.</p>
        <h3>Frapper</h3>
        <div class="gd-duel">
          <div><b>Contre un défenseur</b><p>Si l'<b>Attaque</b> (avec son soutien) est au moins égale à sa <b>Défense</b>, il est <b>vaincu</b> : à la défausse, avec ses Objets. Sinon, rien : les dégâts ne restent pas.</p></div>
          <div><b>Sans défenseur</b><p>L'attaque <b>touche le CEO</b> : il prend son premier PV. La valeur de l'attaque ne compte pas — une touche, un PV.</p></div>
        </div>
        <p>Tu peux attaquer encore tant qu'il te reste des Essences et des Joueurs désengagés. Mais attaquer expose : un Joueur engagé ne défendra pas pendant le tour adverse.</p>`
    },
    {
      id: 'defendre', titre: 'Défendre', ico: 'garde',
      resume: 'Qui peut s\'interposer.',
      html: () => `
        <p>Quand on t'attaque, tu peux <b>déclarer un défenseur</b> : il s'engage, et c'est lui que l'attaque frappe.</p>
        <ul>
          <li>Peut défendre : ton Joueur <b>désengagé</b> de la <b>même ligne</b> que l'attaquant.</li>
          <li>Un Joueur avec <b>Garde</b> peut défendre n'importe quelle attaque.</li>
          <li>Sans défenseur, ton CEO est touché.</li>
        </ul>
        <p>L'écran te dit d'avance si ton défenseur <b>tient</b> ou s'il sera <b>vaincu</b>. Attention : l'attaquant peut encore ajouter un <b>soutien</b> après ta déclaration.</p>
        <h3>Bien défendre</h3>
        <p>Un défenseur qui tient ne perd rien, mais il reste engagé jusqu'à ton prochain entretien. Ne pas défendre coûte un PV, qui arrive dans ta main (ou joue sa Résilience).</p>`
    },
    {
      id: 'pv', titre: 'PV et Résilience', ico: 'coeur',
      resume: 'Ce qui se passe quand tu es touché.',
      html: () => `
        <p>Tes PV sont des cartes de ton Club, posées face cachée. Quand ton CEO est touché, tu regardes ton premier PV, et tu le <b>prends en main</b> sans le montrer.</p>
        <h3>La Résilience</h3>
        <p>Beaucoup de Coachs, Moments et Objets ont une <b>Résilience</b>. Si ton premier PV en a une, tu peux la <b>révéler et jouer son effet</b> tout de suite, gratuitement — en plein tour adverse — <b>au lieu</b> de prendre la carte en main. Elle part ensuite à la défausse, sauf si elle dit le contraire.</p>
        <p>« <b>Jouez cette carte</b> » : la carte fait son effet normal (un Objet se lie à un de tes Joueurs). C'est la jouer : la restriction par couleur s'applique.</p>
        <h3>La fin</h3>
        <p>Une attaque qui touche un CEO <b>sans PV</b> gagne la partie. Un CEO qui doit piocher dans un <b>Club vide</b> perd aussi. Et on peut abandonner.</p>`
    },
    {
      id: 'motscles', titre: 'Mots-clés', ico: 'quest',
      resume: 'Provocation, Garde, Buff, Riposte, Légion, Shield, Signature.',
      html: () => `
        ${kw('Provocation', 'L\'attaquant face à ce Joueur doit le cibler.')}
        ${kw('Garde', 'Ce Joueur peut défendre n\'importe quelle attaque.')}
        ${kw('Buff', 'Tes autres Joueurs ont +X Attaque ou +X Défense.')}
        ${kw('Riposte', 'Quand il est vaincu, tu peux déclencher une de ses attaques, pour un coût diminué de 1, en ciblant le Joueur attaquant. Elle se paie avec tes Essences encore désengagées : en garder pour le tour adverse, c\'est garder une Riposte.')}
        ${kw('Légion', 'Quand il est vaincu, tu peux défausser une carte pour le récupérer dans ta main.')}
        ${kw('Shield', 'Tant qu\'il est en jeu, ce Joueur ignore la première attaque qu\'il subit.')}
        ${kw('Signature', 'Le talent propre à un Joueur, selon son icône : <b>★</b> un effet <b>immédiat</b>, quand il arrive sur le Terrain ; <b>⚡</b> un effet <b>réactif</b> (« Lorsque… ») ; sans icône, un effet <b>persistant</b>.')}
        <h3>Le vocabulaire</h3>
        <dl class="gd-voc">
          <dt>Engager / désengager</dt><dd>Tourner une carte de côté quand elle sert (attaquer, soutenir, défendre, payer) / la redresser. Tout se désengage à ton entretien.</dd>
          <dt>Déployé</dt><dd>Sur le Terrain.</dd>
          <dt>Bench</dt><dd>Une carte déployée envoyée à la défausse. Un Joueur bench emporte ses Objets. Ce n'est pas être vaincu.</dd>
          <dt>Vaincu</dt><dd>Un défenseur battu : à la défausse, avec ses Objets.</dd>
          <dt>Détruire, défausser</dt><dd>Mettre à la défausse.</dd>
          <dt>Lier</dt><dd>Attacher un Objet à un Joueur.</dd>
          <dt>Touché</dt><dd>Un CEO frappé par une attaque. Il prend un PV.</dd>
          <dt>Club, Réserve</dt><dd>Ta pioche, et ta pile d'Essences.</dd>
        </dl>
        ${note('Chaque fois qu\'un effet touche une pile, on la mélange ; si un effet fait seulement regarder ou révéler des cartes, elles reprennent leur place, dans le même ordre.')}`
    },
    {
      id: 'deck', titre: 'Construire un deck', ico: 'cards',
      resume: 'Club, Réserve, et les limites.',
      html: () => `
        <ul>
          <li><b>Club : ${R().CLUB} cartes</b> — Joueurs, Objets, Moments, Coachs.</li>
          <li><b>${R().COPIES} exemplaires au plus</b> d'une même carte. Une même carte, c'est <b>le même nom et la même couleur</b>, même si le texte ou l'illustration change : une Reverse, une Promo à l'illustration différente comptent avec elle.</li>
          <li><b>Réserve : ${R().RESERVE} Essences</b>, des couleurs que tu veux. Tu n'as pas besoin de les posséder.</li>
          <li>Les Essences Brillantes que tu possèdes apparaissent brillantes en combat.</li>
        </ul>
        <h3>Les conseils officiels</h3>
        <ul>
          <li>Au moins <b>15 Joueurs</b>, pour ne pas en manquer.</li>
          <li><b>Une ou deux couleurs</b> dans ta Réserve, et un Club construit autour : sinon tu risques de ne pas pouvoir jouer une carte ou attaquer. Dans l'atelier, « Régler d'après mes attaques » l'accorde à tes attaques.</li>
          <li>Surtout des Joueurs dont l'attaque coûte <b>une ou deux Essences</b>.</li>
        </ul>
        ${note('Les Starter Decks des Sections sont prêtés : tu peux les jouer sans en avoir les cartes.')}`
    },
    {
      id: 'modes', titre: 'Les modes', ico: 'trophy',
      resume: 'Campagne, Arcade, Raid, Versus.',
      html: () => `
        <h3>Les Sections</h3>
        <p>En entrant dans les Combats, tu rejoins une <b>Section</b> : Toxique ou Déter, comme les deux Starter Decks. Tu reçois sa Promo et son Starter Deck, et la campagne te fait affronter l'autre Section.</p>
        <h3>Campagne</h3>
        <p>Vingt rivaux de la Section adverse, en quatre actes, de plus en plus forts. Chaque rival battu pour la première fois paie ; la finir te donne la Promo de l'autre Section. Quatre combats ont une règle de plus, annoncée avant (plus de PV, une Essence d'avance).</p>
        <h3>Arcade</h3>
        <p>Choisis la difficulté, de 1 à 5 : ton adversaire reçoit un deck tiré au sort, différent à chaque partie. Plus c'est dur, plus ça rapporte.</p>
        ${note('En solo, les cinq premières victoires du jour rapportent des Éclats (Arcade, et combats de campagne rejoués). L\'XP n\'a pas de limite.')}
        <h3>Raid</h3>
        <p>Un boss pour tout le serveur, <b>un nouveau toutes les deux semaines</b>. Chaque PV que tu lui prends compte pour tous : à chaque palier de dégâts, une <b>phase</b> tombe et ouvre un <b>coffre commun</b> pour tous ceux qui ont combattu ; tes propres dégâts paient aussi des <b>paliers personnels</b>. Six phases ; la dernière abattue, place au <b>mode Infini</b>. Trois tentatives par jour.</p>
        <h3>Versus</h3>
        <p>Pas de recherche d'adversaire : tu défies un de tes amis, il accepte, et vous jouez en direct, 60 secondes par tour. Les trois premiers défis de la journée rapportent des Éclats.</p>`
    },
    {
      id: 'lectures', titre: 'Ce que les règles ne disent pas', ico: 'flask',
      resume: 'Les points que le texte officiel ne tranche pas.',
      html: () => `
        <p>Là où le texte officiel ne tranche pas, le jeu retient la lecture la plus proche du texte :</p>
        <ul class="gd-maison">
          <li><b>Provocation</b> : l'attaque se déclare sur ce Joueur, qui n'est pas engagé ; on compare à sa Défense. Un Joueur avec Garde peut encore défendre à sa place.</li>
          <li><b>Une attaque sans valeur</b> (seulement un effet) est une attaque comme les autres : elle se défend, et touche le CEO si personne ne la défend.</li>
          <li><b>Le soutien</b> : un seul voisin, désengagé ; seule sa valeur s'ajoute (pas son effet), et ce n'est pas une attaque de plus.</li>
          <li><b>La Riposte</b> ne se défend pas, et seule sa valeur compte.</li>
          <li><b>Un Coach joué par sa Résilience</b> ne compte pas dans la limite d'un Coach par tour.</li>
          <li><b>Le mélange des piles</b> : un texte qui dit où placer les cartes (« dessus », « dessous », « dans l'ordre de votre choix ») l'emporte.</li>
          <li><b>Qui commence</b> : un pile ou face, à chaque partie.</li>
          <li><b>Remplacer un Joueur</b> : le nouveau prend la case de celui qui est bench.</li>
          <li><b>GP Explorer II</b> : celui qui la joue choisit ses deux Joueurs, puis l'adversaire. Ce tour-là, il ne joue plus de Joueur, même par un effet qui dit « jouez ».</li>
          <li><b>Paris Gentle Mates</b> : les deux Essences Mauves rendues à la Réserve sont d'abord celles qui ont déjà payé ; seule la valeur de l'attaque double, pas un soutien.</li>
        </ul>
        ${note('La composition des deux Starter Decks est provisoire : leur liste officielle n\'est pas encore connue.')}`
    }
  ];
})();

/* Version 3.0.6 : le glossaire. Chaque mot du jeu, en une ou deux phrases,
   et le chapitre du Guide qui en dit plus. Même source que les chapitres :
   docs/regles-3.0.md ; les nombres viennent de REGLE. */
const GLOSSAIRE = (() => {
  const R = () => Combat.REGLE;
  const m = (mot, def, voir) => ({ mot, def, voir });
  return () => [
    m('Action (phase d\')', 'La deuxième phase du tour : jouer des Joueurs, des Objets, des Moments (autant qu\'on veut) et un Coach, dans l\'ordre qu\'on veut.', 'tour'),
    m('Arcade', 'Un combat en solo, à la difficulté choisie (1 à 5 étoiles), contre un deck tiré au sort.', 'modes'),
    m('Attaque', 'Une ligne d\'un Joueur précédée d\'Essences : c\'est son coût. Elle se déclare sur le CEO adverse ; contre un défenseur, son nombre se compare à sa Défense.', 'attaquer'),
    m('Bench', 'Une carte déployée envoyée à la défausse. Un Joueur bench emporte ses Objets. Ce n\'est pas être vaincu.', 'motscles'),
    m('Buff', 'Mot-clé : tes autres Joueurs ont +X Attaque ou +X Défense.', 'motscles'),
    m('Campagne', 'Vingt rivaux de la Section adverse, en quatre actes. Chacun paie la première fois qu\'il tombe.', 'modes'),
    m('Case', `${R().LIGNES} par camp, face à celles de l'adversaire. Une case et celle d'en face font une ligne.`, 'essentiel'),
    m('CEO', 'Toi, et ton adversaire. Il a des PV ; touché alors qu\'il n\'en a plus, il a perdu.', 'essentiel'),
    m('Club', `Ton deck : ${R().CLUB} cartes (Joueurs, Objets, Moments, Coachs). Tu y pioches une carte à chaque entretien ; le Club vide au moment de piocher, tu perds.`, 'deck'),
    m('Coach', 'Un effet immédiat, puis la défausse. Un seul Coach par tour. Soumis à la restriction par couleur.', 'cartes'),
    m('Combat (phase de)', 'Elle commence à ta première attaque du tour : on n\'y joue plus que des attaques. Le tout premier tour de la partie n\'en a pas.', 'tour'),
    m('Coût', 'Les Essences dessinées devant une attaque. Une de couleur veut sa couleur ; la Neutre prend n\'importe laquelle.', 'attaquer'),
    m('Défausse', 'Où vont les Moments et Coachs joués, les cartes défaussées, détruites ou bench, et les Joueurs vaincus avec leurs Objets.', 'motscles'),
    m('Défendre', 'Quand on t\'attaque, ton Joueur désengagé de la même ligne (ou un Joueur avec Garde) peut s\'interposer : il s\'engage, et c\'est lui que l\'attaque frappe.', 'defendre'),
    m('Défense', 'Le nombre d\'un Joueur : la valeur à atteindre ou dépasser pour le vaincre.', 'attaquer'),
    m('Déployer', 'Poser un Joueur de sa main sur une case libre. Gratuit, autant qu\'on veut. Les trois cases prises, une fois par tour, on peut en bench un non engagé pour mettre le nouveau à sa place.', 'tour'),
    m('Désengager', 'Redresser une carte. Toutes tes cartes se désengagent à ton entretien.', 'motscles'),
    m('Détruire', 'Mettre à la défausse.', 'motscles'),
    m('Effet immédiat (★)', 'Une Signature qui se joue quand le Joueur arrive sur le Terrain.', 'motscles'),
    m('Engager', 'Tourner une carte de côté quand elle sert : attaquer, soutenir, défendre, payer. Un Joueur engagé ne peut ni attaquer ni défendre jusqu\'à ton prochain entretien.', 'attaquer'),
    m('Entretien', 'La première phase du tour : piocher, tout désengager, jouer la première Essence de la Réserve.', 'tour'),
    m('Essence', 'Elle paie les attaques, et sa couleur permet de jouer les Objets, Coachs et Moments de cette couleur. Elle vit dans ta Réserve, et n\'a pas besoin d\'être possédée.', 'cartes'),
    m('Essence Brillante', 'La version rare d\'une Essence : si tu la possèdes, tes Essences de sa couleur brillent en combat. Rien d\'autre ne change.', 'deck'),
    m('Fin de tour', `La dernière phase : défausser jusqu'à garder ${R().MAIN_MAX} cartes en main au plus.`, 'tour'),
    m('Garde', 'Mot-clé : ce Joueur peut défendre n\'importe quelle attaque.', 'motscles'),
    m('Infini (mode)', 'Au Raid, une fois les six phases tombées : chaque victoire fait monter d\'un palier, plus dur, pour la performance de chacun.', 'modes'),
    m('Joueur', 'La carte qui se déploie, attaque et défend. Il a une Défense, des attaques, parfois des capacités.', 'cartes'),
    m('Légion', 'Mot-clé : vaincu, tu peux défausser une carte pour le récupérer dans ta main.', 'motscles'),
    m('Lier', 'Attacher un Objet à un de tes Joueurs. Il le garde tant qu\'il reste en jeu ; pas de limite d\'Objets.', 'cartes'),
    m('Ligne', 'Une case et celle d\'en face. Défendre, Provocation et le face-à-face se jouent ligne contre ligne.', 'essentiel'),
    m('Main', `${R().MAIN} cartes au départ, qu'on peut changer une fois. ${R().MAIN_MAX} au plus à la fin de son tour.`, 'tour'),
    m('Moment', 'Un effet immédiat, puis la défausse. Autant que tu veux. Soumis à la restriction par couleur.', 'cartes'),
    m('Mot-clé', 'Une capacité de Joueur : Provocation, Garde, Buff, Riposte, Légion, Shield.', 'motscles'),
    m('Mulligan', `Changer sa main de départ : la remélanger dans son Club et piocher ${R().MAIN} cartes. Une seule fois.`, 'tour'),
    m('Neutre', 'Le symbole gris d\'un coût : n\'importe quelle Essence le paie. Une carte Neutre se joue sans condition de couleur.', 'attaquer'),
    m('Niveau', 'Ton niveau de combattant. Chaque combat fini rapporte de l\'XP ; chaque niveau paie.', 'modes'),
    m('Objet', 'Il se lie à un de tes Joueurs et reste avec lui : « ce Joueur », c\'est celui qui le porte. Il part à la défausse quand son Joueur quitte le Terrain.', 'cartes'),
    m('Phase (Raid)', 'Une étape du boss commun : elle tombe quand les dégâts de tout le serveur atteignent son seuil, et ouvre un coffre pour tous.', 'modes'),
    m('Pioche', 'Une carte du Club à chaque entretien, même au tout premier tour. Un CEO qui doit piocher dans un Club vide a perdu.', 'tour'),
    m('Provocation', 'Mot-clé : l\'attaquant face à ce Joueur doit le cibler.', 'motscles'),
    m('PV', `Les Points de Victoire : ${R().PV} cartes de ton Club posées face cachée. Touché, ton CEO prend le premier en main, ou en joue la Résilience.`, 'pv'),
    m('Raid', 'Un boss pour tout le serveur, un nouveau toutes les deux semaines : six phases, des coffres communs et personnels, puis l\'Infini.', 'modes'),
    m('Remplacer', 'Les trois cases prises, une fois par tour : bench un Joueur non engagé pour déployer le nouveau à sa place.', 'tour'),
    m('Réserve', `Tes ${R().RESERVE} Essences, mélangées, face cachée. La première entre en jeu à chaque entretien.`, 'tour'),
    m('Résilience', 'Sur un Coach, un Moment ou un Objet : quand c\'est le PV que tu prends, tu peux jouer son effet tout de suite, gratuitement, au lieu de le garder en main.', 'pv'),
    m('Restriction par couleur', 'Un Objet, un Coach ou un Moment d\'une couleur ne se joue qu\'avec une Essence de cette couleur en jeu.', 'cartes'),
    m('Riposte', 'Mot-clé : vaincu, ce Joueur peut déclencher une de ses attaques contre le Joueur attaquant, pour une Essence de moins.', 'motscles'),
    m('Section', 'Toxique ou Déter : ton camp dans les Combats. Elle donne son Starter Deck et sa Promo, et la campagne t\'oppose à l\'autre.', 'modes'),
    m('Shield', 'Mot-clé : tant qu\'il est en jeu, ce Joueur ignore la première attaque qu\'il subit.', 'motscles'),
    m('Signature', 'Le talent propre à un Joueur : un effet immédiat (★), réactif (⚡) ou persistant (sans icône).', 'motscles'),
    m('Soutien', 'Quand l\'adversaire défend, un de tes Joueurs voisins de l\'attaquant peut engager son attaque (en la payant) : sa valeur s\'ajoute.', 'attaquer'),
    m('Starter Deck', 'Le deck d\'une Section, prêté : tu peux le jouer sans en posséder les cartes.', 'deck'),
    m('Touché', 'Un CEO frappé par une attaque. Une touche = un PV, quelle que soit la valeur de l\'attaque.', 'pv'),
    m('Vaincu', 'Un défenseur dont l\'Attaque reçue (avec son soutien) égale ou dépasse sa Défense : à la défausse, avec ses Objets.', 'attaquer'),
    m('Versus', 'Un défi en direct contre un ami, 60 secondes par tour.', 'modes')
  ];
})();
