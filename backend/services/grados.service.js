/**
 * backend/services/grados.service.js
 * -----------------------------------------------------------------------------
 * SQL de grados. Cada grado viaja siempre con el nombre de su escuela y la
 * cantidad de alumnos activos, que es lo que muestran las pantallas.
 */

const { consulta } = require('../config/db');
const { armarSet } = require('./comun');

const SELECT_BASE = `
  SELECT g.*,
         e.nombre AS escuela_nombre,
         e.codigo AS escuela_codigo,
         (SELECT count(*)::int FROM alumnos a
            WHERE a.grado_id = g.id AND a.activo) AS total_alumnos
    FROM grados g
    JOIN escuelas e ON e.id = g.escuela_id
`;

/**
 * @param {object} filtros
 * @param {number|null} filtros.escuelaId  null = todas las escuelas
 * @param {boolean} filtros.incluirInactivos
 */
async function listar({ escuelaId = null, incluirInactivos = false } = {}) {
  const { rows } = await consulta(
    `${SELECT_BASE}
      WHERE ($1::int IS NULL OR g.escuela_id = $1)
        AND ($2 = TRUE OR g.activo = TRUE)
      ORDER BY lower(e.nombre), g.orden, lower(g.nombre)`,
    [escuelaId, incluirInactivos]
  );
  return rows;
}

async function obtenerPorId(id) {
  const { rows } = await consulta(`${SELECT_BASE} WHERE g.id = $1`, [id]);
  return rows[0] || null;
}

async function crear(datos) {
  const { rows } = await consulta(
    `INSERT INTO grados (escuela_id, nombre, orden, dia_semana, hora_inicio, duracion_min, activo)
     VALUES ($1, $2, COALESCE($3, 0), $4, $5, COALESCE($6, 60), COALESCE($7, TRUE))
     RETURNING id`,
    [
      datos.escuela_id,
      datos.nombre,
      datos.orden ?? null,
      datos.dia_semana ?? null,
      datos.hora_inicio ?? null,
      datos.duracion_min ?? null,
      datos.activo ?? null,
    ]
  );
  return obtenerPorId(rows[0].id);
}

async function actualizar(id, datos) {
  const { clausula, valores, siguiente } = armarSet(datos);
  const { rowCount } = await consulta(
    `UPDATE grados SET ${clausula} WHERE id = $${siguiente}`,
    [...valores, id]
  );
  if (rowCount === 0) return null;
  return obtenerPorId(id);
}

async function cambiarEstado(id, activo) {
  const { rowCount } = await consulta(
    'UPDATE grados SET activo = $1 WHERE id = $2',
    [activo, id]
  );
  if (rowCount === 0) return null;
  return obtenerPorId(id);
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };
