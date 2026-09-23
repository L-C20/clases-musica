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
import { estado as cache } from '../estado.js';
import { navegar, ponerGuardia, reemplazarDireccion } from '../app.js';
import {
  el, vaciar, agregar, encabezado, boton, botonIcono, selectorAgrupado,
  cargando, vacio, aviso, confirmar, plural,
} from '../ui.js';
import { icono } from '../iconos.js';
import { elegirGrado } from './elegir-grado.js';
import { hoy, formatearConDia, fechaDeEstaSemana, sumarDias } from '../fechas.js';

const ESTADOS = [
  { valor: 'presente', letra: 'P', texto: 'Presente' },
  { valor: 'ausente', letra: 'A', texto: 'Ausente' },
  { valor: 'tarde', letra: 'T', texto: 'Tarde' },
  { valor: 'justificado', letra: 'J', texto: 'Justificado' },
];

export async function vistaAsistencia(contenedor, parametros = {}) {
  let gradoSel = parametros.grado || '';
  let fechaSel = parametros.fecha || hoy();

  /** Estado en memoria: alumno_id -> { estado, observacion } */
  let marcas = new Map();
  let planilla = null;
  let hayCambios = false;

  const todosLosGrados = await cache.grados();
  const escuelas = await cache.escuelas();

  const panel = el('div', {});

  // Avisa antes de abandonar la pantalla con una planilla a medio cargar.
  ponerGuardia(() =>
    hayCambios ? 'Hay asistencia sin guardar. Si salís ahora se pierde lo marcado.' : null
  );

  /* --- Selectores -------------------------------------------------------- */

  /*
   * Un solo selector para escuela y grado.
   *
   * Antes eran dos: elegir la escuela y recien ahi elegir el grado. Como cada
   * grado pertenece a una sola escuela, el primer paso no agregaba informacion,
   * solo un toque mas antes de poder trabajar. Agrupados, la escuela se sigue
   * viendo como titulo y el grado se elige de una.
   */
  const selectorGrado = selectorAgrupado({
    opciones: todosLosGrados.map((g) => ({
      grupo: g.escuela_nombre, valor: g.id, texto: g.nombre,
    })),
    valor: gradoSel,
    textoVacio: 'Elegí un grado',
    clase: 'control control--filtro control--ancho',
    onCambio: (valor) => { gradoSel = valor; alCambiarGrado(); },
  });

  const campoFecha = el('input', {
    clase: 'control control--filtro',
    type: 'date',
    value: fechaSel,
    onChange: (e) => { fechaSel = e.target.value || hoy(); cargar(); },
  });

  /*
   * Las flechas mueven una SEMANA, no un dia.
   *
   * Cada grado tiene una clase por semana: saltando de a siete dias se cae
   * siempre sobre otra clase real de ese mismo grado. De a un dia habria que
   * tocar seis veces para llegar a un dia en el que no hubo clase.
   */
  function moverSemanas(cantidad) {
    fechaSel = sumarDias(fechaSel, cantidad * 7);
    campoFecha.value = fechaSel;
    cargar();
  }

  const grupoFecha = el('div', { clase: 'grupo-fecha control--ancho' },
    botonIcono('anterior', { titulo: 'Semana anterior', onClick: () => moverSemanas(-1) }),
    campoFecha,
    botonIcono('siguiente', { titulo: 'Semana siguiente', onClick: () => moverSemanas(1) })
  );

  /** Al elegir un grado, se propone la fecha de su clase de esta semana. */
  function alCambiarGrado() {
    const grado = todosLosGrados.find((g) => g.id === Number(gradoSel));
    if (grado && grado.dia_semana !== null) {
      fechaSel = fechaDeEstaSemana(grado.dia_semana);
      campoFecha.value = fechaSel;
    }
    cargar();
  }

  /*
   * La barra de filtros aparece recien cuando hay un grado elegido.
   *
   * Mientras no lo hay, la pantalla es el paso a paso de tarjetas y un
   * desplegable arriba seria una segunda forma de hacer lo mismo, compitiendo
   * con la primera. Una vez adentro si sirve: es la manera rapida de saltar a
   * otro grado sin volver al principio.
   */
  const barra = el('div', { clase: 'barra-filtros', hidden: true }, selectorGrado, grupoFecha);

  vaciar(contenedor);
  contenedor.append(
    encabezado('Asistencia', 'Elegí grado y fecha, marcá y guardá'),
    barra,
    panel
  );

  /* --- Carga de la planilla ---------------------------------------------- */

  function mostrarSeleccion() {
    barra.hidden = true;
    vaciar(panel);
    panel.append(elegirGrado({
      grados: todosLosGrados,
      escuelas,
      onElegir: (id) => {
        gradoSel = String(id);
        selectorGrado.value = gradoSel;
        alCambiarGrado();
      },
    }));
  }

  async function cargar() {
    if (!gradoSel) return mostrarSeleccion();

    barra.hidden = false;

    // Mantener la direccion al dia permite recargar o compartir el enlace.
    reemplazarDireccion(`#/asistencia?grado=${gradoSel}&fecha=${fechaSel}`);

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
        }, icono('editar', { tamano: 17 }))
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
            el('strong', {}, 'Ya tiene asistencia cargada. '),
            'Al guardar se corrige, no se duplica.',
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
