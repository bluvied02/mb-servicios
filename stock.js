'use strict'
// STOCK
//
// Cada producto tiene costo y porcentaje de ganancia: el precio sale solo
// (redondeado para arriba segun Ajustes). Si se escribe un precio a mano,
// queda "precio fijo" y no cambia aunque cambie el costo.
// Cada producto tiene su minimo: al llegar ahi aparece en "Para reponer".
// El stock es lo que entro (compras, ajustes) menos lo usado en trabajos
// terminados, asi que no hay que descontar nada a mano.

const UNIDADES = ['unidad', 'par', 'juego', 'metro', 'caja']

VISTAS.stock = function (main) {
  const conf = Datos.config()
  const filtro = APP.filtros.stock || 'todos'
  const st = Calculo.stock(Datos.lista('movstock'), Datos.lista('trabajo'))
  const todos = Datos.lista('producto').filter((p) => p.activo !== false)
  const estado = (p) => Calculo.estadoStock(st.get(p.id) || 0, p.minimo)
  const reponer = todos.filter((p) => Number(p.minimo) > 0 && estado(p) !== 'ok')
  const categorias = [...new Set(todos.map((p) => p.categoria).filter(Boolean))].sort()
  const valor = todos.reduce((s, p) => s + Math.max(0, st.get(p.id) || 0) * (Number(p.costo) || 0), 0)
  const buscar = el('input', { type: 'search', placeholder: 'Nombre, código o marca', valor: APP.filtros.stockBusca || '' })
  const caja = el('div', {})
  const pintarLista = () => {
    const q = buscar.value.trim()
    APP.filtros.stockBusca = q
    let lista = filtro === 'reponer' ? reponer : filtro === 'inactivos' ? Datos.lista('producto').filter((p) => p.activo === false) : filtro === 'todos' ? todos : todos.filter((p) => p.categoria === filtro)
    if (q) lista = lista.filter((p) => coincide([p.nombre, p.codigo, p.marca, p.categoria, p.proveedor, (proveedorDeProducto(p) || {}).nombre].join(' '), q))
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
    poner(caja, lista.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, lista.slice(0, 500).map((p) => {
      const n = st.get(p.id) || 0
      const e = estado(p)
      return el('button', { clase: 'item', onclick: () => verProducto(p.id) },
        el('div', { clase: 'cuerpo' }, el('b', {}, p.nombre), el('span', { clase: 'sub' }, [p.codigo, p.marca, p.ubicacion].filter(Boolean).join(' · ') || p.categoria || '')),
        el('div', { clase: 'fin pila' }, el('b', { clase: 'num' }, plata(Calculo.precioProducto(p, conf.redondeo))),
          chip(fmtCant(n) + (Number(p.minimo) > 0 ? ' / mín. ' + fmtCant(p.minimo) : ''), e === 'falta' ? 'mal' : e === 'bajo' ? 'alerta' : '')))
    })) : vacio(filtro === 'reponer' ? 'No hay nada para reponer.' : 'No hay productos.', 'stock', filtro === 'reponer' ? null : el('button', { clase: 'btn primario', onclick: () => editarProducto({ nombre: q }) }, icono('sumar'), 'Producto nuevo')))
  }
  buscar.addEventListener('input', pintarLista)
  poner(main,
    cabecera('Stock', null,
      el('button', { clase: 'btn', onclick: () => aumentarCostos() }, icono('sumar'), 'Aumento'),
      el('button', { clase: 'btn', onclick: () => entradaMercaderia() }, icono('stock'), 'Entró mercadería'),
      el('button', { clase: 'btn primario', onclick: () => editarProducto(null) }, icono('sumar'), 'Producto')),
    el('div', { clase: 'kpis' },
      kpi('Productos', String(todos.length), cuantos(categorias.length, 'categoría', 'categorías')),
      kpi('Para reponer', String(reponer.length), reponer.filter((p) => estado(p) === 'falta').length + ' sin stock', reponer.length ? 'alerta' : '', () => irA('stock', 'reponer')),
      kpi('Stock al costo', plata(valor), 'Lo que tenés invertido')),
    el('div', { clase: 'filtros' }, [['todos', 'Todos'], ['reponer', 'Para reponer (' + reponer.length + ')']].concat(categorias.map((c) => [c, c])).concat([['inactivos', 'Dados de baja']]).map(([id, n]) =>
      el('button', { clase: 'filtro' + (filtro === id ? ' activo' : ''), onclick: () => irA('stock', id) }, n))),
    filtro === 'reponer' && reponer.length ? el('div', { clase: 'chips', estilo: { marginBottom: '10px' } }, botonesPedido(reponer, st)) : null,
    el('div', { clase: 'buscador' }, icono('buscar'), buscar),
    caja)
  pintarLista()
}

// Un boton de pedido por cada proveedor que tiene algo para reponer.
function botonesPedido (reponer, st) {
  const provs = new Map()
  let sinProv = 0
  for (const p of reponer) { const x = proveedorDeProducto(p); if (x) provs.set(x.id, x); else sinProv++ }
  return [...provs.values()].map((x) => el('button', { clase: 'btn chico', onclick: () => pedidoProveedor(x) }, icono('whatsapp'), 'Pedido a ' + x.nombre))
    .concat(sinProv ? [el('button', { clase: 'btn chico', onclick: () => listaPedido(reponer.filter((p) => !proveedorDeProducto(p)), st) }, icono('whatsapp'), 'Pedido de ' + cuantos(sinProv, 'producto', 'productos') + ' sin proveedor')] : [])
}
function listaPedido (reponer, st) {
  const lineas = ['*Pedido ' + Datos.config().negocio + '*', '']
  for (const p of reponer) {
    const falta = Math.max(1, Math.ceil((Number(p.minimo) || 0) * 2 - (st.get(p.id) || 0)))
    lineas.push('• ' + falta + ' × ' + p.nombre + (p.codigo ? ' (' + p.codigo + ')' : ''))
  }
  const area = areaTexto(lineas.join('\n'), { rows: 12 })
  const h = hoja({
    titulo: 'Pedido',
    cuerpo: [el('p', { clase: 'sub' }, 'Estos productos no tienen proveedor. Elegíselo en cada producto y el pedido se arma solo por proveedor.'), area],
    pie: [el('button', { clase: 'btn', onclick: () => copiarTexto(area.value) }, icono('copiar'), 'Copiar'),
      el('button', { clase: 'btn primario', onclick: () => { window.open('https://wa.me/?text=' + encodeURIComponent(area.value), '_blank', 'noopener'); h.cerrar() } }, icono('whatsapp'), 'WhatsApp')]
  })
}

// --- ver un producto ----------------------------------------------------------------------------
function verProducto (id) {
  const cuerpo = el('div', {})
  let h = null
  const pintarTodo = () => {
    const p = Datos.get(id)
    if (!p) { h.cerrar(); return }
    const conf = Datos.config()
    const trabajos = Datos.lista('trabajo')
    const st = Calculo.stock(Datos.lista('movstock'), trabajos)
    const n = st.get(p.id) || 0
    const precio = Calculo.precioProducto(p, conf.redondeo)
    const e = Calculo.estadoStock(n, p.minimo)
    // Lo que entro y salio, lo mas nuevo arriba.
    const movs = Datos.lista('movstock').filter((m) => m.productoId === p.id).map((m) => ({ fecha: m.fecha || m.creado, texto: m.mov === 'compra' ? 'Entró' + (m.proveedor ? ' de ' + m.proveedor : '') : m.mov === 'inicial' ? 'Stock inicial' : 'Ajuste' + (m.notas ? ': ' + m.notas : ''), cant: m.cantidad }))
    for (const t of trabajos) if (Calculo.esCobrable(t)) for (const it of t.items || []) if (it.productoId === p.id) movs.push({ fecha: t.terminado || t.creado, texto: (t.clase === 'venta' ? 'Venta' : 'Trabajo') + ' #' + t.numero, cant: -it.cantidad, trabajoId: t.id })
    movs.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    poner(cuerpo,
      p.activo === false ? el('div', { clase: 'aviso' }, el('b', {}, 'Dado de baja'), 'No aparece para agregar a trabajos.') : null,
      el('div', { clase: 'dato-grande' },
        el('div', {}, el('div', { clase: 'r' }, 'Hay'), el('div', { clase: 'v ' + (e === 'falta' ? 'rojo' : '') }, fmtCant(n) + ' ' + (p.unidad && p.unidad !== 'unidad' ? p.unidad : ''))),
        el('div', {}, el('div', { clase: 'r' }, 'Mínimo'), el('div', { clase: 'v' }, fmtCant(p.minimo || 0))),
        el('div', {}, el('div', { clase: 'r' }, 'Precio'), el('div', { clase: 'v' }, plata(precio)))),
      e !== 'ok' && Number(p.minimo) > 0 ? el('div', { clase: 'aviso ' + (e === 'falta' ? 'mal' : 'alerta') }, el('b', {}, e === 'falta' ? 'No queda' : 'Llegó al mínimo'), 'Hay que reponer.') : null,
      el('div', { clase: 'tarjeta' },
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Costo'), el('b', { clase: 'num' }, plata(p.costo || 0))),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, p.precioFijo ? 'Precio fijo (ganancia)' : 'Ganancia'), el('b', {}, p.precioFijo ? (Calculo.porcentajeDesdePrecio(p.costo, p.precio) ?? '-') + '%' : (p.porcentaje || 0) + '%')),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Ganás por unidad'), el('b', { clase: 'num verde' }, plata(precio - (Number(p.costo) || 0)))),
        [['Código', p.codigo], ['Marca', p.marca], ['Categoría', p.categoria], ['Proveedor', proveedorDeProducto(p) ? null : p.proveedor], ['Dónde está', p.ubicacion]].filter((x) => x[1]).map(([r, v]) => el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, r), el('b', {}, v)))),
      proveedorDeProducto(p) ? el('button', { clase: 'opcion', estilo: { marginBottom: '12px' }, onclick: () => verProveedor(proveedorDeProducto(p).id) }, icono('camion'), el('span', { clase: 'txt' }, el('span', { clase: 'sub' }, 'Proveedor'), el('b', {}, proveedorDeProducto(p).nombre)), icono('flecha', 'tenue')) : null,
      el('div', { clase: 'acciones-grandes' },
        el('button', { clase: 'btn primario', onclick: () => entradaMercaderia(p) }, icono('sumar'), 'Entró'),
        el('button', { clase: 'btn', onclick: () => ajustarStock(p, n) }, icono('editar'), 'Conté y hay…')),
      el('h3', {}, 'Movimientos'),
      movs.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, movs.slice(0, 60).map((m) => el(m.trabajoId ? 'button' : 'div', { clase: 'item', onclick: m.trabajoId ? () => verTrabajo(m.trabajoId) : null },
        el('div', { clase: 'cuerpo' }, el('b', {}, m.texto), el('span', { clase: 'sub' }, fechaCorta(m.fecha))),
        el('div', { clase: 'fin num ' + (m.cant < 0 ? 'rojo' : 'verde') }, (m.cant > 0 ? '+' : '') + fmtCant(m.cant))))) : el('p', { clase: 'sub' }, 'Sin movimientos.'),
      el('div', { clase: 'chips', estilo: { marginTop: '16px' } },
        el('button', { clase: 'btn chico', onclick: () => editarProducto(p) }, icono('editar'), 'Editar'),
        el('button', { clase: 'btn chico ' + (p.activo === false ? '' : 'peligro'), onclick: () => Datos.guardar(Object.assign({}, p, { activo: p.activo === false })) }, p.activo === false ? 'Volver a dar de alta' : 'Dar de baja')))
  }
  const quitar = Datos.alCambiar(() => { if (!h.cerrado) pintarTodo() })
  h = hoja({ titulo: (Datos.get(id) || {}).nombre || 'Producto', completa: true, cuerpo, alCerrar: quitar })
  pintarTodo()
}

// --- cargar o editar un producto -----------------------------------------------------------------
function editarProducto (base, alGuardar) {
  const conf = Datos.config()
  const p = Object.assign({ porcentaje: conf.margen, unidad: 'unidad', minimo: 0, activo: true }, base || {})
  const nuevo = !p.id
  const categorias = [...new Set(Datos.lista('producto').map((x) => x.categoria).filter(Boolean))]
  const nombre = entrada(p.nombre, { placeholder: 'Ej.: Cilindro Kallay 60 mm' })
  const codigo = entrada(p.codigo, { placeholder: 'Opcional' })
  const marca = entrada(p.marca)
  const categoria = entrada(p.categoria, { list: 'lista-cat', placeholder: 'Ej.: Cilindros, Candados, Llaves vírgenes' })
  let provId = (proveedorDeProducto(p) || {}).id || null
  const proveedor = botonProveedor(provId, (x) => { provId = x ? x.id : null }, { ninguno: true })
  const ubicacion = entrada(p.ubicacion, { placeholder: 'Estante, cajón…' })
  const unidad = selector(UNIDADES, p.unidad)
  const costo = entradaPlata(p.costo)
  const porcentaje = entrada(p.precioFijo ? (Calculo.porcentajeDesdePrecio(p.costo, p.precio) ?? '') : p.porcentaje, { inputmode: 'decimal', clase: 'num' })
  const precio = entradaPlata(Calculo.precioProducto(p, conf.redondeo) || '')
  const minimo = entrada(p.minimo || '', { inputmode: 'decimal', clase: 'num', placeholder: '0' })
  const inicial = entrada('', { inputmode: 'decimal', clase: 'num', placeholder: '0' })
  let fijo = !!p.precioFijo
  const avisoFijo = el('div', {})
  const pintarFijo = () => poner(avisoFijo, fijo ? el('div', { clase: 'aviso info' }, el('b', {}, 'Precio fijo'), 'Escribiste el precio a mano: no cambia aunque cambie el costo. ',
    el('button', { type: 'button', clase: 'btn chico', estilo: { marginTop: '6px' }, onclick: () => { fijo = false; recalcular(); pintarFijo() } }, 'Calcular con el porcentaje')) : el('p', { clase: 'sub', estilo: { margin: '-6px 0 12px' } }, 'El precio sale del costo + el porcentaje, redondeado a $' + conf.redondeo + '.'))
  const recalcular = () => {
    if (fijo) { const pc = Calculo.porcentajeDesdePrecio(costo.valor() || 0, precio.valor() || 0); porcentaje.value = pc == null ? '' : String(pc).replace('.', ','); return }
    precio.value = formatoEntrada(Calculo.precioDesdeCosto(costo.valor() || 0, aNumero(porcentaje.value) || 0, conf.redondeo))
  }
  costo.addEventListener('input', recalcular)
  porcentaje.addEventListener('input', () => { fijo = false; recalcular(); pintarFijo() })
  precio.addEventListener('input', () => { fijo = true; recalcular(); pintarFijo() })
  const guardar = () => {
    if (!nombre.value.trim()) { toast('Poné el nombre.', 'mal'); return }
    Object.assign(p, {
      tipo: 'producto', nombre: nombre.value.trim(), codigo: codigo.value.trim(), marca: marca.value.trim(), categoria: categoria.value.trim(), proveedorId: provId, proveedor: provId ? nombreProveedor(provId) : (proveedorDeProducto(p) ? '' : p.proveedor || ''),
      ubicacion: ubicacion.value.trim(), unidad: unidad.value, costo: costo.valor() || 0, minimo: aNumero(minimo.value) || 0, precioFijo: fijo
    })
    if (fijo) p.precio = precio.valor() || 0
    else { p.porcentaje = aNumero(porcentaje.value) || 0; delete p.precio }
    const fichas = [p]
    const ini = aNumero(inicial.value)
    if (nuevo) { p.id = uuid(); if (ini > 0) fichas.push({ tipo: 'movstock', mov: 'inicial', productoId: p.id, cantidad: ini, fecha: new Date().toISOString() }) }
    const [f] = Datos.guardarVarias(fichas)
    h.cerrar()
    toast('Producto guardado', 'ok')
    if (alGuardar) alGuardar(f)
  }
  const h = hoja({
    titulo: nuevo ? 'Producto nuevo' : 'Editar producto',
    completa: true,
    cuerpo: [
      el('datalist', { id: 'lista-cat' }, categorias.map((c) => el('option', { value: c }))),
      campo('Nombre', nombre),
      el('div', { clase: 'dos' }, campo('Código', codigo), campo('Marca', marca)),
      el('div', { clase: 'dos' }, campo('Categoría', categoria), campo('Se vende por', unidad)),
      el('h3', {}, 'Precio'),
      el('div', { clase: 'tres' }, campo('Costo', costo), campo('Ganancia %', porcentaje), campo('Precio de venta', precio)),
      avisoFijo,
      el('h3', {}, 'Stock'),
      el('div', { clase: 'dos' }, campo('Mínimo', minimo, 'Cuando quede esto o menos, te avisa'), nuevo ? campo('Cuántos hay ahora', inicial) : el('div', {})),
      el('div', { clase: 'campo' }, 'Proveedor', proveedor), campo('Dónde está', ubicacion)
    ],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, 'Guardar')]
  })
  pintarFijo()
  if (!fijo) recalcular()
}
// Los movimientos de stock son fichas 'movstock'; en 'mov' va si fue 'inicial', 'compra' o 'ajuste'.

function ajustarStock (p, hay) {
  const cant = entrada(fmtCant(hay), { inputmode: 'decimal', clase: 'num numero-grande centro' })
  const motivo = entrada('', { placeholder: 'Ej.: conteo, se rompió, se perdió' })
  const h = hoja({
    titulo: 'Conté ' + p.nombre,
    cuerpo: [el('p', { clase: 'tenue' }, 'El sistema dice que hay ' + fmtCant(hay) + '. Poné cuántos contaste de verdad.'), campo('Hay', cant), campo('Motivo', motivo)],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: () => {
      const n = aNumero(cant.value)
      if (!Number.isFinite(n) || n < 0) { toast('Poné un número.', 'mal'); return }
      const dif = Calculo.r2(n - hay)
      if (dif) Datos.guardar({ tipo: 'movstock', mov: 'ajuste', productoId: p.id, cantidad: dif, notas: motivo.value.trim(), fecha: new Date().toISOString() })
      h.cerrar()
      toast(dif ? 'Ajustado (' + (dif > 0 ? '+' : '') + fmtCant(dif) + ')' : 'Estaba bien', 'ok')
    } }, 'Guardar')]
  })
}

// Aumento de costos por porcentaje (cuando el proveedor manda lista nueva).
function aumentarCostos () {
  const conf = Datos.config()
  const ps = Datos.lista('producto').filter((p) => p.activo !== false)
  const cats = [...new Set(ps.map((p) => p.categoria).filter(Boolean))].sort()
  const provs = Datos.lista('proveedor').filter((x) => ps.some((p) => (proveedorDeProducto(p) || {}).id === x.id)).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const cual = selector([{ valor: '', texto: 'Todos los productos' }].concat(cats.map((c) => ({ valor: 'c:' + c, texto: 'Categoría: ' + c }))).concat(provs.map((x) => ({ valor: 'p:' + x.id, texto: 'Proveedor: ' + x.nombre }))), '')
  const pct = entrada('', { inputmode: 'decimal', clase: 'num numero-grande', placeholder: 'Ej.: 10' })
  const aviso = el('p', { clase: 'sub' })
  const elegidos = () => ps.filter((p) => !cual.value || (cual.value.startsWith('c:') ? p.categoria === cual.value.slice(2) : (proveedorDeProducto(p) || {}).id === cual.value.slice(2)))
  const pintarAviso = () => { const n = elegidos().length; aviso.textContent = n + ' productos. Sube el costo y el precio se recalcula solo (los de precio fijo no cambian de precio).' }
  cual.addEventListener('change', pintarAviso)
  const h = hoja({
    titulo: 'Aumento de costos',
    cuerpo: [campo('A qué productos', cual), campo('Aumento %', pct), aviso],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: async () => {
      const k = aNumero(pct.value)
      if (!(k > 0) || k > 500) { toast('Poné el porcentaje.', 'mal'); return }
      const lista = elegidos()
      if (!(await confirmar('Aumentar ' + k + '%', 'Se sube el costo de ' + lista.length + ' productos. Ej.: ' + (lista[0] ? lista[0].nombre + ' pasa de ' + plata(lista[0].costo || 0) + ' a ' + plata(Calculo.r2((lista[0].costo || 0) * (1 + k / 100))) : ''), 'Aumentar'))) return
      Datos.guardarVarias(lista.map((p) => Object.assign({}, p, { costo: Calculo.r2((Number(p.costo) || 0) * (1 + k / 100)) })))
      h.cerrar()
      toast('Listo: ' + lista.length + ' productos con precio nuevo (redondeado a $' + conf.redondeo + ')', 'ok', 5)
    } }, 'Aumentar')]
  })
  pintarAviso()
}
