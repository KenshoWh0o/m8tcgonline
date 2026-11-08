#!/usr/bin/env bash
# La sortie de la 3.0 à la racine de main (README § 2.7, étape 2 ; 3.0.17).
#
#     bash tools/sortie.sh <dossier d'un clone ou d'un worktree du dépôt>
#
# Dans ce dossier : une branche locale « sortie-3.0 », partie de origin/main,
# où tout ce qui est suivi est remplacé par l'arbre de origin/version-3.0, sauf
# demo/ (la démo de Gentle Mates n'est suivie que sur main ; le .gitignore de
# la 3.0 l'ignore, la ligne est retirée sur main). Rien n'est commité ni
# poussé : la session relit `git status`, commite (son message, sa ligne
# Claude-Session), puis pousse `sortie-3.0:main` (un commit de plus sur main,
# sans réécriture). preprod/, CNAME et _config.yml viennent de version-3.0.
set -euo pipefail
M="$(cd "$1" && pwd)"
git -C "$M" fetch -q origin main version-3.0
git -C "$M" checkout -q -B sortie-3.0 origin/main
git -C "$M" rm -r -q --cached . > /dev/null
find "$M" -mindepth 1 -maxdepth 1 ! -name .git ! -name demo -exec rm -rf {} +
git -C "$M" archive origin/version-3.0 | tar -x -C "$M"
sed -i '/^# La démo présentée à Gentle Mates/,/^demo\/$/d' "$M/.gitignore"
git -C "$M" add -A .
echo "Prêt dans $M (branche sortie-3.0) :"
git -C "$M" status --short | awk '{print $1}' | sort | uniq -c
grep -o "APP_VERSION = '[^']*'" "$M/js/pwa.js" || true
test -f "$M/CNAME" && test -f "$M/_config.yml" && test -d "$M/demo" && test -d "$M/preprod" && echo "CNAME, _config.yml, demo/ et preprod/ présents."
