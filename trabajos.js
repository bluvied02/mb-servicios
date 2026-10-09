'use strict'
// TRABAJOS, PRESUPUESTOS Y VENTAS DE MOSTRADOR
//
// Todo es un "trabajo" con numero:
//   tipo 'presupuesto' -> no se debe nada ni descuenta stock. Se pasa a trabajo con un toque.
//   tipo 'trabajo'     -> pendiente -> en curso -> terminado (o cancelado).
//   tipo 'venta'       -> mostrador: queda terminado al guardarlo.
// Recien al estar terminado cuenta para la deuda del cliente, descuenta los
// materiales del stock y empieza a correr la garantia.

const ESTADOS = { pendiente: 'Pendiente', en_curso: 'En curso', terminado: 'Terminado', cancelado: 'Cancelado' }
const ACREDITO = ['Mostró escritura o contrato de alquiler', 'Factura de un servicio a su nombre', 'DNI con ese domicilio', 'Lo reconoce el portero, encargado o vecino', 'Con policía presente', 'Es inquilino: avisó la inmobiliaria', 'No pudo acreditar']

function chipEstado (t) {
  if (t.clase === 'presupuesto') return chip('Presupuesto', 'info')
  if (t.clase === 'venta') return chip('Venta', '')
  return chip(ESTADOS[t.estado] || t.estado, t.estado === 'terminado' ? 'ok' : t.estado === 'cancelado' ? '' : t.estado === 'en_curso' ? 'alerta' : 'info')
}
function lugarTrabajo (t) {
  const c = Datos.get(t.clienteId)
  if (!c) return null
  const d = (c.domicilios || []).find((x) => x.id === t.domicilioId)
  if (d) return d
  const v = (c.vehiculos || []).find((x) => x.id === t.vehiculoId)
  return v ? { direccion: [v.marca, v.modelo, v.patente].filter(Boolean).join(' ') } : null
}
function filaTrabajo (t, hoy, alTocar) {
  const c = Datos.get(t.clienteId)
  const lugar = lugarTrabajo(t)
  const tot = Calculo.totalesTrabajo(t).total
  const cuando = t.clase === 'trabajo' && t.estado !== 'terminado' && t.fecha
    ? (diaDe(t.fecha) === hoy ? 'Hoy ' + horaCorta(t.fecha) : fechaCorta(t.fecha) + (/T/.test(t.fecha) ? ' ' + horaCorta(t.fecha) : ''))
    : fechaCorta(Calculo.diaTrabajo(t))
  return el('button', { clase: 'item', onclick: alTocar || (() => verTrabajo(t.id)) },
    el('div', { clase: 'cuerpo' },
      el('b', {}, '#' + t.numero + ' · ' + (c ? c.nombre : t.clase === 'venta' ? 'Consumidor final' : 'Sin cliente')),
      el('span', { clase: 'sub' }, [t.servicio, lugar && lugar.direccion, cuando].filter(Boolean).join(' · '))),
    el('div', { clase: 'fin pila' }, el('b', { clase: 'num' }, plata(tot)), t.urgencia && t.estado !== 'terminado' ? chip('Urgente', 'mal') : chipEstado(t)))
}

// --- la lista ---------------------------------------------------------------------------------
VISTAS.trabajos = function (main) {
  const hoy = hoyISO()
  const filtro = APP.filtros.trabajos || 'abiertos'
  const busq = APP.filtros.trabajosBusca || ''
  const todos = Datos.lista('trabajo')
  const grupos = {
    abiertos: todos.filter((t) => t.clase === 'trabajo' && (t.estado === 'pendiente' || t.estado === 'en_curso')),
    presupuestos: todos.filter((t) => t.clase === 'presupuesto' && t.estado !== 'cancelado'),
    terminados: todos.filter((t) => t.clase !== 'presupuesto' && t.estado === 'terminado'),
    todos
  }
  let lista = grupos[filtro] || grupos.abiertos
  if (busq) lista = lista.filter((t) => coincide(['#' + t.numero, t.numero, t.servicio, t.descripcion, (Datos.get(t.clienteId) || {}).nombre, (lugarTrabajo(t) || {}).direccion].join(' '), busq))
  if (filtro === 'abiertos') lista.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || a.numero - b.numero)
  else lista.sort((a, b) => b.numero - a.numero)
  const buscar = el('input', { type: 'search', placeholder: 'Buscar por cliente, dirección o número', valor: busq })
  buscar.addEventListener('input', () => { APP.filtros.trabajosBusca = buscar.value; pintarLista() })
  const caja = el('div', {})
  const pintarLista = () => {
    const q = buscar.value.trim()
    const filtrada = q ? (grupos[filtro] || []).filter((t) => coincide(['#' + t.numero, t.numero, t.servicio, t.descripcion, (Datos.get(t.clienteId) || {}).nombre, (lugarTrabajo(t) || {}).direccion].join(' '), q)) : lista
    if (q) filtrada.sort((a, b) => b.numero - a.numero)
    poner(caja, filtrada.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, filtrada.slice(0, 300).map((t) => filaTrabajo(t, hoy))) : vacio(filtro === 'presupuestos' ? 'No hay presupuestos.' : 'No hay trabajos acá.', 'trabajo'))
  }
  poner(main,
    cabecera('Trabajos', null,
      el('button', { clase: 'btn', onclick: () => editarTrabajo({ clase: 'presupuesto' }) }, icono('presupuesto'), 'Presupuesto'),
      el('button', { clase: 'btn primario', onclick: () => editarTrabajo({ clase: 'trabajo' }) }, icono('sumar'), 'Trabajo')),
    el('div', { clase: 'filtros' }, [['abiertos', 'Para hacer'], ['presupuestos', 'Presupuestos'], ['terminados', 'Terminados'], ['todos', 'Todos']].map(([id, n]) =>
      el('button', { clase: 'filtro' + (filtro === id ? ' activo' : ''), onclick: () => irA('trabajos', id) }, n, el('span', { clase: 'n' }, grupos[id].length)))),
    el('div', { clase: 'buscador' }, icono('buscar'), buscar),
    caja)
  pintarLista()
}

// --- elegir cliente ---------------------------------------------------------------------------
function elegirCliente (alElegir, opciones) {
  opciones = opciones || {}
  const input = el('input', { type: 'search', placeholder: 'Nombre, dirección o teléfono', autocomplete: 'off' })
  const res = el('div', {})
  const h = hoja({
    titulo: 'Elegir cliente',
    completa: true,
    cuerpo: [el('div', { clase: 'buscador' }, icono('buscar'), input),
      el('div', { clase: 'acciones-grandes' },
        el('button', { clase: 'btn suave', onclick: () => editarCliente({ nombre: input.value.trim() }, (c) => { h.cerrar(); alElegir(c) }) }, icono('sumar'), 'Cliente nuevo'),
        opciones.consumidorFinal ? el('button', { clase: 'btn', onclick: () => { h.cerrar(); alElegir(null) } }, 'Consumidor final') : null),
      res]
  })
  const pintarRes = () => {
    const q = input.value.trim()
    let cs = Datos.lista('cliente')
    if (q) cs = cs.filter((c) => coincide(textoCliente(c), q))
    else cs.sort((a, b) => (b.modificado || '').localeCompare(a.modificado || ''))
    poner(res, cs.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, cs.slice(0, 40).map((c) => el('button', { clase: 'item', onclick: () => { h.cerrar(); alElegir(c) } },
      el('div', { clase: 'cuerpo' }, el('b', {}, c.nombre), el('span', { clase: 'sub' }, [claseCliente(c) !== 'Particular' ? claseCliente(c) : null, (c.domicilios || []).map((d) => d.direccion).join(' · ')].filter(Boolean).join(' · '))),
      icono('flecha', 'tenue')))) : vacio(q ? 'No hay ningún cliente así. Crealo con "Cliente nuevo".' : 'Todavía no hay clientes.', 'cliente'))
  }
  input.addEventListener('input', pintarRes)
  pintarRes()
}

// --- elegir producto del stock ---------------------------------------------------------------
function elegirProducto (alElegir) {
  const conf = Datos.config()
  const st = Calculo.stock(Datos.lista('movstock'), Datos.lista('trabajo'))
  const input = el('input', { type: 'search', placeholder: 'Nombre, código o marca', autocomplete: 'off' })
  const res = el('div', {})
  const h = hoja({
    titulo: 'Agregar del stock',
    completa: true,
    cuerpo: [el('div', { clase: 'buscador' }, icono('buscar'), input),
      el('button', { clase: 'btn suave ancho', estilo: { marginBottom: '10px' }, onclick: () => editarProducto({ nombre: input.value.trim() }, (p) => { h.cerrar(); alElegir(p) }) }, icono('sumar'), 'Producto nuevo'),
      res]
  })
  const pintarRes = () => {
    const q = input.value.trim()
    let ps = Datos.lista('producto').filter((p) => p.activo !== false)
    if (q) ps = ps.filter((p) => coincide([p.nombre, p.codigo, p.marca, p.categoria].join(' '), q))
    ps.sort((a, b) => a.nombre.localeCompare(b.nombre))
    poner(res, ps.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, ps.slice(0, 60).map((p) => {
      const n = st.get(p.id) || 0
      return el('button', { clase: 'item', onclick: () => { h.cerrar(); alElegir(p) } },
        el('div', { clase: 'cuerpo' }, el('b', {}, p.nombre), el('span', { clase: 'sub' }, [p.codigo, p.marca, 'Quedan ' + fmtCant(n)].filter(Boolean).join(' · '))),
        el('div', { clase: 'fin num' }, plata(Calculo.precioProducto(p, conf.redondeo))))
    })) : vacio('No hay productos así.', 'stock'))
  }
  input.addEventListener('input', pintarRes)
  pintarRes()
}

// --- cargar o editar un trabajo ---------------------------------------------------------------
function editarTrabajo (base, alGuardar) {
  const conf = Datos.config()
  const nuevo = !base.id
  const t = JSON.parse(JSON.stringify(Object.assign({
    clase: 'trabajo', estado: 'pendiente', items: [], manoObra: 0, descuento: 0, urgencia: false,
    recargoPct: conf.recargoPct, garantiaDias: conf.garantiaDias, servicio: base.clase === 'venta' ? 'Venta de mostrador' : ''
  }, base, { tipo: 'trabajo' })))
  const esVenta = t.clase === 'venta'
  const titulo = (nuevo ? (esVenta ? 'Venta de mostrador' : t.clase === 'presupuesto' ? 'Presupuesto nuevo' : 'Trabajo nuevo') : (t.clase === 'presupuesto' ? 'Presupuesto' : esVenta ? 'Venta' : 'Trabajo') + ' #' + t.numero)

  const zonaCliente = el('div', {})
  const zonaLugar = el('div', {})
  const zonaApertura = el('div', {})
  const zonaItems = el('div', {})
  const zonaTotal = el('div', {})

  const pintarCliente = () => {
    const c = Datos.get(t.clienteId)
    poner(zonaCliente, el('div', { clase: 'campo' }, 'Cliente',
      el('button', { clase: 'opcion', type: 'button', onclick: () => elegirCliente((x) => { t.clienteId = x ? x.id : null; t.domicilioId = null; t.vehiculoId = null; pintarCliente(); pintarLugar() }, { consumidorFinal: esVenta }) },
        icono('cliente'), el('span', { clase: 'txt' }, el('b', {}, c ? c.nombre : esVenta ? 'Consumidor final' : 'Elegir cliente'), c && c.telefono ? el('span', { clase: 'sub' }, c.telefono) : null), icono('flecha', 'tenue'))))
  }
  const pintarLugar = () => {
    const c = Datos.get(t.clienteId)
    if (!c || esVenta) return limpiar(zonaLugar)
    const ops = (c.domicilios || []).map((d) => ({ valor: 'd:' + d.id, texto: d.nombre ? d.nombre + ' · ' + d.direccion : d.direccion, icono: 'casa' }))
      .concat((c.vehiculos || []).map((v) => ({ valor: 'v:' + v.id, texto: [v.marca, v.modelo, v.patente].filter(Boolean).join(' '), icono: 'auto' })))
    const actual = t.domicilioId ? 'd:' + t.domicilioId : t.vehiculoId ? 'v:' + t.vehiculoId : null
    if (ops.length === 1 && !actual && nuevo) { const [k, id] = ops[0].valor.split(':'); if (k === 'd') t.domicilioId = id; else t.vehiculoId = id; return pintarLugar() }
    poner(zonaLugar, el('div', { clase: 'campo' }, '¿Dónde? (o en qué auto)',
      ops.length ? botonesElegir(ops, actual, (v) => { const [k, id] = v.split(':'); t.domicilioId = k === 'd' ? id : null; t.vehiculoId = k === 'v' ? id : null }) : el('span', { clase: 'ayuda' }, 'Este cliente no tiene domicilios cargados.'),
      el('div', { clase: 'chips', estilo: { marginTop: '6px' } },
        el('button', { type: 'button', clase: 'btn chico', onclick: () => editarDomicilio(c, null, (d) => { t.domicilioId = d.id; t.vehiculoId = null; pintarLugar() }) }, icono('sumar'), 'Domicilio'),
        el('button', { type: 'button', clase: 'btn chico', onclick: () => editarVehiculo(c, null, (v) => { t.vehiculoId = v.id; t.domicilioId = null; pintarLugar() }) }, icono('sumar'), 'Auto'))))
  }

  // Quien pidio la apertura (para cubrirse si despues hay problemas).
  const ap = t.apertura || {}
  const apNombre = entrada(ap.nombre, { placeholder: 'Nombre y apellido' })
  const apDni = entrada(ap.dni, { inputmode: 'numeric', placeholder: 'DNI' })
  const apComo = selector([{ valor: '', texto: 'Elegí…' }].concat(ACREDITO.map((x) => ({ valor: x, texto: x }))), ap.como || '')
  const apNotas = entrada(ap.notas, { placeholder: 'Ej.: patrullero 1234, vecina del 2°B' })
  const pintarApertura = () => {
    if (!/apertura/i.test(t.servicio || '')) return limpiar(zonaApertura)
    poner(zonaApertura, el('div', { clase: 'tarjeta', estilo: { background: 'var(--sup2)' } },
      el('h2', {}, 'Quién pidió la apertura'),
      el('p', { clase: 'sub', estilo: { marginTop: '-6px' } }, 'Te cubre si después hay algún problema: anotá quién la pidió y cómo demostró que vive ahí.'),
      el('div', { clase: 'dos' }, campo('Nombre', apNombre), campo('DNI', apDni)),
      campo('Cómo demostró que vive ahí', apComo), campo('Notas', apNotas)))
  }

  const servicios = (conf.servicios || SERVICIOS).filter((s) => esVenta || s !== 'Venta de mostrador')
  const elegirServicio = botonesElegir(servicios.map((s) => ({ valor: s, texto: s })), t.servicio, (v) => { t.servicio = v; pintarApertura() })
  const fecha = el('input', { type: 'datetime-local', valor: t.fecha ? String(t.fecha).slice(0, 16) : '' })
  const descripcion = areaTexto(t.descripcion, { placeholder: esVenta ? 'Opcional' : 'Qué hay que hacer. Ej.: no abre la puerta del frente, cambiar cilindro…' })
  const manoObra = entradaPlata(t.manoObra || '')
  const descuento = entradaPlata(t.descuento || '')
  const urgencia = casilla('Urgencia o fuera de horario (+' + t.recargoPct + '%)', t.urgencia, (v) => { t.urgencia = v; pintarTotal() })
  const garantiaDias = entrada(t.garantiaDias, { inputmode: 'numeric', clase: 'num' })
  const notas = areaTexto(t.notas, { placeholder: 'Solo las ves vos (no salen en el presupuesto)', rows: 2 })
  manoObra.addEventListener('input', () => { t.manoObra = manoObra.valor() || 0; pintarTotal() })
  descuento.addEventListener('input', () => { t.descuento = descuento.valor() || 0; pintarTotal() })

  const pintarItems = () => {
    poner(zonaItems,
      t.items.length ? el('div', { clase: 'items-trabajo' }, t.items.map((it, i) => {
        const cant = entrada(fmtCant(it.cantidad), { inputmode: 'decimal', clase: 'num chico-num', 'aria-label': 'Cantidad' })
        const precio = entradaPlata(it.precio, { clase: 'num chico-num', 'aria-label': 'Precio' })
        cant.addEventListener('input', () => { const n = aNumero(cant.value); it.cantidad = Number.isFinite(n) ? n : 0; pintarTotal(); sub.textContent = plata(it.cantidad * it.precio) })
        precio.addEventListener('input', () => { it.precio = precio.valor() || 0; pintarTotal(); sub.textContent = plata(it.cantidad * it.precio) })
        const sub = el('span', { clase: 'num sub' }, plata(it.cantidad * it.precio))
        return el('div', { clase: 'item-trabajo' },
          el('div', { clase: 'nombre' }, it.productoId ? el('b', {}, it.nombre) : entrada(it.nombre, { placeholder: 'Qué es', oninput: (ev) => { it.nombre = ev.target.value } }), sub),
          el('label', { clase: 'mini' }, 'Cant.', cant),
          el('label', { clase: 'mini' }, 'Precio c/u', precio),
          el('button', { type: 'button', clase: 'btn-ico', 'aria-label': 'Sacar', onclick: () => { t.items.splice(i, 1); pintarItems(); pintarTotal() } }, icono('basura')))
      })) : null,
      el('div', { clase: 'chips', estilo: { marginBottom: '12px' } },
        el('button', { type: 'button', clase: 'btn chico suave', onclick: () => elegirProducto((p) => {
          const ya = t.items.find((x) => x.productoId === p.id)
          if (ya) ya.cantidad += 1
          else t.items.push({ productoId: p.id, nombre: p.nombre, cantidad: 1, precio: Calculo.precioProducto(p, conf.redondeo), costo: Number(p.costo) || 0 })
          pintarItems(); pintarTotal()
        }) }, icono('stock'), 'Agregar del stock'),
        el('button', { type: 'button', clase: 'btn chico', onclick: () => { t.items.push({ productoId: null, nombre: '', cantidad: 1, precio: 0, costo: 0 }); pintarItems() } }, icono('sumar'), 'Otro (sin stock)')))
  }
  const pintarTotal = () => {
    const x = Calculo.totalesTrabajo(t)
    poner(zonaTotal, el('div', { clase: 'totales' },
      x.materiales ? el('div', { clase: 'fila' }, el('span', {}, 'Materiales'), el('span', { clase: 'num' }, plata(x.materiales))) : null,
      x.manoObra ? el('div', { clase: 'fila' }, el('span', {}, 'Mano de obra'), el('span', { clase: 'num' }, plata(x.manoObra))) : null,
      x.recargo ? el('div', { clase: 'fila' }, el('span', {}, 'Recargo urgencia ' + t.recargoPct + '%'), el('span', { clase: 'num' }, plata(x.recargo))) : null,
      x.descuento ? el('div', { clase: 'fila' }, el('span', {}, 'Descuento'), el('span', { clase: 'num' }, '-' + plata(x.descuento))) : null,
      el('div', { clase: 'fila total' }, el('span', {}, 'Total'), el('span', { clase: 'num' }, plata(x.total)))))
  }

  const guardar = () => {
    if (!esVenta && !t.clienteId) { toast('Elegí el cliente.', 'mal'); return }
    if (!t.servicio) { toast('Elegí qué servicio es.', 'mal'); return }
    t.items = t.items.filter((it) => it.productoId || (it.nombre && it.nombre.trim())).map((it) => Object.assign({}, it, { nombre: (it.nombre || '').trim() }))
    if (esVenta && !t.items.length && !(manoObra.valor() > 0)) { toast('Agregá lo que se vendió.', 'mal'); return }
    t.fecha = fecha.value || null
    t.descripcion = descripcion.value.trim()
    t.manoObra = manoObra.valor() || 0
    t.descuento = descuento.valor() || 0
    t.garantiaDias = Number(garantiaDias.value) || 0
    t.notas = notas.value.trim()
    if (/apertura/i.test(t.servicio)) t.apertura = { nombre: apNombre.value.trim(), dni: apDni.value.trim(), como: apComo.value, notas: apNotas.value.trim() }
    else delete t.apertura
    if (!t.numero) t.numero = Datos.siguienteNumero()
    if (esVenta && nuevo) { t.estado = 'terminado'; t.terminado = new Date().toISOString() }
    const f = Datos.guardar(t)
    h.cerrar()
    toast((esVenta ? 'Venta' : t.clase === 'presupuesto' ? 'Presupuesto' : 'Trabajo') + ' #' + f.numero + ' guardado', 'ok')
    if (alGuardar) return alGuardar(f)
    if (esVenta && nuevo) return cobrarTrabajo(f)
    verTrabajo(f.id)
  }

  const h = hoja({
    titulo,
    completa: true,
    foco: false,
    cuerpo: [
      zonaCliente, zonaLugar,
      esVenta ? null : el('div', { clase: 'campo' }, 'Servicio', elegirServicio),
      zonaApertura,
      esVenta ? null : campo(t.clase === 'presupuesto' ? 'Fecha estimada (opcional)' : 'Cuándo (opcional)', fecha),
      campo(esVenta ? 'Notas' : 'Qué hay que hacer', descripcion),
      el('h3', {}, esVenta ? 'Qué se vendió' : 'Materiales'),
      zonaItems,
      campo(esVenta ? 'Trabajo / copias (opcional)' : 'Mano de obra', manoObra),
      esVenta ? null : urgencia,
      campo('Descuento (opcional)', descuento),
      zonaTotal,
      esVenta ? null : el('div', { clase: 'dos', estilo: { marginTop: '12px' } }, campo('Garantía (días)', garantiaDias, '0 = sin garantía')),
      campo('Notas internas', notas)
    ],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, esVenta && nuevo ? 'Guardar y cobrar' : 'Guardar')]
  })
  pintarCliente(); pintarLugar(); pintarApertura(); pintarItems(); pintarTotal()
  if (nuevo && !t.clienteId && !esVenta) setTimeout(() => elegirCliente((x) => { t.clienteId = x ? x.id : null; pintarCliente(); pintarLugar() }), 80)
}

// --- ver un trabajo -------------------------------------------------------------------------------
function verTrabajo (id) {
  const cuerpo = el('div', {})
  const pie = el('div', { clase: 'acciones-trabajo' })
  let h = null
  const pintarTodo = () => {
    const t = Datos.get(id)
    if (!t) { if (h) h.cerrar(); return }
    if (h) h.cuerpo.parentNode.querySelector('.cab-hoja h2').textContent = tituloTrabajo(t)
    const conf = Datos.config()
    const hoy = hoyISO()
    const c = Datos.get(t.clienteId)
    const x = Calculo.totalesTrabajo(t)
    const tsCliente = Datos.lista('trabajo').filter((y) => y.clienteId === t.clienteId)
    const psCliente = Datos.lista('pago').filter((p) => p.clienteId === t.clienteId)
    const saldo = t.clienteId ? Calculo.saldoTrabajo(t, tsCliente, psCliente) : { total: x.total, pagado: Datos.lista('pago').filter((p) => p.trabajoId === t.id && Calculo.pagoValido(p)).reduce((s, p) => s + p.monto, 0) }
    if (!t.clienteId) saldo.saldo = Calculo.r2(saldo.total - saldo.pagado)
    const pagosDe = Datos.lista('pago').filter((p) => p.trabajoId === t.id).sort((a, b) => a.fecha.localeCompare(b.fecha))
    const dom = c && (c.domicilios || []).find((d) => d.id === t.domicilioId)
    const veh = c && (c.vehiculos || []).find((v) => v.id === t.vehiculoId)
    const gar = Calculo.garantia(t, hoy)
    const cobrable = Calculo.esCobrable(t)
    const ev = cobrable && saldo.saldo > 0 ? Calculo.estadoVence(t.vence, hoy) : null

    poner(cuerpo,
      el('div', { clase: 'chips', estilo: { marginBottom: '10px' } }, chipEstado(t), t.urgencia ? chip('Urgencia +' + t.recargoPct + '%', 'mal') : null, gar ? chip(gar.vigente ? 'Garantía hasta ' + fechaCorta(gar.hasta) : 'Garantía vencida', gar.vigente ? 'ok' : '') : null),
      c ? el('div', { clase: 'tarjeta' },
        el('div', { clase: 'tarjeta-cab' }, el('div', {}, el('b', { clase: 'grande-texto' }, c.nombre), el('div', { clase: 'sub' }, [claseCliente(c), c.telefono].filter(Boolean).join(' · '))),
          el('button', { clase: 'btn chico', onclick: () => verCliente(c.id) }, 'Ver cliente')),
        el('div', { clase: 'chips' },
          c.telefono ? el('a', { clase: 'btn chico', href: linkTelefono(c.telefono) }, icono('telefono'), 'Llamar') : null,
          c.telefono ? el('button', { clase: 'btn chico', onclick: () => abrirWhatsApp(c.telefono, '') }, icono('whatsapp'), 'WhatsApp') : null,
          dom ? el('a', { clase: 'btn chico', href: linkMapa(dom.direccion, dom.localidad), target: '_blank', rel: 'noopener' }, icono('mapa'), 'Cómo llegar') : null),
        dom ? el('div', { clase: 'fila', estilo: { marginTop: '8px' } }, el('div', { clase: 'izq' }, el('b', {}, dom.nombre || 'Domicilio'), el('div', { clase: 'sub' }, [dom.direccion, dom.localidad, dom.referencia].filter(Boolean).join(' · ')),
          (dom.cerraduras || []).length ? el('div', { clase: 'sub' }, 'Cerraduras: ' + dom.cerraduras.map((k) => [k.ubicacion, k.tipo, k.marca].filter(Boolean).join(' ')).join(' · ')) : null)) : null,
        veh ? el('div', { clase: 'fila' }, el('div', { clase: 'izq' }, el('b', {}, [veh.marca, veh.modelo, veh.anio].filter(Boolean).join(' ')), el('div', { clase: 'sub' }, [veh.patente, veh.tipoLlave, veh.chip].filter(Boolean).join(' · ')))) : null) : null,
      el('div', { clase: 'tarjeta' },
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Servicio'), el('b', {}, t.servicio || '-')),
        t.fecha && t.estado !== 'terminado' ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Cuándo'), el('b', {}, fechaCorta(t.fecha) + (/T/.test(t.fecha) ? ' ' + horaCorta(t.fecha) : ''))) : null,
        t.terminado ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Terminado'), el('b', {}, fechaCorta(t.terminado))) : null,
        t.descripcion ? el('p', { estilo: { margin: '8px 0 0', whiteSpace: 'pre-wrap' } }, t.descripcion) : null,
        t.notas ? el('div', { clase: 'aviso', estilo: { marginTop: '10px', marginBottom: 0 } }, el('b', {}, 'Notas internas'), t.notas) : null),
      t.apertura ? el('div', { clase: 'tarjeta' }, el('h2', {}, 'Quién pidió la apertura'),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Nombre'), el('b', {}, t.apertura.nombre || '—')),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'DNI'), el('b', {}, t.apertura.dni || '—')),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Cómo lo demostró'), el('b', { clase: t.apertura.como === 'No pudo acreditar' || !t.apertura.como ? 'rojo' : '' }, t.apertura.como || 'No se anotó')),
        t.apertura.notas ? el('div', { clase: 'sub' }, t.apertura.notas) : null) : null,
      el('div', { clase: 'tarjeta' },
        (t.items || []).map((it) => el('div', { clase: 'fila' }, el('div', { clase: 'izq' }, fmtCant(it.cantidad) + ' × ' + it.nombre), el('span', { clase: 'num' }, plata(it.cantidad * it.precio)))),
        x.manoObra ? el('div', { clase: 'fila' }, el('span', {}, 'Mano de obra'), el('span', { clase: 'num' }, plata(x.manoObra))) : null,
        x.recargo ? el('div', { clase: 'fila' }, el('span', {}, 'Recargo urgencia'), el('span', { clase: 'num' }, plata(x.recargo))) : null,
        x.descuento ? el('div', { clase: 'fila' }, el('span', {}, 'Descuento'), el('span', { clase: 'num' }, '-' + plata(x.descuento))) : null,
        el('div', { clase: 'fila total' }, el('b', {}, 'Total'), el('b', { clase: 'num' }, plata(x.total))),
        t.clase !== 'presupuesto' ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, cobrable ? 'Pagado' : 'Seña'), el('span', { clase: 'num' }, plata(saldo.pagado))) : null,
        cobrable ? el('div', { clase: 'fila' }, el('b', {}, 'Debe'), el('b', { clase: 'num ' + (saldo.saldo > 0 ? 'rojo' : 'verde') }, saldo.saldo > 0 ? plata(saldo.saldo) : 'Pagado')) : null,
        ev ? el('div', { clase: 'aviso ' + (ev.clase === 'vencido' ? 'mal' : ev.clase === 'ok' ? '' : 'alerta'), estilo: { margin: '8px 0 0' } }, el('b', {}, ev.texto), 'Fiado' + (t.vence ? ': prometió pagar el ' + fechaCorta(t.vence) : '')) : null,
        x.costoMateriales ? el('div', { clase: 'sub', estilo: { marginTop: '6px' } }, 'Costo de materiales ' + plata(x.costoMateriales) + ' · te queda ' + plata(x.ganancia)) : null),
      pagosDe.length ? el('div', { clase: 'tarjeta sin-relleno' }, el('h2', {}, 'Pagos'), el('div', { clase: 'lista' }, pagosDe.map((p) => filaPago(p)))) : null)

    // Las acciones segun en que anda.
    const b = (texto, ico, fn, clase) => el('button', { clase: 'btn ' + (clase || ''), onclick: fn }, ico ? icono(ico) : null, texto)
    const acciones = []
    if (t.clase === 'presupuesto' && t.estado !== 'cancelado') {
      acciones.push(b('Aceptado: pasar a trabajo', 'ok', () => { Datos.guardar(Object.assign({}, t, { clase: 'trabajo', estado: 'pendiente', aceptado: new Date().toISOString() })); toast('Ahora es el trabajo #' + t.numero, 'ok') }, 'primario'))
    }
    if (t.clase === 'trabajo' && t.estado === 'pendiente') acciones.push(b('Empezar', 'trabajo', () => Datos.guardar(Object.assign({}, t, { estado: 'en_curso', empezado: new Date().toISOString() }))))
    if (t.clase === 'trabajo' && (t.estado === 'pendiente' || t.estado === 'en_curso')) acciones.push(b('Terminado', 'ok', () => terminarTrabajo(t), 'primario'))
    if (cobrable && saldo.saldo > 0) {
      acciones.push(b('Cobrar', 'plata', () => cobrarTrabajo(t), 'primario'))
      acciones.push(b(t.vence ? 'Cambiar fecha de pago' : 'Poner fecha de pago', 'calendario', () => cambiarVence(t)))
      if (c && c.telefono) acciones.push(b('Recordar por WhatsApp', 'whatsapp', () => recordarDeuda(c, [{ trabajo: t, saldo: saldo.saldo, vence: t.vence }])))
    }
    if (t.clase === 'trabajo' && !cobrable && t.estado !== 'cancelado') acciones.push(b('Cobrar seña', 'plata', () => registrarPago({ clienteId: t.clienteId, trabajoId: t.id })))
    acciones.push(b(t.clase === 'presupuesto' ? 'PDF del presupuesto' : 'PDF', 'pdf', () => pdfTrabajo(t)))
    if (c && c.telefono) acciones.push(b(t.clase === 'presupuesto' ? 'Mandar por WhatsApp' : 'Mandar detalle', 'whatsapp', () => abrirWhatsApp(c.telefono, textoTrabajoWA(t))))
    if (t.estado !== 'cancelado') acciones.push(b('Editar', 'editar', () => editarTrabajo(t)))
    if (t.clase === 'trabajo' && t.estado === 'terminado') acciones.push(b('Volver a abrir', 'refrescar', async () => {
      if (await confirmar('Volver a abrir', 'El trabajo vuelve a "en curso": deja de contar en la deuda y los materiales vuelven al stock hasta que lo termines de nuevo.', 'Volver a abrir')) Datos.guardar(Object.assign({}, t, { estado: 'en_curso', terminado: null }))
    }))
    if (t.estado === 'cancelado') acciones.push(b('Recuperar', 'refrescar', () => Datos.guardar(Object.assign({}, t, { estado: t.clase === 'venta' ? 'terminado' : 'pendiente' }))))
    else if (t.estado !== 'terminado' || t.clase === 'venta') acciones.push(b(t.clase === 'presupuesto' ? 'No lo aceptó' : 'Cancelar', 'cerrar', async () => {
      if (await confirmar(t.clase === 'presupuesto' ? 'Presupuesto no aceptado' : 'Cancelar', t.clase === 'venta' ? 'La venta se anula: no se debe y lo vendido vuelve al stock.' : 'Queda guardado como cancelado (se puede recuperar).', 'Sí, cancelar', true)) Datos.guardar(Object.assign({}, t, { estado: 'cancelado' }))
    }, 'peligro'))
    poner(pie, acciones)
  }
  // Si algo cambia (un pago, otro dispositivo), se vuelve a pintar.
  const quitar = Datos.alCambiar(() => { if (!h.cerrado) pintarTodo() })
  h = hoja({ titulo: tituloTrabajo(Datos.get(id)), completa: true, cuerpo: [cuerpo, pie], alCerrar: quitar })
  pintarTodo()
  return h
}

const tituloTrabajo = (t) => t ? (t.clase === 'presupuesto' ? 'Presupuesto' : t.clase === 'venta' ? 'Venta' : 'Trabajo') + ' #' + t.numero : ''

function terminarTrabajo (t) {
  const f = Datos.guardar(Object.assign({}, t, { estado: 'terminado', terminado: new Date().toISOString() }))
  toast('Trabajo #' + t.numero + ' terminado', 'ok')
  // Avisa si algun material no alcanzaba en el stock.
  const st = Calculo.stock(Datos.lista('movstock'), Datos.lista('trabajo'))
  const faltan = (f.items || []).filter((it) => it.productoId && (st.get(it.productoId) || 0) < 0)
  if (faltan.length) toast('Ojo: en el stock no alcanzaba ' + faltan.map((x) => x.nombre).join(', ') + '. Revisá el stock.', 'mal', 7)
  if (Calculo.totalesTrabajo(f).total > 0) cobrarTrabajo(f)
}
function cobrarTrabajo (t) { registrarPago({ clienteId: t.clienteId, trabajoId: t.id }) }

function cambiarVence (t) {
  const conf = Datos.config()
  const fecha = entradaFecha(t.vence || sumarDias(hoyISO(), conf.diasFiado))
  const rapidas = el('div', { clase: 'chips' }, [7, 15, 30].map((d) => el('button', { type: 'button', clase: 'chip-btn', onclick: () => { fecha.value = sumarDias(hoyISO(), d) } }, 'En ' + d + ' días')))
  const h = hoja({
    titulo: '¿Cuándo paga?',
    cuerpo: [el('p', { clase: 'tenue' }, 'El día que le toca pagar te aparece en Inicio y, si no paga, queda como vencido para recordárselo.'), rapidas, el('div', { estilo: { marginTop: '10px' } }, campo('Fecha', fecha))],
    pie: [el('button', { clase: 'btn', onclick: () => { Datos.guardar(Object.assign({}, Datos.get(t.id), { vence: null })); h.cerrar() } }, 'Sin fecha'),
      el('button', { clase: 'btn primario', onclick: () => { if (!fecha.value) return; Datos.guardar(Object.assign({}, Datos.get(t.id), { vence: fecha.value })); h.cerrar(); toast('Fecha de pago: ' + fechaCorta(fecha.value), 'ok') } }, 'Guardar')]
  })
}

function textoTrabajoWA (t) {
  const conf = Datos.config()
  const c = Datos.get(t.clienteId) || {}
  const x = Calculo.totalesTrabajo(t)
  const lineas = ['Hola ' + primerNombre(c.nombre) + ', te escribimos de *' + conf.negocio + '*.', '']
  lineas.push((t.clase === 'presupuesto' ? '*Presupuesto' : '*Trabajo') + ' #' + t.numero + '* — ' + (t.servicio || ''))
  if (t.descripcion) lineas.push(t.descripcion)
  for (const it of t.items || []) lineas.push('• ' + fmtCant(it.cantidad) + ' × ' + it.nombre + ': ' + plata(it.cantidad * it.precio))
  if (x.manoObra) lineas.push('• Mano de obra: ' + plata(x.manoObra))
  if (x.recargo) lineas.push('• Recargo por urgencia: ' + plata(x.recargo))
  if (x.descuento) lineas.push('• Descuento: -' + plata(x.descuento))
  lineas.push('*Total: ' + plata(x.total) + '*')
  if (t.clase === 'presupuesto' && conf.validezPresupuesto) lineas.push('', 'Válido por ' + conf.validezPresupuesto + ' días.')
  if (t.clase !== 'presupuesto' && t.garantiaDias) lineas.push('', 'Garantía: ' + t.garantiaDias + ' días.')
  return lineas.join('\n')
}
