/**
 * frontend/js/graficos.js
 * -----------------------------------------------------------------------------
 * Gráficos hechos con HTML y CSS, sin ninguna librería.
 *
 * DECISIONES DE DISEÑO (no son estéticas, son de legibilidad):
 *
 * - Barras HORIZONTALES. Los nombres de escuelas y grados son largos; en
 *   barras verticales habría que rotar el texto y se vuelve ilegible.
 *
 * - UN SOLO COLOR, no uno por barra. El gráfico compara una magnitud
 *   (porcentaje de asistencia), no identidades. Pintar cada barra de un color
 *   distinto sugiere categorías que no existen y hace más difícil comparar.
 *
 * - La barra es fina (14px) y termina redondeada solo del lado del dato,
 *   cuadrada contra el eje: así se ve de dónde arranca y hasta dónde llega.
 *
 * - Entre barras vecinas hay un espacio del color del fondo, no un borde.
 *
 * - El valor va escrito al final de cada barra. Nadie debería tener que medir
 *   contra el eje para leer un número.
 */

import { el } from './ui.js';

/** Tooltip único y compartido: se crea una sola vez para toda la aplicación. */
let globo = null;

function asegurarGlobo() {
  if (!globo) {
    globo = el('div', { clase: 'globo', hidden: true });
    document.body.append(globo);
  }
  return globo;
}

function mostrarGlobo(texto, evento) {
  const nodo = asegurarGlobo();
  nodo.textContent = texto;
  nodo.hidden = false;

  const margen = 14;
  const ancho = nodo.offsetWidth;
  // Si el globo se saldría por la derecha, se corre para adentro.
  const x = Math.min(evento.clientX + margen, window.innerWidth - ancho - 8);
  nodo.style.left = `${Math.max(8, x)}px`;
  nodo.style.top = `${evento.clientY + margen}px`;
}

function ocultarGlobo() {
  if (globo) globo.hidden = true;
}

/**
 * Gráfico de barras horizontales.
 *
 * @param {object} opciones
 * @param {Array}  opciones.filas    [{ etiqueta, valor, detalle, sinDatos }]
 * @param {number} opciones.maximo   tope de la escala (100 para porcentajes)
 * @param {string} opciones.sufijo   se agrega al valor mostrado ('%' por ejemplo)
 * @param {string} opciones.vacio    texto si no hay nada que graficar
 */
export function graficoBarras({ filas, maximo = 100, sufijo = '', vacio = 'Sin datos para graficar' }) {
  const conDatos = filas.filter((f) => !f.sinDatos && f.valor !== null);

  if (conDatos.length === 0) {
    return el('p', { clase: 'grafico__vacio' }, vacio);
  }

  // La escala siempre arranca en cero: si no, las diferencias se exageran.
  const tope = Math.max(maximo, ...conDatos.map((f) => f.valor)) || 1;

  return el('div', { clase: 'grafico' },
    ...filas.map((fila) => {
      const sinDatos = fila.sinDatos || fila.valor === null;
      const ancho = sinDatos ? 0 : Math.max((fila.valor / tope) * 100, 0.8);

      const barra = el('div', {
        clase: 'grafico__barra',
        style: `width: ${ancho}%`,
      });

      const cuerpo = el('div', { clase: `grafico__fila${sinDatos ? ' grafico__fila--sin-datos' : ''}` },
        el('span', { clase: 'grafico__etiqueta', title: fila.etiqueta }, fila.etiqueta),
        el('div', { clase: 'grafico__pista' }, barra),
        el('span', { clase: 'grafico__valor' },
          sinDatos ? '—' : `${fila.valor}${sufijo}`)
      );

      if (fila.detalle) {
        cuerpo.addEventListener('mousemove', (e) => mostrarGlobo(fila.detalle, e));
        cuerpo.addEventListener('mouseleave', ocultarGlobo);
      }

      return cuerpo;
    })
  );
}

/**
 * Medidor: una barra chica para meter dentro de una celda de tabla.
 * Por debajo del umbral se pinta en rojo, que es la señal para mirar el caso.
 */
export function medidor(porcentaje, { umbral = 75 } = {}) {
  if (porcentaje === null || porcentaje === undefined) {
    return el('span', { clase: 'apagado' }, 'Sin datos');
  }

  const bajo = porcentaje < umbral;

  return el('div', { clase: 'medidor' },
    el('div', { clase: 'medidor__pista' },
      el('div', {
        clase: `medidor__relleno${bajo ? ' medidor__relleno--bajo' : ''}`,
        style: `width: ${Math.min(Math.max(porcentaje, 0), 100)}%`,
      })
    ),
    el('span', { clase: 'medidor__numero' }, `${porcentaje}%`)
  );
}

/**
 * Reparte el color de identidad de cada escuela.
 *
 * Son los cuatro primeros colores de la paleta validada, en el orden que pasó
 * los controles de daltonismo. Se asignan por POSICIÓN en la lista ordenada de
 * escuelas, no por id, para que el color de una escuela no cambie si se borra
 * otra. El color nunca va solo: siempre está el nombre al lado.
 */
export function colorDeEscuela(indice) {
  return `var(--serie-${(indice % 4) + 1})`;
}
