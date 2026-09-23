/**
 * backend/controllers/clases.controller.js
 * -----------------------------------------------------------------------------
 * Historial de clases y estadisticas.
 */

const servicio = require('../services/clases.service');
const { Campos, validarId, idOpcional } = require('../validators/comun');
const { ErrorApi } = require('../middleware/errores');

async function listar(req, res) {
  const { desde, hasta } = new Campos(req.query)
    .fecha('desde', { etiqueta: 'fecha desde' })
    .fecha('hasta', { etiqueta: 'fecha hasta' })
    .fin();

  const clases = await servicio.listar({
    escuelaId: idOpcional(req.query.escuela_id, 'id de escuela'),
    gradoId: idOpcional(req.query.grado_id, 'id de grado'),
    desde: desde ?? null,
    hasta: hasta ?? null,
  });

  res.json({ ok: true, datos: clases });
}

async function obtener(req, res) {
  const id = validarId(req.params.id, 'id de clase');
  const clase = await servicio.obtenerConAsistencias(id);
  if (!clase) throw new ErrorApi(404, 'La clase no existe');
  res.json({ ok: true, datos: clase });
}

/** Borra una clase entera. Solo para corregir una carga equivocada. */
async function eliminar(req, res) {
  const id = validarId(req.params.id, 'id de clase');
  const borrada = await servicio.eliminar(id);
  if (!borrada) throw new ErrorApi(404, 'La clase no existe');
  res.json({ ok: true, datos: { eliminada: true } });
}

/** Historial completo de un alumno: GET /api/alumnos/:id/asistencias */
async function historialDeAlumno(req, res) {
  const id = validarId(req.params.id, 'id de alumno');

  const { desde, hasta } = new Campos(req.query)
    .fecha('desde', { etiqueta: 'fecha desde' })
    .fecha('hasta', { etiqueta: 'fecha hasta' })
    .fin();

  const historial = await servicio.historialDeAlumno(id, {
    desde: desde ?? null,
    hasta: hasta ?? null,
  });

  res.json({ ok: true, datos: historial });
}

module.exports = { listar, obtener, eliminar, historialDeAlumno };
