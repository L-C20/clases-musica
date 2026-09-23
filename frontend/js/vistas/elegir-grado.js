/**
 * frontend/js/vistas/elegir-grado.js
 * -----------------------------------------------------------------------------
 * La pantalla de entrada de Asistencia y Notas: escuela -> grado, a puro toque.
 *
 * Antes las dos arrancaban con un selector desplegable y un cartel que decia
 * "Elegí un grado". Un desplegable sirve para CAMBIAR de grado cuando ya sabes
 * cual queres, pero para ENTRAR no muestra nada: hay que abrirlo para ver que
 * hay adentro, y no dice cuantos alumnos tiene ni que dia es la clase.
 *
 * Con tarjetas, lo que hay se ve sin tocar nada, y cada una lleva el dato que
 * confirma que es la que buscabas: el horario y cuantos alumnos son.
 *
 * Las dos pantallas comparten este archivo. Si se separaran en dos copias,
 * dentro de unos meses serian dos pantallas distintas sin que nadie lo haya
 * decidido.
 */

import { el, vaciar, agregar, boton, plural } from '../ui.js';
import { icono } from '../iconos.js';
import { nombreDeDia } from '../fechas.js';
import { navegar } from '../app.js';

/** "Jue 08:30 · 9 alumnos", o el aviso de que todavia no tiene horario. */
function detalleDelGrado(grado) {
  const alumnos = plural(grado.total_alumnos, 'alumno');

  if (grado.dia_semana === null || !grado.hora_inicio) {
    return `Sin horario · ${alumnos}`;
  }

  const dia = nombreDeDia(grado.dia_semana);
  return `${dia} ${String(grado.hora_inicio).slice(0, 5)} · ${alumnos}`;
}

/**
 * Una tarjeta: icono a la izquierda, nombre y dato, flecha a la derecha.
 *
 * Es un <button> y no un <div> con onClick: asi se llega con el tabulador,
 * se activa con Enter y el lector de pantalla lo anuncia como algo que se
 * puede tocar. Un div con un click encima no hace nada de eso.
 */
function tarjeta({ nombreIcono, titulo, detalle, alTocar, apagada = false }) {
  return el('button', {
    clase: `tarjeta-eleccion${apagada ? ' tarjeta-eleccion--apagada' : ''}`,
    type: 'button',
    disabled: apagada,
    onClick: alTocar,
  },
    el('span', { clase: 'tarjeta-eleccion__icono' }, icono(nombreIcono, { tamano: 21 })),
    el('span', { clase: 'tarjeta-eleccion__cuerpo' },
      el('span', { clase: 'tarjeta-eleccion__titulo' }, titulo),
      el('span', { clase: 'tarjeta-eleccion__detalle' }, detalle)
    ),
    apagada ? null : icono('siguiente', { tamano: 17, clase: 'tarjeta-eleccion__flecha' })
  );
}

/**
 * Devuelve el elemento con el paso a paso.
 *
 * grados:   la lista completa, tal como la devuelve la cache.
 * escuelas: todas las escuelas, incluso las que todavia no tienen grados.
 * onElegir: se llama con el id del grado elegido.
 * onElegirEscuela: si se pasa, aparece ademas una tarjeta para ver la escuela
 *   entera sin bajar a un grado. La usa Alumnos; Asistencia y Notas no, porque
 *   una planilla es siempre de UN grado.
 */
export function elegirGrado({ grados, escuelas: todasLasEscuelas = [], onElegir, onElegirEscuela = null }) {
  const caja = el('div', { clase: 'eleccion' });

  /** null = mostrando las escuelas; un id = mostrando los grados de esa. */
  let escuelaAbierta = null;

  /*
   * Todas las escuelas, con sus totales.
   *
   * Se parte de la lista de escuelas y no de la de grados a proposito: una
   * escuela sin grados igual tiene que verse, apagada. Si se la saltea, quien
   * la busca no sabe si falta cargarla o si la aplicacion se la comio.
   */
  function escuelas() {
    const totales = new Map();
    for (const g of grados) {
      if (!totales.has(g.escuela_id)) totales.set(g.escuela_id, { grados: 0, alumnos: 0 });
      const t = totales.get(g.escuela_id);
      t.grados += 1;
      t.alumnos += Number(g.total_alumnos) || 0;
    }

    return todasLasEscuelas
      .map((e) => ({
        id: e.id,
        nombre: e.nombre,
        ...(totales.get(e.id) || { grados: 0, alumnos: 0 }),
      }))
      // Las que se pueden abrir primero, en orden alfabetico; las vacias al
      // final. Si no, la unica escuela con grados puede quedar tercera, detras
      // de dos tarjetas que no llevan a ningun lado.
      .sort((a, b) =>
        (b.grados > 0) - (a.grados > 0) || a.nombre.localeCompare(b.nombre, 'es'));
  }

  function dibujarEscuelas() {
    const lista = escuelas();

    if (lista.length === 0 || lista.every((e) => e.grados === 0)) {
      agregar(caja, el('div', { clase: 'vacio' },
        el('p', {}, 'Todavía no hay grados cargados.'),
        el('p', { clase: 'campo__ayuda' },
          'Cada grado pertenece a una escuela y es el que junta a los alumnos.'),
        boton('Ir a Grados', { tipo: 'primario', onClick: () => navegar('/grados') })
      ));
      return;
    }

    agregar(caja,
      el('p', { clase: 'eleccion__paso' }, 'Elegí la escuela'),
      el('div', { clase: 'tarjetas' },
        ...lista.map((e) => tarjeta({
          nombreIcono: 'escuelas',
          titulo: e.nombre,
          detalle: e.grados === 0
            ? 'Todavía sin grados'
            : `${plural(e.grados, 'grado')} · ${plural(e.alumnos, 'alumno')}`,
          apagada: e.grados === 0,
          alTocar: () => { escuelaAbierta = e.id; dibujar(); },
        }))
      )
    );
  }

  function dibujarGrados() {
    const suyos = grados.filter((g) => g.escuela_id === escuelaAbierta);
    const escuela = suyos[0]?.escuela_nombre || '';
    const alumnos = suyos.reduce((total, g) => total + (Number(g.total_alumnos) || 0), 0);

    agregar(caja,
      el('div', { clase: 'eleccion__cabecera' },
        el('button', {
          clase: 'eleccion__volver',
          type: 'button',
          onClick: () => { escuelaAbierta = null; dibujar(); },
        },
          icono('anterior', { tamano: 16 }),
          'Escuelas'
        ),
        el('p', { clase: 'eleccion__paso' }, escuela)
      ),
      el('div', { clase: 'tarjetas' },
        onElegirEscuela
          ? tarjeta({
              nombreIcono: 'alumnos',
              titulo: `Todos los de ${escuela}`,
              detalle: `${plural(alumnos, 'alumno')} en ${plural(suyos.length, 'grado')}`,
              alTocar: () => onElegirEscuela(escuelaAbierta),
            })
          : null,
        ...suyos.map((g) => tarjeta({
          nombreIcono: 'grados',
          titulo: g.nombre,
          detalle: detalleDelGrado(g),
          alTocar: () => onElegir(g.id),
        }))
      )
    );
  }

  function dibujar() {
    vaciar(caja);
    if (escuelaAbierta === null) dibujarEscuelas();
    else dibujarGrados();
  }

  dibujar();
  return caja;
}
