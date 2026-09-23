-- =====================================================================
-- seed.sql - datos iniciales
-- Se puede ejecutar varias veces sin duplicar nada (ON CONFLICT DO NOTHING).
-- =====================================================================

INSERT INTO escuelas (codigo, nombre) VALUES
  ('1733', 'Mauelturata'),
  ('1722', 'La Fundición'),
  ('1412', 'Correo Salinas'),
  ('1476', 'María Luisa Duhagon')
-- El indice unico de codigo es parcial (WHERE codigo IS NOT NULL), asi que
-- ON CONFLICT tiene que repetir esa misma condicion para poder usarlo.
ON CONFLICT (codigo) WHERE codigo IS NOT NULL DO NOTHING;
