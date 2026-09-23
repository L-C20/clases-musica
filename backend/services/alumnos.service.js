/**
 * backend/services/alumnos.service.js
 * -----------------------------------------------------------------------------
 * SQL de alumnos.
 *
 * El alumno solo guarda grado_id. La escuela se obtiene con un JOIN, asi que
 * es imposible que un alumno quede "en una escuela distinta a la de su grado".
 */

const { consulta } = require('../config/db');
const { armarSet } = require('./comun');

const SELECT_BASE = `
  SELECT a.*,
         g.nombre  AS grado_nombre,
         g.orden   AS grado_orden,
         e.id      AS escuela_id,
         e.nombre  AS escuela_nombre,
         e.codigo  AS escuela_codigo
    FROM alumnos a
    JOIN grados   g ON g.id = a.grado_id
    JOIN escuelas e ON e.id = g.escuela_id
`;

/**
 * Listado con filtros combinables. Todos son opcionales.
 *
 * El patron ($1::int IS NULL OR columna = $1) permite usar una sola consulta
 * para todas las combinaciones de filtros, en vez de ir concatenando trozos
 * de SQL (que es justo lo que abre la puerta a la inyeccion).
 *
 * @param {number|null} filtros.escuelaId
 * @param {number|null} filtros.gradoId
 * @param {string|null} filtros.busqueda   texto libre: nombre, apellido o documento
 * @param {boolean} filtros.incluirInactivos
 */
async function listar({ escuelaId = null, gradoId = null, busqueda = null, incluirInactivos = false } = {}) {
  const { rows } = await consulta(
    `${SELECT_BASE}
      WHERE ($1::int IS NULL OR e.id = $1)
        AND ($2::int IS NULL OR a.grado_id = $2)
        AND ($3::text IS NULL OR (
              unaccent(lower(a.nombre || ' ' || a.apellido)) LIKE '%' || unaccent(lower($3)) || '%'
           OR unaccent(lower(a.apellido || ' ' || a.nombre)) LIKE '%' || unaccent(lower($3)) || '%'
           OR a.documento LIKE '%' || $3 || '%'
        ))
        AND ($4 = TRUE OR a.activo = TRUE)
      ORDER BY lower(a.apellido), lower(a.nombre)`,
    [escuelaId, gradoId, busqueda, incluirInactivos]
  );
  return rows;
}

async function obtenerPorId(id) {
  const { rows } = await consulta(`${SELECT_BASE} WHERE a.id = $1`, [id]);
  return rows[0] || null;
}

async function crear(datos) {
  const { rows } = await consulta(
    `INSERT INTO alumnos (grado_id, nombre, apellido, documento, observaciones, activo)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE))
     RETURNING id`,
    [
      datos.grado_id,
      datos.nombre,
      datos.apellido,
      datos.documento ?? null,
      datos.observaciones ?? null,
      datos.activo ?? null,
    ]
  );
  return obtenerPorId(rows[0].id);
}

async function actualizar(id, datos) {
  const { clausula, valores, siguiente } = armarSet(datos);
  const { rowCount } = await consulta(
    `UPDATE alumnos SET ${clausula} WHERE id = $${siguiente}`,
    [...valores, id]
  );
  if (rowCount === 0) return null;
  return obtenerPorId(id);
}

/** Baja logica: el alumno deja de aparecer pero conserva todo su historial. */
async function cambiarEstado(id, activo) {
  const { rowCount } = await consulta(
    'UPDATE alumnos SET activo = $1 WHERE id = $2',
    [activo, id]
  );
  if (rowCount === 0) return null;
  return obtenerPorId(id);
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };
