/**
 * backend/services/ficha.service.js
 * -----------------------------------------------------------------------------
 * La ficha del alumno: todo lo que se sabe de una persona, en UNA consulta
 * desde el punto de vista del frontend.
 *
 * Este servicio no escribe SQL propio. Su trabajo es COMPONER lo que ya
 * resuelven los otros servicios, y hacerlo en paralelo para que la pantalla
 * no espere cuatro viajes seguidos a la base.
 */

const alumnos = require('./alumnos.service');
const clases = require('./clases.service');
const notas = require('./notas.service');

/**
 * @param {number} alumnoId
 * @param {object} filtros  { desde, hasta } acotan el historial de asistencia
 */
async function obtener(alumnoId, { desde = null, hasta = null } = {}) {
  const alumno = await alumnos.obtenerPorId(alumnoId);
  if (!alumno) return null;

  // Las tres consultas no dependen entre si: van juntas.
  const [asistencia, listaDeNotas, resumenDeNotas] = await Promise.all([
    clases.historialDeAlumno(alumnoId, { desde, hasta }),
    notas.listar({ alumnoId }),
    notas.resumenDeAlumno(alumnoId),
  ]);

  return {
    alumno,
    asistencia: {
      estadisticas: asistencia.estadisticas,
      clases: asistencia.clases,
    },
    notas: {
      resumen: resumenDeNotas,
      // listar() ordena por fecha descendente, asi que la primera es la
      // mas reciente: eso es la "nota actual" de la ficha.
      actual: listaDeNotas.length > 0 ? listaDeNotas[0] : null,
      lista: listaDeNotas,
    },
  };
}

module.exports = { obtener };
