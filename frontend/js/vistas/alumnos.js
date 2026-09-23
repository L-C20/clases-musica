/**
 * frontend/js/vistas/alumnos.js
 * -----------------------------------------------------------------------------
 * Pantalla de alumnos: busqueda, filtros por escuela y grado, alta, edicion
 * y baja logica.
 *
 * Acepta ?escuela=ID y ?grado=ID en la direccion.
 *
 * Los alumnos NUNCA se borran: se desactivan, para conservar su historial
 * de asistencias y notas.
 */

import { api } from '../api.js';
import { estado, opcionesEscuelas, opcionesGrados } from '../estado.js';
import { navegar } from '../app.js';
import {
  el, vaciar, encabezado, boton, tabla, etiquetaEstado,
  cargando, vacio, aviso, formulario, confirmar,
} from '../ui.js';

export async function vistaAlumnos(contenedor, parametros = {}) {
  let escuelaFiltro = parametros.escuela || '';
  let gradoFiltro = parametros.grado || '';
  let busqueda = '';
  let mostrarInactivos = false;

  const escuelas = await opcionesEscuelas();
  const lista = el('div', {});

  // Si se llego con ?grado=ID, dejamos sincronizada la escuela de ese grado.
  if (gradoFiltro && !escuelaFiltro) {
    const grados = await estado.grados();
    escuelaFiltro = String(grados.find((g) => g.id === Number(gradoFiltro))?.escuela_id || '');
  }

  const selectorEscuela = el('select', {
    clase: 'control control--filtro',
    onChange: async (e) => {
      escuelaFiltro = e.target.value;
      gradoFiltro = '';
      await recargarSelectorGrados();
      refrescar();
    },
  },
    el('option', { value: '' }, 'Todas las escuelas'),
    ...escuelas.map((o) =>
      el('option', { value: String(o.valor), selected: String(o.valor) === String(escuelaFiltro) }, o.texto))
  );

  const selectorGrado = el('select', {
    clase: 'control control--filtro',
    onChange: (e) => { gradoFiltro = e.target.value; refrescar(); },
  });

  const buscador = el('input', {
    clase: 'control control--filtro control--buscador',
    type: 'search',
    placeholder: 'Buscar por nombre, apellido o documento...',
    onInput: (e) => {
      busqueda = e.target.value;
      clearTimeout(buscador._temporizador);
      // Espera a que deje de escribir antes de consultar al servidor.
      buscador._temporizador = setTimeout(refrescar, 250);
    },
  });

  async function recargarSelectorGrados() {
    const grados = await opcionesGrados(escuelaFiltro || null);
    vaciar(selectorGrado);
    selectorGrado.append(
      el('option', { value: '' }, 'Todos los grados'),
      ...grados.map((o) =>
        el('option', { value: String(o.valor), selected: String(o.valor) === String(gradoFiltro) }, o.texto))
    );
  }

  await recargarSelectorGrados();

  vaciar(contenedor);
  contenedor.append(
    encabezado(
      'Alumnos',
      'Los alumnos que dejan de asistir se desactivan, no se borran',
      boton('+ Nuevo alumno', { tipo: 'primario', onClick: () => abrirFormulario() })
    ),
    el('div', { clase: 'barra-filtros' },
      selectorEscuela,
      selectorGrado,
      buscador,
      el('label', { clase: 'casilla' },
        el('input', {
          type: 'checkbox',
          onChange: (e) => { mostrarInactivos = e.target.checked; refrescar(); },
        }),
        'Mostrar inactivos'
      )
    ),
    lista
  );

  async function refrescar() {
    vaciar(lista);
    lista.append(cargando());

    const alumnos = await api.alumnos.listar({
      escuela_id: escuelaFiltro || null,
      grado_id: gradoFiltro || null,
      q: busqueda || null,
      incluir_inactivos: mostrarInactivos,
    });

    vaciar(lista);

    if (alumnos.length === 0) {
      lista.append(vacio(
        busqueda
          ? `No se encontraron alumnos que coincidan con "${busqueda}".`
          : 'No hay alumnos para estos filtros.',
        busqueda ? null : boton('Agregar alumno', { tipo: 'primario', onClick: () => abrirFormulario() })
      ));
      return;
    }

    lista.append(
      el('p', { clase: 'conteo' }, `${alumnos.length} alumno${alumnos.length === 1 ? '' : 's'}`),
      tabla([
        {
          titulo: 'Alumno',
          // El nombre lleva a la ficha: es el centro de informacion del alumno.
          render: (a) => el('button', {
            clase: 'enlace-alumno',
            type: 'button',
            title: 'Ver la ficha completa',
            onClick: () => navegar('/alumno', { id: a.id }),
          }, `${a.apellido}, ${a.nombre}`),
        },
        { titulo: 'Documento', oculta: true, render: (a) => a.documento || '—' },
        { titulo: 'Escuela', render: (a) => a.escuela_nombre },
        { titulo: 'Grado', render: (a) => a.grado_nombre },
        { titulo: 'Estado', render: (a) => etiquetaEstado(a.activo) },
        {
          titulo: 'Acciones',
          clase: 'col-acciones',
          render: (alumno) => el('div', { clase: 'acciones' },
            boton('Editar', { chico: true, onClick: () => abrirFormulario(alumno) }),
            boton(alumno.activo ? 'Dar de baja' : 'Reactivar', {
              chico: true,
              tipo: alumno.activo ? 'peligro' : 'secundario',
              onClick: () => cambiarEstado(alumno),
            })
          ),
        },
      ], alumnos)
    );
  }

  async function abrirFormulario(alumno = null) {
    await editarAlumno(alumno, { gradoPorDefecto: gradoFiltro, alTerminar: refrescar });
  }

  async function cambiarEstado(alumno) {
    await cambiarEstadoAlumno(alumno, { alTerminar: refrescar });
  }

  await refrescar();
}

/* ---------------------------------------------------------------------------
 * Funciones compartidas
 *
 * La ficha del alumno (vistas/alumno.js) usa exactamente el mismo formulario
 * y la misma baja logica que este listado. Viven aca, exportadas, para que
 * no haya dos versiones de la misma pantalla que se vayan separando con el
 * tiempo.
 * ------------------------------------------------------------------------ */

/** Campos del formulario de alumno, con la lista de grados al dia. */
export async function camposDeAlumno() {
  const grados = await opcionesGrados(null);
  return [
    { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'texto', requerido: true, ancho: 'mitad' },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ancho: 'mitad' },
    { nombre: 'grado_id', etiqueta: 'Escuela y grado', tipo: 'select', requerido: true,
      numerico: true, opciones: grados },
    { nombre: 'documento', etiqueta: 'Documento', tipo: 'texto', ancho: 'mitad',
      ayuda: 'Opcional, pero no puede repetirse' },
    { nombre: 'observaciones', etiqueta: 'Observaciones generales', tipo: 'textarea', filas: 3 },
  ];
}

/** Abre el formulario para crear (alumno = null) o editar un alumno. */
export async function editarAlumno(alumno = null, { gradoPorDefecto = '', alTerminar } = {}) {
  formulario({
    titulo: alumno ? `Editar ${alumno.apellido}, ${alumno.nombre}` : 'Nuevo alumno',
    campos: await camposDeAlumno(),
    valores: alumno || { grado_id: gradoPorDefecto || '' },
    alGuardar: async (datos) => {
      if (alumno) await api.alumnos.actualizar(alumno.id, datos);
      else await api.alumnos.crear(datos);

      estado.olvidar('escuelas', 'grados');
      aviso(alumno ? 'Alumno actualizado' : 'Alumno creado');
      await alTerminar?.();
    },
  });
}

/** Baja / alta logica, con confirmacion antes de dar de baja. */
export async function cambiarEstadoAlumno(alumno, { alTerminar } = {}) {
  if (alumno.activo) {
    const sigue = await confirmar(
      `¿Dar de baja a ${alumno.nombre} ${alumno.apellido}? No se borra nada: conserva su historial y podés reactivarlo cuando quieras.`,
      { textoOk: 'Dar de baja', peligroso: true }
    );
    if (!sigue) return false;
  }

  await api.alumnos.cambiarEstado(alumno.id, !alumno.activo);
  estado.olvidar('escuelas', 'grados');
  aviso(alumno.activo ? 'Alumno dado de baja' : 'Alumno reactivado');
  await alTerminar?.();
  return true;
}
