'use strict'
// MB SERVICIOS — CERRAJERIA: arranque, entrar, menu, inicio y buscador.
//
// Archivos: calculo.js (las cuentas), comun.js (piezas de pantalla), datos.js
// (donde se guarda), ejemplo.js (datos de mentira para ?prueba), y una parte
// por seccion: trabajos.js, clientes.js, cuentas.js, stock.js, caja.js,
// ajustes.js y pdf.js.

const VERSION_APP = '1.1'
const APP = { vista: 'inicio', listo: false, email: null, filtros: {} }

const SECCIONES = [
  { id: 'inicio', nombre: 'Inicio', icono: 'inicio' },
  { id: 'agenda', nombre: 'Agenda', icono: 'calendario' },
  { id: 'trabajos', nombre: 'Trabajos', icono: 'trabajo' },
  { id: 'clientes', nombre: 'Clientes', icono: 'cliente' },
  { id: 'cuentas', nombre: 'Cuentas y fiado', icono: 'cuenta' },
  { id: 'proveedores', nombre: 'Proveedores', icono: 'camion' },
  { id: 'stock', nombre: 'Stock', icono: 'stock' },
  { id: 'caja', nombre: 'Caja y gastos', icono: 'caja' },
  { id: 'ajustes', nombre: 'Ajustes', icono: 'ajustes' }
]
const VISTAS = {} // cada seccion se anota: VISTAS.trabajos = (main) => ...

// --- arranque ---------------------------------------------------------------------------------
async function arrancar () {
  aplicarTema()
  if ('serviceWorker' in navigator && !PRUEBA) navigator.serviceWorker.register('sw.js').catch(() => {})
  try { await Nubes.iniciar() } catch (e) {
    if (e.message === 'falta_nube') return pantallaMensaje('Falta conectar la nube', 'Todavía no está configurado dónde se guardan los datos. Avisale a quien te instaló el sistema.')
    return pantallaMensaje('Sin conexión', 'Para entrar la primera vez hace falta internet.', el('button', { clase: 'btn primario ancho grande', onclick: () => location.reload() }, 'Probar de nuevo'))
  }
  if (/type=recovery/.test(location.hash)) return pantallaNuevaClave()
  Datos.cargarLocal()
  let email = null
  try { email = await Nubes.sesion() } catch (e) {}
  if (!email && PRUEBA) { await Nubes.entrar(); email = 'prueba' }
  if (!email) return pantallaEntrar()
  entrarApp(email)
}

function entrarApp (email) {
  APP.email = email
  APP.listo = true
  if (PRUEBA && !Datos.fichas.size) cargarEjemplo()
  Datos.alCambiar(() => { if (!document.querySelector('.busqueda-global')) pintar() })
  armarApp()
  Datos.sincronizar()
}

function pantallaEntrar (mensaje) {
  const email = el('input', { type: 'email', autocomplete: 'username', placeholder: 'tu@email.com', inputmode: 'email' })
  const clave = el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña' })
  const error = el('div', { clase: 'error' }, mensaje || '')
  email.value = leerLocal('mb.email', '') || ''
  const boton = el('button', { clase: 'btn primario ancho grande' }, 'Entrar')
  const entrar = async () => {
    error.textContent = ''
    boton.disabled = true
    boton.textContent = 'Entrando…'
    try {
      await Nubes.entrar(email.value.trim(), clave.value)
      guardarLocal('mb.email', email.value.trim())
      // Si antes entro otra persona en este navegador, no se mezclan los datos.
      if (leerLocal('mb.dueño', null) !== email.value.trim()) { Datos.borrarLocal(); guardarLocal('mb.dueño', email.value.trim()) }
      entrarApp(email.value.trim())
    } catch (e) {
      error.textContent = /invalid/i.test(e.message || '') ? 'Email o contraseña incorrectos.' : textoError(e)
    } finally {
      boton.disabled = false
      boton.textContent = 'Entrar'
    }
  }
  boton.addEventListener('click', entrar)
  clave.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') entrar() })
  const olvide = async () => {
    if (!email.value.trim()) { error.textContent = 'Escribí tu email y tocá de nuevo.'; return }
    const r = await Nubes.recuperarClave(email.value.trim())
    error.textContent = r && r.error ? r.error.message : 'Te mandamos un mail para crear una contraseña nueva.'
  }
  poner($app, el('div', { clase: 'entrar' },
    el('img', { clase: 'logo', src: 'icono-192.png', alt: '' }),
    el('h1', {}, 'MB Servicios'),
    el('p', {}, 'Cerrajería. Entrá con tu email y contraseña.'),
    campo('Email', email), campo('Contraseña', clave),
    error, boton,
    el('p', { estilo: { marginTop: '16px', textAlign: 'center' } }, el('a', { href: '#', onclick: (ev) => { ev.preventDefault(); olvide() } }, 'Me olvidé la contraseña')),
    el('div', { estilo: { marginTop: '10px' } }, botonInstalar('suave'))))
  ;(email.value ? clave : email).focus()
}

function pantallaNuevaClave () {
  const clave = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Contraseña nueva (8 o más)' })
  const error = el('div', { clase: 'error' })
  const guardar = async () => {
    if (clave.value.length < 8) { error.textContent = 'Tiene que tener 8 o más caracteres.'; return }
    try { await Nubes.nuevaClave(clave.value) } catch (e) { error.textContent = textoError(e); return }
    history.replaceState(null, '', location.pathname)
    location.reload()
  }
  poner($app, el('div', { clase: 'entrar' }, el('h1', {}, 'Contraseña nueva'), el('p', {}, 'Elegí la contraseña con la que vas a entrar.'),
    campo('Contraseña nueva', clave), error, el('button', { clase: 'btn primario ancho grande', onclick: guardar }, 'Guardar')))
}

// --- armazon: menu al costado (compu) o abajo (celular) -----------------------------------------
function armarApp () {
  const conf = Datos.config()
  document.title = conf.negocio
  const lado = el('nav', { clase: 'lado', id: 'lado' })
  const main = el('main', { id: 'main' })
  const tabbar = el('nav', { clase: 'tabbar', id: 'tabbar' })
  poner($app, el('div', { clase: 'app' }, lado, main), tabbar)
  pintar()
}

function insignias () {
  const hoy = hoyISO()
  const cs = Calculo.cuentas(Datos.lista('trabajo'), Datos.lista('pago'))
  let vencidos = 0
  for (const c of cs.values()) for (const d of c.deudas) if (d.vence && d.vence < hoy) vencidos++
  const st = Calculo.stock(Datos.lista('movstock'), Datos.lista('trabajo'))
  let bajos = 0
  for (const p of Datos.lista('producto')) if (p.activo !== false && Number(p.minimo) > 0 && Calculo.estadoStock(st.get(p.id) || 0, p.minimo) !== 'ok') bajos++
  const provVencidos = deudasProveedoresVencidas(hoy).length
  const atrasados = Datos.lista('trabajo').filter((t) => t.clase === 'trabajo' && (t.estado === 'pendiente' || t.estado === 'en_curso') && t.fecha && diaDe(t.fecha) < hoy).length
  return { cuentas: vencidos, stock: bajos, proveedores: provVencidos, agenda: atrasados }
}

function irA (vista, filtro) {
  APP.vista = vista
  if (filtro) APP.filtros[vista] = filtro
  window.scrollTo(0, 0)
  pintar()
}

function pintar () {
  const main = document.getElementById('main')
  if (!main) return
  const ins = insignias()
  const conf = Datos.config()
  const insignia = (n) => n ? el('span', { clase: 'insignia' }, n) : null
  poner(document.getElementById('lado'),
    el('div', { clase: 'marca' }, el('img', { src: 'icono-192.png', alt: '' }), el('span', {}, conf.negocio)),
    el('button', { clase: 'btn primario', estilo: { margin: '0 4px 10px', width: 'calc(100% - 8px)', justifyContent: 'center' }, onclick: menuNuevo }, icono('sumar'), 'Nuevo'),
    SECCIONES.map((s) => el('button', { clase: APP.vista === s.id ? 'activo' : '', onclick: () => irA(s.id) }, icono(s.icono), s.nombre, insignia(ins[s.id]))),
    el('div', { estilo: { marginTop: 'auto', padding: '12px' }, clase: 'sub' }, 'Versión ' + VERSION_APP + (PRUEBA ? ' · prueba' : '')))
  const enMas = ['cuentas', 'proveedores', 'stock', 'caja', 'ajustes'].includes(APP.vista)
  poner(document.getElementById('tabbar'),
    el('button', { clase: APP.vista === 'inicio' ? 'activo' : '', onclick: () => irA('inicio') }, icono('inicio'), 'Inicio'),
    el('button', { clase: APP.vista === 'trabajos' || APP.vista === 'agenda' ? 'activo' : '', onclick: () => irA(APP.vista === 'agenda' ? 'agenda' : 'trabajos') }, icono('trabajo'), 'Trabajos', insignia(ins.agenda)),
    el('button', { clase: 'escanear', 'aria-label': 'Nuevo', onclick: menuNuevo }, el('span', { clase: 'bola' }, icono('sumar')), 'Nuevo'),
    el('button', { clase: APP.vista === 'clientes' ? 'activo' : '', onclick: () => irA('clientes') }, icono('cliente'), 'Clientes'),
    el('button', { clase: enMas ? 'activo' : '', onclick: menuMas }, icono('mas'), enMas ? SECCIONES.find((s) => s.id === APP.vista).nombre.split(' ')[0] : 'Más', insignia(ins.cuentas + ins.stock + ins.proveedores)))
  const arriba = el('div', { clase: 'arriba' },
    el('div', { clase: 'quien' }, el('div', { clase: 'negocio' }, conf.negocio), el('div', { clase: 'sub' }, fechaCorta(hoyISO()))),
    el('button', { clase: 'btn-ico', 'aria-label': 'Buscar', onclick: buscarTodo }, icono('buscar')),
    el('button', { id: 'conexion', clase: 'conexion', onclick: () => Datos.sincronizar().then(() => toast(Datos.estado === 'off' ? 'Sin señal: lo anotado queda guardado y sube cuando vuelva.' : 'Todo guardado en la nube', Datos.estado === 'off' ? 'mal' : 'ok')) }))
  pintarConexion(arriba.querySelector('#conexion'))
  const cuerpo = el('div', {})
  poner(main, arriba, cuerpo)
  ;(VISTAS[APP.vista] || VISTAS.inicio)(cuerpo)
}

function menuMas () {
  const ins = insignias()
  const h = hoja({
    titulo: 'Más',
    cuerpo: eleccion(SECCIONES.filter((s) => ['agenda', 'cuentas', 'proveedores', 'stock', 'caja', 'ajustes'].includes(s.id)).map((s) => ({
      id: s.id, nombre: s.nombre, icono: s.icono,
      sub: s.id === 'cuentas' && ins.cuentas ? ins.cuentas + ' cobros vencidos' : s.id === 'stock' && ins.stock ? ins.stock + ' productos para reponer' : s.id === 'proveedores' && ins.proveedores ? cuantos(ins.proveedores, 'pago vencido', 'pagos vencidos') : s.id === 'agenda' && ins.agenda ? cuantos(ins.agenda, 'trabajo atrasado', 'trabajos atrasados') : null,
      clase: ins[s.id] && s.id !== 'caja' ? 'con-alerta' : ''
    })), (x) => { h.cerrar(); irA(x.id) })
  })
}

function menuNuevo () {
  const h = hoja({
    titulo: 'Nuevo',
    cuerpo: eleccion([
      { id: 'trabajo', nombre: 'Trabajo', sub: 'Una orden: apertura, instalación, cambio de combinación…', icono: 'trabajo' },
      { id: 'presupuesto', nombre: 'Presupuesto', sub: 'Se manda en PDF o por WhatsApp', icono: 'presupuesto' },
      { id: 'venta', nombre: 'Venta de mostrador', sub: 'Copias de llaves, candados, lo que se vende en el local', icono: 'llave' },
      { id: 'pago', nombre: 'Cobrar a un cliente', sub: 'Un pago de lo que debe', icono: 'plata' },
      { id: 'cliente', nombre: 'Cliente', icono: 'cliente' },
      { id: 'gasto', nombre: 'Gasto', icono: 'gasto' },
      { id: 'compra', nombre: 'Compra / entró mercadería', sub: 'Suma al stock; pagada o a cuenta del proveedor', icono: 'stock' },
      { id: 'pagoprov', nombre: 'Pagarle a un proveedor', icono: 'camion' },
      { id: 'proveedor', nombre: 'Proveedor', icono: 'camion' }
    ], (x) => {
      h.cerrar()
      if (x.id === 'trabajo' || x.id === 'presupuesto' || x.id === 'venta') editarTrabajo({ clase: x.id })
      else if (x.id === 'pago') registrarPago({})
      else if (x.id === 'cliente') editarCliente(null, (c) => verCliente(c.id))
      else if (x.id === 'gasto') editarGasto()
      else if (x.id === 'compra') entradaMercaderia()
      else if (x.id === 'pagoprov') pagarProveedor({})
      else if (x.id === 'proveedor') editarProveedor(null, (p) => verProveedor(p.id))
    })
  })
}

// --- inicio -----------------------------------------------------------------------------------
VISTAS.inicio = function (main) {
  const hoy = hoyISO()
  const conf = Datos.config()
  const trabajos = Datos.lista('trabajo')
  const pagos = Datos.lista('pago')
  const cs = Calculo.cuentas(trabajos, pagos)
  let teDeben = 0; let vencido = 0; let nVencidos = 0; let nHoy = 0
  for (const c of cs.values()) {
    teDeben += c.debe
    for (const d of c.deudas) {
      const e = Calculo.estadoVence(d.vence, hoy)
      if (e.clase === 'vencido') { vencido += d.saldo; nVencidos++ } else if (e.clase === 'hoy') nHoy++
    }
  }
  const caja = Calculo.caja(pagos, Datos.lista('gasto'), hoy)
  const abiertos = trabajos.filter((t) => t.clase === 'trabajo' && (t.estado === 'pendiente' || t.estado === 'en_curso'))
  const cheques = pagos.filter((p) => Calculo.pagoValido(p) && p.medio === 'cheque' && p.cheque && p.cheque.estado === 'cartera' && p.cheque.fechaCobro && p.cheque.fechaCobro <= sumarDias(hoy, 2))
  const ins = insignias()
  const seguir = paraSeguimiento()

  const alertas = []
  if (nVencidos) alertas.push(el('button', { clase: 'alerta-fila mal', onclick: () => irA('cuentas', 'vencidos') }, el('div', { clase: 'ico' }, icono('alerta')),
    el('div', { clase: 'txt' }, el('b', {}, nVencidos === 1 ? '1 fiado vencido sin pagar' : nVencidos + ' fiados vencidos sin pagar'), el('span', { clase: 'sub' }, plata(vencido) + ' · tocá para mandar el recordatorio')), icono('flecha')))
  if (nHoy) alertas.push(el('button', { clase: 'alerta-fila alerta', onclick: () => irA('cuentas', 'hoy') }, el('div', { clase: 'ico' }, icono('calendario')),
    el('div', { clase: 'txt' }, el('b', {}, nHoy === 1 ? '1 fiado vence hoy' : nHoy + ' fiados vencen hoy'), el('span', { clase: 'sub' }, 'Recordale al cliente')), icono('flecha')))
  if (cheques.length) alertas.push(el('button', { clase: 'alerta-fila alerta', onclick: () => irA('cuentas', 'cheques') }, el('div', { clase: 'ico' }, icono('cheque')),
    el('div', { clase: 'txt' }, el('b', {}, cheques.length === 1 ? '1 cheque para depositar' : cheques.length + ' cheques para depositar'), el('span', { clase: 'sub' }, plata(cheques.reduce((s, p) => s + p.monto, 0)))), icono('flecha')))
  if (ins.stock) alertas.push(el('button', { clase: 'alerta-fila alerta', onclick: () => irA('stock', 'reponer') }, el('div', { clase: 'ico' }, icono('stock')),
    el('div', { clase: 'txt' }, el('b', {}, ins.stock === 1 ? '1 producto para reponer' : ins.stock + ' productos para reponer'), el('span', { clase: 'sub' }, 'Llegaron al mínimo o no quedan')), icono('flecha')))
  const provVenc = deudasProveedoresVencidas(hoy)
  if (provVenc.length) {
    const provs = [...new Set(provVenc.map((x) => x.proveedorId))]
    alertas.push(el('button', { clase: 'alerta-fila alerta', onclick: () => provs.length === 1 ? verProveedor(provs[0]) : irA('proveedores', 'debo') }, el('div', { clase: 'ico' }, icono('camion')),
      el('div', { clase: 'txt' }, el('b', {}, provs.length === 1 ? 'Tenés que pagarle a ' + nombreProveedor(provs[0]) : 'Tenés que pagarle a ' + provs.length + ' proveedores'), el('span', { clase: 'sub' }, plata(provVenc.reduce((s, x) => s + x.deuda.saldo, 0)) + ' · vence hoy o ya venció')), icono('flecha')))
  }
  if (ins.agenda) alertas.push(el('button', { clase: 'alerta-fila alerta', onclick: () => irA('agenda') }, el('div', { clase: 'ico' }, icono('calendario')),
    el('div', { clase: 'txt' }, el('b', {}, cuantos(ins.agenda, 'trabajo quedó atrasado', 'trabajos quedaron atrasados')), el('span', { clase: 'sub' }, 'Tenían fecha de antes de hoy: terminalos o cambiales la fecha')), icono('flecha')))
  if (seguir.length) alertas.push(el('button', { clase: 'alerta-fila info', onclick: () => verSeguimientos() }, el('div', { clase: 'ico' }, icono('escudo')),
    el('div', { clase: 'txt' }, el('b', {}, 'Postventa: ' + (seguir.length === 1 ? '1 cliente para llamar' : seguir.length + ' clientes para llamar')), el('span', { clase: 'sub' }, 'Preguntales cómo les anduvo el trabajo')), icono('flecha')))

  // Agenda: lo que esta para hacer, primero lo de fecha mas cercana.
  const agenda = abiertos.slice().sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.numero - b.numero))

  poner(main,
    el('div', { clase: 'buscar-falso', onclick: buscarTodo, role: 'button' }, icono('buscar'), 'Buscar cliente, dirección, teléfono, trabajo…'),
    el('div', { clase: 'kpis' },
      kpi('Cobrado hoy', plata(caja.totalEntro), caja.totalEntro ? 'Efectivo ' + plata(caja.entro.efectivo) : 'Todavía nada', '', () => irA('caja')),
      kpi('Te deben', plata(teDeben), cs.size ? cuantos([...cs.values()].filter((c) => c.debe > 0).length, 'cliente', 'clientes') : '', '', () => irA('cuentas')),
      kpi('Vencido', plata(vencido), nVencidos ? cuantos(nVencidos, 'trabajo', 'trabajos') + ' sin pagar' : 'Nada vencido', vencido > 0 ? 'mal' : '', () => irA('cuentas', 'vencidos')),
      kpi('Trabajos abiertos', String(abiertos.length), abiertos.filter((t) => t.fecha && diaDe(t.fecha) === hoy).length + ' para hoy', '', () => irA('trabajos', 'abiertos'))),
    alertas.length ? el('div', { clase: 'alertas' }, alertas) : null,
    el('div', { clase: 'accesos' },
      acceso('Trabajo', 'trabajo', () => editarTrabajo({ clase: 'trabajo' })),
      acceso('Presupuesto', 'presupuesto', () => editarTrabajo({ clase: 'presupuesto' })),
      acceso('Venta', 'llave', () => editarTrabajo({ clase: 'venta' })),
      acceso('Cobrar', 'plata', () => registrarPago({})),
      acceso('Cliente', 'cliente', () => editarCliente(null, (c) => verCliente(c.id))),
      acceso('Gasto', 'gasto', () => editarGasto()),
      acceso('Compra', 'stock', () => entradaMercaderia()),
      acceso('Agenda', 'calendario', () => irA('agenda'))),
    el('div', { clase: 'tarjeta sin-relleno' },
      el('div', { clase: 'tarjeta-cab', estilo: { padding: '10px 16px 0' } }, el('h2', {}, 'Para hacer'), el('button', { clase: 'btn chico', onclick: () => irA('trabajos', 'abiertos') }, 'Ver todos')),
      agenda.length ? el('div', { clase: 'lista' }, agenda.slice(0, 8).map((t) => filaTrabajo(t, hoy))) : vacio('No hay trabajos pendientes.', 'trabajo', el('button', { clase: 'btn primario', onclick: () => editarTrabajo({ clase: 'trabajo' }) }, icono('sumar'), 'Nuevo trabajo'))),
    PRUEBA ? el('div', { clase: 'aviso info' }, el('b', {}, 'Modo prueba'), 'Los datos son de ejemplo y quedan solo en este navegador. ' + conf.negocio + ' de verdad se abre sin ?prueba en el link.') : null)
}
function acceso (texto, ico, fn) {
  return el('button', { clase: 'acceso', onclick: fn }, el('span', { clase: 'ico' }, icono(ico)), texto)
}

// --- postventa: llamar despues del trabajo ------------------------------------------------------
function paraSeguimiento () {
  const conf = Datos.config()
  const hoy = hoyISO()
  const dias = Number(conf.seguimientoDias) || 0
  if (!dias) return []
  return Datos.lista('trabajo').filter((t) => t.clase === 'trabajo' && t.estado === 'terminado' && !t.seguimiento && t.clienteId &&
    Calculo.diasEntre(Calculo.diaTrabajo(t), hoy) >= dias && Calculo.diasEntre(Calculo.diaTrabajo(t), hoy) <= dias + 30)
    .sort((a, b) => Calculo.diaTrabajo(a).localeCompare(Calculo.diaTrabajo(b)))
}
function verSeguimientos () {
  const conf = Datos.config()
  const cuerpo = el('div', {})
  const h = hoja({ titulo: 'Postventa', cuerpo })
  const pintarLista = () => {
    const lista = paraSeguimiento()
    if (!lista.length) return poner(cuerpo, vacio('No hay clientes para llamar. ¡Al día!', 'escudo'))
    poner(cuerpo,
      el('p', { clase: 'tenue' }, 'Trabajos terminados hace ' + conf.seguimientoDias + ' días o más. Preguntale al cliente cómo le anduvo: genera confianza y te vuelven a llamar.'),
      el('div', { clase: 'lista tarjeta sin-relleno' }, lista.map((t) => {
        const c = Datos.get(t.clienteId) || {}
        return el('div', { clase: 'item' },
          el('div', { clase: 'cuerpo' }, el('b', {}, c.nombre || 'Cliente'), el('span', { clase: 'sub' }, '#' + t.numero + ' · ' + (t.servicio || 'Trabajo') + ' · ' + fechaCorta(Calculo.diaTrabajo(t)))),
          el('div', { clase: 'rapidas' },
            el('button', { clase: 'btn-ico', 'aria-label': 'WhatsApp', onclick: () => abrirWhatsApp(c.telefono, 'Hola ' + primerNombre(c.nombre) + ', te escribimos de ' + conf.negocio + '. ¿Cómo anduvo ' + (t.servicio ? 'el trabajo de ' + t.servicio.toLowerCase() : 'el trabajo') + '? Cualquier cosa, estamos a disposición.') }, icono('whatsapp')),
            el('button', { clase: 'btn chico', onclick: () => { Datos.guardar(Object.assign({}, t, { seguimiento: new Date().toISOString() })); pintarLista() } }, icono('ok'), 'Listo')))
      })))
  }
  pintarLista()
  return h
}
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || ''

// --- buscador de todo -----------------------------------------------------------------------------
function buscarTodo () {
  const input = el('input', { type: 'search', placeholder: 'Nombre, dirección, teléfono, #trabajo, producto…', autocomplete: 'off' })
  const res = el('div', { clase: 'res' })
  const capa = el('div', { clase: 'busqueda-global' },
    el('div', { clase: 'cab' }, el('button', { clase: 'btn-ico', 'aria-label': 'Cerrar', onclick: () => cerrar() }, icono('atras')), input), res)
  const cerrar = () => { capa.remove(); document.removeEventListener('keydown', esc) }
  const esc = (ev) => { if (ev.key === 'Escape') cerrar() }
  document.addEventListener('keydown', esc)
  const ir = (fn) => () => { cerrar(); fn() }
  const buscar = () => {
    const q = input.value.trim()
    if (!q) return poner(res, el('p', { clase: 'sub', estilo: { padding: '14px 4px' } }, 'Buscá por nombre, dirección de cualquiera de sus domicilios, teléfono, patente, número de trabajo o producto.'))
    const clientes = Datos.lista('cliente').filter((c) => coincide(textoCliente(c), q)).slice(0, 12)
    const num = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null
    const trabajos = Datos.lista('trabajo').filter((t) => (num && t.numero === num) || (!num && coincide([t.servicio, t.descripcion, (Datos.get(t.clienteId) || {}).nombre].join(' '), q))).sort((a, b) => b.numero - a.numero).slice(0, 8)
    const productos = Datos.lista('producto').filter((p) => coincide([p.nombre, p.codigo, p.marca, p.categoria].join(' '), q)).slice(0, 8)
    const provs = Datos.lista('proveedor').filter((p) => coincide([p.nombre, p.rubro, p.contacto, p.telefono, p.cuit].join(' '), q)).slice(0, 6)
    const grupo = (titulo, filas) => filas.length ? [el('h3', {}, titulo), el('div', { clase: 'tarjeta sin-relleno lista' }, filas)] : null
    poner(res,
      grupo('Clientes', clientes.map((c) => el('button', { clase: 'item', onclick: ir(() => verCliente(c.id)) }, el('div', { clase: 'cuerpo' }, el('b', {}, c.nombre), el('span', { clase: 'sub' }, [c.telefono, [...new Set((c.domicilios || []).map((d) => d.direccion))].join(' · ')].filter(Boolean).join(' · '))), icono('flecha', 'tenue')))),
      grupo('Trabajos', trabajos.map((t) => filaTrabajo(t, hoyISO(), ir(() => verTrabajo(t.id))))),
      grupo('Productos', productos.map((p) => el('button', { clase: 'item', onclick: ir(() => verProducto(p.id)) }, el('div', { clase: 'cuerpo' }, el('b', {}, p.nombre), el('span', { clase: 'sub' }, [p.codigo, p.marca].filter(Boolean).join(' · '))), el('div', { clase: 'fin num' }, plata(Calculo.precioProducto(p, Datos.config().redondeo)))))),
      grupo('Proveedores', provs.map((p) => el('button', { clase: 'item', onclick: ir(() => verProveedor(p.id)) }, el('div', { clase: 'cuerpo' }, el('b', {}, p.nombre), el('span', { clase: 'sub' }, [p.rubro, p.telefono].filter(Boolean).join(' · '))), icono('flecha', 'tenue')))),
      !clientes.length && !trabajos.length && !productos.length && !provs.length ? vacio('No encontré nada con "' + q + '".', 'buscar', el('button', { clase: 'btn primario', onclick: ir(() => editarCliente({ nombre: q }, (c) => verCliente(c.id))) }, icono('sumar'), 'Crear cliente "' + q + '"')) : null)
  }
  input.addEventListener('input', buscar)
  document.body.append(capa)
  buscar()
  setTimeout(() => input.focus(), 30)
}
function textoCliente (c) {
  return [c.nombre, c.telefono, c.telefono2, c.dni, c.email, c.clase,
    (c.domicilios || []).map((d) => [d.nombre, d.direccion, d.localidad, d.contacto].join(' ')).join(' '),
    (c.vehiculos || []).map((v) => [v.marca, v.modelo, v.patente].join(' ')).join(' ')].join(' ')
}

document.addEventListener('DOMContentLoaded', arrancar)
