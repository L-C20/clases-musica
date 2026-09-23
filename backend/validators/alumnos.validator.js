/**
 * backend/validators/alumnos.validator.js
 * -----------------------------------------------------------------------------
 * Reglas de validacion para alumnos.
 *
 * El alumno guarda grado_id, no escuela_id: la escuela se deduce por el grado.
 * El documento es opcional, pero si se carga no puede repetirse (lo garantiza
 * un indice unico en la base).
 */

const { Campos } = require('./comun');

function validarCreacion(cuerpo) {
  return new Campos(cuerpo)
    .entero('grado_id', { requerido: true, min: 1, etiqueta: 'grado' })
    .texto('nombre', { requerido: true, max: 80, etiqueta: 'nombre' })
    .texto('apellido', { requerido: true, max: 80, etiqueta: 'apellido' })
    .texto('documento', { max: 20, etiqueta: 'documento' })
    .texto('observaciones', { max: 2000, etiqueta: 'observaciones' })
    .booleano('activo')
    .fin();
}

function validarEdicion(cuerpo) {
  return new Campos(cuerpo)
    .entero('grado_id', { min: 1, etiqueta: 'grado', nuloPermitido: false })
    .texto('nombre', { max: 80, etiqueta: 'nombre', nuloPermitido: false })
    .texto('apellido', { max: 80, etiqueta: 'apellido', nuloPermitido: false })
    .texto('documento', { max: 20, etiqueta: 'documento' })
    .texto('observaciones', { max: 2000, etiqueta: 'observaciones' })
    .booleano('activo')
    .fin({ minimoUnCampo: true });
}

module.exports = { validarCreacion, validarEdicion };
