'use strict'
// CAJA Y GASTOS: lo que entro cada dia por medio de pago, lo que salio, y el
// resumen del mes (lo hecho, lo cobrado, los gastos y lo que quedo).

VISTAS.caja = function (main) {
  const hoy = hoyISO()
  const dia = APP.filtros.cajaDia || hoy
  const pagos = Datos.lista('pago')
  const gastos = Datos.lista('gasto')
  const c = Calculo.caja(pagos, gastos, dia)
  const mes = APP.filtros.cajaMes || hoy.slice(0, 7)
  const [a, m] = mes.split('-').map(Number)
  const finMes = Calculo.diaISO(new Date(a, m, 0))
  const r = Calculo.resumen(Datos.lista('trabajo'), pagos, gastos, mes + '-01', finMes)
  const cambiarDia = (n) => { APP.filtros.cajaDia = sumarDias(dia, n); pintar() }
  const cambiarMes = (n) => { const d = new Date(a, m - 1 + n, 1); APP.filtros.cajaMes = Calculo.diaISO(d).slice(0, 7); pintar() }
  const movs = c.pagos.map((p) => ({ fecha: p.fecha, fila: filaPago(p) }))
    .concat(c.gastos.map((g) => ({ fecha: g.fecha + (g.creado ? g.creado.slice(10) : ''), fila: filaGasto(g) })))
    .sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)))
  const nombreMes = new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  poner(main,
    cabecera('Caja y gastos', null, el('button', { clase: 'btn primario', onclick: () => editarGasto() }, icono('sumar'), 'Gasto')),
    el('div', { clase: 'navegar-dia' },
      el('button', { clase: 'btn-ico', 'aria-label': 'Día anterior', onclick: () => cambiarDia(-1) }, icono('atras')),
      el('b', {}, dia === hoy ? 'Hoy, ' + fechaCorta(dia) : fechaCorta(dia)),
      el('button', { clase: 'btn-ico', 'aria-label': 'Día siguiente', disabled: dia >= hoy ? true : null, onclick: () => cambiarDia(1) }, icono('flecha'))),
    el('div', { clase: 'kpis' },
      kpi('Efectivo', plata(c.entro.efectivo), c.salio.efectivo ? 'Gastos en efectivo ' + plata(c.salio.efectivo) : ''),
      kpi('Transferencias', plata(c.entro.transferencia), ''),
      kpi('Cheques', plata(c.entro.cheque), 'Recibidos'),
      kpi('Gastos', plata(c.totalSalio), '', c.totalSalio ? 'alerta' : '')),
    el('div', { clase: 'tarjeta' },
      el('div', { clase: 'fila' }, el('span', {}, 'Entró'), el('b', { clase: 'num' }, plata(c.totalEntro))),
      el('div', { clase: 'fila' }, el('span', {}, 'Salió'), el('b', { clase: 'num' }, '-' + plata(c.totalSalio))),
      el('div', { clase: 'fila total' }, el('b', {}, 'Quedó'), el('b', { clase: 'num' }, plata(c.neto))),
      el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Efectivo que tendría que haber de hoy'), el('b', { clase: 'num' }, plata(c.efectivoNeto)))),
    movs.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, movs.map((x) => x.fila)) : vacio('No hubo movimientos este día.', 'caja'),
    el('div', { clase: 'tarjeta', estilo: { marginTop: '18px' } },
      el('div', { clase: 'tarjeta-cab' },
        el('button', { clase: 'btn-ico', 'aria-label': 'Mes anterior', onclick: () => cambiarMes(-1) }, icono('atras')),
        el('h2', { estilo: { textTransform: 'capitalize' } }, nombreMes),
        el('button', { clase: 'btn-ico', 'aria-label': 'Mes siguiente', disabled: mes >= hoy.slice(0, 7) ? true : null, onclick: () => cambiarMes(1) }, icono('flecha'))),
      el('div', { clase: 'fila' }, el('span', {}, 'Trabajos y ventas terminados'), el('b', {}, String(r.cantidad))),
      el('div', { clase: 'fila' }, el('span', {}, 'Total hecho'), el('b', { clase: 'num' }, plata(r.vendido))),
      el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, '  de eso, mano de obra'), el('span', { clase: 'num' }, plata(r.manoObra))),
      el('div', { clase: 'fila' }, el('span', {}, 'Costo de los materiales'), el('span', { clase: 'num' }, '-' + plata(r.costoMateriales))),
      el('div', { clase: 'fila' }, el('span', {}, 'Gastos'), el('span', { clase: 'num' }, '-' + plata(r.gastos))),
      el('div', { clase: 'fila total' }, el('b', {}, 'Ganancia'), el('b', { clase: 'num ' + (r.ganancia >= 0 ? 'verde' : 'rojo') }, plata(r.ganancia))),
      el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Cobrado en el mes'), el('span', { clase: 'num' }, plata(r.cobrado))),
      el('p', { clase: 'sub', estilo: { margin: '8px 0 0' } }, 'La ganancia cuenta lo hecho en el mes aunque esté fiado. Los gastos de mercadería ya incluyen lo que compraste para stock, así que es aproximada.')))
}

const MEDIO_GASTO = { efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque' }
function filaGasto (g) {
  const prov = g.proveedorId ? nombreProveedor(g.proveedorId) : ''
  return el('button', { clase: 'item', onclick: () => editarGasto(g) },
    el('div', { clase: 'ico-lista gasto' }, icono(g.proveedorId ? 'camion' : 'gasto')),
    el('div', { clase: 'cuerpo' }, el('b', {}, g.concepto || g.categoria || 'Gasto'),
      el('span', { clase: 'sub' }, [fechaCorta(g.fecha), g.pagoProveedor ? 'Pago a ' + prov : prov, g.pagoProveedor ? null : g.categoria, MEDIO_GASTO[g.medio] || 'Efectivo'].filter(Boolean).join(' · '))),
    el('div', { clase: 'fin num rojo' }, el('b', {}, '-' + plata(g.monto))))
}

function editarGasto (base) {
  const g = Object.assign({ fecha: hoyISO(), medio: 'efectivo', categoria: 'Combustible' }, base || {})
  const nuevo = !g.id
  let provId = g.proveedorId || null
  const categoria = selector(CATEGORIAS_GASTO, g.categoria)
  const concepto = entrada(g.concepto, { placeholder: 'Ej.: nafta, mecha, alquiler de octubre' })
  const monto = entradaPlata(g.monto, { clase: 'num plata-grande' })
  const fecha = entradaFecha(g.fecha)
  const medio = botonesElegir([{ valor: 'efectivo', texto: 'Efectivo' }, { valor: 'transferencia', texto: 'Transferencia' }, { valor: 'cheque', texto: 'Cheque' }], g.medio)
  // Si es para un proveedor: puede ser un gasto suelto o un pago de lo que se le debe.
  const esPago = casilla('Es un pago de lo que le debo', !!g.pagoProveedor)
  const zonaPago = el('div', {})
  const pintarPago = () => {
    if (!provId || g.compraId) return limpiar(zonaPago)
    const k = Calculo.cuentaProveedor(Datos.lista('compra').filter((c) => c.proveedorId === provId), Datos.lista('gasto').filter((x) => x.proveedorId === provId && x.id !== g.id))
    poner(zonaPago, k.debe > 0 || g.pagoProveedor ? [esPago, el('p', { clase: 'sub', estilo: { marginTop: '-6px' } }, 'Le debés ' + plata(k.debe) + '. Si lo tildás, el pago baja esa deuda.')] : null)
  }
  const prov = botonProveedor(provId, (x) => { provId = x ? x.id : null; pintarPago() }, { ninguno: true })
  const h = hoja({
    titulo: nuevo ? 'Gasto' : 'Editar gasto',
    cuerpo: [campo('Monto', monto), el('div', { clase: 'dos' }, campo('Qué', categoria), campo('Fecha', fecha)), campo('Detalle', concepto), el('div', { clase: 'campo' }, 'Cómo se pagó', medio),
      el('div', { clase: 'campo' }, 'Proveedor (opcional)', prov), zonaPago,
      g.compraId ? el('p', { clase: 'sub' }, 'Es el pago de una compra. ', el('button', { clase: 'btn chico', onclick: () => verCompra(g.compraId) }, 'Ver la compra')) : null,
      nuevo ? null : el('button', { clase: 'btn peligro chico', onclick: async () => { if (await confirmar('Borrar gasto', '¿Borrarlo?', 'Borrar', true)) { Datos.borrar(g.id); h.cerrar() } } }, icono('basura'), 'Borrar gasto')],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: () => {
      const m = monto.valor()
      if (!(m > 0)) { toast('Poné el monto.', 'mal'); return }
      const x = Object.assign({}, g, { tipo: 'gasto', monto: Calculo.r2(m), categoria: categoria.value, concepto: concepto.value.trim(), fecha: fecha.value || hoyISO(), medio: medio.valor(), proveedorId: provId })
      x.pagoProveedor = !!provId && (g.compraId ? true : (zonaPago.contains(esPago) && esPago.input.checked))
      if (!x.pagoProveedor) delete x.pagoProveedor
      if (!provId) delete x.compraId
      Datos.guardar(x)
      h.cerrar()
      toast('Gasto anotado', 'ok')
    } }, 'Guardar')]
  })
  pintarPago()
}
