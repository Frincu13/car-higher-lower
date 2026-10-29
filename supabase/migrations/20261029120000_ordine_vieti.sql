-- În ordine are acum trei vieți și mașini cu loc clar, deci scorurile cresc mult.
-- Recordurile de dinainte (o greșeală și gata) ies din clasamentul general fără să
-- fie șterse: trec pe o categorie care nu se mai afișează.
update public.scoruri_general
set cat = cat || ':fara-vieti'
where joc = 'ordine' and cat in ('hp', 'weight', 'accel');
