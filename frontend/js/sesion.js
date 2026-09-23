/**
 * frontend/js/sesion.js
 * -----------------------------------------------------------------------------
 * Pantalla de acceso.
 *
 * Solo aparece si el servidor tiene configurada la variable CLAVE_ACCESO
 * (o sea: cuando la aplicacion esta publicada en internet). En tu computadora
 * no se ve nunca, porque el servidor responde que no esta protegida.
 */

import { api } from './api.js';
import { el } from './ui.js';

/** Dibuja el formulario y devuelve una promesa que termina al entrar bien. */
function pedirClave(motivo = null) {
  return new Promise((resolver) => {
    const error = el('p', { clase: 'modal__error', hidden: !motivo }, motivo || '');

    const campo = el('input', {
      clase: 'control',
      type: 'password',
      id: 'clave',
      autocomplete: 'current-password',
      placeholder: 'Contraseña',
    });

    const botonEntrar = el('button', { clase: 'boton boton--primario', type: 'submit' }, 'Entrar');

    const formulario = el('form', {
      clase: 'acceso__caja',
      onSubmit: async (evento) => {
        evento.preventDefault();
        error.hidden = true;
        botonEntrar.disabled = true;
        botonEntrar.textContent = 'Entrando...';

        try {
          await api.post('/sesion', { clave: campo.value });
          pantalla.remove();
          resolver();
        } catch (fallo) {
          error.textContent = fallo.message;
          error.hidden = false;
          botonEntrar.disabled = false;
          botonEntrar.textContent = 'Entrar';
          campo.select();
        }
      },
    },
      el('div', { clase: 'acceso__marca' },
        el('span', { clase: 'marca__icono' }, '♪'),
        el('h1', {}, 'Clases de Música')
      ),
      el('p', { clase: 'acceso__texto' }, 'Ingresá tu contraseña para continuar.'),
      el('div', { clase: 'campo' },
        el('label', { clase: 'campo__etiqueta', for: 'clave' }, 'Contraseña'),
        campo
      ),
      error,
      botonEntrar
    );

    const pantalla = el('div', { clase: 'acceso' }, formulario);
    document.body.append(pantalla);
    setTimeout(() => campo.focus(), 50);
  });
}

/**
 * Se llama al arrancar la aplicacion. Si hace falta clave y no hay sesion,
 * muestra la pantalla de acceso y no devuelve el control hasta que se entre.
 */
export async function asegurarSesion() {
  try {
    const estado = await api.get('/sesion');
    if (estado.protegida && !estado.autenticado) await pedirClave();
  } catch {
    // Si ni siquiera se puede consultar el estado, el problema es de conexion
    // y lo informa la pantalla que se dibuja despues.
  }
}

// Cuando una llamada cualquiera recibe un 401, se vuelve a pedir la clave.
document.addEventListener('sesion-expirada', () => {
  if (document.querySelector('.acceso')) return; // ya se esta pidiendo
  pedirClave('Tu sesión venció. Ingresá la contraseña otra vez.')
    .then(() => window.location.reload());
});
