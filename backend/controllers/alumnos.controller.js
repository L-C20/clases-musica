/**
 * backend/controllers/alumnos.controller.js
 */

const servicio = require('../services/alumnos.service');
const servicioGrados = require('../services/grados.service');
const { validarCreacion, validarEdicion } = require('../validators/alumnos.validator');
const { validarId, idOpcional, flag } = require('../validators/comun');
const { ErrorApi } = require('../middleware/errores');

async function listar(req, res) {
  const busqueda = typeof req.query.q === 'string' && req.query.q.trim() !== ''
    ? req.query.q.trim()
    : null;

  const alumnos = await servicio.listar({
    escuelaId: idOpcional(req.query.escuela_id, 'id de escuela'),
    gradoId: idOpcional(req.query.grado_id, 'id de grado'),
    busqueda,
    incluirInactivos: flag(req.query.incluir_inactivos),
  });
  res.json({ ok: true, datos: alumnos });
}

async function obtener(req, res) {
  const id = validarId(req.params.id, 'id de alumno');
  const alumno = await servicio.obtenerPorId(id);
  if (!alumno) throw new ErrorApi(404, 'El alumno no existe');
  res.json({ ok: true, datos: alumno });
}

async function crear(req, res) {
  const datos = validarCreacion(req.body);

  const grado = await servicioGrados.obtenerPorId(datos.grado_id);
  if (!grado) throw new ErrorApi(400, 'El grado indicado no existe');

  const alumno = await servicio.crear(datos);
  res.status(201).json({ ok: true, datos: alumno });
}

async function actualizar(req, res) {
  const id = validarId(req.params.id, 'id de alumno');
  const datos = validarEdicion(req.body);

  if (datos.grado_id !== undefined) {
    const grado = await servicioGrados.obtenerPorId(datos.grado_id);
    if (!grado) throw new ErrorApi(400, 'El grado indicado no existe');
  }

  const alumno = await servicio.actualizar(id, datos);
  if (!alumno) throw new ErrorApi(404, 'El alumno no existe');
  res.json({ ok: true, datos: alumno });
}

/** Alta / baja logica. El alumno nunca se elimina de la base. */
async function cambiarEstado(req, res) {
  const id = validarId(req.params.id, 'id de alumno');
  if (typeof req.body?.activo !== 'boolean') {
    throw new ErrorApi(400, 'Se espera el campo "activo" con valor verdadero o falso');
  }
  const alumno = await servicio.cambiarEstado(id, req.body.activo);
  if (!alumno) throw new ErrorApi(404, 'El alumno no existe');
  res.json({ ok: true, datos: alumno });
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
