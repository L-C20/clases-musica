/**
 * backend/services/clases.service.js
 * -----------------------------------------------------------------------------
 * Historial: clases dictadas, sus asistencias y las estadisticas por alumno.
 *
 * CRITERIO DE ASISTENCIA (importante, es una decision, no una verdad):
 *   - "presente" y "tarde" cuentan como asistio.
 *   - "ausente" cuenta como falta.
 *   - "justificado" NO cuenta como falta, pero tampoco como presente:
 *     se descuenta del total, como una falta con aviso.
 *
 *   porcentaje = (presentes + tardes) / (total - justificados)
 *
 * Si preferis otro criterio, se cambia solo en este archivo.
 */

const { consulta } = require('../config/db');

/** Conteos por estado, reutilizados en varias consultas. */
const CONTEOS_POR_ESTADO = `
  count(asi.id)::int                                              AS total,
  count(asi.id) FILTER (WHERE asi.estado = 'presente')::int       AS presentes,
  count(asi.id) FILTER (WHERE asi.estado = 'ausente')::int        AS ausentes,
  count(asi.id) FILTER (WHERE asi.estado = 'tarde')::int          AS tardes,
  count(asi.id) FILTER (WHERE asi.estado = 'justificado')::int    AS justificados
`;

/** Aplica el criterio de arriba sobre un objeto de conteos. */
function calcularPorcentaje({ total, presentes, tardes, justificados }) {
  const base = total - justificados;
  if (base <= 0) return null;
  return Math.round(((presentes + tardes) / base) * 1000) / 10; // un decimal
}

/**
 * Listado de clases con filtros combinables.
 * @param {number|null} escuelaId
 * @param {number|null} gradoId
 * @param {string|null} desde   AAAA-MM-DD
 * @param {string|null} hasta   AAAA-MM-DD
 */
async function listar({ escuelaId = null, gradoId = null, desde = null, hasta = null, limite = 200 } = {}) {
  const { rows } = await consulta(
    `SELECT c.id, c.fecha, c.tema, c.observacion,
            g.id AS grado_id, g.nombre AS grado_nombre,
            e.id AS escuela_id, e.nombre AS escuela_nombre, e.codigo AS escuela_codigo,
            ${CONTEOS_POR_ESTADO}
       FROM clases c
       JOIN grados   g ON g.id = c.grado_id
       JOIN escuelas e ON e.id = g.escuela_id
       LEFT JOIN asistencias asi ON asi.clase_id = c.id
      WHERE ($1::int  IS NULL OR e.id = $1)
        AND ($2::int  IS NULL OR c.grado_id = $2)
        AND ($3::date IS NULL OR c.fecha >= $3)
        AND ($4::date IS NULL OR c.fecha <= $4)
      GROUP BY c.id, g.id, e.id
      ORDER BY c.fecha DESC, lower(e.nombre), g.orden
      LIMIT $5`,
    [escuelaId, gradoId, desde, hasta, limite]
  );

  return rows.map((fila) => ({ ...fila, porcentaje: calcularPorcentaje(fila) }));
}

/** Una clase con el detalle de cada alumno. */
async function obtenerConAsistencias(claseId) {
  const { rows: clases } = await consulta(
    `SELECT c.id, c.fecha, c.tema, c.observacion,
            g.id AS grado_id, g.nombre AS grado_nombre,
            e.id AS escuela_id, e.nombre AS escuela_nombre
       FROM clases c
       JOIN grados   g ON g.id = c.grado_id
       JOIN escuelas e ON e.id = g.escuela_id
      WHERE c.id = $1`,
    [claseId]
  );

  if (clases.length === 0) return null;

  const { rows: asistencias } = await consulta(
    `SELECT asi.alumno_id, asi.estado, asi.observacion,
            a.nombre, a.apellido, a.activo
       FROM asistencias asi
       JOIN alumnos a ON a.id = asi.alumno_id
      WHERE asi.clase_id = $1
      ORDER BY lower(a.apellido), lower(a.nombre)`,
    [claseId]
  );

  return { ...clases[0], asistencias };
}

/**
 * Borra una clase. El ON DELETE CASCADE de asistencias se lleva sus registros.
 * Se usa solo para corregir una clase cargada por error.
 */
async function eliminar(claseId) {
  const { rowCount } = await consulta('DELETE FROM clases WHERE id = $1', [claseId]);
  return rowCount > 0;
}

/**
 * Historial de un alumno: cada clase con su estado, mas las estadisticas.
 */
async function historialDeAlumno(alumnoId, { desde = null, hasta = null } = {}) {
  const { rows: clases } = await consulta(
    `SELECT c.fecha, asi.estado, asi.observacion,
            c.id AS clase_id, c.tema,
            g.nombre AS grado_nombre, e.nombre AS escuela_nombre
       FROM asistencias asi
       JOIN clases   c ON c.id = asi.clase_id
       JOIN grados   g ON g.id = c.grado_id
       JOIN escuelas e ON e.id = g.escuela_id
      WHERE asi.alumno_id = $1
        AND ($2::date IS NULL OR c.fecha >= $2)
        AND ($3::date IS NULL OR c.fecha <= $3)
      ORDER BY c.fecha DESC`,
    [alumnoId, desde, hasta]
  );

  const { rows: resumen } = await consulta(
    `SELECT ${CONTEOS_POR_ESTADO}
       FROM asistencias asi
      WHERE asi.alumno_id = $1
        AND ($2::date IS NULL OR EXISTS (
              SELECT 1 FROM clases c WHERE c.id = asi.clase_id AND c.fecha >= $2))
        AND ($3::date IS NULL OR EXISTS (
              SELECT 1 FROM clases c WHERE c.id = asi.clase_id AND c.fecha <= $3))`,
    [alumnoId, desde, hasta]
  );

  const estadisticas = { ...resumen[0], porcentaje: calcularPorcentaje(resumen[0]) };
  return { estadisticas, clases };
}

module.exports = {
  listar,
  obtenerConAsistencias,
  eliminar,
  historialDeAlumno,
  calcularPorcentaje,
};
