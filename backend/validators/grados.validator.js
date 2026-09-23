/**
 * backend/validators/grados.validator.js
 * -----------------------------------------------------------------------------
 * Reglas de validacion para grados.
 *
 * dia_semana / hora_inicio / duracion_min son el horario habitual de la clase
 * semanal. Los tres son opcionales: podes cargar un grado sin horario y
 * completarlo despues.
 */

const { Campos } = require('./comun');

function validarCreacion(cuerpo) {
  return new Campos(cuerpo)
    .entero('escuela_id', { requerido: true, min: 1, etiqueta: 'escuela' })
    .texto('nombre', { requerido: true, max: 80, etiqueta: 'nombre' })
    .entero('orden', { min: 0, max: 999, etiqueta: 'orden', nuloPermitido: false })
    .entero('dia_semana', { min: 0, max: 6, etiqueta: 'dia de la semana' })
    .hora('hora_inicio', { etiqueta: 'hora de inicio' })
    .entero('duracion_min', { min: 1, max: 600, etiqueta: 'duracion', nuloPermitido: false })
    .booleano('activo')
    .fin();
}

function validarEdicion(cuerpo) {
  return new Campos(cuerpo)
    .entero('escuela_id', { min: 1, etiqueta: 'escuela', nuloPermitido: false })
    .texto('nombre', { max: 80, etiqueta: 'nombre', nuloPermitido: false })
    .entero('orden', { min: 0, max: 999, etiqueta: 'orden', nuloPermitido: false })
    .entero('dia_semana', { min: 0, max: 6, etiqueta: 'dia de la semana' })
    .hora('hora_inicio', { etiqueta: 'hora de inicio' })
    .entero('duracion_min', { min: 1, max: 600, etiqueta: 'duracion', nuloPermitido: false })
    .booleano('activo')
    .fin({ minimoUnCampo: true });
}

module.exports = { validarCreacion, validarEdicion };
