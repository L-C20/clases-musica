/**
 * backend/services/escuelas.service.js
 * -----------------------------------------------------------------------------
 * Todo el SQL de escuelas vive aca. Ni las rutas ni los controladores
 * escriben consultas: solo llaman a estas funciones.
 */

const { consulta } = require('../config/db');
const { armarSet } = require('./comun');

/**
 * Columnas de conteo que acompanan a cada escuela.
 * Van como subconsultas para no tener que agrupar toda la fila con GROUP BY.
 * El ::int es necesario porque count() devuelve BIGINT y el driver lo
 * entregaria como texto.
 */
const CONTEOS = `
  (SELECT count(*)::int FROM grados g
     WHERE g.escuela_id = e.id AND g.activo) AS total_grados,
  (SELECT count(*)::int FROM alumnos a
     JOIN grados g2 ON g2.id = a.grado_id
     WHERE g2.escuela_id = e.id AND a.activo) AS total_alumnos
`;

async function listar({ incluirInactivas = false } = {}) {
  const { rows } = await consulta(
    `SELECT e.*, ${CONTEOS}
       FROM escuelas e
      WHERE ($1 = TRUE OR e.activo = TRUE)
      ORDER BY e.codigo NULLS LAST, lower(e.nombre)`,
    [incluirInactivas]
  );
  return rows;
}

async function obtenerPorId(id) {
  const { rows } = await consulta(
    `SELECT e.*, ${CONTEOS} FROM escuelas e WHERE e.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function crear(datos) {
  const { rows } = await consulta(
    `INSERT INTO escuelas (codigo, nombre, descripcion, activo)
     VALUES ($1, $2, $3, COALESCE($4, TRUE))
     RETURNING *`,
    [datos.codigo ?? null, datos.nombre, datos.descripcion ?? null, datos.activo ?? null]
  );
  return obtenerPorId(rows[0].id);
}

async function actualizar(id, datos) {
  const { clausula, valores, siguiente } = armarSet(datos);
  const { rowCount } = await consulta(
    `UPDATE escuelas SET ${clausula} WHERE id = $${siguiente}`,
    [...valores, id]
  );
  if (rowCount === 0) return null;
  return obtenerPorId(id);
}

/** Activar / desactivar. Nunca se borra fisicamente una escuela. */
async function cambiarEstado(id, activo) {
  const { rowCount } = await consulta(
    'UPDATE escuelas SET activo = $1 WHERE id = $2',
    [activo, id]
  );
  if (rowCount === 0) return null;
  return obtenerPorId(id);
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };
