/**
 * backend/validators/escuelas.validator.js
 * -----------------------------------------------------------------------------
 * Reglas de validacion para escuelas.
 *
 * Al crear: el nombre es obligatorio.
 * Al editar: todos los campos son opcionales, pero tiene que venir al menos uno.
 */

const { Campos } = require('./comun');

function validarCreacion(cuerpo) {
  return new Campos(cuerpo)
    .texto('codigo', { max: 20, etiqueta: 'codigo' })
    .texto('nombre', { requerido: true, max: 120, etiqueta: 'nombre' })
    .texto('descripcion', { max: 500, etiqueta: 'descripcion' })
    .booleano('activo')
    .fin();
}

function validarEdicion(cuerpo) {
  return new Campos(cuerpo)
    .texto('codigo', { max: 20, etiqueta: 'codigo' })
    .texto('nombre', { max: 120, etiqueta: 'nombre', nuloPermitido: false })
    .texto('descripcion', { max: 500, etiqueta: 'descripcion' })
    .booleano('activo')
    .fin({ minimoUnCampo: true });
}

module.exports = { validarCreacion, validarEdicion };
