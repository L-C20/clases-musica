/**
 * frontend/js/ui.js
 * -----------------------------------------------------------------------------
 * Piezas de interfaz reutilizables. Las vistas describen QUE mostrar;
 * este archivo se encarga de COMO se dibuja.
 *
 * Todo se construye con createElement (nunca innerHTML con datos), asi que
 * un nombre con < o > no puede romper la pagina ni inyectar HTML.
 */

/* ---------------------------------------------------------------------------
 * Creacion de elementos
 * ------------------------------------------------------------------------ */

/**
 * el('button', { clase: 'boton', onClick: fn }, 'Guardar')
 */
export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;

    if (clave === 'clase') nodo.className = valor;
    else if (clave === 'html') nodo.innerHTML = valor;
    else if (clave.startsWith('on') && typeof valor === 'function') {
      nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave === 'dataset') {
      Object.assign(nodo.dataset, valor);
    } else if (clave in nodo && clave !== 'list') {
      nodo[clave] = valor;
    } else {
      nodo.setAttribute(clave, valor);
    }
  }

  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }

  return nodo;
}

export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
}

/**
 * Agrega hijos a un nodo salteando los vacios.
 *
 * Hay que usar esto en lugar de nodo.append(...) cada vez que algun hijo
 * pueda ser null (tipico: `condicion ? el(...) : null`). El append del DOM
 * convierte null en el TEXTO "null" y aparece escrito en la pantalla.
 */
export function agregar(nodo, ...hijos) {
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

/* ---------------------------------------------------------------------------
 * Bloques comunes
 * ------------------------------------------------------------------------ */

/** Encabezado de pantalla: titulo, subtitulo y botones de accion. */
export function encabezado(titulo, subtitulo, ...acciones) {
  return el('header', { clase: 'encabezado' },
    el('div', {},
      el('h1', {}, titulo),
      subtitulo ? el('p', { clase: 'encabezado__sub' }, subtitulo) : null
    ),
    acciones.length ? el('div', { clase: 'encabezado__acciones' }, ...acciones) : null
  );
}

export function boton(texto, { onClick, tipo = 'secundario', titulo = null, chico = false } = {}) {
  return el('button', {
    clase: `boton boton--${tipo}${chico ? ' boton--chico' : ''}`,
    type: 'button',
    title: titulo,
    onClick,
  }, texto);
}

export function etiquetaEstado(activo) {
  return el('span', { clase: `pastilla pastilla--${activo ? 'ok' : 'apagado'}` },
    activo ? 'Activo' : 'Inactivo');
}

export function cargando(mensaje = 'Cargando...') {
  return el('p', { clase: 'mensaje mensaje--cargando' }, mensaje);
}

export function vacio(mensaje, accion = null) {
  return el('div', { clase: 'vacio' },
    el('p', {}, mensaje),
    accion
  );
}

/**
 * Tabla generica.
 *
 * columnas: [{ titulo, render(fila), clase? }]
 * Cada celda lleva data-etiqueta con el titulo de su columna: el CSS lo usa
 * para convertir la tabla en tarjetas apiladas cuando la pantalla es chica.
 */
export function tabla(columnas, filas) {
  return el('div', { clase: 'tabla-contenedor' },
    el('table', { clase: 'tabla' },
      el('thead', {}, el('tr', {}, ...columnas.map((c) => el('th', { clase: c.clase }, c.titulo)))),
      el('tbody', {}, ...filas.map((fila) =>
        el('tr', { clase: fila.activo === false ? 'fila--inactiva' : null },
          ...columnas.map((c) =>
            el('td', { clase: c.clase, dataset: { etiqueta: c.titulo } }, c.render(fila))
          )
        )
      ))
    )
  );
}

/* ---------------------------------------------------------------------------
 * Avisos
 * ------------------------------------------------------------------------ */

let contenedorAvisos = null;

export function aviso(mensaje, tipo = 'ok') {
  if (!contenedorAvisos) {
    contenedorAvisos = el('div', { clase: 'avisos' });
    document.body.append(contenedorAvisos);
  }

  const nodo = el('div', { clase: `aviso aviso--${tipo}` }, mensaje);
  contenedorAvisos.append(nodo);

  setTimeout(() => {
    nodo.classList.add('aviso--saliendo');
    setTimeout(() => nodo.remove(), 250);
  }, tipo === 'error' ? 5000 : 2600);
}

/* ---------------------------------------------------------------------------
 * Ventanas modales
 * ------------------------------------------------------------------------ */

function cerrarModal(fondo) {
  fondo.remove();
  document.body.classList.remove('sin-scroll');
}

/**
 * Cierra cualquier modal abierto.
 * El router la llama al cambiar de pantalla: sin esto, un formulario abierto
 * quedaria flotando encima de la pantalla siguiente.
 */
export function cerrarModales() {
  document.querySelectorAll('.modal-fondo').forEach((fondo) => cerrarModal(fondo));
}

function abrirModal(contenido, { alCerrar } = {}) {
  const fondo = el('div', { clase: 'modal-fondo' });
  const caja = el('div', { clase: 'modal' }, contenido);

  fondo.append(caja);
  fondo.addEventListener('mousedown', (e) => {
    if (e.target === fondo) { cerrarModal(fondo); alCerrar?.(); }
  });

  const escape = (e) => {
    if (e.key === 'Escape') {
      cerrarModal(fondo);
      alCerrar?.();
      document.removeEventListener('keydown', escape);
    }
  };
  document.addEventListener('keydown', escape);

  document.body.append(fondo);
  document.body.classList.add('sin-scroll');

  return () => cerrarModal(fondo);
}

/** Confirmacion de si/no. Devuelve una promesa que resuelve a true o false. */
export function confirmar(mensaje, { textoOk = 'Confirmar', peligroso = false } = {}) {
  return new Promise((resolver) => {
    let cerrar;
    const contenido = el('div', {},
      el('h2', { clase: 'modal__titulo' }, 'Confirmar'),
      el('p', { clase: 'modal__texto' }, mensaje),
      el('div', { clase: 'modal__pie' },
        boton('Cancelar', { onClick: () => { cerrar(); resolver(false); } }),
        boton(textoOk, { tipo: peligroso ? 'peligro' : 'primario', onClick: () => { cerrar(); resolver(true); } })
      )
    );
    cerrar = abrirModal(contenido, { alCerrar: () => resolver(false) });
  });
}

/**
 * Formulario en una ventana modal.
 *
 * campos: [{ nombre, etiqueta, tipo, requerido, opciones, ayuda, ancho }]
 *   tipo: texto | textarea | numero | select | hora
 *   ancho: 'completo' (por defecto) | 'mitad'
 *
 * alGuardar(valores) puede ser async. Si lanza un error, el mensaje se muestra
 * dentro del modal y el formulario NO se cierra: asi no se pierde lo escrito.
 */
export function formulario({ titulo, campos, valores = {}, textoGuardar = 'Guardar', alGuardar }) {
  const errorCaja = el('p', { clase: 'modal__error', hidden: true });
  const entradas = new Map();

  const cuerpo = el('div', { clase: 'form' });

  for (const campo of campos) {
    const id = `campo-${campo.nombre}`;
    const valorActual = valores[campo.nombre];
    let entrada;

    if (campo.tipo === 'select') {
      entrada = el('select', { clase: 'control', id },
        el('option', { value: '' }, campo.textoVacio || 'Seleccionar...'),
        ...campo.opciones.map((o) =>
          el('option', { value: String(o.valor), selected: String(o.valor) === String(valorActual ?? '') }, o.texto)
        )
      );
    } else if (campo.tipo === 'textarea') {
      entrada = el('textarea', { clase: 'control', id, rows: campo.filas || 3, value: valorActual ?? '' });
    } else {
      const tipoHtml = campo.tipo === 'numero' ? 'number' : campo.tipo === 'hora' ? 'time' : 'text';
      entrada = el('input', {
        clase: 'control',
        id,
        type: tipoHtml,
        value: valorActual ?? '',
        min: campo.min,
        max: campo.max,
        placeholder: campo.marcador || '',
        autocomplete: 'off',
      });
    }

    entradas.set(campo.nombre, { entrada, campo });

    cuerpo.append(
      el('div', { clase: `campo campo--${campo.ancho || 'completo'}` },
        el('label', { clase: 'campo__etiqueta', for: id },
          campo.etiqueta,
          campo.requerido ? el('span', { clase: 'campo__obligatorio' }, ' *') : null
        ),
        entrada,
        campo.ayuda ? el('small', { clase: 'campo__ayuda' }, campo.ayuda) : null
      )
    );
  }

  /** Junta los valores tipados por el usuario. */
  function leerValores() {
    const resultado = {};
    for (const [nombre, { entrada, campo }] of entradas) {
      let valor = entrada.value;
      if (typeof valor === 'string') valor = valor.trim();

      if (valor === '') {
        resultado[nombre] = null;
      } else if (campo.tipo === 'numero' || campo.tipo === 'select') {
        // Los select de este formulario siempre llevan ids numericos.
        resultado[nombre] = campo.tipo === 'numero' || campo.numerico ? Number(valor) : valor;
      } else {
        resultado[nombre] = valor;
      }
    }
    return resultado;
  }

  const botonGuardar = boton(textoGuardar, { tipo: 'primario', onClick: enviar });
  let cerrar;

  async function enviar() {
    errorCaja.hidden = true;
    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando...';

    try {
      await alGuardar(leerValores());
      cerrar();
    } catch (error) {
      errorCaja.textContent = error.message;
      errorCaja.hidden = false;
      botonGuardar.disabled = false;
      botonGuardar.textContent = textoGuardar;
    }
  }

  const contenido = el('form', { onSubmit: (e) => { e.preventDefault(); enviar(); } },
    el('h2', { clase: 'modal__titulo' }, titulo),
    cuerpo,
    errorCaja,
    el('div', { clase: 'modal__pie' },
      boton('Cancelar', { onClick: () => cerrar() }),
      botonGuardar
    )
  );

  cerrar = abrirModal(contenido);

  // Foco en el primer campo, para poder empezar a escribir directamente.
  setTimeout(() => entradas.values().next().value?.entrada.focus(), 50);
}
