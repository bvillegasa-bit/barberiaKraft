/* =============================================================================
   Barbería Kraft — pagina-reservar.js
   Flujo del cliente: Servicio → Fecha → Hora → Confirmar.
   - Guard de sesión: sin sesión redirige a /login?next=/reservar.
   - Datos: servicios (api.js) + horario_del_dia + slots_ocupados (RPC).
   - Alta: RPC crear_reserva (valida en servidor) → /ticket?codigo=...
   - Lógica pura de horarios: logica/horario-logica.js (sin duplicar reglas).
   ============================================================================= */

import {
  $,
  $$,
  iniciarNavbar,
  formatoSoles,
  estadoCarga,
  estadoError,
  estadoVacio
} from './ui.js';
import { cargarServiciosActivos, mensajeErrorSeccion } from './api.js';
import { getSupabase } from './supabase-client.js';
import { esConfigPlaceholder } from './config.js';
import { configurarNavbarSesion } from './navbar-sesion.js';
import { configurarVolverPanel } from './volver-panel.js';
import { cerrarSesion } from './auth.js';
import {
  esFechaValida,
  esFechaReservable,
  generarSlots,
  horarioDeFecha,
  filtrarSlotsDisponibles
} from './logica/horario-logica.js';

const MENSAJES_ERROR = Object.freeze({
  debes_iniciar_sesion: 'Debes iniciar sesión para reservar.',
  no_autenticado: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  fecha_invalida: 'La fecha no es válida: elige entre hoy y los próximos 60 días.',
  fecha_muy_lejana: 'Solo puedes reservar con hasta 60 días de anticipación.',
  hora_invalida: 'Debes seleccionar una hora.',
  hora_fuera_de_grilla: 'La hora elegida no está dentro de los horarios disponibles.',
  dia_cerrado: 'Los domingos permanecemos cerrados. Elige otro día.',
  horario_no_permitido: 'La hora elegida está fuera del horario de atención.',
  servicio_invalido: 'El servicio seleccionado ya no está disponible.',
  servicio_no_disponible: 'El servicio ya no está disponible. Elige otro.',
  sin_cupo: 'No hay cupo para esa hora. Elige otro horario.',
  reserva_duplicada: 'Ya tienes una reserva activa para esa fecha y hora.'
});

const IDS_PASO = Object.freeze({
  1: 'paso-servicio',
  2: 'paso-fecha',
  3: 'paso-hora',
  4: 'paso-confirmar'
});

const estado = {
  paso: 1,
  servicios: [],
  servicio: null,
  fecha: '',
  hora: '',
  horarioFecha: null,
  fechaReservable: false
};

const app = $('#reserva-app');
const contEstado = $('#reserva-estado');
const listaServicios = $('#lista-servicios');
const inputFecha = $('#fecha');
const avisoFecha = $('#aviso-fecha');
const grillaSlots = $('#grilla-horas');
const avisoSlots = $('#aviso-slots');
const resumen = $('#resumen-reserva');
const errorReserva = $('#alerta-reserva');
const btnConfirmar = $('#btn-confirmar');
const btnAtras = $('#btn-atras');
const btnSiguiente = $('#btn-siguiente');
const avisoConfig = $('#reserva-config');

/* -----------------------------------------------------------------------------
   Fechas y horas en la zona del negocio (America/Lima, sin depender del equipo)
   ----------------------------------------------------------------------------- */
function partesLima() {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const valores = {};
  partes.forEach((parte) => {
    valores[parte.type] = parte.value;
  });

  return {
    fecha: `${valores.year}-${valores.month}-${valores.day}`,
    hora: `${valores.hour === '24' ? '00' : valores.hour}:${valores.minute}`
  };
}

function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const utc = new Date(Date.UTC(anio, mes - 1, dia + dias));
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${utc.getUTCFullYear()}-${mm}-${dd}`;
}

function normalizarHora(valor) {
  const texto = String(valor ?? '').trim();
  return /^\d{2}:\d{2}/.test(texto) ? texto.slice(0, 5) : '';
}

function fechaLegible(fecha) {
  if (!esFechaValida(fecha)) return '-';
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

function esDomingo(fecha) {
  if (!esFechaValida(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() === 0;
}

/* -----------------------------------------------------------------------------
   Horario de la fecha (RPC con fallback a la lógica pura)
   ----------------------------------------------------------------------------- */
async function cargarHorarioFecha(fecha) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('horario_del_dia', { p_fecha: fecha });
    if (error) throw error;

    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila) throw new Error('Sin datos de horario');

    return {
      apertura: normalizarHora(fila.apertura) || '08:30',
      cierre: normalizarHora(fila.cierre) || '19:00',
      esFeriado: Boolean(fila.es_feriado)
    };
  } catch {
    const base = horarioDeFecha(fecha, {});
    return { apertura: base.apertura, cierre: base.cierre, esFeriado: base.esFeriado };
  }
}

/* -----------------------------------------------------------------------------
   Stepper
   ----------------------------------------------------------------------------- */
const ETIQUETAS_PASO = ['Servicio', 'Fecha', 'Hora', 'Confirmar'];

function actualizarStepper() {
  $$('.stepper__paso').forEach((elemento) => {
    const paso = Number(elemento.dataset.paso);
    elemento.classList.toggle('is-actual', paso === estado.paso);
    elemento.classList.toggle('is-completado', paso < estado.paso);
    if (paso === estado.paso) {
      elemento.setAttribute('aria-current', 'step');
    } else {
      elemento.removeAttribute('aria-current');
    }
  });

  const stepper = $('.stepper');
  if (stepper) stepper.setAttribute('data-paso', String(estado.paso));

  const barra = $('.stepper__barra');
  if (barra) {
    barra.setAttribute('aria-valuenow', String(estado.paso));
    barra.setAttribute('aria-valuetext', `Paso ${estado.paso} de 4: ${ETIQUETAS_PASO[estado.paso - 1]}`);
  }
}

function actualizarBotonSiguiente() {
  let habilitado = false;

  if (estado.paso === 1) habilitado = Boolean(estado.servicio);
  if (estado.paso === 2) habilitado = estado.fechaReservable;
  if (estado.paso === 3) habilitado = Boolean(estado.hora);
  if (estado.paso === 4) habilitado = false;

  btnSiguiente.disabled = !habilitado;
}

function irAPaso(paso) {
  estado.paso = paso;

  $$('.reserva-paso').forEach((seccion) => {
    seccion.hidden = Number(seccion.dataset.paso) !== paso;
  });

  if (paso === 4) renderResumen();

  btnAtras.hidden = paso === 1;
  btnSiguiente.hidden = paso === 4;
  actualizarStepper();
  actualizarBotonSiguiente();

  const seccion = $(`#${IDS_PASO[paso]}`);
  const titulo = seccion ? seccion.querySelector('h2') : null;
  if (titulo) titulo.focus();

  if (paso === 3) cargarSlots();
}

/* -----------------------------------------------------------------------------
   Paso 1 — servicios
   ----------------------------------------------------------------------------- */
function seleccionarServicio(servicio, boton) {
  estado.servicio = servicio;
  $$('.reserva-servicio', listaServicios).forEach((elemento) => {
    elemento.setAttribute('aria-pressed', String(elemento === boton));
  });
  actualizarBotonSiguiente();
}

function renderServicios(servicios) {
  listaServicios.innerHTML = '';

  servicios.forEach((servicio) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'reserva-servicio';
    boton.setAttribute('aria-pressed', 'false');

    const info = document.createElement('span');
    info.className = 'reserva-servicio__info';

    const nombre = document.createElement('span');
    nombre.className = 'reserva-servicio__nombre';
    nombre.textContent = String(servicio.nombre ?? '');

    const meta = document.createElement('span');
    meta.className = 'reserva-servicio__meta';
    meta.textContent = `${Number(servicio.duracion_min) || 30} min`;

    const precio = document.createElement('span');
    precio.className = 'reserva-servicio__precio';
    precio.textContent = formatoSoles(servicio.precio_soles);

    info.append(nombre, meta);
    boton.append(info, precio);
    boton.addEventListener('click', () => seleccionarServicio(servicio, boton));

    listaServicios.appendChild(boton);
  });
}

async function cargarServicios() {
  estadoCarga(listaServicios, 'Cargando servicios…');

  const { ok, data, error } = await cargarServiciosActivos();

  if (!ok) {
    estadoError(listaServicios, mensajeErrorSeccion(error), cargarServicios);
    return;
  }

  if (data.length === 0) {
    estadoVacio(listaServicios, 'No hay servicios disponibles por ahora.', 'icon-navaja');
    return;
  }

  estado.servicios = data;
  renderServicios(data);
}

/* -----------------------------------------------------------------------------
   Paso 2 — fecha
   ----------------------------------------------------------------------------- */
function mostrarAvisoFecha(texto, esError) {
  if (!texto) {
    avisoFecha.hidden = true;
    avisoFecha.textContent = '';
    return;
  }
  avisoFecha.textContent = texto;
  avisoFecha.classList.toggle('reserva-aviso--error', Boolean(esError));
  avisoFecha.hidden = false;
}

async function alCambiarFecha() {
  const fecha = String(inputFecha.value ?? '').trim();
  estado.fecha = fecha;
  estado.hora = '';
  estado.fechaReservable = false;
  estado.horarioFecha = null;
  inputFecha.setCustomValidity('');
  mostrarAvisoFecha('', false);
  actualizarBotonSiguiente();

  if (!fecha) return;

  if (!esFechaValida(fecha)) {
    mostrarAvisoFecha('La fecha no es válida.', true);
    return;
  }

  if (esDomingo(fecha)) {
    inputFecha.setCustomValidity('Los domingos permanecemos cerrados.');
    mostrarAvisoFecha('Los domingos permanecemos cerrados. Elige otro día.', true);
    return;
  }

  const { fecha: hoy, hora: ahora } = partesLima();
  const horario = await cargarHorarioFecha(fecha);
  estado.horarioFecha = horario;

  if (!esFechaReservable(fecha, { hoy, ahora, cierre: horario.cierre })) {
    const mensaje =
      fecha === hoy
        ? 'Ya no quedan horarios disponibles para hoy. Elige otro día.'
        : 'No atendemos ese día. Elige de lunes a sábado.';
    inputFecha.setCustomValidity(mensaje);
    mostrarAvisoFecha(mensaje, true);
    return;
  }

  estado.fechaReservable = true;
  if (horario.esFeriado) {
    mostrarAvisoFecha(`Es feriado: el cierre es a las ${horario.cierre}.`, false);
  }
  actualizarBotonSiguiente();
}

/* -----------------------------------------------------------------------------
   Paso 3 — horarios
   ----------------------------------------------------------------------------- */
function renderSlots(todos, ocupadas, disponibles) {
  grillaSlots.innerHTML = '';

  if (todos.length === 0) {
    estadoVacio(grillaSlots, 'No hay horarios de atención para esta fecha.', 'icon-reloj');
    return;
  }

  todos.forEach((hora) => {
    const ocupado = ocupadas.has(hora);
    const disponible = disponibles.has(hora);

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'reserva-slot';
    boton.disabled = !disponible;
    boton.setAttribute('aria-pressed', String(estado.hora === hora));
    boton.setAttribute('aria-label', ocupado ? `${hora}, ocupado` : `${hora}${disponible ? '' : ', no disponible'}`);

    const texto = document.createElement('span');
    texto.textContent = hora;
    boton.appendChild(texto);

    if (!disponible) {
      const etiqueta = document.createElement('span');
      etiqueta.className = 'reserva-slot__etiqueta';
      etiqueta.textContent = ocupado ? 'Ocupado' : 'No disponible';
      boton.appendChild(etiqueta);
    } else {
      boton.addEventListener('click', () => {
        estado.hora = hora;
        $$('.reserva-slot', grillaSlots).forEach((elemento) => {
          elemento.setAttribute('aria-pressed', String(elemento === boton));
        });
        actualizarBotonSiguiente();
      });
    }

    grillaSlots.appendChild(boton);
  });
}

async function cargarSlots() {
  if (!estado.fecha) return;

  estadoCarga(grillaSlots, 'Consultando horarios…');
  avisoSlots.hidden = true;

  const horario = estado.horarioFecha || (await cargarHorarioFecha(estado.fecha));
  estado.horarioFecha = horario;

  const todos = generarSlots({
    apertura: horario.apertura,
    cierre: horario.cierre,
    intervaloMin: 30
  });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('slots_ocupados', { p_fecha: estado.fecha });
    if (error) throw error;

    const ocupadas = new Set(
      (Array.isArray(data) ? data : [])
        .map((fila) => normalizarHora(fila?.hora))
        .filter(Boolean)
    );

    const { fecha: hoy, hora: ahora } = partesLima();
    const disponibles = new Set(
      filtrarSlotsDisponibles(todos, { fecha: estado.fecha, hoy, ahora, ocupadas })
    );

    if (estado.hora && !disponibles.has(estado.hora)) {
      estado.hora = '';
    }

    renderSlots(todos, ocupadas, disponibles);
    actualizarBotonSiguiente();

    if (todos.length > 0 && disponibles.size === 0) {
      avisoSlots.textContent = 'No quedan horarios disponibles para esta fecha. Elige otro día.';
      avisoSlots.classList.add('reserva-aviso--error');
      avisoSlots.hidden = false;
    }
  } catch (error) {
    estadoError(grillaSlots, mensajeErrorSeccion(error), cargarSlots);
    avisoSlots.hidden = true;
  }
}

/* -----------------------------------------------------------------------------
   Paso 4 — resumen y confirmación
   ----------------------------------------------------------------------------- */
function agregarFila(etiqueta, valor, modificador = '') {
  const fila = document.createElement('div');
  fila.className = 'reserva-resumen__fila';

  const dt = document.createElement('dt');
  dt.className = 'reserva-resumen__etiqueta';
  dt.textContent = etiqueta;

  const dd = document.createElement('dd');
  dd.className = 'reserva-resumen__valor';
  if (modificador) dd.classList.add(modificador);
  dd.textContent = valor;

  fila.append(dt, dd);
  resumen.appendChild(fila);
}

function renderResumen() {
  resumen.innerHTML = '';
  if (!estado.servicio) return;

  agregarFila('Servicio', String(estado.servicio.nombre ?? '-'));
  agregarFila('Fecha', fechaLegible(estado.fecha));
  agregarFila('Hora', estado.hora || '-');
  agregarFila('Duración', `${Number(estado.servicio.duracion_min) || 0} min`);
  agregarFila('Precio', formatoSoles(estado.servicio.precio_soles), 'reserva-resumen__valor--total');
  agregarFila('Barbero', 'Cualquiera');
}

function codigoErrorReserva(error) {
  const hint = String(error?.hint ?? '').trim().toLowerCase();
  if (hint) return hint;

  const mensaje = String(error?.message ?? '').toLowerCase();
  if (mensaje.includes('cupo')) return 'sin_cupo';
  if (mensaje.includes('domingo')) return 'dia_cerrado';
  if (mensaje.includes('fuera de la grilla') || mensaje.includes('grilla')) return 'hora_fuera_de_grilla';
  if (mensaje.includes('60') || mensaje.includes('lejana')) return 'fecha_muy_lejana';
  if (mensaje.includes('horario')) return 'horario_no_permitido';
  if (
    mensaje.includes('sesión') ||
    mensaje.includes('sesion') ||
    mensaje.includes('iniciar sesión') ||
    mensaje.includes('autentic')
  ) {
    return 'debes_iniciar_sesion';
  }
  if (mensaje.includes('fecha')) return 'fecha_invalida';
  if (mensaje.includes('disponible')) return 'servicio_no_disponible';
  if (mensaje.includes('servicio')) return 'servicio_invalido';
  if (mensaje.includes('reserva activa') || mensaje.includes('duplicada')) return 'reserva_duplicada';
  return '';
}

function mostrarErrorReserva(texto) {
  errorReserva.textContent = texto;
  errorReserva.hidden = !texto;
}

async function confirmarReserva() {
  if (!estado.servicio || !estado.fecha || !estado.hora) return;

  mostrarErrorReserva('');
  btnConfirmar.disabled = true;
  btnConfirmar.textContent = 'Confirmando…';

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('crear_reserva', {
      p_servicio_id: estado.servicio.id,
      p_fecha: estado.fecha,
      p_hora: estado.hora,
      p_barbero: 'cualquiera'
    });

    if (error) {
      const codigo = codigoErrorReserva(error);
      if (codigo === 'debes_iniciar_sesion' || codigo === 'no_autenticado') {
        window.location.assign('/login?next=' + encodeURIComponent('/reservar'));
        return;
      }
      mostrarErrorReserva(
        MENSAJES_ERROR[codigo] || 'No se pudo confirmar la reserva. Inténtalo de nuevo.'
      );
      return;
    }

    const fila = Array.isArray(data) ? data[0] : data;
    const codigo = String(fila?.codigo ?? '').trim();
    if (!codigo) {
      mostrarErrorReserva('La reserva se creó, pero no recibimos el código del ticket. Revisa tus reservas.');
      return;
    }

    window.location.assign('/ticket?codigo=' + encodeURIComponent(codigo));
  } catch (error) {
    console.error('pagina-reservar.js — crear_reserva:', error);
    mostrarErrorReserva('No se pudo confirmar la reserva. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Confirmar reserva';
  }
}

/* -----------------------------------------------------------------------------
   Eventos y arranque
   ----------------------------------------------------------------------------- */
function conectarEventos() {
  btnSiguiente.addEventListener('click', () => {
    if (estado.paso < 4) irAPaso(estado.paso + 1);
  });

  btnAtras.addEventListener('click', () => {
    if (estado.paso > 1) irAPaso(estado.paso - 1);
  });

  inputFecha.addEventListener('change', alCambiarFecha);
  btnConfirmar.addEventListener('click', confirmarReserva);
}

function configurarCerrarSesion() {
  const botonSalir = $('#btn-cerrar-sesion');
  if (!botonSalir) return;

  botonSalir.hidden = false;
  botonSalir.addEventListener('click', () => cerrarSesion());
}

async function haySesion() {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  } catch (error) {
    console.error('pagina-reservar.js — getSession:', error);
    return false;
  }
}

async function iniciar() {
  iniciarNavbar();

  const anio = $('#anio');
  if (anio) anio.textContent = String(new Date().getFullYear());

  if (esConfigPlaceholder()) {
    if (avisoConfig) avisoConfig.hidden = false;
    return;
  }

  configurarNavbarSesion();
  configurarVolverPanel();

  estadoCarga(contEstado, 'Verificando tu sesión…');

  if (!(await haySesion())) {
    window.location.replace('/login?next=' + encodeURIComponent('/reservar'));
    return;
  }

  contEstado.innerHTML = '';
  contEstado.hidden = true;
  app.hidden = false;
  configurarCerrarSesion();

  const { fecha: hoy } = partesLima();
  inputFecha.min = hoy;
  inputFecha.max = sumarDias(hoy, 60);

  conectarEventos();
  actualizarStepper();
  actualizarBotonSiguiente();
  await cargarServicios();
}

iniciar();
