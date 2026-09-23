/**
 * frontend/js/vistas/notas.js
 * -----------------------------------------------------------------------------
 * Planilla de notas, con la misma idea que la de asistencia:
 *
 *  - Una sola llamada trae el grado entero con lo ya cargado.
 *  - Se escribe la nota de cada alumno de corrido; Enter salta al siguiente.
 *  - Un solo boton guarda todo, en una sola transaccion.
 *  - Volver a guardar la misma fecha CORRIGE, no duplica.
 *  - Borrar el numero de un alumno ELIMINA esa nota (no la guarda en cero).
 *
 * Al lado de cada alumno se muestra su nota anterior como referencia.
 *
 * Direccion: #/notas?grado=4&fecha=2026-09-23
 */

import { api } from '../api.js';
import { opcionesEscuelas, estado as cache } from '../estado.js';
import { navegar, ponerGuardia, reemplazarDireccion } from '../app.js';
import { el, vaciar, agregar, encabezado, boton, cargando, vacio, aviso } from '../ui.js';
import { hoy, formatearConDia } from '../fechas.js';

export async function vistaNotas(contenedor, parametros = {}) {
  let escuelaSel = parametros.escuela || '';
  let gradoSel = parametros.grado || '';
  let fechaSel = parametros.fecha || hoy();

  /** alumno_id -> { nota: string, observacion: string } */
  let marcas = new Map();
  let planilla = null;
  let hayCambios = false;

  const escuelas = await opcionesEscuelas();
  const todosLosGrados = await cache.grados();

  if (gradoSel && !escuelaSel) {
    escuelaSel = String(todosLosGrados.find((g) => g.id === Number(gradoSel))?.escuela_id || '');
  }

  const panel = el('div', {});

  ponerGuardia(() =>
    hayCambios ? 'Hay notas sin guardar. Si salís ahora se pierde lo cargado.' : null
  );

  /* --- Selectores -------------------------------------------------------- */

  const selectorEscuela = el('select', {
    clase: 'control control--filtro',
    onChange: (e) => {
      escuelaSel = e.target.value;
      gradoSel = '';
      llenarGrados();
      mostrarSeleccion();
    },
  },
    el('option', { value: '' }, 'Elegí una escuela'),
    ...escuelas.map((o) =>
      el('option', { value: String(o.valor), selected: String(o.valor) === String(escuelaSel) }, o.texto))
  );

  const selectorGrado = el('select', {
    clase: 'control control--filtro',
    onChange: (e) => { gradoSel = e.target.value; cargar(); },
  });

  const campoFecha = el('input', {
    clase: 'control control--filtro',
    type: 'date',
    value: fechaSel,
    onChange: (e) => { fechaSel = e.target.value || hoy(); cargar(); },
  });

  function llenarGrados() {
    const grados = todosLosGrados.filter((g) => !escuelaSel || g.escuela_id === Number(escuelaSel));
    vaciar(selectorGrado);
    selectorGrado.append(
      el('option', { value: '' }, 'Elegí un grado'),
      ...grados.map((g) =>
        el('option', { value: String(g.id), selected: String(g.id) === String(gradoSel) }, g.nombre))
    );
  }

  llenarGrados();

  vaciar(contenedor);
  contenedor.append(
    encabezado('Notas', 'Cargá la nota de todo el grado de una vez'),
    el('div', { clase: 'barra-filtros' }, selectorEscuela, selectorGrado, campoFecha),
    panel
  );

  /* --- Carga -------------------------------------------------------------- */

  function mostrarSeleccion() {
    vaciar(panel);
    panel.append(vacio('Elegí una escuela y un grado para cargar las notas.'));
  }

  async function cargar() {
    if (!gradoSel) return mostrarSeleccion();

    reemplazarDireccion(`#/notas?grado=${gradoSel}&fecha=${fechaSel}`);

    vaciar(panel);
    panel.append(cargando('Buscando las notas...'));

    planilla = await api.get(`/notas/planilla?grado_id=${gradoSel}&fecha=${fechaSel}`);

    marcas = new Map(
      planilla.alumnos.map((a) => [
        a.id,
        {
          nota: a.nota === null ? '' : String(a.nota),
          observacion: a.observacion || '',
        },
      ])
    );
    hayCambios = false;

    dibujarPlanilla();
  }

  /* --- Dibujo ------------------------------------------------------------- */

  const resumen = el('p', { clase: 'resumen' });

  function actualizarResumen() {
    const notas = [...marcas.values()]
      .map((m) => Number(m.nota))
      .filter((n) => Number.isFinite(n) && notaValida(n));

    const promedio = notas.length > 0
      ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100
      : null;

    vaciar(resumen);
    agregar(resumen,
      el('span', { clase: 'resumen__dato' }, `${notas.length} de ${marcas.size} cargadas`),
      promedio !== null
        ? el('span', { clase: 'resumen__dato resumen__dato--presente' }, `Promedio ${promedio}`)
        : null,
      hayCambios ? el('span', { clase: 'resumen__pendiente' }, 'Sin guardar') : null
    );
  }

  function notaValida(n) {
    return n >= 1 && n <= 10;
  }

  function filaAlumno(alumno, indice) {
    const marca = marcas.get(alumno.id);

    const campoObservacion = el('input', {
      clase: 'control alumno__observacion',
      type: 'text',
      placeholder: 'Observación (opcional)',
      value: marca.observacion,
      hidden: marca.observacion === '',
      onInput: (e) => {
        marcas.get(alumno.id).observacion = e.target.value;
        hayCambios = true;
        actualizarResumen();
      },
    });

    const campoNota = el('input', {
      clase: 'nota-campo',
      type: 'number',
      inputmode: 'decimal',
      min: 1,
      max: 10,
      step: 0.5,
      placeholder: '—',
      value: marca.nota,
      dataset: { indice: String(indice) },
      onInput: (e) => {
        marcas.get(alumno.id).nota = e.target.value;
        hayCambios = true;
        e.target.classList.toggle(
          'nota-campo--invalida',
          e.target.value !== '' && !notaValida(Number(e.target.value))
        );
        actualizarResumen();
      },
      onKeyDown: (e) => {
        // Enter baja al siguiente alumno: se carga el grado entero sin
        // soltar el teclado ni usar el mouse.
        if (e.key === 'Enter') {
          e.preventDefault();
          const siguiente = panel.querySelector(`.nota-campo[data-indice="${indice + 1}"]`);
          if (siguiente) siguiente.focus();
          else e.target.blur();
        }
      },
    });

    return el('div', { clase: `alumno${alumno.activo ? '' : ' alumno--inactivo'}` },
      el('div', { clase: 'alumno__cabecera' },
        el('span', { clase: 'alumno__nombre' }, `${alumno.apellido}, ${alumno.nombre}`),
        alumno.nota_anterior !== null
          ? el('span', { clase: 'nota-anterior', title: 'Nota anterior' }, `antes ${alumno.nota_anterior}`)
          : null,
        campoNota,
        el('button', {
          type: 'button',
          clase: 'alumno__nota',
          title: 'Agregar una observación',
          onClick: () => {
            campoObservacion.hidden = !campoObservacion.hidden;
            if (!campoObservacion.hidden) campoObservacion.focus();
          },
        }, '✎')
      ),
      campoObservacion
    );
  }

  function dibujarPlanilla() {
    vaciar(panel);

    if (planilla.alumnos.length === 0) {
      panel.append(vacio(
        'Este grado todavía no tiene alumnos cargados.',
        boton('Ir a Alumnos', { tipo: 'primario', onClick: () => navegar('/alumnos', { grado: gradoSel }) })
      ));
      return;
    }

    const botonGuardar = boton('Guardar notas', {
      tipo: 'primario',
      onClick: () => guardar(botonGuardar),
    });

    agregar(panel,
      el('div', { clase: 'clase-cabecera' },
        el('h2', {}, `${planilla.escuela.nombre} — ${planilla.grado.nombre}`),
        el('p', { clase: 'clase-cabecera__fecha' }, formatearConDia(planilla.fecha))
      ),

      planilla.ya_registrada
        ? el('div', { clase: 'anuncio anuncio--info' },
            el('strong', {}, 'Esta fecha ya tiene notas cargadas. '),
            'Al guardar se corrigen, no se duplican. Si borrás un número, esa nota se elimina.'
          )
        : null,

      el('div', { clase: 'acciones-rapidas' }, resumen),

      el('p', { clase: 'campo__ayuda' },
        'Escribí la nota (1 a 10) y presioná Enter para pasar al siguiente alumno.'),

      el('div', { clase: 'lista-alumnos' }, ...planilla.alumnos.map(filaAlumno)),

      el('div', { clase: 'barra-guardar' }, botonGuardar)
    );

    actualizarResumen();

    // Foco en el primer campo: se puede empezar a escribir de inmediato.
    setTimeout(() => panel.querySelector('.nota-campo')?.focus(), 60);
  }

  /* --- Guardado ----------------------------------------------------------- */

  async function guardar(botonGuardar) {
    const invalidas = [...marcas.values()].filter(
      (m) => m.nota !== '' && !notaValida(Number(m.nota))
    );
    if (invalidas.length > 0) {
      aviso('Hay notas fuera de la escala 1 a 10', 'error');
      return;
    }

    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando...';

    try {
      const notas = [...marcas.entries()].map(([alumnoId, m]) => ({
        alumno_id: alumnoId,
        nota: m.nota === '' ? null : Number(m.nota),
        observacion: m.observacion.trim() || null,
      }));

      const resultado = await api.post('/notas/planilla', {
        grado_id: Number(gradoSel),
        fecha: fechaSel,
        notas,
      });

      hayCambios = false;
      aviso(
        resultado.borradas > 0
          ? `${resultado.guardadas} notas guardadas, ${resultado.borradas} eliminadas`
          : `${resultado.guardadas} notas guardadas`
      );
      await cargar();
    } catch (error) {
      aviso(error.message, 'error');
      botonGuardar.disabled = false;
      botonGuardar.textContent = 'Guardar notas';
    }
  }

  /* --- Arranque ----------------------------------------------------------- */

  if (gradoSel) await cargar();
  else mostrarSeleccion();
}
