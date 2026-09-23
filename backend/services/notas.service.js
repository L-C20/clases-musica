/**
 * backend/services/notas.service.js
 * -----------------------------------------------------------------------------
 * Notas / evaluaciones.
 *
 * Misma idea que la planilla de asistencia: una consulta para traer la lista
 * completa de un grado y una transaccion para guardarla entera.
 *
 * Diferencia importante con asistencias: una nota puede quedar VACIA. Si el
 * docente borra el numero de un alumno, esa evaluacion se elimina en vez de
 * guardarse en cero (que significaria algo muy distinto).
 */

const { consulta, enTransaccion } = require('../config/db');

/** Escala de la aplicacion. Se valida tambien en la base (CHECK 1..10). */
const NOTA_MINIMA = 1;
const NOTA_MAXIMA = 10;

/**
 * Planilla de notas de un grado en una fecha.
 *
 * @param {number} gradoId
 * @param {string} fecha   AAAA-MM-DD
 * @param {string} tipo    permite mas de una evaluacion el mismo dia
 */
async function obtenerPlanilla(gradoId, fecha, tipo = 'general') {
  const { rows: gradoFilas } = await consulta(
    `SELECT g.id, g.nombre,
            e.id AS escuela_id, e.nombre AS escuela_nombre, e.codigo AS escuela_codigo
       FROM grados g
       JOIN escuelas e ON e.id = g.escuela_id
      WHERE g.id = $1`,
    [gradoId]
  );

  if (gradoFilas.length === 0) return null;
  const grado = gradoFilas[0];

  const { rows: alumnos } = await consulta(
    `SELECT a.id, a.nombre, a.apellido, a.activo,
            ev.id          AS evaluacion_id,
            ev.nota,
            ev.concepto,
            ev.periodo,
            ev.observacion,
            -- Ultima nota anterior a esta fecha, como referencia al cargar.
            (SELECT anterior.nota
               FROM evaluaciones anterior
              WHERE anterior.alumno_id = a.id
                AND anterior.fecha < $2
                AND anterior.nota IS NOT NULL
              ORDER BY anterior.fecha DESC
              LIMIT 1) AS nota_anterior
       FROM alumnos a
       LEFT JOIN evaluaciones ev
              ON ev.alumno_id = a.id
             AND ev.fecha = $2
             AND ev.tipo = $3
      WHERE a.grado_id = $1
        AND (a.activo = TRUE OR ev.id IS NOT NULL)
      ORDER BY lower(a.apellido), lower(a.nombre)`,
    [gradoId, fecha, tipo]
  );

  const cargadas = alumnos.filter((a) => a.nota !== null).length;

  return {
    escuela: {
      id: grado.escuela_id,
      nombre: grado.escuela_nombre,
      codigo: grado.escuela_codigo,
    },
    grado: { id: grado.id, nombre: grado.nombre },
    fecha,
    tipo,
    ya_registrada: cargadas > 0,
    alumnos: alumnos.map((a) => ({
      ...a,
      // NUMERIC llega como texto desde el driver; se pasa a numero para
      // que el frontend no tenga que adivinar.
      nota: a.nota === null ? null : Number(a.nota),
      nota_anterior: a.nota_anterior === null ? null : Number(a.nota_anterior),
    })),
  };
}

/**
 * Guarda la planilla completa en una transaccion.
 *
 * Cada fila puede:
 *   - traer nota o concepto  -> se crea o se corrige
 *   - venir totalmente vacia -> se borra la evaluacion si existia
 *
 * @param {Array} filas [{ alumno_id, nota, concepto, periodo, observacion }]
 */
async function guardarPlanilla(gradoId, fecha, tipo, filas) {
  const conValor = filas.filter((f) => f.nota !== null || f.concepto !== null);
  const vacias = filas.filter((f) => f.nota === null && f.concepto === null);

  return enTransaccion(async (cliente) => {
    let guardadas = 0;
    let borradas = 0;

    if (conValor.length > 0) {
      // Un solo INSERT para todas las filas, apoyado en el indice unico
      // (alumno_id, fecha, tipo) que crea la migracion 003.
      const resultado = await cliente.query(
        `INSERT INTO evaluaciones (alumno_id, fecha, tipo, nota, concepto, periodo, observacion)
         SELECT dato.alumno_id, $2, $3, dato.nota, dato.concepto, dato.periodo, dato.observacion
           FROM UNNEST($1::int[], $4::numeric[], $5::text[], $6::text[], $7::text[])
                AS dato(alumno_id, nota, concepto, periodo, observacion)
         ON CONFLICT (alumno_id, fecha, tipo) DO UPDATE
           SET nota        = EXCLUDED.nota,
               concepto    = EXCLUDED.concepto,
               periodo     = EXCLUDED.periodo,
               observacion = EXCLUDED.observacion`,
        [
          conValor.map((f) => f.alumno_id),
          fecha,
          tipo,
          conValor.map((f) => f.nota),
          conValor.map((f) => f.concepto),
          conValor.map((f) => f.periodo),
          conValor.map((f) => f.observacion),
        ]
      );
      guardadas = resultado.rowCount;
    }

    if (vacias.length > 0) {
      // Nota borrada en pantalla = evaluacion eliminada.
      const resultado = await cliente.query(
        `DELETE FROM evaluaciones
          WHERE fecha = $2 AND tipo = $3
            AND alumno_id = ANY($1::int[])`,
        [vacias.map((f) => f.alumno_id), fecha, tipo]
      );
      borradas = resultado.rowCount;
    }

    return { guardadas, borradas };
  });
}

/** Comprueba que los alumnos enviados sean realmente de ese grado. */
async function alumnosAjenosAlGrado(gradoId, idsAlumnos) {
  if (idsAlumnos.length === 0) return [];

  const { rows } = await consulta(
    `SELECT id FROM UNNEST($2::int[]) AS id
      WHERE id NOT IN (SELECT a.id FROM alumnos a WHERE a.grado_id = $1)`,
    [gradoId, idsAlumnos]
  );
  return rows.map((r) => r.id);
}

/** Listado de evaluaciones con filtros, para el historial. */
async function listar({ escuelaId = null, gradoId = null, alumnoId = null, desde = null, hasta = null, limite = 300 } = {}) {
  const { rows } = await consulta(
    `SELECT ev.id, ev.fecha, ev.nota, ev.concepto, ev.periodo, ev.tipo, ev.observacion,
            a.id AS alumno_id, a.nombre, a.apellido,
            g.id AS grado_id, g.nombre AS grado_nombre,
            e.id AS escuela_id, e.nombre AS escuela_nombre
       FROM evaluaciones ev
       JOIN alumnos  a ON a.id = ev.alumno_id
       JOIN grados   g ON g.id = a.grado_id
       JOIN escuelas e ON e.id = g.escuela_id
      WHERE ($1::int  IS NULL OR e.id = $1)
        AND ($2::int  IS NULL OR g.id = $2)
        AND ($3::int  IS NULL OR a.id = $3)
        AND ($4::date IS NULL OR ev.fecha >= $4)
        AND ($5::date IS NULL OR ev.fecha <= $5)
      ORDER BY ev.fecha DESC, lower(a.apellido), lower(a.nombre)
      LIMIT $6`,
    [escuelaId, gradoId, alumnoId, desde, hasta, limite]
  );

  return rows.map((r) => ({ ...r, nota: r.nota === null ? null : Number(r.nota) }));
}

/** Resumen de notas de un alumno: promedio, mejor, peor y cantidad. */
async function resumenDeAlumno(alumnoId) {
  const { rows } = await consulta(
    `SELECT count(*)::int AS cantidad,
            round(avg(nota), 2) AS promedio,
            max(nota) AS mejor,
            min(nota) AS peor
       FROM evaluaciones
      WHERE alumno_id = $1 AND nota IS NOT NULL`,
    [alumnoId]
  );

  const r = rows[0];
  return {
    cantidad: r.cantidad,
    promedio: r.promedio === null ? null : Number(r.promedio),
    mejor: r.mejor === null ? null : Number(r.mejor),
    peor: r.peor === null ? null : Number(r.peor),
  };
}

async function eliminar(id) {
  const { rowCount } = await consulta('DELETE FROM evaluaciones WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  NOTA_MINIMA,
  NOTA_MAXIMA,
  obtenerPlanilla,
  guardarPlanilla,
  alumnosAjenosAlGrado,
  listar,
  resumenDeAlumno,
  eliminar,
};
