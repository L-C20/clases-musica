/**
 * backend/app.js
 * -----------------------------------------------------------------------------
 * Arma la aplicacion Express: middlewares, archivos del frontend, rutas
 * de la API y manejo de errores.
 *
 * No arranca el servidor: de eso se encarga backend/index.js.
 * Separarlo hace que la app sea facil de testear mas adelante.
 */

const path = require('path');
const express = require('express');
const rutasApi = require('./routes');
const { noEncontrado, manejadorDeErrores } = require('./middleware/errores');

const app = express();

// --- Middlewares base -------------------------------------------------------

// Interpreta los cuerpos JSON que manda el frontend.
app.use(express.json({ limit: '1mb' }));

// Log simple de cada request, util mientras desarrollamos.
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api')) {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
    }
  });
  next();
});

// --- Frontend ---------------------------------------------------------------
// El mismo servidor sirve la interfaz. Un solo puerto, sin CORS.
//
// En desarrollo se pide al navegador que NO guarde en cache los archivos:
// asi, al editar un .css o un .js, el cambio se ve recargando la pagina,
// sin tener que hacer Ctrl+F5 cada vez.
const enDesarrollo = process.env.NODE_ENV !== 'production';

app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  setHeaders: (res) => {
    if (enDesarrollo) res.setHeader('Cache-Control', 'no-store');
  },
}));

// --- API --------------------------------------------------------------------
app.use('/api', rutasApi);

// --- Errores ----------------------------------------------------------------
// Van al final, despues de todas las rutas.
app.use('/api', noEncontrado);
app.use(manejadorDeErrores);

module.exports = app;
