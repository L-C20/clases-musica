/**
 * frontend/js/vistas/asistencia.js
 * -----------------------------------------------------------------------------
 * LA PANTALLA MAS IMPORTANTE DE LA APLICACION.
 *
 * Todo esta pensado para que cargar una clase lleve segundos:
 *
 *  - Una sola llamada al servidor trae grado, escuela, alumnos y lo ya cargado.
 *  - Los alumnos arrancan marcados como PRESENTES: solo hay que tocar las
 *    excepciones. Es el caso habitual y ahorra decenas de toques.
 *  - Un toque por alumno. Sin formularios, sin abrir ventanas.
 *  - Un solo boton guarda toda la planilla, en una sola transaccion.
 *  - Si la clase ya estaba cargada, se ve el aviso y los estados vienen
 *    puestos: guardar de nuevo corrige, no duplica.
 *
 * Direccion: #/asistencia?grado=4&fecha=2026-09-23
 */

import { api } from '../api.js';
import { opcionesEscuelas, estado as cache } from '../estado.js';
import { navegar, ponerGuardia } from '../app.js';
import { el, vaciar, agregar, encabezado, boton, cargando, vacio, aviso, confirmar, plural } from '../ui.js';
import { hoy, formatearConDia, fechaDeEstaSemana } from '../fechas.js';

const ESTADOS = [
  { valor: 'presente', letra: 'P', texto: 'Presente' },
  { valor: 'ausente', letra: 'A', texto: 'Ausente' },
  { valor: 'tarde', letra: 'T', texto: 'Tarde' },
  { valor: 'justificado', letra: 'J', texto: 'Justificado' },
];

export async function vistaAsistencia(contenedor, parametros = {}) {
  let escuelaSel = parametros.escuela || '';
  let gradoSel = parametros.grado || '';
  let fechaSel = parametros.fecha || hoy();

  /** Estado en memoria: alumno_id -> { estado, observacion } */
  let marcas = new Map();
  let planilla = null;
  let hayCambios = false;

  const escuelas = await opcionesEscuelas();
  const todosLosGrados = await cache.grados();

  // Si vino un grado por la direccion, se completa la escuela que le corresponde.
  if (gradoSel && !escuelaSel) {
    escuelaSel = String(todosLosGrados.find((g) => g.id === Number(gradoSel))?.escuela_id || '');
  }

  const panel = el('div', {});

  // Avisa antes de abandonar la pantalla con una planilla a medio cargar.
  ponerGuardia(() =>
    hayCambios ? 'Hay asistencia sin guardar. Si salís ahora se pierde lo marcado.' : null
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
    onChange: (e) => { gradoSel = e.target.value; alCambiarGrado(); },
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

  /** Al elegir un grado, se propone la fecha de su clase de esta semana. */
  function alCambiarGrado() {
    const grado = todosLosGrados.find((g) => g.id === Number(gradoSel));
    if (grado && grado.dia_semana !== null) {
      fechaSel = fechaDeEstaSemana(grado.dia_semana);
      campoFecha.value = fechaSel;
    }
    cargar();
  }

  llenarGrados();

  vaciar(contenedor);
  contenedor.append(
    encabezado('Asistencia', 'Elegí grado y fecha, marcá y guardá'),
    el('div', { clase: 'barra-filtros' }, selectorEscuela, selectorGrado, campoFecha),
    panel
  );

  /* --- Carga de la planilla ---------------------------------------------- */

  function mostrarSeleccion() {
    vaciar(panel);
    panel.append(vacio('Elegí una escuela y un grado para cargar la asistencia.'));
  }

  async function cargar() {
    if (!gradoSel) return mostrarSeleccion();

    // Mantener la direccion al dia permite recargar o compartir el enlace.
    history.replaceState(null, '', `#/asistencia?grado=${gradoSel}&fecha=${fechaSel}`);

    vaciar(panel);
    panel.append(cargando('Buscando la planilla...'));

    planilla = await api.get(`/planilla?grado_id=${gradoSel}&fecha=${fechaSel}`);

    marcas = new Map(
      planilla.alumnos.map((a) => [
        a.id,
        {
          // Clase nueva: todos presentes. Clase ya cargada: lo que estaba.
          estado: a.estado || 'presente',
          observacion: a.observacion || '',
        },
      ])
    );
    hayCambios = false;

    dibujarPlanilla();
  }

  /* --- Dibujo ------------------------------------------------------------ */

  const resumen = el('p', { clase: 'resumen' });

  function actualizarResumen() {
    const cuenta = { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
    marcas.forEach((m) => { cuenta[m.estado] += 1; });

    vaciar(resumen);
    agregar(resumen,
      el('span', { clase: 'resumen__dato resumen__dato--presente' }, plural(cuenta.presente, 'presente')),
      el('span', { clase: 'resumen__dato resumen__dato--ausente' }, plural(cuenta.ausente, 'ausente')),
      el('span', { clase: 'resumen__dato resumen__dato--tarde' }, plural(cuenta.tarde, 'tarde')),
      el('span', { clase: 'resumen__dato resumen__dato--justificado' }, plural(cuenta.justificado, 'justificado')),
      hayCambios ? el('span', { clase: 'resumen__pendiente' }, 'Sin guardar') : null
    );
  }

  function filaAlumno(alumno) {
    const marca = marcas.get(alumno.id);

    const campoObservacion = el('input', {
      clase: 'control alumno__observacion',
      type: 'text',
      placeholder: 'Observación de la clase (opcional)',
      value: marca.observacion,
      hidden: marca.observacion === '',
      onInput: (e) => {
        marcas.get(alumno.id).observacion = e.target.value;
        hayCambios = true;
        actualizarResumen();
      },
    });

    const botonesEstado = ESTADOS.map((opcion) =>
      el('button', {
        type: 'button',
        clase: `estado estado--${opcion.valor}${marca.estado === opcion.valor ? ' estado--elegido' : ''}`,
        title: opcion.texto,
        'aria-label': `${opcion.texto}: ${alumno.apellido}, ${alumno.nombre}`,
        onClick: (e) => {
          marcas.get(alumno.id).estado = opcion.valor;
          hayCambios = true;

          // Se repinta solo esta fila, no la lista entera: en un grado de
          // 30 alumnos la diferencia se nota al tocar rapido.
          const grupo = e.target.closest('.alumno__estados');
          grupo.querySelectorAll('.estado').forEach((b) => b.classList.remove('estado--elegido'));
          e.target.closest('.estado').classList.add('estado--elegido');

          actualizarResumen();
        },
      },
        el('span', { clase: 'estado__letra' }, opcion.letra),
        el('span', { clase: 'estado__texto' }, opcion.texto)
      )
    );

    return el('div', { clase: `alumno${alumno.activo ? '' : ' alumno--inactivo'}` },
      el('div', { clase: 'alumno__cabecera' },
        el('span', { clase: 'alumno__nombre' },
          `${alumno.apellido}, ${alumno.nombre}`,
          alumno.activo ? null : el('span', { clase: 'pastilla pastilla--apagado' }, 'Inactivo')
        ),
        el('div', { clase: 'alumno__estados' }, ...botonesEstado),
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

    const campoTema = el('input', {
      clase: 'control',
      type: 'text',
      placeholder: 'Tema de la clase (opcional)',
      value: planilla.clase?.tema || '',
      onInput: () => { hayCambios = true; actualizarResumen(); },
    });

    const botonGuardar = boton('Guardar asistencia', {
      tipo: 'primario',
      onClick: () => guardar(campoTema.value, botonGuardar),
    });

    agregar(panel,
      el('div', { clase: 'clase-cabecera' },
        el('h2', {}, `${planilla.escuela.nombre} — ${planilla.grado.nombre}`),
        el('p', { clase: 'clase-cabecera__fecha' }, formatearConDia(planilla.fecha))
      ),

      planilla.ya_registrada
        ? el('div', { clase: 'anuncio anuncio--info' },
            el('strong', {}, 'Esta clase ya tiene asistencia registrada. '),
            'Podés modificarla: al guardar se corrige la existente, no se duplica.',
            el('span', { clase: 'anuncio__extra' },
              boton('Borrar esta clase', {
                chico: true, tipo: 'peligro',
                onClick: () => borrarClase(planilla.clase.id),
              })
            )
          )
        : null,

      el('div', { clase: 'acciones-rapidas' },
        resumen,
        boton('Todos presentes', { chico: true, onClick: marcarTodosPresentes })
      ),

      el('div', { clase: 'lista-alumnos' }, ...planilla.alumnos.map(filaAlumno)),

      el('div', { clase: 'campo campo--completo' },
        el('label', { clase: 'campo__etiqueta' }, 'Tema de la clase'),
        campoTema
      ),

      el('div', { clase: 'barra-guardar' }, botonGuardar)
    );

    actualizarResumen();
  }

  function marcarTodosPresentes() {
    marcas.forEach((m) => { m.estado = 'presente'; });
    hayCambios = true;
    dibujarPlanilla();
  }

  /* --- Guardado ---------------------------------------------------------- */

  async function guardar(tema, botonGuardar) {
    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando...';

    try {
      const asistencias = [...marcas.entries()].map(([alumnoId, m]) => ({
        alumno_id: alumnoId,
        estado: m.estado,
        observacion: m.observacion.trim() || null,
      }));

      await api.post('/planilla', {
        grado_id: Number(gradoSel),
        fecha: fechaSel,
        tema: tema.trim() || null,
        asistencias,
      });

      hayCambios = false;
      aviso(planilla.ya_registrada ? 'Asistencia corregida' : 'Asistencia guardada');
      await cargar();
    } catch (error) {
      aviso(error.message, 'error');
      botonGuardar.disabled = false;
      botonGuardar.textContent = 'Guardar asistencia';
    }
  }

  async function borrarClase(claseId) {
    const sigue = await confirmar(
      'Se borra la clase entera con la asistencia de todos los alumnos. Esto no se puede deshacer.',
      { textoOk: 'Borrar la clase', peligroso: true }
    );
    if (!sigue) return;

    await api.delete(`/clases/${claseId}`);
    aviso('Clase borrada');
    await cargar();
  }

  /* --- Arranque ---------------------------------------------------------- */

  if (gradoSel) await cargar();
  else mostrarSeleccion();
}
