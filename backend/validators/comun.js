/**
 * backend/validators/comun.js
 * -----------------------------------------------------------------------------
 * Herramienta de validacion compartida por todas las entidades.
 *
 * Idea central: en vez de cortar en el primer error, va juntando TODOS los
 * problemas y los devuelve de una sola vez. Asi el frontend puede mostrarlos
 * todos juntos en vez de ir de a uno.
 *
 * Uso tipico desde un controlador:
 *
 *   const datos = new Campos(req.body)
 *     .texto('nombre', { requerido: true, max: 120 })
 *     .entero('orden', { min: 0 })
 *     .fin();
 *
 * `datos` solo contiene las claves que realmente vinieron y pasaron la
 * validacion. Eso es importante: los servicios usan esas claves para armar
 * el UPDATE, asi que nunca llega al SQL un nombre de columna inventado.
 */

const { ErrorApi } = require('../middleware/errores');

const PATRON_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

class Campos {
  constructor(cuerpo) {
    this.cuerpo = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
    this.errores = [];
    this.datos = {};
  }

  /** Distingue "no vino el campo" de "vino vacio". Es clave para los PUT. */
  _vino(nombre) {
    return Object.prototype.hasOwnProperty.call(this.cuerpo, nombre);
  }

  _vacio(valor) {
    return valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '');
  }

  /**
   * Campo de texto.
   * Si es opcional y llega vacio, se guarda como NULL (no como cadena vacia).
   */
  texto(nombre, { requerido = false, max = 255, etiqueta = nombre, nuloPermitido = true } = {}) {
    if (!this._vino(nombre)) {
      if (requerido) this.errores.push(`Falta el campo "${etiqueta}"`);
      return this;
    }

    const valor = this.cuerpo[nombre];

    if (this._vacio(valor)) {
      // nuloPermitido = false se usa al EDITAR columnas NOT NULL: el campo
      // puede no venir, pero si viene no puede venir vacio.
      if (requerido || !nuloPermitido) {
        this.errores.push(`El campo "${etiqueta}" no puede estar vacio`);
      } else {
        this.datos[nombre] = null;
      }
      return this;
    }

    if (typeof valor !== 'string') {
      this.errores.push(`El campo "${etiqueta}" debe ser texto`);
      return this;
    }

    const limpio = valor.trim();
    if (limpio.length > max) {
      this.errores.push(`El campo "${etiqueta}" no puede superar los ${max} caracteres`);
      return this;
    }

    this.datos[nombre] = limpio;
    return this;
  }

  /** Numero entero, con rango opcional. */
  entero(nombre, { requerido = false, min = null, max = null, etiqueta = nombre, nuloPermitido = true } = {}) {
    if (!this._vino(nombre)) {
      if (requerido) this.errores.push(`Falta el campo "${etiqueta}"`);
      return this;
    }

    const valor = this.cuerpo[nombre];

    if (this._vacio(valor)) {
      if (requerido || !nuloPermitido) {
        this.errores.push(`El campo "${etiqueta}" no puede estar vacio`);
      } else {
        this.datos[nombre] = null;
      }
      return this;
    }

    const numero = Number(valor);
    if (!Number.isInteger(numero)) {
      this.errores.push(`El campo "${etiqueta}" debe ser un numero entero`);
      return this;
    }
    if (min !== null && numero < min) {
      this.errores.push(`El campo "${etiqueta}" no puede ser menor a ${min}`);
      return this;
    }
    if (max !== null && numero > max) {
      this.errores.push(`El campo "${etiqueta}" no puede ser mayor a ${max}`);
      return this;
    }

    this.datos[nombre] = numero;
    return this;
  }

  /** Numero decimal (para las notas de la Fase 5). */
  decimal(nombre, { requerido = false, min = null, max = null, etiqueta = nombre } = {}) {
    if (!this._vino(nombre)) {
      if (requerido) this.errores.push(`Falta el campo "${etiqueta}"`);
      return this;
    }

    const valor = this.cuerpo[nombre];

    if (this._vacio(valor)) {
      if (requerido) this.errores.push(`El campo "${etiqueta}" no puede estar vacio`);
      else this.datos[nombre] = null;
      return this;
    }

    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
      this.errores.push(`El campo "${etiqueta}" debe ser un numero`);
      return this;
    }
    if (min !== null && numero < min) {
      this.errores.push(`El campo "${etiqueta}" no puede ser menor a ${min}`);
      return this;
    }
    if (max !== null && numero > max) {
      this.errores.push(`El campo "${etiqueta}" no puede ser mayor a ${max}`);
      return this;
    }

    this.datos[nombre] = numero;
    return this;
  }

  /** Verdadero/falso. Acepta true/false y los textos "true"/"false". */
  booleano(nombre, { requerido = false, etiqueta = nombre } = {}) {
    if (!this._vino(nombre)) {
      if (requerido) this.errores.push(`Falta el campo "${etiqueta}"`);
      return this;
    }

    const valor = this.cuerpo[nombre];
    if (typeof valor === 'boolean') {
      this.datos[nombre] = valor;
      return this;
    }
    if (valor === 'true' || valor === 'false') {
      this.datos[nombre] = valor === 'true';
      return this;
    }

    this.errores.push(`El campo "${etiqueta}" debe ser verdadero o falso`);
    return this;
  }

  /** Hora en formato HH:MM (24 horas). */
  hora(nombre, { requerido = false, etiqueta = nombre } = {}) {
    if (!this._vino(nombre)) {
      if (requerido) this.errores.push(`Falta el campo "${etiqueta}"`);
      return this;
    }

    const valor = this.cuerpo[nombre];

    if (this._vacio(valor)) {
      if (requerido) this.errores.push(`El campo "${etiqueta}" no puede estar vacio`);
      else this.datos[nombre] = null;
      return this;
    }

    // Un input type="time" puede mandar "10:00" o "10:00:00".
    const recortado = String(valor).slice(0, 5);
    if (!PATRON_HORA.test(recortado)) {
      this.errores.push(`El campo "${etiqueta}" debe tener formato HH:MM (ejemplo: 10:00)`);
      return this;
    }

    this.datos[nombre] = recortado;
    return this;
  }

  /** Fecha en formato AAAA-MM-DD. Se usa desde la Fase 3. */
  fecha(nombre, { requerido = false, etiqueta = nombre } = {}) {
    if (!this._vino(nombre)) {
      if (requerido) this.errores.push(`Falta el campo "${etiqueta}"`);
      return this;
    }

    const valor = this.cuerpo[nombre];

    if (this._vacio(valor)) {
      if (requerido) this.errores.push(`El campo "${etiqueta}" no puede estar vacio`);
      else this.datos[nombre] = null;
      return this;
    }

    if (!PATRON_FECHA.test(String(valor))) {
      this.errores.push(`El campo "${etiqueta}" debe tener formato AAAA-MM-DD`);
      return this;
    }

    this.datos[nombre] = String(valor);
    return this;
  }

  /** El valor tiene que estar dentro de una lista cerrada. */
  opcion(nombre, lista, { requerido = false, etiqueta = nombre } = {}) {
    if (!this._vino(nombre)) {
      if (requerido) this.errores.push(`Falta el campo "${etiqueta}"`);
      return this;
    }

    const valor = this.cuerpo[nombre];

    if (this._vacio(valor)) {
      if (requerido) this.errores.push(`El campo "${etiqueta}" no puede estar vacio`);
      else this.datos[nombre] = null;
      return this;
    }

    if (!lista.includes(valor)) {
      this.errores.push(`El campo "${etiqueta}" debe ser uno de: ${lista.join(', ')}`);
      return this;
    }

    this.datos[nombre] = valor;
    return this;
  }

  /** Cierra la validacion. Si hubo errores, lanza un 400 con la lista completa. */
  fin({ minimoUnCampo = false } = {}) {
    if (this.errores.length > 0) {
      throw new ErrorApi(400, 'Los datos enviados no son validos', this.errores);
    }
    if (minimoUnCampo && Object.keys(this.datos).length === 0) {
      throw new ErrorApi(400, 'No se envio ningun campo para modificar');
    }
    return this.datos;
  }
}

/** Valida un :id de la URL y lo devuelve como numero. */
function validarId(valor, etiqueta = 'id') {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new ErrorApi(400, `El ${etiqueta} de la URL no es valido`);
  }
  return numero;
}

/**
 * Lee un parametro opcional de la query string como numero.
 * Devuelve null si no vino, para poder usarlo directo en el SQL.
 */
function idOpcional(valor, etiqueta) {
  if (valor === undefined || valor === '' || valor === null) return null;
  return validarId(valor, etiqueta);
}

/** Lee un flag de la query string: ?incluir_inactivas=true */
function flag(valor) {
  return valor === 'true' || valor === '1';
}

module.exports = { Campos, validarId, idOpcional, flag };
