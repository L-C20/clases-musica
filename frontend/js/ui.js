/**
 * frontend/js/ui.js
 * -----------------------------------------------------------------------------
 * Piezas de interfaz reutilizables. Las vistas describen QUE mostrar;
 * este archivo se encarga de COMO se dibuja.
 *
 * Todo se construye con createElement (nunca innerHTML con datos), asi que
 * un nombre con < o > no puede romper la pagina ni inyectar HTML.
 */

import { icono } from './iconos.js';

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
 * Texto con el numero y la palabra en singular o plural.
 *
 *   plural(1, 'ausencia', 'ausencias')  -> "1 ausencia"
 *   plural(3, 'ausencia', 'ausencias')  -> "3 ausencias"
 *
 * Si no se pasa el plural, se arma agregando una "s".
 */
export function plural(cantidad, singular, formaPlural = `${singular}s`) {
  return `${cantidad} ${cantidad === 1 ? singular : formaPlural}`;
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

/**
 * enviar:true lo convierte en el boton de envio de su formulario.
 *
 * Importa mas de lo que parece: un boton type="button" con un onClick depende
 * de que ese click llegue. Uno de envio lo activa el navegador, y tambien
 * responde al Enter desde cualquier campo y a las formas de activarlo que usan
 * los lectores de pantalla.
 */
export function boton(texto, { onClick, tipo = 'secundario', titulo = null, chico = false, enviar = false } = {}) {
  return el('button', {
    clase: `boton boton--${tipo}${chico ? ' boton--chico' : ''}`,
    type: enviar ? 'submit' : 'button',
    title: titulo,
    onClick,
  }, texto);
}

/**
 * Boton de una sola accion, dibujado con un icono.
 *
 * Sirve para las columnas de acciones de los listados: tres botones con texto
 * ("Editar", "Alumnos", "Desactivar") ocupan media fila y hacen que la tabla
 * se lea peor que los datos que tiene al lado.
 *
 * El titulo NO es opcional: es lo unico que dice que hace el boton, asi que va
 * como tooltip y tambien como aria-label, para quien navega con lector de
 * pantalla o con el teclado.
 */
export function botonIcono(nombre, { titulo, onClick, tipo = 'normal' }) {
  return el('button', {
    clase: `boton-icono boton-icono--${tipo}`,
    type: 'button',
    title: titulo,
    'aria-label': titulo,
    onClick,
  }, icono(nombre, { tamano: 18 }));
}

/**
 * Select con las opciones repartidas en grupos (optgroup).
 *
 * opciones: [{ grupo, valor, texto }]
 *
 * Con esto un solo selector reemplaza a dos encadenados: en lugar de elegir
 * la escuela y despues el grado, se ve la escuela como titulo del grupo y se
 * elige el grado de una sola vez.
 */
export function selectorAgrupado({ opciones, valor = '', textoVacio, clase = 'control control--filtro', onCambio }) {
  const grupos = new Map();
  for (const o of opciones) {
    if (!grupos.has(o.grupo)) grupos.set(o.grupo, []);
    grupos.get(o.grupo).push(o);
  }

  return el('select', { clase, onChange: (e) => onCambio(e.target.value) },
    el('option', { value: '' }, textoVacio),
    ...[...grupos].map(([nombre, items]) =>
      el('optgroup', { label: nombre },
        ...items.map((o) =>
          el('option', { value: String(o.valor), selected: String(o.valor) === String(valor) }, o.texto))
      )
    )
  );
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
 * columnas: [{ titulo, render(fila), clase?, oculta? }]
 *
 * En pantalla chica la tabla se convierte en tarjetas apiladas, y ahi cada
 * celda necesita decir de que columna es. Por eso todas llevan data-etiqueta:
 * el CSS lo muestra como rotulo.
 *
 * Dos detalles que hacen que las tarjetas no queden interminables:
 *
 *  - La PRIMERA columna es el titulo de la tarjeta. No lleva rotulo (seria
 *    repetir "ALUMNO" arriba de cada nombre) y va destacada.
 *  - Una columna con oculta:true no se muestra en celular. Sirve para los
 *    datos de consulta, que en el telefono solo agregan scroll; en la
 *    computadora se siguen viendo.
 */
export function tabla(columnas, filas) {
  const claseDeColumna = (c, indice) => [
    c.clase,
    indice === 0 ? 'col-titulo' : null,
    c.oculta ? 'col-oculta-celular' : null,
  ].filter(Boolean).join(' ') || null;

  return el('div', { clase: 'tabla-contenedor' },
    el('table', { clase: 'tabla' },
      el('thead', {}, el('tr', {},
        ...columnas.map((c, i) => el('th', { clase: claseDeColumna(c, i) }, c.titulo)))),
      el('tbody', {}, ...filas.map((fila) =>
        el('tr', { clase: fila.activo === false ? 'fila--inactiva' : null },
          ...columnas.map((c, i) =>
            el('td', { clase: claseDeColumna(c, i), dataset: { etiqueta: c.titulo } }, c.render(fila))
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

  // Sin onClick: lo dispara el envio del formulario, que es un solo camino.
  const botonGuardar = boton(textoGuardar, { tipo: 'primario', enviar: true });
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

      /*
       * El error tiene que VERSE.
       *
       * El cartel vive arriba del pie del modal. En un formulario largo, con
       * la pantalla puesta abajo para llegar al boton, aparecia fuera de la
       * vista: se tocaba Guardar, no se cerraba nada y no se veia ningun
       * motivo. Parecia que el boton no hacia nada.
       *
       * Por eso ahora se lo trae a la vista, y ademas sale como aviso flotante,
       * que se ve aunque el modal este desplazado en cualquier posicion.
       */
      errorCaja.scrollIntoView({ block: 'center', behavior: 'smooth' });
      aviso(error.message, 'error');

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
