-- =====================================================================
-- 002_busqueda_sin_acentos.sql
--
-- Problema: buscar "perez" no encontraba a "Perez" escrito con tilde,
-- porque lower() cambia mayusculas pero no toca los acentos.
--
-- Solucion: la extension unaccent, que viene incluida con PostgreSQL.
--   unaccent('Pérez')  ->  'Perez'
--   unaccent('Ramírez') ->  'Ramirez'
--
-- Se aplica a los dos lados de la comparacion (al dato guardado y al texto
-- buscado), asi da igual como este escrito cada uno.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
