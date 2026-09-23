-- =====================================================================
-- 001_esquema_inicial.sql
-- Esquema completo: escuelas > grados > alumnos > clases > asistencias
--                                             > evaluaciones
-- =====================================================================

-- ---------------------------------------------------------------------
-- Estados posibles de asistencia.
-- Para agregar uno nuevo mas adelante:
--   ALTER TYPE estado_asistencia ADD VALUE 'retirado';
-- ---------------------------------------------------------------------
CREATE TYPE estado_asistencia AS ENUM ('presente', 'ausente', 'tarde', 'justificado');

-- ---------------------------------------------------------------------
-- Funcion reutilizable: mantiene actualizado_en al dia en cada UPDATE.
-- Se engancha como trigger en todas las tablas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- ESCUELAS
-- =====================================================================
CREATE TABLE escuelas (
  id             SERIAL PRIMARY KEY,
  codigo         TEXT,                                  -- ej: 1733
  nombre         TEXT        NOT NULL,                  -- ej: Mauelturata
  descripcion    TEXT,
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT escuelas_nombre_no_vacio CHECK (length(trim(nombre)) > 0)
);

-- El codigo, si existe, no puede repetirse.
CREATE UNIQUE INDEX escuelas_codigo_unico
  ON escuelas (codigo) WHERE codigo IS NOT NULL;

-- Nombre unico sin distinguir mayusculas.
CREATE UNIQUE INDEX escuelas_nombre_unico
  ON escuelas (lower(nombre));

CREATE TRIGGER trg_escuelas_timestamp
  BEFORE UPDATE ON escuelas
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();


-- =====================================================================
-- GRADOS  (pertenecen a una escuela)
-- El horario semanal habitual vive aca: un grado = una clase por semana.
-- =====================================================================
CREATE TABLE grados (
  id             SERIAL PRIMARY KEY,
  escuela_id     INTEGER     NOT NULL REFERENCES escuelas(id) ON DELETE RESTRICT,
  nombre         TEXT        NOT NULL,                  -- ej: 5to grado
  orden          INTEGER     NOT NULL DEFAULT 0,        -- para ordenar la lista
  dia_semana     SMALLINT,                              -- 0=domingo ... 6=sabado
  hora_inicio    TIME,                                  -- ej: 10:00
  duracion_min   INTEGER     NOT NULL DEFAULT 60,
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT grados_nombre_no_vacio  CHECK (length(trim(nombre)) > 0),
  CONSTRAINT grados_dia_valido       CHECK (dia_semana IS NULL OR dia_semana BETWEEN 0 AND 6),
  CONSTRAINT grados_duracion_valida  CHECK (duracion_min > 0 AND duracion_min <= 600),
  -- No puede haber dos grados con el mismo nombre en la misma escuela.
  CONSTRAINT grados_nombre_por_escuela UNIQUE (escuela_id, nombre)
);

CREATE INDEX grados_escuela_idx ON grados (escuela_id, activo);
CREATE INDEX grados_agenda_idx  ON grados (dia_semana, hora_inicio) WHERE activo;

CREATE TRIGGER trg_grados_timestamp
  BEFORE UPDATE ON grados
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();


-- =====================================================================
-- ALUMNOS  (pertenecen a un grado; la escuela se deduce por el grado)
-- Nunca se borran: se desactivan con activo = FALSE.
-- =====================================================================
CREATE TABLE alumnos (
  id             SERIAL PRIMARY KEY,
  grado_id       INTEGER     NOT NULL REFERENCES grados(id) ON DELETE RESTRICT,
  nombre         TEXT        NOT NULL,
  apellido       TEXT        NOT NULL,
  documento      TEXT,                                  -- DNI, opcional
  observaciones  TEXT,                                  -- observaciones generales
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT alumnos_nombre_no_vacio   CHECK (length(trim(nombre)) > 0),
  CONSTRAINT alumnos_apellido_no_vacio CHECK (length(trim(apellido)) > 0)
);

-- El documento, si se carga, no puede repetirse.
CREATE UNIQUE INDEX alumnos_documento_unico
  ON alumnos (documento) WHERE documento IS NOT NULL;

CREATE INDEX alumnos_grado_idx    ON alumnos (grado_id, activo);
CREATE INDEX alumnos_busqueda_idx ON alumnos (lower(apellido), lower(nombre));

CREATE TRIGGER trg_alumnos_timestamp
  BEFORE UPDATE ON alumnos
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();


-- =====================================================================
-- CLASES  (un encuentro real: grado + fecha)
-- UNIQUE(grado_id, fecha) = la base impide duplicar una clase.
-- =====================================================================
CREATE TABLE clases (
  id             SERIAL PRIMARY KEY,
  grado_id       INTEGER     NOT NULL REFERENCES grados(id) ON DELETE RESTRICT,
  fecha          DATE        NOT NULL,                  -- dia de calendario, sin zona horaria
  tema           TEXT,                                  -- que se dio en la clase
  observacion    TEXT,                                  -- nota general de la clase
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT clases_grado_fecha_unica UNIQUE (grado_id, fecha)
);

CREATE INDEX clases_grado_fecha_idx ON clases (grado_id, fecha DESC);
CREATE INDEX clases_fecha_idx       ON clases (fecha DESC);

CREATE TRIGGER trg_clases_timestamp
  BEFORE UPDATE ON clases
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();


-- =====================================================================
-- ASISTENCIAS  (un alumno en una clase)
-- UNIQUE(clase_id, alumno_id) = imposible cargar dos veces el mismo alumno.
-- ON DELETE CASCADE: si se borra una clase cargada por error, se van sus asistencias.
-- =====================================================================
CREATE TABLE asistencias (
  id             SERIAL PRIMARY KEY,
  clase_id       INTEGER           NOT NULL REFERENCES clases(id)  ON DELETE CASCADE,
  alumno_id      INTEGER           NOT NULL REFERENCES alumnos(id) ON DELETE RESTRICT,
  estado         estado_asistencia NOT NULL,
  observacion    TEXT,
  creado_en      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ       NOT NULL DEFAULT now(),

  CONSTRAINT asistencias_clase_alumno_unica UNIQUE (clase_id, alumno_id)
);

CREATE INDEX asistencias_alumno_idx ON asistencias (alumno_id);
CREATE INDEX asistencias_estado_idx ON asistencias (estado);

CREATE TRIGGER trg_asistencias_timestamp
  BEFORE UPDATE ON asistencias
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();


-- =====================================================================
-- EVALUACIONES  (notas del alumno; historial completo, nada se pisa)
-- Escala 1 a 10. Los campos concepto y periodo quedan preparados para
-- trimestres y conceptos cualitativos en fases posteriores.
-- =====================================================================
CREATE TABLE evaluaciones (
  id             SERIAL PRIMARY KEY,
  alumno_id      INTEGER       NOT NULL REFERENCES alumnos(id) ON DELETE RESTRICT,
  fecha          DATE          NOT NULL DEFAULT CURRENT_DATE,
  nota           NUMERIC(4,2),                          -- 1.00 a 10.00
  concepto       TEXT,                                  -- futuro: Muy bueno, etc.
  periodo        TEXT,                                  -- futuro: 1er trimestre
  tipo           TEXT          NOT NULL DEFAULT 'general',
  observacion    TEXT,
  creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT evaluaciones_nota_en_escala CHECK (nota IS NULL OR (nota >= 1 AND nota <= 10)),
  -- Una evaluacion tiene que traer al menos una nota o un concepto.
  CONSTRAINT evaluaciones_nota_o_concepto CHECK (nota IS NOT NULL OR concepto IS NOT NULL)
);

CREATE INDEX evaluaciones_alumno_idx ON evaluaciones (alumno_id, fecha DESC);

CREATE TRIGGER trg_evaluaciones_timestamp
  BEFORE UPDATE ON evaluaciones
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
