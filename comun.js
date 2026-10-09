'use strict'
// PIEZAS COMUNES DE LAS PANTALLAS: armar elementos, iconos, avisos, hojas que
// suben desde abajo, campos de plata y fechas, y el boton de instalar.

const $app = document.getElementById('app')

function el (tag, props, ...hijos) {
  const n = document.createElement(tag)
  for (const k in (props || {})) {
    const v = props[k]
    if (v == null || v === false) continue
    if (k === 'clase') n.className = v
    else if (k === 'texto') n.textContent = v
    else if (k === 'estilo') Object.assign(n.style, v)
    else if (k === 'valor') n.value = v
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else n.setAttribute(k, v === true ? '' : v)
  }
  for (const h of hijos.flat(6)) if (h != null && h !== false) n.append(h instanceof Node ? h : document.createTextNode(String(h)))
  return n
}
const limpiar = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n }
const poner = (n, ...hijos) => { limpiar(n); for (const h of hijos.flat(6)) if (h != null && h !== false) n.append(h); return n }

const { fmtPlata, fmtCant, fechaCorta, horaCorta, sinTildes, coincide, hoyISO, sumarDias, diaDe } = window.Calculo
const plata = fmtPlata
const uuid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) }))
const guardarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
const leerLocal = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v) } catch (e) { return def } }
const vibrar = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms || 30) } catch (e) {} }
// "1.250,5" o "1250.5" -> 1250.5 (el punto de miles se acepta).
function aNumero (txt) {
  let s = String(txt == null ? '' : txt).trim().replace(/\s/g, '').replace(/\$/g, '')
  if (!s) return NaN
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
const aCentavos = (txt) => { const n = aNumero(txt); return Number.isFinite(n) ? Math.round(n * 100) : NaN }
const fechaHora = (t) => fechaCorta(t) + ' ' + horaCorta(t)
function hace (t) {
  const min = Math.round((Date.now() - t) / 60000)
  return min < 1 ? 'recién' : min < 60 ? 'hace ' + min + ' min' : min < 1440 ? 'hace ' + Math.round(min / 60) + ' h' : 'hace ' + Math.round(min / 1440) + ' días'
}

// --- iconos (trazos simples, toman el color del texto) ---------------------------------
const ICONOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  balanza: 'M12 3v18 M5 21h14 M4 8h16 M7 8l-3 7a3 3 0 0 0 6 0z M17 8l-3 7a3 3 0 0 0 6 0z',
  cocina: 'M7 3v8 M4 3v5a3 3 0 0 0 6 0V3 M7 11v10 M17 3c-2 2-3 5-3 8h3v10',
  camion: 'M2 6h12v10H2z M14 10h4l3 3v3h-7 M6 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M17 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  recibir: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M8 13.5l4 2 4-2',
  foto: 'M4 7h3l2-3h6l2 3h3v12H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  candado: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  pieza: 'M3 14l9-9 9 9-9 7z M12 5v16',
  dias: 'M4 5h16v16H4z M4 10h16 M9 3v4 M15 3v4',
  stock: 'M21 8 12 3 3 8v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  productos: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3',
  personas: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 20v-1a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.5z',
  mas: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  alerta: 'M12 3 2 20h20z M12 10v4 M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01',
  cerrar: 'M6 6l12 12 M18 6 6 18',
  flecha: 'M9 6l6 6-6 6',
  atras: 'M15 6l-6 6 6 6',
  ok: 'M5 12l5 5L20 7',
  sumar: 'M12 5v14 M5 12h14',
  restar: 'M5 12h14',
  basura: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14',
  salir: 'M15 3h4v18h-4 M10 17l5-5-5-5 M15 12H3',
  refrescar: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  compras: 'M6 6h15l-2 8H8z M6 6 5 3H2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  regla: 'M3 17 17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2',
  historial: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  plata: 'M12 2v20 M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  editar: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
  descargar: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  compartir: 'M12 15V3 M8 7l4-4 4 4 M5 11v9h14v-9'
}
function icono (nombre, clase) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', 'ic' + (clase ? ' ' + clase : ''))
  svg.setAttribute('aria-hidden', 'true')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', ICONOS[nombre] || ICONOS.mas)
  svg.append(p)
  return svg
}

function toast (texto, tipo, segundos) {
  for (const t of document.querySelectorAll('.aviso-toast')) t.remove()
  const t = el('div', { clase: 'aviso-toast ' + (tipo || ''), role: 'status' }, texto)
  document.body.append(t)
  setTimeout(() => t.remove(), (segundos || 3.5) * 1000)
}

function cabecera (titulo, sub, ...derecha) {
  return el('div', { clase: 'cabecera' }, el('div', { clase: 't' }, el('h1', {}, titulo), sub ? el('div', { clase: 'sub' }, sub) : null),
    derecha.flat().filter(Boolean).length ? el('div', { clase: 'acciones-cab' }, derecha) : null)
}
function kpi (rotulo, valor, detalle, clase, alTocar) {
  return el(alTocar ? 'button' : 'div', { clase: 'kpi' + (clase ? ' ' + clase : ''), onclick: alTocar || null },
    el('div', { clase: 'r' }, rotulo), el('div', { clase: 'v' }, valor), detalle ? el('div', { clase: 'd' }, detalle) : null)
}
function vacio (texto, icon, boton) {
  return el('div', { clase: 'nada' }, icon ? el('div', { clase: 'ico-grande' }, icono(icon)) : null, el('div', {}, texto), boton || null)
}
const chip = (texto, clase) => el('span', { clase: 'chip' + (clase ? ' ' + clase : '') }, texto)

// --- hoja que sube (detalle, cargar algo) ---------------------------------------------------
// hoja({ titulo, cuerpo, pie, completa }) -> { cerrar, cuerpo }. Se cierra con
// la X, tocando afuera o con el "atras" del celular.
//
// El "atras": mientras haya alguna hoja abierta hay UN solo paso extra en el
// historial (la guarda). El atras del celular cierra la de arriba y, si quedan
// otras, se vuelve a poner la guarda. Al cerrar la ultima se saca la guarda,
// pero un rato despues: si enseguida se abre otra (elegir algo y pasar al paso
// siguiente) la guarda se reusa y el historial no se desordena.
const HOJAS = []
const GUARDA = { puesta: false, sacando: null, ignorar: 0 }
function ponerGuarda () {
  if (GUARDA.sacando) { clearTimeout(GUARDA.sacando); GUARDA.sacando = null }
  if (!GUARDA.puesta) { history.pushState({ hoja: true }, ''); GUARDA.puesta = true }
}
function sacarGuarda () {
  if (!GUARDA.puesta || GUARDA.sacando) return
  GUARDA.sacando = setTimeout(() => {
    GUARDA.sacando = null
    if (HOJAS.length || !GUARDA.puesta) return
    GUARDA.puesta = false
    GUARDA.ignorar++
    history.back()
  }, 150)
}
window.addEventListener('popstate', () => {
  if (GUARDA.ignorar > 0) { GUARDA.ignorar--; return }
  if (!GUARDA.puesta) return
  GUARDA.puesta = false
  const h = HOJAS[HOJAS.length - 1]
  if (h) h.cerrar(true)
  if (HOJAS.length) ponerGuarda()
})
function hoja (op) {
  const cuerpo = el('div', { clase: 'cuerpo-hoja' }, op.cuerpo || null)
  const pie = op.pie && op.pie.length ? el('div', { clase: 'pie-hoja' }, op.pie) : null
  const caja = el('div', { clase: 'hoja' + (op.completa ? ' completa' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': op.titulo },
    el('div', { clase: 'agarre' }),
    el('div', { clase: 'cab-hoja' }, el('h2', {}, op.titulo), el('button', { clase: 'btn-ico', 'aria-label': 'Cerrar', onclick: () => h.cerrar() }, icono('cerrar'))),
    cuerpo, pie)
  const telon = el('div', { clase: 'telon', onclick: (ev) => { if (ev.target === telon && !op.fija) h.cerrar() } }, caja)
  const h = {
    cuerpo,
    pie,
    cerrado: false,
    cerrar (desdeAtras) {
      if (h.cerrado) return
      h.cerrado = true
      telon.remove()
      const i = HOJAS.indexOf(h)
      if (i >= 0) HOJAS.splice(i, 1)
      if (!desdeAtras && !HOJAS.length) sacarGuarda()
      if (op.alCerrar) op.alCerrar()
    }
  }
  HOJAS.push(h)
  ponerGuarda()
  document.body.append(telon)
  const primero = caja.querySelector('input:not([type=checkbox]):not([type=file]), select')
  if (primero && op.foco !== false) setTimeout(() => primero.focus(), 60)
  return h
}
const cerrarHojas = () => { while (HOJAS.length) HOJAS[HOJAS.length - 1].cerrar() }

function confirmar (titulo, texto, si, peligro) {
  return new Promise((ok) => {
    let res = false
    const h = hoja({
      titulo,
      cuerpo: el('p', { clase: 'tenue' }, texto),
      pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Volver'),
        el('button', { clase: 'btn ' + (peligro ? 'peligro' : 'primario'), onclick: () => { res = true; h.cerrar() } }, si || 'Sí')],
      alCerrar: () => ok(res)
    })
  })
}

// Un campo numerico grande con su unidad al costado ("g", "planchas").
function campoNumero (rotulo, unidad, opciones) {
  opciones = opciones || {}
  const input = el('input', { type: 'text', inputmode: opciones.decimales ? 'decimal' : 'numeric', autocomplete: 'off', placeholder: opciones.placeholder || '', clase: 'numero-grande', valor: opciones.valor != null ? String(opciones.valor) : null })
  const c = el('label', { clase: 'campo' }, rotulo, el('div', { clase: 'con-unidad' }, input, unidad ? el('span', { clase: 'unidad' }, unidad) : null), opciones.ayuda ? el('span', { clase: 'ayuda' }, opciones.ayuda) : null)
  c.input = input
  c.valor = () => aNumero(input.value)
  return c
}

// Sumar y restar con botones grandes (para cantidades de producción).
function contador (inicial, alCambiar, paso) {
  let v = inicial || 0
  const input = el('input', { type: 'text', inputmode: 'numeric', clase: 'numero-grande centro', valor: String(v) })
  const cambiar = (n) => { v = Math.max(0, n); input.value = String(v); alCambiar && alCambiar(v) }
  input.addEventListener('input', () => { const n = aNumero(input.value); v = Number.isFinite(n) ? Math.max(0, n) : 0; alCambiar && alCambiar(v) })
  input.addEventListener('focus', () => input.select())
  const c = el('div', { clase: 'contador-fila' },
    el('button', { clase: 'btn grande', 'aria-label': 'Restar ' + (paso || 1), onclick: () => cambiar(v - (paso || 1)) }, icono('restar')),
    input,
    el('button', { clase: 'btn grande', 'aria-label': 'Sumar ' + (paso || 1), onclick: () => cambiar(v + (paso || 1)) }, icono('sumar')))
  c.valor = () => v
  c.poner = cambiar
  c.input = input
  return c
}

// Sacar una foto con la camara y achicarla (para que suba rapido y no ocupe).
function botonFoto (rotulo) {
  let datos = null
  const vista = el('img', { clase: 'foto-vista', alt: 'Foto sacada', hidden: true })
  const archivo = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true })
  const texto = el('span', {}, rotulo || 'Sacar foto')
  const boton = el('button', { clase: 'btn ancho grande', type: 'button', onclick: () => archivo.click() }, icono('foto'), texto)
  archivo.addEventListener('change', async () => {
    const f = archivo.files && archivo.files[0]
    if (!f) return
    try {
      datos = await achicarFoto(f, 960, 0.62)
      vista.src = datos
      vista.hidden = false
      texto.textContent = 'Sacar otra'
    } catch (e) { toast('No se pudo leer la foto. Probá de nuevo.', 'mal') }
  })
  const c = el('div', { clase: 'foto-campo' }, vista, boton, archivo)
  c.datos = () => datos
  return c
}
function achicarFoto (archivo, lado, calidad) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height))
      const cv = document.createElement('canvas')
      cv.width = Math.round(img.width * k)
      cv.height = Math.round(img.height * k)
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
      URL.revokeObjectURL(url)
      ok(cv.toDataURL('image/jpeg', calidad))
    }
    img.onerror = (e) => { URL.revokeObjectURL(url); mal(e) }
    img.src = url
  })
}

// Botones grandes para elegir una cosa de una lista (producto, insumo, local).
function eleccion (items, alElegir, opciones) {
  opciones = opciones || {}
  return el('div', { clase: 'eleccion' + (opciones.dos ? ' dos-col' : '') }, items.map((x) =>
    el('button', { clase: 'opcion' + (x.clase ? ' ' + x.clase : ''), type: 'button', onclick: () => { vibrar(); alElegir(x) } },
      x.icono ? icono(x.icono) : null,
      el('span', { clase: 'txt' }, el('b', {}, x.nombre), x.sub ? el('span', { clase: 'sub' }, x.sub) : null),
      opciones.sinFlecha ? null : icono('flecha', 'tenue'))))
}

// --- instalar en el celular (acceso directo en la pantalla de inicio) ------------------------
// Android/Chrome avisa que se puede instalar y se abre su cartel. iPhone no
// tiene cartel: hay que hacerlo desde Safari. Y si el link se abrio desde
// WhatsApp, primero hay que pasarlo al navegador de verdad.
const INSTALAR = { evento: null }
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); INSTALAR.evento = ev })
window.addEventListener('appinstalled', () => { INSTALAR.evento = null; toast('Listo: ya está en la pantalla de inicio', 'ok', 5) })
const yaInstalada = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true
function botonInstalar (clase) {
  if (yaInstalada()) return null
  return el('button', { clase: 'btn ancho ' + (clase || ''), type: 'button', onclick: () => instalar() }, icono('descargar'), 'Instalar en este celular')
}
async function instalar () {
  if (INSTALAR.evento) {
    const ev = INSTALAR.evento
    INSTALAR.evento = null
    try { ev.prompt(); await ev.userChoice } catch (e) {}
    return
  }
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/.test(ua)
  const dentroDeApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/.test(ua)
  const pasos = (titulo, lista, abierto) => el('details', { clase: 'detalles', open: abierto || null },
    el('summary', {}, titulo), el('ol', { clase: 'pasos' }, lista.map((p) => el('li', {}, p))))
  const iphone = pasos('iPhone', [
    'Abrí el link en Safari. Si lo abriste desde WhatsApp, tocá la brújula o "Abrir en Safari".',
    el('span', {}, 'Tocá el botón Compartir ', el('span', { clase: 'tecla-chica' }, icono('compartir')), ' (abajo en el medio, o arriba a la derecha).'),
    'Bajá y tocá "Agregar a inicio" (o "Agregar a pantalla de inicio").',
    'Tocá "Agregar". Queda el ícono de MB Servicios.'
  ], ios)
  const androide = pasos('Android', [
    'Abrí el link en Chrome. Si lo abriste desde WhatsApp, tocá los tres puntitos ⋮ y "Abrir en Chrome".',
    'Tocá los tres puntitos ⋮ arriba a la derecha.',
    'Tocá "Agregar a la pantalla principal" o "Instalar aplicación".',
    'Confirmá con "Instalar" o "Agregar".'
  ], android)
  const compu = pasos('Computadora', [
    'Abrí el link en Chrome o en Edge.',
    'En la barra de la dirección, a la derecha, tocá el ícono de instalar (una pantallita con una flecha).',
    'Si no está: menú ⋮ → "Transmitir, guardar y compartir" → "Instalar página como app" (en Edge: menú ··· → "Aplicaciones" → "Instalar este sitio como aplicación").'
  ], !ios && !android)
  hoja({
    titulo: 'Instalar en este celular',
    cuerpo: [
      dentroDeApp ? el('div', { clase: 'aviso alerta' }, el('b', {}, 'Lo abriste desde otra app'), 'Desde ahí no se puede instalar. Primero abrilo en ' + (ios ? 'Safari' : 'Chrome') + ' (mirá el paso 1).') : null,
      el('p', { clase: 'tenue' }, 'Así queda un ícono en la pantalla de inicio y se abre como una app.'),
      ios ? [iphone, androide, compu] : android ? [androide, iphone, compu] : [compu, androide, iphone]
    ]
  })
}

function aplicarTema () {
  const m = document.querySelector('meta[name=theme-color]')
  if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim() || '#f5f6f8'
}

function pantallaMensaje (titulo, texto, boton) {
  poner($app, el('div', { clase: 'entrar' }, el('img', { clase: 'logo', src: 'icono-192.png', alt: '' }), el('h1', {}, titulo), el('p', {}, texto), boton || null))
}

// --- iconos propios de la cerrajeria ----------------------------------------------------------
Object.assign(ICONOS, {
  llave: 'M8 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M11.5 11H21 M18 11v3 M15 11v2',
  casa: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  cliente: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  trabajo: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  presupuesto: 'M7 3h8l4 4v14H7z M15 3v4h4 M10 12h6 M10 16h6',
  cuenta: 'M3 6h18v12H3z M3 10h18 M7 15h4',
  caja: 'M4 8h16v12H4z M8 8V5h8v3 M4 13h16',
  cheque: 'M3 7h18v10H3z M6 13h5 M14 13h4 M6 10h12',
  whatsapp: 'M4 20l1.3-4A8 8 0 1 1 8 18.7z M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .9a3.5 3.5 0 0 1-2.2-2.2l.9-1-1-2z',
  telefono: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
  mapa: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  auto: 'M5 16h14v-4l-2-5H7l-2 5z M5 12h14 M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M16.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-5-5',
  calendario: 'M4 5h16v16H4z M4 10h16 M9 3v4 M15 3v4',
  pdf: 'M7 3h8l4 4v14H7z M15 3v4h4 M9.5 13h5 M9.5 17h5',
  escudo: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z M9 12l2 2 4-4',
  cerradura: 'M7 3h10v18H7z M12 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M12 9v4',
  gasto: 'M12 2v20 M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  urgente: 'M13 2 4 14h7l-1 8 9-12h-7z',
  copiar: 'M8 8h12v12H8z M16 8V4H4v12h4'
})

// --- campos de formulario -----------------------------------------------------------------------
// campo('Nombre', input, 'ayuda')
function campo (rotulo, control, ayuda) {
  return el('label', { clase: 'campo' }, rotulo, control, ayuda ? el('span', { clase: 'ayuda' }, ayuda) : null)
}
function entrada (valor, props) {
  return el('input', Object.assign({ type: 'text', autocomplete: 'off', valor: valor == null ? '' : String(valor) }, props || {}))
}
function areaTexto (valor, props) {
  const t = el('textarea', Object.assign({ rows: 3 }, props || {}))
  t.value = valor || ''
  return t
}
function selector (opciones, valor, props) {
  const s = el('select', props || {}, opciones.map((o) => {
    const v = typeof o === 'string' ? o : o.valor
    const t = typeof o === 'string' ? o : o.texto
    return el('option', { value: v, selected: v === valor ? true : null }, t)
  }))
  if (valor != null) s.value = valor
  return s
}
// Plata: se escribe "12.500" o "12500,50". .valor() da el numero (NaN si esta vacio o mal).
function entradaPlata (valor, props) {
  const i = el('input', Object.assign({ type: 'text', inputmode: 'decimal', autocomplete: 'off', clase: 'num', placeholder: '0', valor: valor == null || valor === '' ? '' : formatoEntrada(valor) }, props || {}))
  i.valor = () => aNumero(i.value)
  i.addEventListener('focus', () => setTimeout(() => i.select(), 0))
  return i
}
function formatoEntrada (n) {
  n = Number(n)
  if (!Number.isFinite(n)) return ''
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}
// Botones para elegir uno ("Efectivo · Transferencia · Cheque · Fiado").
function botonesElegir (opciones, valor, alCambiar) {
  let actual = valor
  const caja = el('div', { clase: 'chips grandes' })
  const pintar = () => poner(caja, opciones.map((o) => el('button', {
    type: 'button', clase: 'chip-btn' + (o.valor === actual ? ' activo' : ''), onclick: () => { actual = o.valor; pintar(); alCambiar && alCambiar(actual) }
  }, o.icono ? icono(o.icono) : null, o.texto)))
  pintar()
  caja.valor = () => actual
  caja.poner = (v) => { actual = v; pintar() }
  return caja
}
function casilla (texto, marcado, alCambiar) {
  const i = el('input', { type: 'checkbox', checked: marcado ? true : null })
  if (alCambiar) i.addEventListener('change', () => alCambiar(i.checked))
  const l = el('label', { clase: 'check' }, i, el('span', {}, texto))
  l.input = i
  return l
}

// --- afuera: WhatsApp, llamar, mapa ---------------------------------------------------------------
function abrirWhatsApp (telefono, texto) {
  const n = Calculo.telefonoWA(telefono)
  if (!n) { toast('El cliente no tiene un celular cargado (con código de área).', 'mal', 5); return }
  window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(texto || ''), '_blank', 'noopener')
}
const linkTelefono = (tel) => 'tel:' + String(tel || '').replace(/[^\d+]/g, '')
const linkMapa = (direccion, localidad) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([direccion, localidad].filter(Boolean).join(', '))

// Fecha "AAAA-MM-DD" -> input date (y al reves).
function entradaFecha (valor, props) {
  return el('input', Object.assign({ type: 'date', valor: valor ? String(valor).slice(0, 10) : '' }, props || {}))
}

async function sha256 (texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
}

function copiarTexto (t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast('Copiado', 'ok'), () => toast('No se pudo copiar', 'mal'))
}

// "1 cliente" / "3 clientes"
const cuantos = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios)
