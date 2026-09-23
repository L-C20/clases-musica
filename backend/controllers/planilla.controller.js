/**
 * backend/controllers/planilla.controller.js
 * -----------------------------------------------------------------------------
 * La pantalla de asistencia se resuelve con dos llamadas:
 *
 *   GET  /api/planilla?grado_id=3&fecha=2026-09-23   -> todo lo que necesita
 *   POST /api/planilla                               -> guarda todo junto
 */

const servicio = require('../services/planilla.service');
const { Campos } = require('../validators/comun');
const { ErrorApi } = require('../middleware/errores');

async function obtener(req, res) {
  const { grado_id: gradoId, fecha } = new Campos(req.query)
    .entero('grado_id', { requerido: true, min: 1, etiqueta: 'grado' })
    .fecha('fecha', { requerido: true, etiqueta: 'fecha' })
    .fin();

  const planilla = await servicio.obtener(gradoId, fecha);
  if (!planilla) throw new ErrorApi(404, 'El grado no existe');

  res.json({ ok: true, datos: planilla });
}

/**
 * Valida la lista de asistencias.
 * Se valida fila por fila para poder decir exactamente cual esta mal.
 */
function validarAsistencias(lista) {
  if (!Array.isArray(lista)) {
    throw new ErrorApi(400, 'Se espera una lista de asistencias');
  }

  const errores = [];
  const vistos = new Set();
  const limpias = [];

  lista.forEach((fila, i) => {
    const numero = i + 1;

    const alumnoId = Number(fila?.alumno_id);
    if (!Number.isInteger(alumnoId) || alumnoId < 1) {
      errores.push(`Fila ${numero}: el alumno no es valido`);
      return;
    }

    if (vistos.has(alumnoId)) {
      errores.push(`Fila ${numero}: el alumno ${alumnoId} aparece dos veces`);
      return;
    }
    vistos.add(alumnoId);

    if (!servicio.ESTADOS.includes(fila?.estado)) {
      errores.push(`Fila ${numero}: el estado debe ser uno de ${servicio.ESTADOS.join(', ')}`);
      return;
    }

    const observacion = typeof fila.observacion === 'string' && fila.observacion.trim() !== ''
      ? fila.observacion.trim().slice(0, 500)
      : null;

    limpias.push({ alumno_id: alumnoId, estado: fila.estado, observacion });
  });

  if (errores.length > 0) {
    throw new ErrorApi(400, 'Hay filas de asistencia con problemas', errores);
  }

  return limpias;
}

async function guardar(req, res) {
  const datos = new Campos(req.body)
    .entero('grado_id', { requerido: true, min: 1, etiqueta: 'grado' })
    .fecha('fecha', { requerido: true, etiqueta: 'fecha' })
    .texto('tema', { max: 200, etiqueta: 'tema' })
    .texto('observacion', { max: 1000, etiqueta: 'observacion' })
    .fin();

  const asistencias = validarAsistencias(req.body?.asistencias ?? []);

  // El grado tiene que existir antes de crear la clase.
  const planilla = await servicio.obtener(datos.grado_id, datos.fecha);
  if (!planilla) throw new ErrorApi(404, 'El grado no existe');

  // Ningun alumno de otro grado puede colarse en esta clase.
  const ajenos = await servicio.alumnosAjenosAlGrado(
    datos.grado_id,
    asistencias.map((a) => a.alumno_id)
  );
  if (ajenos.length > 0) {
    throw new ErrorApi(400, 'Hay alumnos que no pertenecen a este grado', ajenos);
  }

  const resultado = await servicio.guardar(
    datos.grado_id,
    datos.fecha,
    { tema: datos.tema, observacion: datos.observacion },
    asistencias
  );

  res.status(resultado.fue_creada ? 201 : 200).json({ ok: true, datos: resultado });
}

module.exports = { obtener, guardar };
