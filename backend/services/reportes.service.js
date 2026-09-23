/**
 * backend/services/reportes.service.js
 * -----------------------------------------------------------------------------
 * Reportes agregados: por escuela, por grado y por alumno.
 *
 * Los tres siguen la misma forma: dos CTE que resumen asistencias y notas en
 * el rango de fechas pedido, y un LEFT JOIN contra la entidad. Se hace asi, y
 * no con subconsultas dentro del SELECT, para recorrer cada tabla UNA sola vez
 * en vez de una por fila.
 *
 * El criterio de asistencia es el mismo de clases.service.js:
 *   porcentaje = (presentes + tardes) / (total - justificados)
 */

const { consulta } = require('../config/db');
const { calcularPorcentaje } = require('./clases.service');

/** Conteos por estado, sobre un alias de asistencias llamado asi. */
const CONTEOS = `
  count(asi.id)::int                                            AS total,
  count(asi.id) FILTER (WHERE asi.estado = 'presente')::int     AS presentes,
  count(asi.id) FILTER (WHERE asi.estado = 'ausente')::int      AS ausentes,
  count(asi.id) FILTER (WHERE asi.estado = 'tarde')::int        AS tardes,
  count(asi.id) FILTER (WHERE asi.estado = 'justificado')::int  AS justificados
`;

/** Pasa los conteos crudos a los numeros que muestra la pantalla. */
function armarFila(fila) {
  const estadisticas = {
    total: fila.total ?? 0,
    presentes: fila.presentes ?? 0,
    ausentes: fila.ausentes ?? 0,
    tardes: fila.tardes ?? 0,
    justificados: fila.justificados ?? 0,
  };

  return {
    ...fila,
    ...estadisticas,
    porcentaje: calcularPorcentaje(estadisticas),
    promedio_notas: fila.promedio_notas === null ? null : Number(fila.promedio_notas),
    cantidad_notas: fila.cantidad_notas ?? 0,
  };
}

/* ---------------------------------------------------------------------------
 * Por escuela
 * ------------------------------------------------------------------------ */

async function porEscuela({ desde = null, hasta = null } = {}) {
  const { rows } = await consulta(
    `WITH asis AS (
       SELECT g.escuela_id, ${CONTEOS}
         FROM asistencias asi
         JOIN clases c ON c.id = asi.clase_id
         JOIN grados g ON g.id = c.grado_id
        WHERE ($1::date IS NULL OR c.fecha >= $1)
          AND ($2::date IS NULL OR c.fecha <= $2)
        GROUP BY g.escuela_id
     ),
     notas AS (
       SELECT g.escuela_id,
              round(avg(ev.nota), 2) AS promedio_notas,
              count(*)::int          AS cantidad_notas
         FROM evaluaciones ev
         JOIN alumnos a ON a.id = ev.alumno_id
         JOIN grados  g ON g.id = a.grado_id
        WHERE ev.nota IS NOT NULL
          AND ($1::date IS NULL OR ev.fecha >= $1)
          AND ($2::date IS NULL OR ev.fecha <= $2)
        GROUP BY g.escuela_id
     ),
     dictadas AS (
       SELECT g.escuela_id, count(*)::int AS clases
         FROM clases c
         JOIN grados g ON g.id = c.grado_id
        WHERE ($1::date IS NULL OR c.fecha >= $1)
          AND ($2::date IS NULL OR c.fecha <= $2)
        GROUP BY g.escuela_id
     )
     SELECT e.id, e.codigo, e.nombre,
            (SELECT count(*)::int FROM grados g
               WHERE g.escuela_id = e.id AND g.activo) AS grados,
            (SELECT count(*)::int FROM alumnos a
               JOIN grados g ON g.id = a.grado_id
              WHERE g.escuela_id = e.id AND a.activo)  AS alumnos,
            COALESCE(dictadas.clases, 0) AS clases,
            COALESCE(asis.total, 0) AS total,
            COALESCE(asis.presentes, 0) AS presentes,
            COALESCE(asis.ausentes, 0) AS ausentes,
            COALESCE(asis.tardes, 0) AS tardes,
            COALESCE(asis.justificados, 0) AS justificados,
            notas.promedio_notas,
            COALESCE(notas.cantidad_notas, 0) AS cantidad_notas
       FROM escuelas e
       LEFT JOIN asis     ON asis.escuela_id = e.id
       LEFT JOIN notas    ON notas.escuela_id = e.id
       LEFT JOIN dictadas ON dictadas.escuela_id = e.id
      WHERE e.activo = TRUE
      ORDER BY e.codigo NULLS LAST, lower(e.nombre)`,
    [desde, hasta]
  );

  return rows.map(armarFila);
}

/* ---------------------------------------------------------------------------
 * Por grado
 * ------------------------------------------------------------------------ */

async function porGrado({ escuelaId = null, desde = null, hasta = null } = {}) {
  const { rows } = await consulta(
    `WITH asis AS (
       SELECT c.grado_id, ${CONTEOS}
         FROM asistencias asi
         JOIN clases c ON c.id = asi.clase_id
        WHERE ($2::date IS NULL OR c.fecha >= $2)
          AND ($3::date IS NULL OR c.fecha <= $3)
        GROUP BY c.grado_id
     ),
     notas AS (
       SELECT a.grado_id,
              round(avg(ev.nota), 2) AS promedio_notas,
              count(*)::int          AS cantidad_notas
         FROM evaluaciones ev
         JOIN alumnos a ON a.id = ev.alumno_id
        WHERE ev.nota IS NOT NULL
          AND ($2::date IS NULL OR ev.fecha >= $2)
          AND ($3::date IS NULL OR ev.fecha <= $3)
        GROUP BY a.grado_id
     ),
     dictadas AS (
       SELECT c.grado_id, count(*)::int AS clases
         FROM clases c
        WHERE ($2::date IS NULL OR c.fecha >= $2)
          AND ($3::date IS NULL OR c.fecha <= $3)
        GROUP BY c.grado_id
     )
     SELECT g.id, g.nombre, g.dia_semana, g.hora_inicio,
            e.id AS escuela_id, e.nombre AS escuela_nombre, e.codigo AS escuela_codigo,
            (SELECT count(*)::int FROM alumnos a
              WHERE a.grado_id = g.id AND a.activo) AS alumnos,
            COALESCE(dictadas.clases, 0) AS clases,
            COALESCE(asis.total, 0) AS total,
            COALESCE(asis.presentes, 0) AS presentes,
            COALESCE(asis.ausentes, 0) AS ausentes,
            COALESCE(asis.tardes, 0) AS tardes,
            COALESCE(asis.justificados, 0) AS justificados,
            notas.promedio_notas,
            COALESCE(notas.cantidad_notas, 0) AS cantidad_notas
       FROM grados g
       JOIN escuelas e ON e.id = g.escuela_id
       LEFT JOIN asis     ON asis.grado_id = g.id
       LEFT JOIN notas    ON notas.grado_id = g.id
       LEFT JOIN dictadas ON dictadas.grado_id = g.id
      WHERE g.activo = TRUE
        AND ($1::int IS NULL OR g.escuela_id = $1)
      ORDER BY lower(e.nombre), g.orden, lower(g.nombre)`,
    [escuelaId, desde, hasta]
  );

  return rows.map(armarFila);
}

/* ---------------------------------------------------------------------------
 * Por alumno
 * ------------------------------------------------------------------------ */

async function porAlumno({ escuelaId = null, gradoId = null, desde = null, hasta = null } = {}) {
  const { rows } = await consulta(
    `WITH asis AS (
       SELECT asi.alumno_id, ${CONTEOS}
         FROM asistencias asi
         JOIN clases c ON c.id = asi.clase_id
        WHERE ($3::date IS NULL OR c.fecha >= $3)
          AND ($4::date IS NULL OR c.fecha <= $4)
        GROUP BY asi.alumno_id
     ),
     notas AS (
       SELECT ev.alumno_id,
              round(avg(ev.nota), 2) AS promedio_notas,
              count(*)::int          AS cantidad_notas,
              max(ev.fecha)          AS ultima_nota_fecha
         FROM evaluaciones ev
        WHERE ev.nota IS NOT NULL
          AND ($3::date IS NULL OR ev.fecha >= $3)
          AND ($4::date IS NULL OR ev.fecha <= $4)
        GROUP BY ev.alumno_id
     )
     SELECT a.id, a.nombre, a.apellido, a.documento,
            g.id AS grado_id, g.nombre AS grado_nombre,
            e.id AS escuela_id, e.nombre AS escuela_nombre, e.codigo AS escuela_codigo,
            COALESCE(asis.total, 0) AS total,
            COALESCE(asis.presentes, 0) AS presentes,
            COALESCE(asis.ausentes, 0) AS ausentes,
            COALESCE(asis.tardes, 0) AS tardes,
            COALESCE(asis.justificados, 0) AS justificados,
            notas.promedio_notas,
            COALESCE(notas.cantidad_notas, 0) AS cantidad_notas
       FROM alumnos a
       JOIN grados   g ON g.id = a.grado_id
       JOIN escuelas e ON e.id = g.escuela_id
       LEFT JOIN asis  ON asis.alumno_id = a.id
       LEFT JOIN notas ON notas.alumno_id = a.id
      WHERE a.activo = TRUE
        AND ($1::int IS NULL OR e.id = $1)
        AND ($2::int IS NULL OR g.id = $2)
      ORDER BY lower(e.nombre), g.orden, lower(a.apellido), lower(a.nombre)`,
    [escuelaId, gradoId, desde, hasta]
  );

  return rows.map(armarFila);
}

/**
 * Totales generales, para encabezar la pantalla de reportes.
 * Se calculan sobre lo que ya devolvio porEscuela, sin volver a la base.
 */
function totales(filasDeEscuela) {
  const suma = (campo) => filasDeEscuela.reduce((acumulado, f) => acumulado + (f[campo] || 0), 0);

  const estadisticas = {
    total: suma('total'),
    presentes: suma('presentes'),
    ausentes: suma('ausentes'),
    tardes: suma('tardes'),
    justificados: suma('justificados'),
  };

  // Promedio general de notas ponderado por cantidad, no promedio de promedios:
  // una escuela con 2 notas no puede pesar lo mismo que una con 40.
  const conNotas = filasDeEscuela.filter((f) => f.promedio_notas !== null);
  const cantidadTotal = conNotas.reduce((a, f) => a + f.cantidad_notas, 0);
  const promedio = cantidadTotal > 0
    ? Math.round(
        (conNotas.reduce((a, f) => a + f.promedio_notas * f.cantidad_notas, 0) / cantidadTotal) * 100
      ) / 100
    : null;

  return {
    escuelas: filasDeEscuela.length,
    grados: suma('grados'),
    alumnos: suma('alumnos'),
    clases: suma('clases'),
    ...estadisticas,
    porcentaje: calcularPorcentaje(estadisticas),
    promedio_notas: promedio,
    cantidad_notas: cantidadTotal,
  };
}

module.exports = { porEscuela, porGrado, porAlumno, totales };
