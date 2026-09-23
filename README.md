# Gestión de Clases de Música

Aplicación web personal para administrar clases de música en varias escuelas:
escuelas, grados, alumnos, asistencias y (próximamente) notas.

- **Backend:** Node.js + Express + PostgreSQL
- **Frontend:** HTML, CSS y JavaScript sin frameworks
- **Base de datos:** PostgreSQL con migraciones versionadas

---

## Correr la aplicación en tu computadora

```bash
npm install
npm run db:seed     # crea las tablas y carga las escuelas
npm run dev         # arranca el servidor con recarga automática
```

Después abrir http://localhost:3000

Antes hay que crear el archivo `.env` copiando `.env.example` y completando
`DATABASE_URL`.

### Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con reinicio automático al editar archivos |
| `npm start` | Servidor normal (es el que usa Railway) |
| `npm run db:migrar` | Aplica las migraciones pendientes |
| `npm run db:seed` | Migra y además carga los datos iniciales |

---

## Publicar en Railway

> **Esto ya está hecho.** El proyecto vive en Railway, en `clases-musica`,
> con dos servicios: `app` y `Postgres`. Lo que sigue queda documentado por
> si alguna vez hay que rehacerlo o montar un segundo entorno.

### Publicar un cambio (el día a día)

El servicio `app` está conectado al repositorio `L-C20/clases-musica`, rama
`main`. Para publicar alcanza con:

```bash
git push
```

Railway reconstruye y despliega solo. **Las migraciones nuevas se aplican en
el arranque**, así que no hay ningún paso extra al agregar una.

### Montar el proyecto desde cero

```bash
railway init
```

```bash
railway add --database postgres
```

```bash
railway add --service app
```

Después, conectar el servicio al repositorio para que los push desplieguen solos:

```bash
railway service source connect --repo USUARIO/REPO --branch main --service app
```

Queda configurar las variables (abajo) y generar el dominio con
`railway domain --service app`.

### 3. Configurar las variables de entorno

En el servicio de la aplicación (no en el de la base), pestaña **Variables**:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `CLAVE_ACCESO` | la contraseña que quieras para entrar |

`PORT` la define Railway sola: **no hay que agregarla**.

> **`CLAVE_ACCESO` no es opcional en la práctica.** Sin ella, cualquiera que
> conozca la dirección puede ver y modificar los datos de los alumnos.

### 4. Generar la dirección pública

En **Settings → Networking → Generate Domain**.

### 5. Cargar las escuelas

Las migraciones se aplican solas al arrancar, pero los datos iniciales no.
La forma más simple es correr el seed dentro del contenedor, que es el único
lugar con acceso a la base interna de Railway:

```bash
railway ssh --service app npm run db:seed
```

Ese mismo comando sirve para cualquier consulta contra la base de producción.
También se pueden crear las escuelas a mano desde la pantalla de Escuelas.

---

## Estructura del proyecto

```
backend/
├── index.js           arranque: conecta, migra y levanta el servidor
├── app.js             arma Express
├── config/db.js       pool de PostgreSQL (único punto de conexión)
├── routes/            solo definen URLs
├── controllers/       leen la petición, validan, responden
├── services/          TODO el SQL vive acá
├── validators/        reglas de validación
└── middleware/        errores y contraseña de acceso

db/
├── migrations/        001, 002... se aplican una sola vez y en orden
├── seed.sql           datos iniciales
└── migrar.js          aplica las migraciones

frontend/
├── index.html         única página (SPA con router por hash)
├── css/
└── js/
    ├── api.js         único lugar que habla con el backend
    ├── ui.js          botones, tablas, modales, avisos
    ├── fechas.js      fechas sin zona horaria
    └── vistas/        una por pantalla
```

---

## Decisiones que conviene conocer antes de tocar el código

**Las fechas de clase son `DATE`, nunca `TIMESTAMP`.** Y el driver está
configurado para devolverlas como texto `"2026-09-23"` (ver `backend/config/db.js`).
Una fecha de calendario no tiene hora: si se convierte a `Date`, en Argentina
aparece como el día anterior.

**Los duplicados los impide la base, no el código.** `UNIQUE(grado_id, fecha)`
en `clases` y `UNIQUE(clase_id, alumno_id)` en `asistencias`. Guardar una
planilla usa `ON CONFLICT DO UPDATE`, así que guardar por primera vez y
corregir después son la misma operación.

**Nada se borra.** Escuelas, grados y alumnos se desactivan con `activo`,
para conservar el historial.

**Solo `/services` escribe SQL,** y siempre con consultas parametrizadas
(`$1`, `$2`), nunca concatenando texto.

**Criterio de asistencia** (en `backend/services/clases.service.js`):
`presente` y `tarde` cuentan como asistió; `justificado` se descuenta del
total. Si querés otro criterio, se cambia ahí y en un solo lugar.
