-- Les fins de ligne Windows dans les corps de fonction.
--
-- Un fichier SQL copié depuis un navigateur sous Windows, puis collé dans le SQL
-- Editor, arrive en \r\n : chaque fonction qu'il définit garde ses \r dans son corps.
-- Pour PostgreSQL ce sont des blancs (rien ne change, sauf dans un texte écrit sur
-- plusieurs lignes : aucune fonction du jeu n'en a au 25 octobre 2026), mais
-- l'empreinte de pg_get_functiondef change, et toute comparaison avec une
-- installation neuve devient fausse. C'est ce qui est arrivé le 25 octobre 2026
-- avec MAJ-2.5.sql : 79 fonctions sur 118.
--
-- Ce bloc recrée chaque fonction touchée à partir de sa propre définition, sans
-- les \r (create or replace : mêmes droits, même oid, même déclencheur). Rejouable,
-- sans effet s'il n'y a rien à corriger ; ni delete ni drop (l'outil Supabase ne
-- demande pas de confirmation). Contrôle : tools/maj-2.5/donnees.sql, dernière ligne.
do $fix$
declare r record; n int := 0;
begin
  for r in select p.oid, pg_get_functiondef(p.oid) as def from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
              and position(E'\r' in p.prosrc) > 0
  loop
    execute replace(r.def, E'\r', '');
    n := n + 1;
  end loop;
  raise notice '% fonctions recréées sans retour chariot', n;
end $fix$;
