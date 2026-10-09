'use strict'
// LAS CUENTAS DE MB SERVICIOS (sin pantalla ni internet, para poder probarlas solas)
//
//   - Precio de venta desde el costo y el porcentaje (y al reves).
//   - Total de un trabajo: materiales + mano de obra + recargo por urgencia - descuento.
//   - Cuenta de cada cliente: que trabajos debe, cuanto, y desde cuando vence.
//     Los pagos que se hicieron para un trabajo van a ese trabajo; los pagos "a
//     cuenta" van pagando lo mas viejo primero.
//   - Stock: lo que entro (compras y ajustes) menos lo que salio en trabajos terminados.
//   - Caja del dia y resumen del mes.
//
// La plata va en pesos (con centavos si hace falta). Las fechas sin hora van
// como 'AAAA-MM-DD' en hora de Argentina (la de la compu o el celular).

;(function (raiz) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

  // --- fechas -------------------------------------------------------------------------------
  const dosDig = (n) => String(n).padStart(2, '0')
  function diaISO (d) {
    d = d instanceof Date ? d : new Date(d)
    return d.getFullYear() + '-' + dosDig(d.getMonth() + 1) + '-' + dosDig(d.getDate())
  }
  const hoyISO = () => diaISO(new Date())
  function sumarDias (dia, n) {
    const [a, m, d] = String(dia).slice(0, 10).split('-').map(Number)
    return diaISO(new Date(a, m - 1, d + n))
  }
  // Dias de 'desde' a 'hasta' (fechas AAAA-MM-DD). Positivo si 'hasta' es despues.
  function diasEntre (desde, hasta) {
    const f = (x) => { const [a, m, d] = String(x).slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d) }
    return Math.round((f(hasta) - f(desde)) / 86400000)
  }
  // El dia (AAAA-MM-DD) de algo que puede venir con hora (ISO) o sin hora.
  const diaDe = (x) => (!x ? '' : /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : diaISO(new Date(x)))

  // --- formatos -----------------------------------------------------------------------------
  const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
  const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  function fmtPlata (n) {
    n = r2(n)
    const s = Number.isInteger(n) ? nf0.format(Math.abs(n)) : nf2.format(Math.abs(n))
    return (n < 0 ? '-$ ' : '$ ') + s
  }
  const fmtCant = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(n) || 0)
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  function fechaCorta (x) {
    if (!x) return ''
    const d = /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(x + 'T12:00:00') : new Date(x)
    const anio = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + anio
  }
  const horaCorta = (x) => { const d = new Date(x); return dosDig(d.getHours()) + ':' + dosDig(d.getMinutes()) }

  // --- precios ------------------------------------------------------------------------------
  // Redondea hacia arriba al 'paso' (10 -> $1.234 queda $1.240). Paso 0 o 1: sin redondeo de pesos.
  function redondearPrecio (n, paso) {
    paso = Number(paso) || 0
    if (paso <= 1) return paso === 1 ? Math.round(n) : r2(n)
    return Math.ceil(r2(n) / paso - 1e-9) * paso
  }
  const precioDesdeCosto = (costo, porcentaje, paso) => redondearPrecio((Number(costo) || 0) * (1 + (Number(porcentaje) || 0) / 100), paso)
  function porcentajeDesdePrecio (costo, precio) {
    costo = Number(costo) || 0
    if (costo <= 0) return null
    return Math.round(((Number(precio) || 0) / costo - 1) * 1000) / 10
  }
  // El precio de un producto: si tiene precio fijo, ese; si no, costo + porcentaje.
  const precioProducto = (p, paso) => (p.precioFijo ? r2(p.precio) : precioDesdeCosto(p.costo, p.porcentaje, paso))

  // --- trabajos -----------------------------------------------------------------------------
  // clase: 'trabajo' | 'presupuesto' | 'venta' (la ficha siempre es tipo 'trabajo'). estado: 'pendiente' | 'en_curso' | 'terminado' | 'cancelado'.
  function totalesTrabajo (t) {
    let materiales = 0
    let costoMateriales = 0
    for (const it of t.items || []) {
      const c = Number(it.cantidad) || 0
      materiales += c * (Number(it.precio) || 0)
      costoMateriales += c * (Number(it.costo) || 0)
    }
    materiales = r2(materiales)
    costoMateriales = r2(costoMateriales)
    const manoObra = r2(t.manoObra)
    const subtotal = r2(materiales + manoObra)
    const recargo = t.urgencia ? r2(subtotal * (Number(t.recargoPct) || 0) / 100) : 0
    const descuento = Math.min(r2(t.descuento), r2(subtotal + recargo))
    const total = r2(subtotal + recargo - descuento)
    return { materiales, costoMateriales, manoObra, subtotal, recargo, descuento, total, ganancia: r2(total - costoMateriales) }
  }
  // Lo que ya se le puede cobrar al cliente (cuenta para la deuda y para el stock).
  const esCobrable = (t) => !!t && !t.borrado && t.clase !== 'presupuesto' && t.estado === 'terminado'
  const diaTrabajo = (t) => diaDe(t.terminado || t.fecha || t.creado)

  // Garantia: desde el dia que se termino, tantos dias.
  function garantia (t, hoy) {
    if (!esCobrable(t) || !(Number(t.garantiaDias) > 0)) return null
    const hasta = sumarDias(diaTrabajo(t), Number(t.garantiaDias))
    const quedan = diasEntre(hoy || hoyISO(), hasta)
    return { hasta, quedan, vigente: quedan >= 0 }
  }

  // --- pagos y cuentas ----------------------------------------------------------------------
  // Un pago con cheque rechazado o anulado no cuenta.
  const pagoValido = (p) => !!p && !p.borrado && !p.anulado && !(p.medio === 'cheque' && p.cheque && p.cheque.estado === 'rechazado')

  // La cuenta de UN cliente.
  //   deudas: trabajos terminados con saldo (lo mas viejo primero), con su vencimiento.
  //   senias: lo pagado de trabajos que todavia no se terminaron.
  //   aFavor: plata que pago de mas (queda para lo proximo).
  function cuentaCliente (trabajos, pagos) {
    const validos = pagos.filter(pagoValido)
    const porTrabajo = new Map()
    let pozo = 0
    const cobrables = trabajos.filter(esCobrable).sort((a, b) => diaTrabajo(a).localeCompare(diaTrabajo(b)) || (a.numero || 0) - (b.numero || 0))
    const vivos = new Map(trabajos.filter((t) => !t.borrado && t.estado !== 'cancelado').map((t) => [t.id, t]))
    const senias = []
    for (const p of validos) {
      const t = p.trabajoId ? vivos.get(p.trabajoId) : null
      if (!t) { pozo += Number(p.monto) || 0; continue }
      porTrabajo.set(t.id, (porTrabajo.get(t.id) || 0) + (Number(p.monto) || 0))
    }
    for (const [id, monto] of porTrabajo) {
      const t = vivos.get(id)
      if (!esCobrable(t)) senias.push({ trabajo: t, pagado: r2(monto) })
    }
    const filas = cobrables.map((t) => {
      const total = totalesTrabajo(t).total
      const directo = porTrabajo.get(t.id) || 0
      const pagado = Math.min(directo, total)
      pozo += directo - pagado
      return { trabajo: t, total, pagado }
    })
    for (const f of filas) {
      const falta = f.total - f.pagado
      if (falta > 0 && pozo > 0) { const usa = Math.min(falta, pozo); f.pagado += usa; pozo -= usa }
      f.pagado = r2(f.pagado)
      f.saldo = r2(f.total - f.pagado)
      f.vence = f.trabajo.vence || null
    }
    const deudas = filas.filter((f) => f.saldo > 0.009)
    const debe = r2(deudas.reduce((s, f) => s + f.saldo, 0))
    const aFavor = r2(pozo)
    return { filas, deudas, debe, aFavor, saldo: r2(debe - aFavor), senias }
  }

  // Cuentas de todos los clientes: Map clienteId -> cuentaCliente.
  function cuentas (trabajos, pagos) {
    const tPor = new Map()
    const pPor = new Map()
    for (const t of trabajos) if (t.clienteId) { if (!tPor.has(t.clienteId)) tPor.set(t.clienteId, []); tPor.get(t.clienteId).push(t) }
    for (const p of pagos) if (p.clienteId) { if (!pPor.has(p.clienteId)) pPor.set(p.clienteId, []); pPor.get(p.clienteId).push(p) }
    const out = new Map()
    for (const id of new Set([...tPor.keys(), ...pPor.keys()])) out.set(id, cuentaCliente(tPor.get(id) || [], pPor.get(id) || []))
    return out
  }

  // Lo que le falta pagar a un trabajo (contando pagos a cuenta).
  function saldoTrabajo (t, trabajosDelCliente, pagosDelCliente) {
    const c = cuentaCliente(trabajosDelCliente, pagosDelCliente)
    const f = c.filas.find((x) => x.trabajo.id === t.id)
    if (f) return { total: f.total, pagado: f.pagado, saldo: f.saldo }
    const total = totalesTrabajo(t).total
    const s = c.senias.find((x) => x.trabajo.id === t.id)
    const pagado = s ? s.pagado : 0
    return { total, pagado, saldo: r2(total - pagado) }
  }

  // En que anda un vencimiento: 'vencido' | 'hoy' | 'pronto' (3 dias o menos) | 'ok' | 'sin' (sin fecha).
  function estadoVence (vence, hoy) {
    if (!vence) return { clase: 'sin', dias: null, texto: 'Sin fecha de pago' }
    const dias = diasEntre(hoy || hoyISO(), vence)
    if (dias < 0) return { clase: 'vencido', dias, texto: 'Vencido hace ' + (-dias) + (dias === -1 ? ' día' : ' días') }
    if (dias === 0) return { clase: 'hoy', dias, texto: 'Vence hoy' }
    if (dias <= 3) return { clase: 'pronto', dias, texto: 'Vence en ' + dias + (dias === 1 ? ' día' : ' días') }
    return { clase: 'ok', dias, texto: 'Vence el ' + fechaCorta(vence) }
  }

  // --- stock --------------------------------------------------------------------------------
  // movimientos: { productoId, cantidad (+ entra / - sale), tipo: 'inicial'|'compra'|'ajuste' }.
  // Lo usado en trabajos terminados se descuenta solo (no hace falta anotarlo).
  function stock (movimientos, trabajos) {
    const m = new Map()
    const sumar = (id, n) => m.set(id, r2((m.get(id) || 0) + n))
    for (const x of movimientos) if (!x.borrado && x.productoId) sumar(x.productoId, Number(x.cantidad) || 0)
    for (const t of trabajos) if (esCobrable(t)) for (const it of t.items || []) if (it.productoId) sumar(it.productoId, -(Number(it.cantidad) || 0))
    return m
  }
  // 'falta' (no queda), 'bajo' (en el minimo o menos), 'ok'.
  function estadoStock (cantidad, minimo) {
    if (cantidad <= 0) return 'falta'
    if (Number(minimo) > 0 && cantidad <= Number(minimo)) return 'bajo'
    return 'ok'
  }

  // --- caja ---------------------------------------------------------------------------------
  const MEDIOS = ['efectivo', 'transferencia', 'cheque']
  // Lo que entro y salio un dia (o entre dos dias), por medio de pago.
  function caja (pagos, gastos, desde, hasta) {
    hasta = hasta || desde
    const dentro = (x) => { const d = diaDe(x); return d >= desde && d <= hasta }
    const entro = { efectivo: 0, transferencia: 0, cheque: 0 }
    const salio = { efectivo: 0, transferencia: 0, cheque: 0 }
    const ps = pagos.filter((p) => pagoValido(p) && dentro(p.fecha))
    const gs = gastos.filter((g) => !g.borrado && dentro(g.fecha))
    for (const p of ps) entro[MEDIOS.includes(p.medio) ? p.medio : 'efectivo'] += Number(p.monto) || 0
    for (const g of gs) salio[MEDIOS.includes(g.medio) ? g.medio : 'efectivo'] += Number(g.monto) || 0
    for (const k of MEDIOS) { entro[k] = r2(entro[k]); salio[k] = r2(salio[k]) }
    const totalEntro = r2(entro.efectivo + entro.transferencia + entro.cheque)
    const totalSalio = r2(salio.efectivo + salio.transferencia + salio.cheque)
    return { entro, salio, totalEntro, totalSalio, neto: r2(totalEntro - totalSalio), efectivoNeto: r2(entro.efectivo - salio.efectivo), pagos: ps, gastos: gs }
  }

  // Resumen entre dos dias: lo que se hizo (vendido), lo que se cobro, gastos y ganancia.
  function resumen (trabajos, pagos, gastos, desde, hasta) {
    let vendido = 0; let costo = 0; let manoObra = 0; let cantidad = 0
    for (const t of trabajos) {
      if (!esCobrable(t)) continue
      const d = diaTrabajo(t)
      if (d < desde || d > hasta) continue
      const x = totalesTrabajo(t)
      vendido += x.total; costo += x.costoMateriales; manoObra += x.manoObra; cantidad++
    }
    const c = caja(pagos, gastos, desde, hasta)
    vendido = r2(vendido); costo = r2(costo)
    return { cantidad, vendido, costoMateriales: costo, manoObra: r2(manoObra), cobrado: c.totalEntro, gastos: c.totalSalio, ganancia: r2(vendido - costo - c.totalSalio) }
  }

  // --- WhatsApp -----------------------------------------------------------------------------
  // "0351 15-555-1234" o "351 5551234" -> "5493515551234". Se carga con codigo de area.
  function telefonoWA (tel) {
    let d = String(tel || '').replace(/\D/g, '')
    if (!d) return ''
    if (d.startsWith('00')) d = d.slice(2)
    if (d.startsWith('54')) { d = d.slice(2); if (d.startsWith('9')) d = d.slice(1) }
    if (d.startsWith('0')) d = d.slice(1)
    // Celular con 15 despues del codigo de area (2, 3 o 4 cifras): se saca el 15.
    for (const largo of [2, 3, 4]) {
      if (d.length === 12 && d.substr(largo, 2) === '15') { d = d.slice(0, largo) + d.slice(largo + 2); break }
    }
    if (d.length !== 10) return d.length >= 8 ? '549' + d : ''
    return '549' + d
  }

  // --- buscar -------------------------------------------------------------------------------
  const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  // Todas las palabras buscadas tienen que estar en el texto.
  function coincide (texto, busqueda) {
    const t = sinTildes(texto)
    return sinTildes(busqueda).split(/\s+/).filter(Boolean).every((p) => t.includes(p))
  }

  const Calculo = {
    r2, diaISO, hoyISO, sumarDias, diasEntre, diaDe, fmtPlata, fmtCant, fechaCorta, horaCorta,
    redondearPrecio, precioDesdeCosto, porcentajeDesdePrecio, precioProducto,
    totalesTrabajo, esCobrable, diaTrabajo, garantia,
    pagoValido, cuentaCliente, cuentas, saldoTrabajo, estadoVence,
    stock, estadoStock, MEDIOS, caja, resumen, telefonoWA, sinTildes, coincide
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = Calculo
  else raiz.Calculo = Calculo
})(typeof window !== 'undefined' ? window : globalThis)
