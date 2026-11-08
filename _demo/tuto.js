/* Le tutoriel des combats, seul : matetcg.com/tuto (8 novembre 2026).

   Le propriétaire : « publie maintenant sur matetcg.com/tuto juste le
   tutoriel de combats pour le partager à tous les ultras. juste le tuto,
   avec le même deck tout le temps etc ».

   `python3 tools/demo.py --tuto` copie le jeu avec le faux serveur
   (_demo/serveur.js, aucun compte) et charge ce fichier juste après
   js/app.js, avant que le démarrage n'aille plus loin que son premier
   `await` : ce qui suit remplace donc l'écran du jeu avant qu'il ne soit
   dessiné. La page n'a qu'un accueil et le tutoriel lui-même
   (js/combat/tutoriel.js : les mêmes deux Clubs, dans le même ordre, à
   chaque partie). Ni en-tête, ni barre d'onglets, ni boosters, ni
   collection, ni fenêtre d'accueil, ni notification (les joueurs simulés du
   faux serveur ne se manifestent pas : la boîte de réception ne démarre
   pas). */
"use strict";
(() => {
  const ID = 'tuto-accueil';

  function estFait() {
    try { return tutoFait(); } catch (e) { return false; /* le faux serveur n'a pas encore répondu */ }
  }

  function vAccueil(fait) {
    return `<div class="lockwrap tuto-accueil" id="${ID}" data-fait="${fait}"><div class="lockcard">
      <img class="locklogo" src="${ART.logo}" alt="${h(GAME_NAME)}">
      <span class="locktag">Tutoriel</span>
      <h1 class="locktitle">Le jeu de combat</h1>
      <div class="lockfin">
        <strong>Une partie guidée, en cinq tours, pour apprendre à jouer.</strong>
        <p>Le même deck pour tout le monde. Sans compte, rien à installer.</p>
        ${fait ? '<p class="tuto-fait">Tutoriel déjà réussi sur cet appareil.</p>' : ''}
      </div>
      <div class="lockentree">
        <button class="btn" type="button" data-tuto="go">${fait ? 'Rejouer le tutoriel' : 'Commencer'}</button>
        ${lienDiscord('btn ghost', 'Rejoindre le Discord')}
      </div>
      <p class="mentions">${MENTIONS}</p>
    </div></div>`;
  }

  /* L'écran : l'accueil, ou rien quand l'arène est ouverte (elle se pose
     par-dessus la page, js/combat/table.js). `body.inlock` retire l'en-tête
     et la barre d'onglets (css/auth.css). L'accueil n'est redessiné que s'il
     manque ou si le tutoriel vient d'être réussi : un rendu demandé par le
     jeu ne le fait pas clignoter. */
  render = function () {
    document.body.classList.add('inlock', 'tuto-seul');
    if (typeof Table !== 'undefined' && Table.ouverte()) return;
    const fait = estFait();
    const el = document.getElementById(ID);
    if (!el || el.dataset.fait !== String(fait)) {
      $('#main').innerHTML = vAccueil(fait);
      window.scrollTo(0, 0);
    }
  };

  /* Rien de ce qui entoure le jeu. */
  proposerAccueil = () => {};
  notifQuete = () => {};
  notifQuetes = () => {};
  demarrerBoite = () => {};
  annoncer = () => {};

  /* La fin : ni quête ni Éclats à promettre, ni Guide à chercher. */
  tutoFin = async (E, gagne) => {
    tuto = null;
    if (!gagne) return '<p class="ar-consigne">Pas grave : le tutoriel se rejoue autant que tu veux.</p>';
    try { localStorage.setItem(TUTO_CLE, '1'); } catch (e) { /* mode privé */ }
    return '<p class="ar-consigne">Tutoriel réussi ! Tu connais maintenant les règles du jeu de combat.</p>';
  };

  document.addEventListener('click', e => {
    if (!e.target.closest('[data-tuto="go"]')) return;
    e.preventDefault();
    /* Le même nom pour tout le monde, pas celui du joueur simulé. */
    if (save) save.pseudo = 'Toi';
    lancerTutoriel();
  });
})();
