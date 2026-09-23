/**
 * backend/controllers/notas.controller.js
 * -----------------------------------------------------------------------------
 *   GET  /api/notas/planilla?grado_id=3&fecha=2026-09-23   -> lista completa
 *   POST /api/notas/planilla                               -> guarda todo junto
 *   GET  /api/notas?...                                    -> historial
 *   GET  /api/notas/resumen/:alumnoId                      -> promedio del alumno
 *   DELETE /api/notas/:id                                  -> borra una nota
 */

const servicio = require('../services/notas.service');
const { Campos, validarId, idOpcional } = require('../validators/comun');
const { ErrorApi } = require('../middleware/errores');

async function obtenerPlanilla(req, res) {
  const datos = new Campos(req.query)
    .entero('grado_id', { requerido: true, min: 1, etiqueta: 'grado' })
    .fecha('fecha', { requerido: true, etiqueta: 'fecha' })
    .texto('tipo', { max: 40, etiqueta: 'tipo' })
    .fin();

  const planilla = await servicio.obtenerPlanilla(
    datos.grado_id,
    datos.fecha,
    datos.tipo || 'general'
  );
  if (!planilla) throw new ErrorApi(404, 'El grado no existe');

  res.json({ ok: true, datos: planilla });
}

/**
 * Valida la lista de notas.
 *
 * Una fila vacia (sin nota y sin concepto) es valida a proposito: significa
 * "este alumno no tiene nota en esta fecha" y provoca el borrado.
 */
function validarFilas(lista) {
  if (!Array.isArray(lista)) {
    throw new ErrorApi(400, 'Se espera una lista de notas');
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

    let nota = null;
    const sinNota = fila.nota === null || fila.nota === undefined || fila.nota === '';

    if (!sinNota) {
      nota = Number(fila.nota);
      if (!Number.isFinite(nota)) {
        errores.push(`Fila ${numero}: la nota debe ser un numero`);
        return;
      }
      if (nota < servicio.NOTA_MINIMA || nota > servicio.NOTA_MAXIMA) {
        errores.push(
          `Fila ${numero}: la nota debe estar entre ${servicio.NOTA_MINIMA} y ${servicio.NOTA_MAXIMA}`
        );
        return;
      }
    }

    const texto = (valor, limite) =>
      typeof valor === 'string' && valor.trim() !== '' ? valor.trim().slice(0, limite) : null;

    limpias.push({
      alumno_id: alumnoId,
      nota,
      concepto: texto(fila.concepto, 80),
      periodo: texto(fila.periodo, 40),
      observacion: texto(fila.observacion, 500),
    });
  });

  if (errores.length > 0) {
    throw new ErrorApi(400, 'Hay filas de notas con problemas', errores);
  }

  return limpias;
}

async function guardarPlanilla(req, res) {
  const datos = new Campos(req.body)
    .entero('grado_id', { requerido: true, min: 1, etiqueta: 'grado' })
    .fecha('fecha', { requerido: true, etiqueta: 'fecha' })
    .texto('tipo', { max: 40, etiqueta: 'tipo' })
    .fin();

  const tipo = datos.tipo || 'general';
  const filas = validarFilas(req.body?.notas ?? []);

  const planilla = await servicio.obtenerPlanilla(datos.grado_id, datos.fecha, tipo);
  if (!planilla) throw new ErrorApi(404, 'El grado no existe');

  const ajenos = await servicio.alumnosAjenosAlGrado(
    datos.grado_id,
    filas.map((f) => f.alumno_id)
  );
  if (ajenos.length > 0) {
    throw new ErrorApi(400, 'Hay alumnos que no pertenecen a este grado', ajenos);
  }

  const resultado = await servicio.guardarPlanilla(datos.grado_id, datos.fecha, tipo, filas);
  res.json({ ok: true, datos: resultado });
}

async function listar(req, res) {
  const { desde, hasta } = new Campos(req.query)
    .fecha('desde', { etiqueta: 'fecha desde' })
    .fecha('hasta', { etiqueta: 'fecha hasta' })
    .fin();

  const notas = await servicio.listar({
    escuelaId: idOpcional(req.query.escuela_id, 'id de escuela'),
    gradoId: idOpcional(req.query.grado_id, 'id de grado'),
    alumnoId: idOpcional(req.query.alumno_id, 'id de alumno'),
    desde: desde ?? null,
    hasta: hasta ?? null,
  });

  res.json({ ok: true, datos: notas });
}

async function resumenDeAlumno(req, res) {
  const id = validarId(req.params.alumnoId, 'id de alumno');
  res.json({ ok: true, datos: await servicio.resumenDeAlumno(id) });
}

async function eliminar(req, res) {
  const id = validarId(req.params.id, 'id de nota');
  const borrada = await servicio.eliminar(id);
  if (!borrada) throw new ErrorApi(404, 'La nota no existe');
  res.json({ ok: true, datos: { eliminada: true } });
}

module.exports = { obtenerPlanilla, guardarPlanilla, listar, resumenDeAlumno, eliminar };
