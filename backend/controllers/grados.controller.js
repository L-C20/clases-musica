/**
 * backend/controllers/grados.controller.js
 */

const servicio = require('../services/grados.service');
const servicioEscuelas = require('../services/escuelas.service');
const { validarCreacion, validarEdicion } = require('../validators/grados.validator');
const { validarId, idOpcional, flag } = require('../validators/comun');
const { ErrorApi } = require('../middleware/errores');

async function listar(req, res) {
  const grados = await servicio.listar({
    escuelaId: idOpcional(req.query.escuela_id, 'id de escuela'),
    incluirInactivos: flag(req.query.incluir_inactivos),
  });
  res.json({ ok: true, datos: grados });
}

async function obtener(req, res) {
  const id = validarId(req.params.id, 'id de grado');
  const grado = await servicio.obtenerPorId(id);
  if (!grado) throw new ErrorApi(404, 'El grado no existe');
  res.json({ ok: true, datos: grado });
}

async function crear(req, res) {
  const datos = validarCreacion(req.body);

  // Mensaje claro si la escuela no existe, en vez del error crudo de la
  // clave foranea que devolveria PostgreSQL.
  const escuela = await servicioEscuelas.obtenerPorId(datos.escuela_id);
  if (!escuela) throw new ErrorApi(400, 'La escuela indicada no existe');

  const grado = await servicio.crear(datos);
  res.status(201).json({ ok: true, datos: grado });
}

async function actualizar(req, res) {
  const id = validarId(req.params.id, 'id de grado');
  const datos = validarEdicion(req.body);

  if (datos.escuela_id !== undefined) {
    const escuela = await servicioEscuelas.obtenerPorId(datos.escuela_id);
    if (!escuela) throw new ErrorApi(400, 'La escuela indicada no existe');
  }

  const grado = await servicio.actualizar(id, datos);
  if (!grado) throw new ErrorApi(404, 'El grado no existe');
  res.json({ ok: true, datos: grado });
}

async function cambiarEstado(req, res) {
  const id = validarId(req.params.id, 'id de grado');
  if (typeof req.body?.activo !== 'boolean') {
    throw new ErrorApi(400, 'Se espera el campo "activo" con valor verdadero o falso');
  }
  const grado = await servicio.cambiarEstado(id, req.body.activo);
  if (!grado) throw new ErrorApi(404, 'El grado no existe');
  res.json({ ok: true, datos: grado });
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
