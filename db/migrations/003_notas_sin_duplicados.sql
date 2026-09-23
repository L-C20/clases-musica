-- =====================================================================
-- 003_notas_sin_duplicados.sql
--
-- La pantalla de notas funciona igual que la de asistencias: se carga la
-- lista entera de un grado y se guarda todo junto. Para que volver a
-- guardar CORRIJA en vez de duplicar, hace falta una restriccion unica
-- contra la cual apoyar el ON CONFLICT DO UPDATE.
--
-- La clave elegida es (alumno_id, fecha, tipo):
--
--   - Un alumno puede tener muchas evaluaciones a lo largo del año
--     (una por fecha), que es justo lo que conserva el historial.
--   - En una misma fecha puede haber mas de una evaluacion si son de
--     TIPO distinto (por ejemplo 'general' y 'examen').
--   - Lo que no puede haber es la misma evaluacion dos veces.
--
-- 'tipo' es NOT NULL con valor por defecto 'general', asi que el indice
-- no necesita tratar nulos.
-- =====================================================================

-- Por las dudas: si ya existieran filas repetidas de una prueba anterior,
-- se conserva la mas reciente y se borran las otras. En una base nueva
-- esto no borra nada.
DELETE FROM evaluaciones e
 USING evaluaciones mas_nueva
 WHERE e.alumno_id = mas_nueva.alumno_id
   AND e.fecha     = mas_nueva.fecha
   AND e.tipo      = mas_nueva.tipo
   AND e.id        < mas_nueva.id;

CREATE UNIQUE INDEX evaluaciones_alumno_fecha_tipo
  ON evaluaciones (alumno_id, fecha, tipo);
