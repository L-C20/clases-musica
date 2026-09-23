/**
 * frontend/js/vistas/escuelas.js
 * -----------------------------------------------------------------------------
 * Pantalla de escuelas: listado, alta, edicion y activar/desactivar.
 */

import { api } from '../api.js';
import { estado } from '../estado.js';
import { navegar } from '../app.js';
import {
  el, vaciar, encabezado, boton, tabla, etiquetaEstado,
  cargando, vacio, aviso, formulario, confirmar,
} from '../ui.js';

const CAMPOS = [
  { nombre: 'codigo', etiqueta: 'Código', tipo: 'texto', ancho: 'mitad',
    marcador: '1733', ayuda: 'Número de la escuela (opcional)' },
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ancho: 'mitad' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
];

export async function vistaEscuelas(contenedor) {
  let mostrarInactivas = false;

  const lista = el('div', {});

  const casillaInactivas = el('label', { clase: 'casilla' },
    el('input', {
      type: 'checkbox',
      checked: mostrarInactivas,
      onChange: (e) => { mostrarInactivas = e.target.checked; refrescar(); },
    }),
    'Mostrar inactivas'
  );

  vaciar(contenedor);
  contenedor.append(
    encabezado(
      'Escuelas',
      'Cada escuela agrupa sus propios grados y alumnos',
      boton('+ Nueva escuela', { tipo: 'primario', onClick: () => abrirFormulario() })
    ),
    el('div', { clase: 'barra-filtros' }, casillaInactivas),
    lista
  );

  async function refrescar() {
    vaciar(lista);
    lista.append(cargando());

    const escuelas = await api.escuelas.listar({ incluir_inactivas: mostrarInactivas });

    vaciar(lista);

    if (escuelas.length === 0) {
      lista.append(vacio(
        'Todavía no hay escuelas cargadas.',
        boton('Crear la primera', { tipo: 'primario', onClick: () => abrirFormulario() })
      ));
      return;
    }

    lista.append(tabla([
      { titulo: 'Código', render: (e) => e.codigo || '—' },
      { titulo: 'Escuela', render: (e) => el('strong', {}, e.nombre) },
      { titulo: 'Descripción', render: (e) => e.descripcion || '—' },
      { titulo: 'Grados', clase: 'col-numero', render: (e) => String(e.total_grados) },
      { titulo: 'Alumnos', clase: 'col-numero', render: (e) => String(e.total_alumnos) },
      { titulo: 'Estado', render: (e) => etiquetaEstado(e.activo) },
      {
        titulo: 'Acciones',
        clase: 'col-acciones',
        render: (escuela) => el('div', { clase: 'acciones' },
          boton('Grados', {
            chico: true,
            titulo: 'Ver los grados de esta escuela',
            onClick: () => navegar('/grados', { escuela: escuela.id }),
          }),
          boton('Editar', { chico: true, onClick: () => abrirFormulario(escuela) }),
          boton(escuela.activo ? 'Desactivar' : 'Activar', {
            chico: true,
            tipo: escuela.activo ? 'peligro' : 'secundario',
            onClick: () => cambiarEstado(escuela),
          })
        ),
      },
    ], escuelas));
  }

  function abrirFormulario(escuela = null) {
    formulario({
      titulo: escuela ? `Editar ${escuela.nombre}` : 'Nueva escuela',
      campos: CAMPOS,
      valores: escuela || {},
      alGuardar: async (valores) => {
        if (escuela) await api.escuelas.actualizar(escuela.id, valores);
        else await api.escuelas.crear(valores);

        estado.olvidar('escuelas');
        aviso(escuela ? 'Escuela actualizada' : 'Escuela creada');
        await refrescar();
      },
    });
  }

  async function cambiarEstado(escuela) {
    if (escuela.activo) {
      const sigue = await confirmar(
        `¿Desactivar "${escuela.nombre}"? Sus grados y alumnos se conservan, pero la escuela deja de aparecer en los listados.`,
        { textoOk: 'Desactivar', peligroso: true }
      );
      if (!sigue) return;
    }

    await api.escuelas.cambiarEstado(escuela.id, !escuela.activo);
    estado.olvidar('escuelas');
    aviso(escuela.activo ? 'Escuela desactivada' : 'Escuela activada');
    await refrescar();
  }

  await refrescar();
}
