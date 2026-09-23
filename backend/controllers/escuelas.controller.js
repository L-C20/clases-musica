/**
 * backend/controllers/escuelas.controller.js
 * -----------------------------------------------------------------------------
 * Los controladores son finos a proposito: leen la peticion, validan,
 * llaman al servicio y responden. No tienen SQL ni reglas de negocio.
 *
 * Los errores no se atrapan aca: Express 5 pasa automaticamente cualquier
 * promesa rechazada al middleware de errores.
 */

const servicio = require('../services/escuelas.service');
const { validarCreacion, validarEdicion } = require('../validators/escuelas.validator');
const { validarId, flag } = require('../validators/comun');
const { ErrorApi } = require('../middleware/errores');

async function listar(req, res) {
  const escuelas = await servicio.listar({
    incluirInactivas: flag(req.query.incluir_inactivas),
  });
  res.json({ ok: true, datos: escuelas });
}

async function obtener(req, res) {
  const id = validarId(req.params.id, 'id de escuela');
  const escuela = await servicio.obtenerPorId(id);
  if (!escuela) throw new ErrorApi(404, 'La escuela no existe');
  res.json({ ok: true, datos: escuela });
}

async function crear(req, res) {
  const datos = validarCreacion(req.body);
  const escuela = await servicio.crear(datos);
  res.status(201).json({ ok: true, datos: escuela });
}

async function actualizar(req, res) {
  const id = validarId(req.params.id, 'id de escuela');
  const datos = validarEdicion(req.body);
  const escuela = await servicio.actualizar(id, datos);
  if (!escuela) throw new ErrorApi(404, 'La escuela no existe');
  res.json({ ok: true, datos: escuela });
}

async function cambiarEstado(req, res) {
  const id = validarId(req.params.id, 'id de escuela');
  if (typeof req.body?.activo !== 'boolean') {
    throw new ErrorApi(400, 'Se espera el campo "activo" con valor verdadero o falso');
  }
  const escuela = await servicio.cambiarEstado(id, req.body.activo);
  if (!escuela) throw new ErrorApi(404, 'La escuela no existe');
  res.json({ ok: true, datos: escuela });
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
