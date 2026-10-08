-- Strângerea drepturilor: clienții (anon, authenticated) nu au ce căuta cu TRUNCATE,
-- REFERENCES sau TRIGGER pe tabelele noastre (erau puse implicit). Nici pe cele viitoare.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
