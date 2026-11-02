/* =====================================================================
   La démo présentée à Gentle Mates (matetcg.com/demo) : la porte à code.

   tools/demo.py --demo copie ce fichier dans demo/js/demo-acces.js et fait
   attendre le démarrage du jeu (js/app.js) sur window.demoAcces(). Tant
   que le bon code n'est pas entré, rien ne démarre : ni partie, ni joueurs
   simulés, ni fenêtre.

   Le code n'est écrit nulle part : la page ne connaît que son empreinte
   (SHA-256 du code en capitales, sans espace ni tiret). Une fois entré, il
   est retenu sur l'appareil.

   Ce que cette porte ne fait pas : protéger les fichiers. Le site est
   statique ; ses scripts et ses images restent téléchargeables à leur
   adresse par qui la connaît. Elle tient à l'écart un visiteur de passage,
   pas quelqu'un de déterminé.
   ===================================================================== */
"use strict";

(() => {
  const EMPREINTE = '8fc52f5a20989490a20f9c149083bf8ca3365b4a680150f3c531241ce62d8e47';
  const CLE = 'mtcg.demo.acces';

  const lu = () => { try { return localStorage.getItem(CLE); } catch (e) { return null; } };
  const retenir = () => { try { localStorage.setItem(CLE, EMPREINTE); } catch (e) { /* mode privé : on redemandera */ } };
  const normaliser = v => String(v || '').trim().toUpperCase().replace(/[\s-]/g, '');

  async function empreinte(v) {
    if (!(window.crypto && crypto.subtle)) throw new Error('https');
    const o = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
    return [...new Uint8Array(o)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  const STYLE = `
#demo-acces{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;overflow:auto;
  padding:max(24px,env(safe-area-inset-top,0px)) 18px max(24px,env(safe-area-inset-bottom,0px));
  background:radial-gradient(120% 70% at 50% 0%,rgba(138,120,245,.22),transparent 60%),var(--bg,#0f0e14);color:var(--text,#f1eef9);
  font-family:var(--body,'Figtree',system-ui,sans-serif)}
#demo-acces .da-carte{width:100%;max-width:380px;text-align:center}
#demo-acces .da-logo{height:clamp(50px,15vw,66px);width:auto;filter:drop-shadow(0 0 26px rgba(138,120,245,.45))}
#demo-acces .da-art{position:relative;height:clamp(150px,30vh,230px);margin:14px auto 18px;display:flex;justify-content:center;align-items:flex-end}
#demo-acces .da-art img{height:100%;width:auto;border-radius:6px;filter:drop-shadow(0 18px 30px rgba(0,0,0,.55));
  animation:da-flotte 5s ease-in-out infinite}
#demo-acces .da-art::before{content:"";position:absolute;inset:8% 14% 0;border-radius:50%;background:radial-gradient(closest-side,rgba(138,120,245,.38),transparent);filter:blur(10px)}
@keyframes da-flotte{50%{transform:translateY(-8px) rotate(-1.2deg)}}
@media (prefers-reduced-motion:reduce){#demo-acces .da-art img{animation:none}}
#demo-acces .da-tag{display:inline-block;font:800 11px/1 var(--body,'Figtree',sans-serif);letter-spacing:.12em;text-transform:uppercase;
  padding:6px 10px;border-radius:999px;background:rgba(138,120,245,.16);color:var(--deco-ink,#c8bfff);box-shadow:inset 0 0 0 1px rgba(179,166,255,.3)}
#demo-acces h1{font-family:var(--display,'Archivo',sans-serif);font-stretch:112%;font-weight:900;font-style:italic;
  font-size:clamp(26px,7.5vw,32px);letter-spacing:-.02em;line-height:1.05;margin:12px 0 8px}
#demo-acces p{margin:0 auto 18px;max-width:32ch;color:var(--subtle,#b9b3c9);line-height:1.45}
#demo-acces form{display:flex;flex-direction:column;gap:10px;text-align:left}
#demo-acces label{font-size:12.5px;font-weight:800;color:var(--subtle,#b9b3c9);letter-spacing:.02em}
#demo-acces input{width:100%;background:var(--surface,#1a1824);border:1px solid var(--line-2,#3a3550);border-radius:12px;color:inherit;
  font:700 18px/1.2 var(--body,'Figtree',sans-serif);letter-spacing:.14em;text-transform:uppercase;padding:14px;text-align:center}
#demo-acces input:focus{outline:0;border-color:var(--accent-soft,#a99bff);box-shadow:0 0 0 3px var(--accent-wash-2,rgba(138,120,245,.28))}
#demo-acces input[aria-invalid=true]{border-color:var(--danger,#ff6b81)}
#demo-acces .da-err{min-height:1.3em;margin:0;font-size:13.5px;font-weight:700;color:var(--danger,#ff6b81);text-align:center}
#demo-acces .da-pied{margin:22px auto 0;font-size:12px;color:var(--muted,#8d87a0);max-width:36ch}
#demo-acces.da-sort{transition:opacity .35s ease;opacity:0;pointer-events:none}
@media (prefers-reduced-motion:reduce){#demo-acces.da-sort{transition:none}}`;

  /* Le jeu attend ici avant de démarrer (js/app.js). */
  window.demoAcces = () => {
    if (lu() === EMPREINTE) return Promise.resolve();
    return new Promise(ok => {
      const st = document.createElement('style');
      st.textContent = STYLE;
      document.head.appendChild(st);
      const z = document.createElement('div');
      z.id = 'demo-acces';
      z.setAttribute('role', 'dialog');
      z.setAttribute('aria-modal', 'true');
      z.setAttribute('aria-labelledby', 'da-titre');
      const art = typeof PACK_ARTS !== 'undefined' && PACK_ARTS[0] ? PACK_ARTS[0] : 'assets/boosters/booster-01.webp';
      const logo = typeof ART !== 'undefined' && ART.logo ? ART.logo : 'assets/logo-m8.webp';
      z.innerHTML = `<div class="da-carte">
          <img class="da-logo" src="${logo}" alt="Mate TCG Online">
          <div class="da-art" aria-hidden="true"><img src="${art}" alt=""></div>
          <span class="da-tag">Démo privée</span>
          <h1 id="da-titre">Mate TCG Online</h1>
          <p>Entre le code d'accès qui t'a été transmis.</p>
          <form novalidate>
            <label for="da-code">Code d'accès</label>
            <input id="da-code" name="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
              aria-describedby="da-err" required>
            <p class="da-err" id="da-err" role="alert"></p>
            <button class="btn" type="submit">Entrer</button>
          </form>
          <p class="da-pied">Projet non affilié à Gentle Mates. Marques et images appartenant à leurs détenteurs respectifs.</p>
        </div>`;
      document.body.appendChild(z);
      document.body.classList.add('demo-verrou');
      const champ = z.querySelector('#da-code'), err = z.querySelector('#da-err');
      setTimeout(() => champ.focus(), 60);
      champ.addEventListener('input', () => { champ.removeAttribute('aria-invalid'); err.textContent = ''; });
      z.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const v = normaliser(champ.value);
        if (!v) { err.textContent = 'Entre le code.'; champ.setAttribute('aria-invalid', 'true'); return champ.focus(); }
        let bon = false;
        try { bon = (await empreinte(v)) === EMPREINTE; }
        catch (x) { err.textContent = 'Ouvre la démo à son adresse en https.'; return; }
        if (!bon) {
          err.textContent = 'Ce code n\'est pas le bon.';
          champ.setAttribute('aria-invalid', 'true');
          champ.select();
          return;
        }
        retenir();
        document.body.classList.remove('demo-verrou');
        z.classList.add('da-sort');
        setTimeout(() => { z.remove(); st.remove(); }, 400);
        ok();
      });
    });
  };
})();
