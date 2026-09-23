/**
 * backend/index.js
 * -----------------------------------------------------------------------------
 * Punto de entrada. Carga las variables de entorno, verifica que la base
 * responda y recien ahi levanta el servidor.
 *
 * La linea de dotenv tiene que ser la PRIMERA: el resto de los archivos
 * ya espera encontrar process.env.DATABASE_URL cargada.
 */

require('dotenv').config();

const app = require('./app');
const { verificarConexion, cerrarPool } = require('./config/db');
const { aplicarMigraciones } = require('../db/migrar');
const { estaProtegida } = require('./middleware/auth');

const PUERTO = process.env.PORT || 3000;

async function arrancar() {
  try {
    const info = await verificarConexion();
    console.log(`Base de datos conectada: ${info.base}`);
  } catch (error) {
    console.error('\nNo se pudo conectar a PostgreSQL.');
    console.error(`Motivo: ${error.message}`);
    console.error('Revisa DATABASE_URL en el archivo .env y que PostgreSQL este corriendo.\n');
    process.exit(1);
  }

  // Aplica las migraciones que falten antes de atender pedidos.
  // Es lo que hace que un despliegue nuevo en Railway actualice la base solo.
  try {
    const aplicadas = await aplicarMigraciones({ silencioso: true });
    if (aplicadas > 0) console.log(`Migraciones aplicadas: ${aplicadas}`);
  } catch (error) {
    console.error('\nNo se pudieron aplicar las migraciones.');
    console.error(`Motivo: ${error.message}\n`);
    process.exit(1);
  }

  if (estaProtegida()) {
    console.log('Acceso protegido por contraseña (CLAVE_ACCESO definida)');
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('AVISO: la aplicación está publicada SIN contraseña.');
    console.warn('       Definí la variable CLAVE_ACCESO para protegerla.');
  }

  const servidor = app.listen(PUERTO, () => {
    console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
    console.log(`Diagnostico:               http://localhost:${PUERTO}/api/salud\n`);
  });

  // Apagado ordenado: cierra el servidor y el pool antes de salir.
  const apagar = async (senal) => {
    console.log(`\n${senal} recibido, cerrando...`);
    servidor.close(async () => {
      await cerrarPool();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));
}

arrancar();
