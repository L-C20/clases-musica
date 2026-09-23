/**
 * backend/services/planilla.service.js
 * -----------------------------------------------------------------------------
 * El corazon de la aplicacion: cargar la asistencia de una clase.
 *
 * Dos operaciones, una consulta cada una:
 *
 *   obtener(gradoId, fecha)  -> todo lo que necesita la pantalla
 *   guardar(...)             -> toda la planilla en UNA transaccion
 *
 * El anti-duplicados no se programa aca: lo garantizan los indices
 * UNIQUE(grado_id, fecha) en clases y UNIQUE(clase_id, alumno_id) en
 * asistencias. Este archivo solo los usa con ON CONFLICT DO UPDATE, asi
 * que guardar por primera vez y corregir despues son la misma operacion.
 */

const { consulta, enTransaccion } = require('../config/db');

const ESTADOS = ['presente', 'ausente', 'tarde', 'justificado'];

/**
 * Devuelve la planilla completa de un grado en una fecha.
 *
 * Incluye los alumnos activos del grado y ademas cualquier alumno inactivo
 * que ya figure en esa clase (para no perder de vista a alguien que se dio
 * de baja despues de esa fecha).
 */
async function obtener(gradoId, fecha) {
  const { rows: gradoFilas } = await consulta(
    `SELECT g.id, g.nombre, g.dia_semana, g.hora_inicio, g.duracion_min,
            e.id AS escuela_id, e.nombre AS escuela_nombre, e.codigo AS escuela_codigo
       FROM grados g
       JOIN escuelas e ON e.id = g.escuela_id
      WHERE g.id = $1`,
    [gradoId]
  );

  if (gradoFilas.length === 0) return null;
  const grado = gradoFilas[0];

  const { rows: claseFilas } = await consulta(
    'SELECT id, tema, observacion, creado_en, actualizado_en FROM clases WHERE grado_id = $1 AND fecha = $2',
    [gradoId, fecha]
  );
  const clase = claseFilas[0] || null;

  const { rows: alumnos } = await consulta(
    `SELECT a.id, a.nombre, a.apellido, a.activo,
            asi.estado, asi.observacion
       FROM alumnos a
       LEFT JOIN asistencias asi
              ON asi.alumno_id = a.id
             AND asi.clase_id = $2
      WHERE a.grado_id = $1
        AND (a.activo = TRUE OR asi.id IS NOT NULL)
      ORDER BY lower(a.apellido), lower(a.nombre)`,
    [gradoId, clase?.id ?? null]
  );

  return {
    escuela: {
      id: grado.escuela_id,
      nombre: grado.escuela_nombre,
      codigo: grado.escuela_codigo,
    },
    grado: {
      id: grado.id,
      nombre: grado.nombre,
      dia_semana: grado.dia_semana,
      hora_inicio: grado.hora_inicio,
      duracion_min: grado.duracion_min,
    },
    fecha,
    // La pantalla usa esto para avisar "esta clase ya tiene asistencia".
    ya_registrada: clase !== null,
    clase,
    alumnos,
  };
}

/**
 * Guarda (o corrige) la planilla completa.
 *
 * Todo ocurre dentro de una transaccion: si algo falla a la mitad, no queda
 * una clase creada sin asistencias ni una asistencia sin su clase.
 *
 * @param {number} gradoId
 * @param {string} fecha              AAAA-MM-DD
 * @param {object} datosClase         { tema, observacion }
 * @param {Array}  asistencias        [{ alumno_id, estado, observacion }]
 */
async function guardar(gradoId, fecha, datosClase, asistencias) {
  return enTransaccion(async (cliente) => {
    // 1. La clase: se crea si no existe, se actualiza si ya existia.
    //    ON CONFLICT usa el indice UNIQUE(grado_id, fecha).
    const { rows } = await cliente.query(
      `INSERT INTO clases (grado_id, fecha, tema, observacion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (grado_id, fecha) DO UPDATE
         SET tema = EXCLUDED.tema,
             observacion = EXCLUDED.observacion
       RETURNING id, (xmax = 0) AS fue_creada`,
      [gradoId, fecha, datosClase.tema ?? null, datosClase.observacion ?? null]
    );

    const claseId = rows[0].id;
    const fueCreada = rows[0].fue_creada;

    if (asistencias.length === 0) {
      return { clase_id: claseId, fue_creada: fueCreada, guardadas: 0 };
    }

    // 2. Las asistencias, todas en un solo INSERT.
    //    UNNEST convierte tres arrays paralelos en filas, asi no hay que
    //    armar "($1,$2),($3,$4),..." a mano ni hacer una consulta por alumno.
    await cliente.query(
      `INSERT INTO asistencias (clase_id, alumno_id, estado, observacion)
       SELECT $1, dato.alumno_id, dato.estado::estado_asistencia, dato.observacion
         FROM UNNEST($2::int[], $3::text[], $4::text[])
              AS dato(alumno_id, estado, observacion)
       ON CONFLICT (clase_id, alumno_id) DO UPDATE
         SET estado = EXCLUDED.estado,
             observacion = EXCLUDED.observacion`,
      [
        claseId,
        asistencias.map((a) => a.alumno_id),
        asistencias.map((a) => a.estado),
        asistencias.map((a) => a.observacion ?? null),
      ]
    );

    return { clase_id: claseId, fue_creada: fueCreada, guardadas: asistencias.length };
  });
}

/**
 * Comprueba que todos los alumnos enviados pertenezcan realmente al grado.
 * Sin esto, una peticion manipulada podria cargar asistencia de un alumno
 * de otra escuela en esta clase.
 */
async function alumnosAjenosAlGrado(gradoId, idsAlumnos) {
  if (idsAlumnos.length === 0) return [];

  const { rows } = await consulta(
    `SELECT id FROM UNNEST($2::int[]) AS id
      WHERE id NOT IN (SELECT a.id FROM alumnos a WHERE a.grado_id = $1)`,
    [gradoId, idsAlumnos]
  );
  return rows.map((r) => r.id);
}

module.exports = { ESTADOS, obtener, guardar, alumnosAjenosAlGrado };
