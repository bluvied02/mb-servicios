'use strict'
// PROVEEDORES
//
// Cada proveedor tiene su ficha (contacto, CUIT, alias, en cuantos dias se le
// paga). Desde ahi se ve:
//   - los productos que le compras (cada producto apunta a su proveedor),
//   - las compras (entra mercaderia al stock) y si se pagaron o quedaron a cuenta,
//   - los pagos y los gastos hechos con el (nafta, un service, herramientas),
//   - cuanto le debes y cuanto gastaste con el por mes.
//
// Compra: ficha 'compra' con sus renglones; lo que va al stock queda ademas
// como movimiento 'movstock' con compraId. Lo pagado es un gasto (sale de la
// caja) con proveedorId; si es pago de deuda lleva pagoProveedor: true.
// Antes el proveedor del producto era solo un nombre escrito: sigue valiendo
// (se busca la ficha por nombre) y hay un boton para crear las fichas.

// --- ayudas ------------------------------------------------------------------------------------
const mismoNombre = (a, b) => sinTildes(a).trim() === sinTildes(b).trim()
function proveedorDeProducto (p) {
  if (!p) return null
  if (p.proveedorId) { const x = Datos.get(p.proveedorId); if (x) return x }
  if (!p.proveedor) return null
  return Datos.lista('proveedor').find((x) => mismoNombre(x.nombre, p.proveedor)) || null
}
const nombreProveedor = (id) => (Datos.get(id) || {}).nombre || ''
function productosDe (prov) {
  return Datos.lista('producto').filter((p) => { const x = proveedorDeProducto(p); return x && x.id === prov.id })
}
// Nombres de proveedor escritos en los productos que todavia no tienen ficha.
function proveedoresSinFicha () {
  const fichas = Datos.lista('proveedor')
  const m = new Map()
  for (const p of Datos.lista('producto')) {
    if (p.proveedorId || !p.proveedor) continue
    if (fichas.some((x) => mismoNombre(x.nombre, p.proveedor))) continue
    m.set(sinTildes(p.proveedor).trim(), p.proveedor.trim())
  }
  return [...m.values()]
}
function crearFichasProveedores () {
  const nuevas = proveedoresSinFicha().map((n) => ({ id: uuid(), tipo: 'proveedor', nombre: n, activo: true }))
  const todas = Datos.lista('proveedor').concat(nuevas)
  const productos = Datos.lista('producto').filter((p) => !p.proveedorId && p.proveedor).map((p) => {
    const x = todas.find((f) => mismoNombre(f.nombre, p.proveedor))
    return x ? Object.assign({}, p, { proveedorId: x.id, proveedor: x.nombre }) : null
  }).filter(Boolean)
  Datos.guardarVarias(nuevas.concat(productos))
  toast(cuantos(nuevas.length, 'proveedor creado', 'proveedores creados') + ' y ' + cuantos(productos.length, 'producto vinculado', 'productos vinculados'), 'ok', 5)
}
function cuentasProv () { return Calculo.cuentasProveedores(Datos.lista('compra'), Datos.lista('gasto')) }
function deudasProveedoresVencidas (hoy) {
  const out = []
  for (const [id, k] of cuentasProv()) for (const d of k.deudas) if (d.vence && d.vence <= hoy) out.push({ proveedorId: id, deuda: d })
  return out
}
const mesActual = () => { const h = hoyISO(); return [h.slice(0, 8) + '01', h] }

// --- la lista ----------------------------------------------------------------------------------
VISTAS.proveedores = function (main) {
  const hoy = hoyISO()
  const filtro = APP.filtros.proveedores || 'todos'
  const todos = Datos.lista('proveedor')
  const activos = todos.filter((p) => p.activo !== false)
  const cs = cuentasProv()
  const [d1, d2] = mesActual()
  const gastoMes = Calculo.gastoProveedores(Datos.lista('compra'), Datos.lista('gasto'), d1, d2)
  let debe = 0; let vencido = 0
  for (const k of cs.values()) { debe += k.debe; for (const d of k.deudas) if (d.vence && d.vence < hoy) vencido += d.saldo }
  const conDeuda = activos.filter((p) => (cs.get(p.id) || {}).debe > 0)
  const totalMes = [...gastoMes.values()].reduce((s, f) => s + f.total, 0)
  const sinFicha = proveedoresSinFicha()
  const buscar = el('input', { type: 'search', placeholder: 'Nombre, rubro o teléfono', valor: APP.filtros.proveedoresBusca || '' })
  const caja = el('div', {})
  const pintarLista = () => {
    const q = buscar.value.trim()
    APP.filtros.proveedoresBusca = q
    let lista = filtro === 'debo' ? conDeuda : filtro === 'baja' ? todos.filter((p) => p.activo === false) : activos
    if (q) lista = lista.filter((p) => coincide([p.nombre, p.rubro, p.contacto, p.telefono, p.cuit].join(' '), q))
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
    poner(caja, lista.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, lista.map((p) => {
      const k = cs.get(p.id)
      const g = gastoMes.get(p.id)
      const venc = k && k.deudas.some((d) => d.vence && d.vence < hoy)
      return el('button', { clase: 'item', onclick: () => verProveedor(p.id) },
        el('div', { clase: 'ico-lista' }, icono('camion')),
        el('div', { clase: 'cuerpo' }, el('b', {}, p.nombre), el('span', { clase: 'sub' }, [p.rubro, p.telefono, cuantos(productosDe(p).length, 'producto', 'productos')].filter(Boolean).join(' · '))),
        k && k.debe > 0 ? el('div', { clase: 'fin pila' }, el('b', { clase: 'num ' + (venc ? 'rojo' : 'ambar') }, plata(k.debe)), el('span', { clase: 'sub' }, venc ? 'vencido' : 'le debés'))
          : g && g.total ? el('div', { clase: 'fin pila' }, el('b', { clase: 'num' }, plata(g.total)), el('span', { clase: 'sub' }, 'este mes')) : null)
    })) : vacio(filtro === 'debo' ? 'No le debés nada a nadie.' : 'Todavía no hay proveedores.', 'camion', filtro === 'debo' ? null : el('button', { clase: 'btn primario', onclick: () => editarProveedor({ nombre: q }, (x) => verProveedor(x.id)) }, icono('sumar'), 'Proveedor nuevo')))
  }
  buscar.addEventListener('input', pintarLista)
  poner(main,
    cabecera('Proveedores', null,
      el('button', { clase: 'btn', onclick: () => pagarProveedor({}) }, icono('plata'), 'Pagar'),
      el('button', { clase: 'btn', onclick: () => entradaMercaderia() }, icono('stock'), 'Compra'),
      el('button', { clase: 'btn primario', onclick: () => editarProveedor(null, (x) => verProveedor(x.id)) }, icono('sumar'), 'Proveedor')),
    el('div', { clase: 'kpis' },
      kpi('Le debés', plata(debe), cuantos(conDeuda.length, 'proveedor', 'proveedores'), debe > 0 ? 'alerta' : '', () => irA('proveedores', 'debo')),
      kpi('Vencido', plata(vencido), vencido > 0 ? 'Ya tendrías que haber pagado' : 'Nada vencido', vencido > 0 ? 'mal' : '', () => irA('proveedores', 'debo')),
      kpi('Gastado este mes', plata(totalMes), 'Compras y gastos', '', () => irA('proveedores', 'gasto')),
      kpi('Proveedores', String(activos.length), '')),
    sinFicha.length ? el('div', { clase: 'aviso info' }, el('b', {}, 'Tus productos ya tienen proveedores escritos'),
      sinFicha.join(', ') + '. Creales la ficha para ver todo lo que les comprás. ',
      el('button', { clase: 'btn chico primario', estilo: { marginTop: '8px' }, onclick: crearFichasProveedores }, icono('ok'), 'Crear ' + cuantos(sinFicha.length, 'ficha', 'fichas'))) : null,
    el('div', { clase: 'filtros' }, [['todos', 'Todos', activos.length], ['debo', 'Les debo', conDeuda.length], ['gasto', 'Gasto por proveedor', null], ['baja', 'Dados de baja', null]].map(([id, n, c]) =>
      el('button', { clase: 'filtro' + (filtro === id ? ' activo' : ''), onclick: () => irA('proveedores', id) }, n, c != null ? el('span', { clase: 'n' }, c) : null))),
    filtro === 'gasto' ? gastoPorProveedor() : [el('div', { clase: 'buscador' }, icono('buscar'), buscar), caja])
  if (filtro !== 'gasto') pintarLista()
}

// Donde se va la plata: ranking de proveedores por mes o por año.
function gastoPorProveedor () {
  const hoy = hoyISO()
  const periodo = APP.filtros.provPeriodo || 'mes'
  const desde = periodo === 'mes' ? hoy.slice(0, 8) + '01' : periodo === 'anio' ? hoy.slice(0, 4) + '-01-01' : '2000-01-01'
  const m = Calculo.gastoProveedores(Datos.lista('compra'), Datos.lista('gasto'), desde, hoy)
  const filas = [...m.entries()].map(([id, f]) => Object.assign({ id, nombre: nombreProveedor(id) || 'Proveedor borrado' }, f)).filter((f) => f.total > 0 || f.pagado > 0).sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...filas.map((f) => f.total))
  const total = filas.reduce((s, f) => s + f.total, 0)
  const sinProv = Datos.lista('gasto').filter((g) => !g.proveedorId && !g.borrado && diaDe(g.fecha) >= desde && diaDe(g.fecha) <= hoy).reduce((s, g) => s + (Number(g.monto) || 0), 0)
  return el('div', {},
    el('div', { clase: 'seg', estilo: { marginBottom: '12px' } }, [['mes', 'Este mes'], ['anio', 'Este año'], ['todo', 'Siempre']].map(([id, n]) =>
      el('button', { clase: periodo === id ? 'activo' : '', onclick: () => { APP.filtros.provPeriodo = id; pintar() } }, n))),
    filas.length ? el('div', { clase: 'tarjeta' },
      el('div', { clase: 'tarjeta-cab' }, el('h2', {}, 'Dónde se va la plata'), el('b', { clase: 'num' }, plata(total))),
      el('div', { clase: 'ranking' }, filas.map((f) => el('button', { clase: 'rank enlace', estilo: { width: '100%' }, onclick: () => verProveedor(f.id) },
        el('div', { clase: 'fila-r' }, el('span', { clase: 'n' }, f.nombre), el('b', { clase: 'num' }, plata(f.total))),
        el('div', { clase: 'pista' }, el('i', { estilo: { width: Math.round(f.total / max * 100) + '%' } })),
        el('div', { clase: 'sub' }, [f.comprado ? 'Compras ' + plata(f.comprado) : null, f.directo ? 'Otros gastos ' + plata(f.directo) : null, 'Pagado ' + plata(f.pagado)].filter(Boolean).join(' · ')))))) : vacio('No hay compras ni gastos con proveedores en este período.', 'camion'),
    sinProv ? el('p', { clase: 'sub' }, 'Además hay ' + plata(sinProv) + ' en gastos sin proveedor (nafta, alquiler…). Si querés verlos acá, al cargar el gasto elegí el proveedor.') : null)
}

// --- ficha de un proveedor ----------------------------------------------------------------------
function verProveedor (id) {
  const cuerpo = el('div', {})
  let h = null
  const pintarTodo = () => {
    const p = Datos.get(id)
    if (!p) { h.cerrar(); return }
    if (h) h.cuerpo.parentNode.querySelector('.cab-hoja h2').textContent = p.nombre
    const hoy = hoyISO()
    const compras = Datos.lista('compra').filter((c) => c.proveedorId === p.id)
    const gastos = Datos.lista('gasto').filter((g) => g.proveedorId === p.id)
    const k = Calculo.cuentaProveedor(compras, gastos)
    const prods = productosDe(p).filter((x) => x.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const st = Calculo.stock(Datos.lista('movstock'), Datos.lista('trabajo'))
    const bajos = prods.filter((x) => Number(x.minimo) > 0 && Calculo.estadoStock(st.get(x.id) || 0, x.minimo) !== 'ok')
    // Gasto de los ultimos 6 meses.
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 - i, 1)
      const desde = Calculo.diaISO(d)
      const hasta = Calculo.diaISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
      const f = Calculo.gastoProveedores(compras, gastos, desde, hasta).get(p.id) || { total: 0 }
      meses.push({ nombre: d.toLocaleDateString('es-AR', { month: 'short' }), total: f.total })
    }
    const maxMes = Math.max(1, ...meses.map((x) => x.total))
    const anio = Calculo.gastoProveedores(compras, gastos, hoy.slice(0, 4) + '-01-01', hoy).get(p.id) || { total: 0, comprado: 0, pagado: 0 }
    const movs = gastos.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))

    poner(cuerpo,
      p.activo === false ? el('div', { clase: 'aviso' }, el('b', {}, 'Dado de baja'), 'No aparece para elegir en compras nuevas.') : null,
      el('div', { clase: 'chips', estilo: { marginBottom: '10px' } },
        p.rubro ? chip(p.rubro, 'info') : null,
        p.telefono ? el('a', { clase: 'btn chico', href: linkTelefono(p.telefono) }, icono('telefono'), p.telefono) : null,
        p.telefono ? el('button', { clase: 'btn chico', onclick: () => abrirWhatsApp(p.telefono, '') }, icono('whatsapp'), 'WhatsApp') : null,
        p.email ? el('a', { clase: 'btn chico', href: 'mailto:' + p.email }, 'Mail') : null,
        el('button', { clase: 'btn chico', onclick: () => editarProveedor(p) }, icono('editar'), 'Editar')),

      el('div', { clase: 'acciones-grandes' },
        el('button', { clase: 'btn primario', onclick: () => entradaMercaderia(null, { proveedorId: p.id }) }, icono('stock'), 'Compra'),
        el('button', { clase: 'btn', onclick: () => pagarProveedor({ proveedorId: p.id }) }, icono('plata'), 'Pagarle'),
        el('button', { clase: 'btn', onclick: () => pedidoProveedor(p) }, icono('whatsapp'), bajos.length ? 'Pedido (' + bajos.length + ' para reponer)' : 'Hacer pedido'),
        el('button', { clase: 'btn', onclick: () => editarGasto({ proveedorId: p.id }) }, icono('gasto'), 'Otro gasto')),

      el('div', { clase: 'tarjeta' },
        el('h2', {}, 'Cuenta'),
        el('div', { clase: 'dato-grande' },
          el('div', {}, el('div', { clase: 'r' }, 'Le debés'), el('div', { clase: 'v ' + (k.debe > 0 ? 'rojo' : '') }, plata(k.debe))),
          el('div', {}, el('div', { clase: 'r' }, 'A favor tuyo'), el('div', { clase: 'v ' + (k.aFavor > 0 ? 'verde' : '') }, plata(k.aFavor))),
          el('div', {}, el('div', { clase: 'r' }, 'Gastado este año'), el('div', { clase: 'v' }, plata(anio.total)))),
        k.deudas.map((d) => {
          const e = Calculo.estadoVence(d.vence, hoy)
          return el('button', { clase: 'item', estilo: { padding: '8px 0', minHeight: '44px' }, onclick: () => verCompra(d.compra.id) },
            el('div', { clase: 'cuerpo' }, el('span', {}, 'Compra ' + fechaCorta(d.compra.fecha) + (d.compra.numero ? ' · N° ' + d.compra.numero : '')),
              el('span', { clase: 'sub ' + (e.clase === 'vencido' ? 'rojo' : e.clase === 'hoy' || e.clase === 'pronto' ? 'ambar' : '') }, e.texto.replace('Sin fecha de pago', 'Sin fecha para pagar'))),
            el('span', { clase: 'num' }, plata(d.saldo)))
        })),

      el('div', { clase: 'tarjeta' },
        el('h2', {}, 'Gasto por mes'),
        el('div', { clase: 'barras', estilo: { height: '96px' } }, meses.map((x) => el('div', { clase: 'b' + (x.total ? '' : ' vacia'), title: x.nombre + ': ' + plata(x.total), estilo: { height: Math.max(x.total ? 4 : 0, Math.round(x.total / maxMes * 100)) + '%' } }))),
        el('div', { clase: 'eje' }, meses.map((x) => el('span', {}, x.nombre))),
        el('div', { clase: 'sub', estilo: { marginTop: '6px' } }, 'Este mes: ' + plata(meses[5].total) + ' · Este año: compras ' + plata(anio.comprado) + ', pagado ' + plata(anio.pagado))),

      el('div', { clase: 'tarjeta-cab', estilo: { marginTop: '16px' } }, el('h2', {}, cuantos(prods.length, 'producto', 'productos') + ' que le comprás'),
        el('button', { clase: 'btn chico suave', onclick: () => editarProducto({ proveedorId: p.id, proveedor: p.nombre }) }, icono('sumar'), 'Producto')),
      prods.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, prods.map((x) => {
        const n = st.get(x.id) || 0
        const e = Calculo.estadoStock(n, x.minimo)
        return el('button', { clase: 'item', onclick: () => verProducto(x.id) },
          el('div', { clase: 'cuerpo' }, el('b', {}, x.nombre), el('span', { clase: 'sub' }, 'Costo ' + plata(x.costo || 0) + (x.codigo ? ' · ' + x.codigo : ''))),
          chip(fmtCant(n) + (Number(x.minimo) > 0 ? ' / mín. ' + fmtCant(x.minimo) : ''), e === 'falta' ? 'mal' : e === 'bajo' ? 'alerta' : ''))
      })) : el('p', { clase: 'sub' }, 'Ningún producto tiene a este proveedor. Se elige al cargar o editar el producto.'),

      el('h3', {}, 'Compras'),
      compras.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, compras.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 40).map((c) => filaCompra(c, k))) : el('p', { clase: 'sub' }, 'Todavía no hay compras.'),
      el('h3', {}, 'Pagos y gastos'),
      movs.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, movs.slice(0, 40).map((g) => filaGasto(g))) : el('p', { clase: 'sub' }, 'Todavía no hay pagos.'),

      [p.contacto, p.cuit, p.email, p.direccion, p.alias, p.diasPago, p.notas, p.telefono2].some(Boolean) ? el('div', { clase: 'tarjeta', estilo: { marginTop: '14px' } },
        [['Contacto', p.contacto], ['Otro teléfono', p.telefono2], ['CUIT', p.cuit], ['Email', p.email], ['Dirección', [p.direccion, p.localidad].filter(Boolean).join(', ')], ['Alias / CBU', p.alias], ['Le pagás a', p.diasPago ? p.diasPago + ' días' : '']]
          .filter((x) => x[1]).map(([r, v]) => el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, r), el('b', {}, v))),
        p.alias ? el('button', { clase: 'btn chico', estilo: { marginTop: '6px' }, onclick: () => copiarTexto(p.alias) }, icono('copiar'), 'Copiar alias') : null,
        p.notas ? el('p', { estilo: { margin: '8px 0 0', whiteSpace: 'pre-wrap' } }, p.notas) : null) : null,
      el('div', { clase: 'chips', estilo: { marginTop: '18px' } },
        el('button', { clase: 'btn chico', onclick: () => Datos.guardar(Object.assign({}, p, { activo: p.activo === false })) }, p.activo === false ? 'Volver a dar de alta' : 'Dar de baja'),
        !compras.length && !gastos.length && !prods.length ? el('button', { clase: 'btn chico peligro', onclick: async () => { if (await confirmar('Borrar proveedor', '¿Borrar a ' + p.nombre + '?', 'Borrar', true)) { Datos.borrar(p.id); h.cerrar() } } }, icono('basura'), 'Borrar') : null))
  }
  const quitar = Datos.alCambiar(() => { if (!h.cerrado) pintarTodo() })
  h = hoja({ titulo: (Datos.get(id) || {}).nombre || 'Proveedor', completa: true, cuerpo, alCerrar: quitar })
  pintarTodo()
}

function filaCompra (c, cuenta) {
  const f = cuenta && cuenta.filas.find((x) => x.compra.id === c.id)
  const estado = c.anulada ? chip('Anulada', '') : !f ? chip('', '') : f.saldo > 0.009 ? chip('Debés ' + plata(f.saldo), 'alerta') : chip('Pagada', 'ok')
  return el('button', { clase: 'item' + (c.anulada ? ' inactivo' : ''), onclick: () => verCompra(c.id) },
    el('div', { clase: 'ico-lista' }, icono('stock')),
    el('div', { clase: 'cuerpo' }, el('b', {}, fechaCorta(c.fecha) + (c.numero ? ' · N° ' + c.numero : '')),
      el('span', { clase: 'sub' }, (c.items || []).map((i) => fmtCant(i.cantidad) + ' ' + i.nombre).join(', ') || c.notas || 'Compra')),
    el('div', { clase: 'fin pila' }, el('b', { clase: 'num' }, plata(c.total)), estado))
}

// --- cargar o editar un proveedor ---------------------------------------------------------------
function editarProveedor (base, alGuardar) {
  const p = Object.assign({ activo: true }, base || {})
  const nuevo = !p.id
  const f = {
    nombre: entrada(p.nombre, { placeholder: 'Ej.: Distribuidora Río Cuarto' }),
    rubro: entrada(p.rubro, { placeholder: 'Qué te vende: cilindros, llaves, cámaras…' }),
    contacto: entrada(p.contacto, { placeholder: 'Con quién hablás (vendedor)' }),
    telefono: entrada(p.telefono, { type: 'tel', inputmode: 'tel', placeholder: 'Con código de área' }),
    telefono2: entrada(p.telefono2, { type: 'tel', inputmode: 'tel' }),
    email: entrada(p.email, { type: 'email', inputmode: 'email' }),
    cuit: entrada(p.cuit),
    direccion: entrada(p.direccion),
    localidad: entrada(p.localidad),
    alias: entrada(p.alias, { placeholder: 'Para transferirle' }),
    diasPago: entrada(p.diasPago || '', { inputmode: 'numeric', clase: 'num', placeholder: '30' })
  }
  const notas = areaTexto(p.notas, { rows: 2 })
  const guardar = () => {
    if (!f.nombre.value.trim()) { toast('Poné el nombre.', 'mal'); f.nombre.focus(); return }
    const otro = Datos.lista('proveedor').find((x) => x.id !== p.id && mismoNombre(x.nombre, f.nombre.value))
    if (otro) { toast('Ya hay un proveedor con ese nombre.', 'mal'); return }
    for (const k in f) p[k] = k === 'diasPago' ? (Number(aNumero(f[k].value)) || 0) : f[k].value.trim()
    p.notas = notas.value.trim()
    p.tipo = 'proveedor'
    const fichas = [p]
    if (nuevo) p.id = uuid()
    else if (base.nombre && base.nombre !== p.nombre) {
      // Si cambio el nombre, los productos que lo tenian escrito siguen apuntando a el.
      for (const x of Datos.lista('producto')) if (!x.proveedorId && x.proveedor && mismoNombre(x.proveedor, base.nombre)) fichas.push(Object.assign({}, x, { proveedorId: p.id, proveedor: p.nombre }))
    }
    const [g] = Datos.guardarVarias(fichas)
    h.cerrar()
    toast('Proveedor guardado', 'ok')
    if (alGuardar) alGuardar(g)
  }
  const h = hoja({
    titulo: nuevo ? 'Proveedor nuevo' : 'Editar proveedor',
    completa: true,
    cuerpo: [campo('Nombre', f.nombre), campo('Qué te vende', f.rubro),
      el('div', { clase: 'dos' }, campo('Contacto', f.contacto), campo('Celular', f.telefono, 'Para mandarle pedidos por WhatsApp')),
      el('div', { clase: 'dos' }, campo('Otro teléfono', f.telefono2), campo('Email', f.email)),
      el('div', { clase: 'dos' }, campo('CUIT', f.cuit), campo('Alias / CBU', f.alias)),
      el('div', { clase: 'dos' }, campo('Dirección', f.direccion), campo('Localidad', f.localidad)),
      campo('¿En cuántos días le pagás?', f.diasPago, 'Si le comprás a cuenta, te avisa cuando hay que pagarle'),
      campo('Notas', notas)],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, 'Guardar')]
  })
}

// --- elegir proveedor ---------------------------------------------------------------------------
function elegirProveedor (alElegir, opciones) {
  opciones = opciones || {}
  const input = el('input', { type: 'search', placeholder: 'Buscar proveedor', autocomplete: 'off' })
  const res = el('div', {})
  const h = hoja({
    titulo: 'Elegir proveedor',
    completa: true,
    cuerpo: [el('div', { clase: 'buscador' }, icono('buscar'), input),
      el('div', { clase: 'acciones-grandes' },
        el('button', { clase: 'btn suave', onclick: () => editarProveedor({ nombre: input.value.trim() }, (p) => { h.cerrar(); alElegir(p) }) }, icono('sumar'), 'Proveedor nuevo'),
        opciones.ninguno ? el('button', { clase: 'btn', onclick: () => { h.cerrar(); alElegir(null) } }, 'Sin proveedor') : null),
      res]
  })
  const pintarRes = () => {
    const q = input.value.trim()
    let ps = Datos.lista('proveedor').filter((p) => p.activo !== false)
    if (q) ps = ps.filter((p) => coincide([p.nombre, p.rubro, p.contacto].join(' '), q))
    ps.sort((a, b) => a.nombre.localeCompare(b.nombre))
    poner(res, ps.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, ps.map((p) => el('button', { clase: 'item', onclick: () => { h.cerrar(); alElegir(p) } },
      el('div', { clase: 'cuerpo' }, el('b', {}, p.nombre), el('span', { clase: 'sub' }, [p.rubro, p.telefono].filter(Boolean).join(' · '))), icono('flecha', 'tenue')))) : vacio(q ? 'No hay ningún proveedor así.' : 'Todavía no hay proveedores.', 'camion'))
  }
  input.addEventListener('input', pintarRes)
  pintarRes()
}
// Boton que muestra el proveedor elegido y abre el elegidor.
function botonProveedor (actualId, alCambiar, opciones) {
  let id = actualId || null
  const caja = el('div', {})
  const pintarB = () => {
    const p = id ? Datos.get(id) : null
    poner(caja, el('button', { clase: 'opcion', type: 'button', onclick: () => elegirProveedor((x) => { id = x ? x.id : null; pintarB(); alCambiar && alCambiar(x) }, opciones) },
      icono('camion'), el('span', { clase: 'txt' }, el('b', {}, p ? p.nombre : 'Elegir proveedor'), p && p.rubro ? el('span', { clase: 'sub' }, p.rubro) : el('span', { clase: 'sub' }, (opciones || {}).ninguno ? 'Opcional' : '')), icono('flecha', 'tenue')))
  }
  pintarB()
  caja.valor = () => id
  return caja
}

// --- compra: entra mercaderia (con o sin proveedor) ----------------------------------------------
function entradaMercaderia (productoInicial, op) {
  op = op || {}
  const conf = Datos.config()
  const lineas = []
  let provId = op.proveedorId || (productoInicial && (proveedorDeProducto(productoInicial) || {}).id) || null
  let medio = 'efectivo'
  const zona = el('div', {})
  const total = el('div', { clase: 'fila total' })
  const fecha = entradaFecha(hoyISO())
  const numero = entrada('', { placeholder: 'Opcional' })
  const notas = entrada('', { placeholder: 'Opcional' })
  const monto = entradaPlata('', { clase: 'num plata-grande' })
  const vence = entradaFecha('')
  const chNumero = entrada('', { inputmode: 'numeric', placeholder: 'Número' })
  const chBanco = entrada('', { placeholder: 'Banco' })
  const chFecha = entradaFecha(hoyISO())
  const zonaPago = el('div', {})
  const zonaMonto = el('div', {}, campo('Cuánto le pagaste', monto, 'Si pagás una parte, el resto queda a cuenta'))
  const zonaCheque = el('div', {}, el('div', { clase: 'dos' }, campo('Banco', chBanco), campo('Número', chNumero)), campo('Fecha de pago del cheque', chFecha))
  const zonaDeuda = el('div', {})
  let montoTocado = false
  monto.addEventListener('input', () => { montoTocado = true; pintarPago() })
  const sumaTotal = () => Calculo.r2(lineas.reduce((s, l) => s + (l.cant || 0) * (l.costo || 0), 0))
  const pintarPago = () => {
    const t = sumaTotal()
    poner(total, el('b', {}, 'Total'), el('b', { clase: 'num' }, plata(t)))
    if (!montoTocado) monto.value = t ? formatoEntrada(t) : ''
    zonaMonto.hidden = medio === 'cuenta'
    zonaCheque.hidden = medio !== 'cheque'
    const pagado = medio === 'cuenta' ? 0 : (monto.valor() || 0)
    const resto = Calculo.r2(t - pagado)
    if (resto > 0.009 && provId) {
      const prov = Datos.get(provId) || {}
      if (!vence.value) vence.value = sumarDias(fecha.value || hoyISO(), Number(prov.diasPago) || 30)
      poner(zonaDeuda, el('div', { clase: 'tarjeta', estilo: { background: 'var(--ambar-suave)', borderColor: 'transparent' } },
        el('b', {}, 'Le quedás debiendo ' + plata(resto)),
        el('p', { clase: 'sub', estilo: { margin: '2px 0 8px' } }, '¿Cuándo le pagás? Ese día te avisa en Inicio.'),
        el('div', { clase: 'chips', estilo: { marginBottom: '8px' } }, [7, 15, 30, 60].map((d) => el('button', { type: 'button', clase: 'chip-btn', onclick: () => { vence.value = sumarDias(hoyISO(), d) } }, d + ' días'))),
        vence))
    } else if (resto > 0.009) poner(zonaDeuda, el('div', { clase: 'aviso alerta' }, 'Para dejar algo a cuenta elegí el proveedor.'))
    else limpiar(zonaDeuda)
  }
  const elegirMedio = botonesElegir([{ valor: 'efectivo', texto: 'Efectivo', icono: 'plata' }, { valor: 'transferencia', texto: 'Transferencia', icono: 'cuenta' }, { valor: 'cheque', texto: 'Cheque', icono: 'cheque' }, { valor: 'cuenta', texto: 'A cuenta (le debo)', icono: 'calendario' }],
    medio, (v) => { medio = v; pintarPago() })
  poner(zonaPago, el('div', { clase: 'campo' }, '¿Cómo le pagaste?', elegirMedio), zonaMonto, zonaCheque, zonaDeuda)
  const prov = botonProveedor(provId, (x) => { provId = x ? x.id : null; vence.value = ''; pintarPago() }, { ninguno: true })

  const agregar = (p) => {
    const ya = lineas.find((l) => l.p && l.p.id === p.id)
    if (ya) ya.cant += 1
    else lineas.push({ p, nombre: p.nombre, cant: 1, costo: Number(p.costo) || 0 })
    if (!provId) { const x = proveedorDeProducto(p); if (x) { provId = x.id; poner(prov, botonProveedor(provId, (y) => { provId = y ? y.id : null; vence.value = ''; pintarPago() }, { ninguno: true })) } }
    pintar()
  }
  const pintar = () => {
    poner(zona, lineas.map((l, i) => {
      const cant = entrada(fmtCant(l.cant), { inputmode: 'decimal', clase: 'num chico-num' })
      const costo = entradaPlata(l.costo, { clase: 'num chico-num' })
      const nota = el('span', { clase: 'sub' })
      const pintarNota = () => {
        if (!l.p) { nota.textContent = 'No va al stock'; return }
        const cambia = Calculo.r2(l.costo) !== Calculo.r2(l.p.costo || 0)
        nota.textContent = cambia && !l.p.precioFijo ? 'Costo nuevo: el precio pasa a ' + plata(Calculo.precioDesdeCosto(l.costo, l.p.porcentaje, conf.redondeo)) : cambia ? 'Precio fijo: sigue en ' + plata(l.p.precio) : ''
      }
      cant.addEventListener('input', () => { l.cant = aNumero(cant.value) || 0; pintarPago() })
      costo.addEventListener('input', () => { l.costo = costo.valor() || 0; pintarPago(); pintarNota() })
      pintarNota()
      return el('div', { clase: 'item-trabajo' },
        el('div', { clase: 'nombre' }, l.p ? el('b', {}, l.p.nombre) : entrada(l.nombre, { placeholder: 'Qué es (no va al stock)', oninput: (ev) => { l.nombre = ev.target.value } }), nota),
        el('label', { clase: 'mini' }, 'Cant.', cant),
        el('label', { clase: 'mini' }, 'Costo c/u', costo),
        el('button', { type: 'button', clase: 'btn-ico', 'aria-label': 'Sacar', onclick: () => { lineas.splice(i, 1); pintar() } }, icono('basura')))
    }), el('div', { clase: 'chips', estilo: { margin: '4px 0 12px' } },
      el('button', { type: 'button', clase: 'btn chico suave', onclick: () => elegirProducto(agregar) }, icono('stock'), lineas.length ? 'Otro producto' : 'Elegir producto'),
      el('button', { type: 'button', clase: 'btn chico', onclick: () => { lineas.push({ p: null, nombre: '', cant: 1, costo: 0 }); pintar() } }, icono('sumar'), 'Otra cosa (sin stock)')))
    pintarPago()
  }

  const guardar = () => {
    const ok = lineas.filter((l) => l.cant > 0 && (l.p || (l.nombre && l.nombre.trim())))
    if (!ok.length) { toast('Elegí qué compraste.', 'mal'); return }
    const t = sumaTotal()
    const pagado = medio === 'cuenta' ? 0 : Calculo.r2(Math.min(monto.valor() || 0, t))
    const resto = Calculo.r2(t - pagado)
    if (resto > 0.009 && !provId) { toast('Para dejar algo a cuenta elegí el proveedor.', 'mal'); return }
    if (medio !== 'cuenta' && !(pagado > 0) && t > 0) { toast('Poné cuánto le pagaste, o elegí "A cuenta".', 'mal'); return }
    const p = provId ? Datos.get(provId) : null
    const dia = fecha.value || hoyISO()
    const ahora = new Date().toISOString()
    const compra = {
      id: uuid(), tipo: 'compra', proveedorId: provId, fecha: dia, numero: numero.value.trim(), notas: notas.value.trim(), total: t,
      items: ok.map((l) => ({ productoId: l.p ? l.p.id : null, nombre: l.p ? l.p.nombre : l.nombre.trim(), cantidad: l.cant, costo: l.costo })),
      vence: resto > 0.009 ? (vence.value || null) : null
    }
    const fichas = [compra]
    for (const l of ok) {
      if (!l.p) continue
      fichas.push({ tipo: 'movstock', mov: 'compra', compraId: compra.id, productoId: l.p.id, cantidad: l.cant, costo: l.costo, proveedorId: provId, proveedor: p ? p.nombre : '', fecha: dia === hoyISO() ? ahora : dia + 'T12:00:00' })
      const actual = Datos.get(l.p.id)
      const cambios = {}
      if (Calculo.r2(l.costo) !== Calculo.r2(actual.costo || 0)) cambios.costo = l.costo
      if (p && !proveedorDeProducto(actual)) { cambios.proveedorId = p.id; cambios.proveedor = p.nombre }
      if (Object.keys(cambios).length) fichas.push(Object.assign({}, actual, cambios))
    }
    if (pagado > 0) {
      const g = { tipo: 'gasto', fecha: dia, categoria: 'Mercadería', concepto: 'Compra' + (p ? ' a ' + p.nombre : ' de mercadería') + (compra.numero ? ' (N° ' + compra.numero + ')' : ''), monto: pagado, medio, compraId: compra.id }
      if (p) { g.proveedorId = p.id; g.pagoProveedor = true }
      if (medio === 'cheque') g.cheque = { numero: chNumero.value.trim(), banco: chBanco.value.trim(), fechaPago: chFecha.value }
      fichas.push(g)
    }
    Datos.guardarVarias(fichas)
    h.cerrar()
    toast('Compra guardada' + (ok.some((l) => l.p) ? ', stock actualizado' : '') + (resto > 0.009 ? ' · le debés ' + plata(resto) : ''), 'ok', 5)
  }
  const h = hoja({
    titulo: 'Compra / entró mercadería',
    completa: true,
    foco: false,
    cuerpo: [el('div', { clase: 'campo' }, 'Proveedor', prov),
      el('div', { clase: 'dos' }, campo('Fecha', fecha), campo('Factura o remito N°', numero)),
      el('h3', {}, 'Qué compraste'), zona, total,
      zonaPago, campo('Notas', notas)],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, 'Guardar')]
  })
  if (productoInicial) agregar(productoInicial)
  else pintar()
}

// --- ver una compra ----------------------------------------------------------------------------
function verCompra (id) {
  const cuerpo = el('div', {})
  const pie = el('div', { clase: 'acciones-trabajo' })
  let h = null
  const pintarTodo = () => {
    const c = Datos.get(id)
    if (!c) { h.cerrar(); return }
    const p = c.proveedorId ? Datos.get(c.proveedorId) : null
    const k = c.proveedorId ? Calculo.cuentaProveedor(Datos.lista('compra').filter((x) => x.proveedorId === c.proveedorId), Datos.lista('gasto').filter((g) => g.proveedorId === c.proveedorId)) : null
    const f = k && k.filas.find((x) => x.compra.id === c.id)
    const pagos = Datos.lista('gasto').filter((g) => g.compraId === c.id)
    const pagado = f ? f.pagado : pagos.reduce((s, g) => s + (Number(g.monto) || 0), 0)
    const saldo = c.anulada ? 0 : Calculo.r2(c.total - pagado)
    const e = saldo > 0 ? Calculo.estadoVence(c.vence, hoyISO()) : null
    poner(cuerpo,
      c.anulada ? el('div', { clase: 'aviso mal' }, el('b', {}, 'Anulada'), 'No cuenta en el stock ni en la deuda.') : null,
      el('div', { clase: 'tarjeta' },
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Proveedor'), p ? el('button', { clase: 'enlace', onclick: () => verProveedor(p.id) }, el('b', {}, p.nombre)) : el('b', {}, 'Sin proveedor')),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Fecha'), el('b', {}, fechaCorta(c.fecha))),
        c.numero ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Factura / remito'), el('b', {}, c.numero)) : null,
        c.notas ? el('p', { clase: 'tenue' }, c.notas) : null),
      el('div', { clase: 'tarjeta' },
        (c.items || []).map((it) => el('div', { clase: 'fila' }, el('div', { clase: 'izq' }, fmtCant(it.cantidad) + ' × ' + it.nombre + (it.productoId ? '' : ' (sin stock)')), el('span', { clase: 'num' }, plata(it.cantidad * it.costo)))),
        el('div', { clase: 'fila total' }, el('b', {}, 'Total'), el('b', { clase: 'num' }, plata(c.total))),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Pagado'), el('span', { clase: 'num' }, plata(pagado))),
        el('div', { clase: 'fila' }, el('b', {}, 'Debés'), el('b', { clase: 'num ' + (saldo > 0 ? 'rojo' : 'verde') }, saldo > 0 ? plata(saldo) : 'Nada')),
        e ? el('div', { clase: 'aviso ' + (e.clase === 'vencido' ? 'mal' : e.clase === 'ok' || e.clase === 'sin' ? '' : 'alerta'), estilo: { margin: '8px 0 0' } }, el('b', {}, e.texto.replace('Sin fecha de pago', 'Sin fecha para pagar'))) : null),
      pagos.length ? [el('h3', {}, 'Pagos de esta compra'), el('div', { clase: 'tarjeta sin-relleno lista' }, pagos.map((g) => filaGasto(g)))] : null)
    const acc = []
    if (!c.anulada && saldo > 0 && p) {
      acc.push(el('button', { clase: 'btn primario', onclick: () => pagarProveedor({ proveedorId: p.id, compraId: c.id }) }, icono('plata'), 'Pagar'))
      acc.push(el('button', { clase: 'btn', onclick: () => cambiarVenceCompra(c) }, icono('calendario'), c.vence ? 'Cambiar fecha de pago' : 'Poner fecha de pago'))
    }
    if (!c.anulada) acc.push(el('button', { clase: 'btn peligro', onclick: () => anularCompra(c) }, icono('basura'), 'Anular compra'))
    poner(pie, acc)
  }
  const quitar = Datos.alCambiar(() => { if (!h.cerrado) pintarTodo() })
  h = hoja({ titulo: 'Compra', completa: true, cuerpo: [cuerpo, pie], alCerrar: quitar })
  pintarTodo()
}
function cambiarVenceCompra (c) {
  const fecha = entradaFecha(c.vence || sumarDias(hoyISO(), 30))
  const h = hoja({
    titulo: '¿Cuándo le pagás?',
    cuerpo: [el('div', { clase: 'chips', estilo: { marginBottom: '10px' } }, [7, 15, 30].map((d) => el('button', { type: 'button', clase: 'chip-btn', onclick: () => { fecha.value = sumarDias(hoyISO(), d) } }, 'En ' + d + ' días'))), campo('Fecha', fecha)],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: () => { Datos.guardar(Object.assign({}, Datos.get(c.id), { vence: fecha.value || null })); h.cerrar() } }, 'Guardar')]
  })
}
async function anularCompra (c) {
  const pagos = Datos.lista('gasto').filter((g) => g.compraId === c.id)
  const movs = Datos.lista('movstock').filter((m) => m.compraId === c.id)
  const txt = 'Usalo si la cargaste por error. ' + (movs.length ? 'Lo que entró al stock se descuenta. ' : '') + (pagos.length ? 'Los pagos de esta compra (' + plata(pagos.reduce((s, g) => s + g.monto, 0)) + ') se borran de la caja.' : '')
  if (!(await confirmar('Anular compra', txt, 'Anular', true))) return
  Datos.guardarVarias([Object.assign({}, c, { anulada: new Date().toISOString() })]
    .concat(movs.map((m) => Object.assign({}, m, { borrado: true })))
    .concat(pagos.map((g) => Object.assign({}, g, { borrado: true }))))
  toast('Compra anulada', 'ok')
}

// --- pagarle a un proveedor --------------------------------------------------------------------
function pagarProveedor (op) {
  if (!op.proveedorId) return elegirProveedor((p) => p && pagarProveedor({ proveedorId: p.id }))
  const p = Datos.get(op.proveedorId)
  const compras = Datos.lista('compra').filter((c) => c.proveedorId === p.id)
  const k = Calculo.cuentaProveedor(compras, Datos.lista('gasto').filter((g) => g.proveedorId === p.id))
  const fila = op.compraId ? k.filas.find((f) => f.compra.id === op.compraId) : null
  const falta = fila ? fila.saldo : k.debe
  let medio = 'efectivo'
  const monto = entradaPlata(falta > 0 ? falta : '', { clase: 'num plata-grande' })
  const fecha = entradaFecha(hoyISO())
  const notas = entrada('', { placeholder: 'Opcional' })
  const chNumero = entrada('', { inputmode: 'numeric', placeholder: 'Número' })
  const chBanco = entrada('', { placeholder: 'Banco' })
  const chFecha = entradaFecha(hoyISO())
  const zonaCheque = el('div', { hidden: true }, el('div', { clase: 'dos' }, campo('Banco', chBanco), campo('Número', chNumero)), campo('Fecha de pago del cheque', chFecha))
  const h = hoja({
    titulo: 'Pagarle a ' + p.nombre,
    foco: false,
    cuerpo: [
      el('div', { clase: 'tarjeta' },
        el('div', { clase: 'fila total' }, el('b', {}, fila ? 'Falta de esta compra' : 'Le debés en total'), el('b', { clase: 'num' }, plata(falta))),
        !fila && k.deudas.length ? el('p', { clase: 'sub' }, 'El pago va cancelando lo más viejo primero: ' + k.deudas.map((d) => fechaCorta(d.compra.fecha) + ' ' + plata(d.saldo)).join(' · ')) : null,
        p.alias ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Alias'), el('button', { clase: 'btn chico', onclick: () => copiarTexto(p.alias) }, icono('copiar'), p.alias)) : null),
      el('div', { clase: 'campo' }, '¿Cómo le pagás?', botonesElegir([{ valor: 'efectivo', texto: 'Efectivo', icono: 'plata' }, { valor: 'transferencia', texto: 'Transferencia', icono: 'cuenta' }, { valor: 'cheque', texto: 'Cheque', icono: 'cheque' }], medio, (v) => { medio = v; zonaCheque.hidden = v !== 'cheque' })),
      campo('Monto', monto), zonaCheque,
      el('div', { clase: 'dos' }, campo('Fecha', fecha), campo('Notas', notas))],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: () => {
      const m = monto.valor()
      if (!(m > 0)) { toast('Poné cuánto le pagás.', 'mal'); return }
      const g = { tipo: 'gasto', fecha: fecha.value || hoyISO(), categoria: 'Mercadería', concepto: 'Pago a ' + p.nombre, monto: Calculo.r2(m), medio, proveedorId: p.id, pagoProveedor: true, compraId: op.compraId || null, notas: notas.value.trim() }
      if (medio === 'cheque') g.cheque = { numero: chNumero.value.trim(), banco: chBanco.value.trim(), fechaPago: chFecha.value }
      Datos.guardar(g)
      h.cerrar()
      toast('Pago a ' + p.nombre + ' de ' + plata(m) + ' anotado', 'ok')
    } }, 'Guardar')]
  })
}

// --- pedido por WhatsApp -----------------------------------------------------------------------
function pedidoProveedor (p) {
  const st = Calculo.stock(Datos.lista('movstock'), Datos.lista('trabajo'))
  const prods = productosDe(p).filter((x) => x.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const sugerido = (x) => { const n = st.get(x.id) || 0; return Number(x.minimo) > 0 && Calculo.estadoStock(n, x.minimo) !== 'ok' ? Math.max(1, Math.ceil(Number(x.minimo) * 2 - n)) : 0 }
  const cants = new Map(prods.map((x) => [x.id, sugerido(x)]))
  const area = areaTexto('', { rows: 9 })
  const armar = () => {
    const lineas = ['Hola' + (p.contacto ? ' ' + primerNombre(p.contacto) : '') + ', te escribo de *' + Datos.config().negocio + '*. Te hago este pedido:', '']
    for (const x of prods) { const c = cants.get(x.id); if (c > 0) lineas.push('• ' + fmtCant(c) + ' × ' + x.nombre + (x.codigo ? ' (' + x.codigo + ')' : '')) }
    lineas.push('', '¡Gracias!')
    area.value = lineas.join('\n')
  }
  const lista = el('div', { clase: 'tarjeta sin-relleno lista' }, prods.map((x) => {
    const c = entrada(cants.get(x.id) || '', { inputmode: 'decimal', clase: 'num chico-num', placeholder: '0', estilo: { width: '80px' } })
    c.addEventListener('input', () => { cants.set(x.id, aNumero(c.value) || 0); armar() })
    return el('div', { clase: 'item' }, el('div', { clase: 'cuerpo' }, el('b', {}, x.nombre), el('span', { clase: 'sub' }, 'Hay ' + fmtCant(st.get(x.id) || 0) + (Number(x.minimo) > 0 ? ' · mín. ' + fmtCant(x.minimo) : ''))), c)
  }))
  armar()
  const h = hoja({
    titulo: 'Pedido a ' + p.nombre,
    completa: true,
    cuerpo: [prods.length ? [el('p', { clase: 'sub' }, 'Ya puse lo que llegó al mínimo (para llegar al doble). Cambiá las cantidades si querés.'), lista] : el('p', { clase: 'sub' }, 'Este proveedor no tiene productos cargados: escribí el pedido acá abajo.'),
      el('h3', {}, 'Mensaje'), area],
    pie: [el('button', { clase: 'btn', onclick: () => copiarTexto(area.value) }, icono('copiar'), 'Copiar'),
      el('button', { clase: 'btn primario', onclick: () => { if (p.telefono) abrirWhatsApp(p.telefono, area.value); else window.open('https://wa.me/?text=' + encodeURIComponent(area.value), '_blank', 'noopener'); h.cerrar() } }, icono('whatsapp'), p.telefono ? 'Mandar por WhatsApp' : 'WhatsApp')]
  })
}
