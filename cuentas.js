'use strict'
// CUENTAS Y FIADO
//
// Cada pago es una ficha: efectivo, transferencia o cheque (con su numero,
// banco y fecha para cobrarlo). "Fiado" no es un pago: el trabajo queda
// debiendo y se le pone la fecha en que el cliente prometio pagar. Si llega
// la fecha y no pago, aparece como vencido en Inicio y aca, con el boton
// para mandarle el recordatorio por WhatsApp.

const MEDIOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque' }
const ICONO_MEDIO = { efectivo: 'plata', transferencia: 'cuenta', cheque: 'cheque' }
const ESTADO_CHEQUE = { cartera: 'Para depositar', depositado: 'Depositado', rechazado: 'Rechazado' }

VISTAS.cuentas = function (main) {
  const hoy = hoyISO()
  const filtro = APP.filtros.cuentas || 'deben'
  const trabajos = Datos.lista('trabajo')
  const pagos = Datos.lista('pago')
  const cs = Calculo.cuentas(trabajos, pagos)
  const filas = []
  let total = 0; let vencido = 0
  for (const [id, k] of cs) {
    if (!(k.debe > 0)) continue
    const c = Datos.get(id)
    if (!c) continue
    const estados = k.deudas.map((d) => Calculo.estadoVence(d.vence, hoy))
    const peor = estados.reduce((a, e) => (e.dias != null && (a == null || e.dias < a) ? e.dias : a), null)
    const venc = k.deudas.filter((d, i) => estados[i].clase === 'vencido').reduce((s, d) => s + d.saldo, 0)
    total += k.debe; vencido += venc
    filas.push({ c, k, peor, venc, hayHoy: estados.some((e) => e.clase === 'hoy' || e.clase === 'pronto') })
  }
  const cheques = pagos.filter((p) => p.medio === 'cheque' && !p.anulado && p.cheque)
  const enCartera = cheques.filter((p) => p.cheque.estado === 'cartera')
  const grupos = {
    vencidos: filas.filter((f) => f.venc > 0),
    hoy: filas.filter((f) => f.hayHoy),
    deben: filas
  }
  const lista = (grupos[filtro] || filas).sort((a, b) => (a.peor == null ? 9999 : a.peor) - (b.peor == null ? 9999 : b.peor) || b.k.debe - a.k.debe)

  poner(main,
    cabecera('Cuentas y fiado', null, el('button', { clase: 'btn primario', onclick: () => registrarPago({}) }, icono('plata'), 'Cobrar')),
    el('div', { clase: 'kpis' },
      kpi('Te deben', plata(total), cuantos(filas.length, 'cliente', 'clientes')),
      kpi('Vencido', plata(vencido), cuantos(grupos.vencidos.length, 'cliente', 'clientes'), vencido > 0 ? 'mal' : ''),
      kpi('Cheques para depositar', plata(enCartera.reduce((s, p) => s + p.monto, 0)), cuantos(enCartera.length, 'cheque', 'cheques'), '', () => irA('cuentas', 'cheques')),
      kpi('Cobrado este mes', plata(Calculo.caja(pagos, [], hoy.slice(0, 8) + '01', hoy).totalEntro), '')),
    el('div', { clase: 'filtros' }, [['vencidos', 'Vencidos', grupos.vencidos.length], ['hoy', 'Vencen pronto', grupos.hoy.length], ['deben', 'Todos los que deben', filas.length], ['cheques', 'Cheques', enCartera.length]].map(([id, n, cant]) =>
      el('button', { clase: 'filtro' + (filtro === id ? ' activo' : ''), onclick: () => irA('cuentas', id) }, n, el('span', { clase: 'n' }, cant)))),
    filtro === 'cheques' ? listaCheques(cheques, hoy)
      : lista.length ? lista.map((f) => tarjetaDeudor(f, hoy)) : vacio(filtro === 'vencidos' ? 'No hay nada vencido. ¡Bien!' : 'Nadie debe nada.', 'cuenta'))
}

function tarjetaDeudor (f, hoy) {
  const { c, k } = f
  const ultimo = k.deudas.map((d) => d.trabajo.recordado).filter(Boolean).sort().pop()
  return el('div', { clase: 'tarjeta' },
    el('div', { clase: 'tarjeta-cab' },
      el('button', { clase: 'enlace', onclick: () => verCliente(c.id) }, el('b', { clase: 'grande-texto' }, c.nombre), el('div', { clase: 'sub' }, [claseCliente(c) !== 'Particular' ? claseCliente(c) : null, c.telefono].filter(Boolean).join(' · '))),
      el('div', { clase: 'centro-der' }, el('b', { clase: 'num grande-texto ' + (f.venc > 0 ? 'rojo' : '') }, plata(k.debe)))),
    k.deudas.map((d) => {
      const e = Calculo.estadoVence(d.vence, hoy)
      return el('button', { clase: 'item', estilo: { padding: '8px 0', minHeight: '44px' }, onclick: () => verTrabajo(d.trabajo.id) },
        el('div', { clase: 'cuerpo' }, el('span', {}, '#' + d.trabajo.numero + ' · ' + (d.trabajo.servicio || 'Trabajo') + ' · ' + fechaCorta(Calculo.diaTrabajo(d.trabajo))),
          el('span', { clase: 'sub ' + (e.clase === 'vencido' ? 'rojo' : e.clase === 'hoy' || e.clase === 'pronto' ? 'ambar' : '') }, e.texto)),
        el('span', { clase: 'num' }, plata(d.saldo)))
    }),
    ultimo ? el('div', { clase: 'sub', estilo: { marginTop: '4px' } }, 'Último recordatorio: ' + fechaCorta(ultimo)) : null,
    el('div', { clase: 'chips', estilo: { marginTop: '10px' } },
      el('button', { clase: 'btn chico primario', onclick: () => registrarPago({ clienteId: c.id }) }, icono('plata'), 'Cobrar'),
      c.telefono ? el('button', { clase: 'btn chico', onclick: () => recordarDeuda(c, k.deudas) }, icono('whatsapp'), 'Recordar por WhatsApp') : el('span', { clase: 'sub' }, 'Sin celular cargado'),
      c.telefono ? el('a', { clase: 'btn chico', href: linkTelefono(c.telefono) }, icono('telefono'), 'Llamar') : null))
}

function recordarDeuda (c, deudas) {
  const conf = Datos.config()
  const total = deudas.reduce((s, d) => s + d.saldo, 0)
  const lineas = ['Hola ' + primerNombre(c.nombre) + ', ¿cómo estás? Te escribimos de *' + conf.negocio + '*.', '',
    deudas.length === 1 ? 'Te recordamos que quedó pendiente el pago de:' : 'Te recordamos que quedaron pendientes estos pagos:']
  for (const d of deudas) lineas.push('• ' + (d.trabajo.servicio || 'Trabajo') + ' (#' + d.trabajo.numero + ', ' + fechaCorta(Calculo.diaTrabajo(d.trabajo)) + '): ' + plata(d.saldo))
  if (deudas.length > 1) lineas.push('*Total: ' + plata(total) + '*')
  if (conf.alias) lineas.push('', 'Podés transferir al alias *' + conf.alias + '*' + (conf.titular ? ' (' + conf.titular + ')' : '') + '.')
  lineas.push('', '¡Muchas gracias!')
  abrirWhatsApp(c.telefono, lineas.join('\n'))
  // Se anota que se le recordo (para saber cuando fue la ultima vez).
  const ahora = new Date().toISOString()
  Datos.guardarVarias(deudas.map((d) => Object.assign({}, Datos.get(d.trabajo.id), { recordado: ahora })))
}

function listaCheques (cheques, hoy) {
  if (!cheques.length) return vacio('No hay cheques anotados.', 'cheque')
  const orden = { cartera: 0, rechazado: 1, depositado: 2 }
  const lista = cheques.slice().sort((a, b) => orden[a.cheque.estado] - orden[b.cheque.estado] || (a.cheque.fechaCobro || '').localeCompare(b.cheque.fechaCobro || ''))
  return el('div', { clase: 'tarjeta sin-relleno lista' }, lista.map((p) => {
    const ch = p.cheque
    const c = Datos.get(p.clienteId)
    const dias = ch.fechaCobro ? Calculo.diasEntre(hoy, ch.fechaCobro) : null
    const listo = ch.estado === 'cartera' && dias != null && dias <= 0
    return el('button', { clase: 'item', onclick: () => verPago(p.id) },
      el('div', { clase: 'ico-lista' }, icono('cheque')),
      el('div', { clase: 'cuerpo' }, el('b', {}, (ch.banco || 'Cheque') + (ch.numero ? ' N° ' + ch.numero : '')),
        el('span', { clase: 'sub' }, [c ? c.nombre : null, ch.fechaCobro ? 'Se cobra ' + fechaCorta(ch.fechaCobro) : null].filter(Boolean).join(' · '))),
      el('div', { clase: 'fin pila' }, el('b', { clase: 'num' }, plata(p.monto)), chip(listo ? 'Ya se puede depositar' : ESTADO_CHEQUE[ch.estado], ch.estado === 'rechazado' ? 'mal' : ch.estado === 'depositado' ? 'ok' : listo ? 'alerta' : 'info')))
  }))
}

function filaPago (p) {
  const anulado = !Calculo.pagoValido(p)
  const t = p.trabajoId ? Datos.get(p.trabajoId) : null
  return el('button', { clase: 'item' + (anulado ? ' inactivo' : ''), onclick: () => verPago(p.id) },
    el('div', { clase: 'ico-lista' }, icono(ICONO_MEDIO[p.medio] || 'plata')),
    el('div', { clase: 'cuerpo' }, el('b', {}, (MEDIOS_PAGO[p.medio] || p.medio) + (anulado ? (p.anulado ? ' · anulado' : ' · rechazado') : '')),
      el('span', { clase: 'sub' }, [fechaCorta(p.fecha) + ' ' + horaCorta(p.fecha), (Datos.get(p.clienteId) || {}).nombre, t ? '#' + t.numero : 'A cuenta', p.notas].filter(Boolean).join(' · '))),
    el('div', { clase: 'fin num' }, el('b', {}, plata(p.monto))))
}

function verPago (id) {
  const p = Datos.get(id)
  if (!p) return
  const c = Datos.get(p.clienteId)
  const t = p.trabajoId ? Datos.get(p.trabajoId) : null
  const ch = p.cheque
  const acciones = []
  const cambiarCheque = (estado) => { Datos.guardar(Object.assign({}, p, { cheque: Object.assign({}, ch, { estado, cambio: new Date().toISOString() }) })); h.cerrar() }
  if (ch && !p.anulado) {
    if (ch.estado !== 'depositado') acciones.push(el('button', { clase: 'btn primario', onclick: () => cambiarCheque('depositado') }, icono('ok'), 'Depositado / cobrado'))
    if (ch.estado !== 'rechazado') acciones.push(el('button', { clase: 'btn peligro', onclick: async () => { if (await confirmar('Cheque rechazado', 'El pago deja de contar: la deuda vuelve a la cuenta del cliente.', 'Rechazado', true)) cambiarCheque('rechazado') } }, 'Rechazado'))
    if (ch.estado !== 'cartera') acciones.push(el('button', { clase: 'btn', onclick: () => cambiarCheque('cartera') }, 'Volver a "para depositar"'))
  }
  if (!p.anulado) acciones.push(el('button', { clase: 'btn peligro', onclick: async () => { if (await confirmar('Anular pago', 'El pago deja de contar (queda anotado como anulado). Usalo si se cargó por error.', 'Anular', true)) { Datos.guardar(Object.assign({}, p, { anulado: new Date().toISOString() })); h.cerrar() } } }, icono('basura'), 'Anular'))
  else acciones.push(el('button', { clase: 'btn', onclick: () => { const x = Object.assign({}, p); delete x.anulado; Datos.guardar(x); h.cerrar() } }, 'Recuperar pago'))
  const h = hoja({
    titulo: 'Pago de ' + plata(p.monto),
    cuerpo: [
      p.anulado ? el('div', { clase: 'aviso mal' }, el('b', {}, 'Anulado'), 'No cuenta en la cuenta ni en la caja.') : null,
      el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Fecha'), el('b', {}, fechaCorta(p.fecha) + ' ' + horaCorta(p.fecha))),
      el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Medio'), el('b', {}, MEDIOS_PAGO[p.medio] || p.medio)),
      c ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Cliente'), el('button', { clase: 'enlace', onclick: () => verCliente(c.id) }, el('b', {}, c.nombre))) : null,
      el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Para'), t ? el('button', { clase: 'enlace', onclick: () => verTrabajo(t.id) }, el('b', {}, '#' + t.numero + ' ' + (t.servicio || ''))) : el('b', {}, 'A cuenta (paga lo más viejo)')),
      ch ? [el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Cheque'), el('b', {}, [ch.banco, ch.numero ? 'N° ' + ch.numero : null].filter(Boolean).join(' '))),
        ch.librador ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'De quién es'), el('b', {}, ch.librador)) : null,
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Se cobra'), el('b', {}, ch.fechaCobro ? fechaCorta(ch.fechaCobro) : '—')),
        el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Estado'), el('b', {}, ESTADO_CHEQUE[ch.estado]))] : null,
      p.notas ? el('p', { clase: 'tenue' }, p.notas) : null
    ],
    pie: acciones
  })
}

// --- cobrar ------------------------------------------------------------------------------------
// registrarPago({ clienteId?, trabajoId? })
function registrarPago (op) {
  if (!op.clienteId && !op.trabajoId) return elegirCliente((c) => c && registrarPago({ clienteId: c.id }))
  const conf = Datos.config()
  const t = op.trabajoId ? Datos.get(op.trabajoId) : null
  const c = op.clienteId ? Datos.get(op.clienteId) : null
  const ts = c ? Datos.lista('trabajo').filter((x) => x.clienteId === c.id) : []
  const ps = c ? Datos.lista('pago').filter((x) => x.clienteId === c.id) : (t ? Datos.lista('pago').filter((x) => x.trabajoId === t.id) : [])
  let falta, info
  if (t) {
    const s = c ? Calculo.saldoTrabajo(t, ts, ps) : { total: Calculo.totalesTrabajo(t).total, pagado: ps.filter(Calculo.pagoValido).reduce((a, p) => a + p.monto, 0) }
    falta = Calculo.r2(s.total - s.pagado)
    info = [el('div', { clase: 'fila' }, el('span', {}, (t.clase === 'venta' ? 'Venta' : 'Trabajo') + ' #' + t.numero + ' · ' + (t.servicio || '')), el('b', { clase: 'num' }, plata(s.total))),
      s.pagado ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Ya pagó'), el('span', { clase: 'num' }, plata(s.pagado))) : null,
      el('div', { clase: 'fila total' }, el('b', {}, 'Falta'), el('b', { clase: 'num' }, plata(Math.max(0, falta))))]
  } else {
    const k = Calculo.cuentaCliente(ts, ps)
    falta = k.debe
    info = [el('div', { clase: 'fila total' }, el('b', {}, 'Debe en total'), el('b', { clase: 'num' }, plata(k.debe))),
      k.deudas.length ? el('p', { clase: 'sub' }, 'El pago va cancelando lo más viejo primero: ' + k.deudas.map((d) => '#' + d.trabajo.numero + ' ' + plata(d.saldo)).join(' · ')) : null]
  }
  const cobrable = t ? Calculo.esCobrable(t) : true
  const puedeFiar = !!(t && c && cobrable && falta > 0)
  let medio = 'efectivo'
  const monto = entradaPlata(falta > 0 ? falta : '', { clase: 'num plata-grande' })
  const chNumero = entrada('', { inputmode: 'numeric', placeholder: 'Número' })
  const chBanco = entrada('', { placeholder: 'Banco' })
  const chFecha = entradaFecha(hoyISO())
  const chLibrador = entrada(c ? c.nombre : '', { placeholder: 'De quién es el cheque' })
  const notas = entrada('', { placeholder: 'Opcional' })
  const vence = entradaFecha(t && t.vence ? t.vence : sumarDias(hoyISO(), conf.diasFiado))
  const zonaMonto = el('div', {})
  const zonaCheque = el('div', {}, el('div', { clase: 'dos' }, campo('Banco', chBanco), campo('Número', chNumero)), el('div', { clase: 'dos' }, campo('Fecha de cobro', chFecha), campo('De quién es', chLibrador)))
  const zonaFiado = el('div', {})
  const pintarZonas = () => {
    zonaMonto.hidden = medio === 'fiado'
    zonaCheque.hidden = medio !== 'cheque'
    const m = medio === 'fiado' ? 0 : (monto.valor() || 0)
    const resto = Calculo.r2(falta - m)
    if (puedeFiar && resto > 0.009) {
      poner(zonaFiado, el('div', { clase: 'tarjeta', estilo: { background: 'var(--ambar-suave)', borderColor: 'transparent' } },
        el('b', {}, medio === 'fiado' ? 'Queda fiado: ' + plata(resto) : 'Quedan ' + plata(resto) + ' fiados'),
        el('p', { clase: 'sub', estilo: { margin: '2px 0 8px' } }, '¿Cuándo paga? Ese día te avisa; si no paga, queda como vencido.'),
        el('div', { clase: 'chips', estilo: { marginBottom: '8px' } }, [7, 15, 30].map((d) => el('button', { type: 'button', clase: 'chip-btn', onclick: () => { vence.value = sumarDias(hoyISO(), d) } }, d + ' días'))),
        vence))
    } else limpiar(zonaFiado)
  }
  monto.addEventListener('input', pintarZonas)
  const medios = [{ valor: 'efectivo', texto: 'Efectivo', icono: 'plata' }, { valor: 'transferencia', texto: 'Transferencia', icono: 'cuenta' }, { valor: 'cheque', texto: 'Cheque', icono: 'cheque' }]
  if (puedeFiar) medios.push({ valor: 'fiado', texto: 'Fiado', icono: 'calendario' })
  const elegirMedio = botonesElegir(medios, medio, (v) => { medio = v; pintarZonas() })

  const guardar = () => {
    const m = medio === 'fiado' ? 0 : monto.valor()
    if (medio !== 'fiado' && !(m > 0)) { toast('Poné cuánto pagó.', 'mal'); monto.focus(); return }
    if (medio === 'cheque' && !chFecha.value) { toast('Poné la fecha de cobro del cheque.', 'mal'); return }
    const fichas = []
    if (m > 0) {
      const p = { tipo: 'pago', fecha: new Date().toISOString(), clienteId: c ? c.id : null, trabajoId: t ? t.id : null, medio, monto: Calculo.r2(m), notas: notas.value.trim() }
      if (medio === 'cheque') p.cheque = { numero: chNumero.value.trim(), banco: chBanco.value.trim(), fechaCobro: chFecha.value, librador: chLibrador.value.trim(), estado: 'cartera' }
      fichas.push(p)
    }
    if (puedeFiar && Calculo.r2(falta - m) > 0.009) fichas.push(Object.assign({}, Datos.get(t.id), { vence: vence.value || null }))
    Datos.guardarVarias(fichas)
    h.cerrar()
    const resto = puedeFiar ? Calculo.r2(falta - m) : 0
    const fiado = resto > 0.009 ? 'quedan ' + plata(resto) + ' fiados' + (vence.value ? ' hasta el ' + fechaCorta(vence.value) : '') : ''
    toast(m > 0 ? 'Cobrado ' + plata(m) + (medio !== 'efectivo' ? ' (' + MEDIOS_PAGO[medio].toLowerCase() + ')' : '') + (fiado ? ' · ' + fiado : '') : 'Quedó fiado' + (vence.value ? ' hasta el ' + fechaCorta(vence.value) : ''), 'ok', 5)
  }
  const h = hoja({
    titulo: t ? (cobrable ? 'Cobrar' : 'Cobrar seña') + (c ? ' · ' + c.nombre : '') : 'Cobrar · ' + (c ? c.nombre : ''),
    foco: false,
    cuerpo: [el('div', { clase: 'tarjeta' }, info),
      el('div', { clase: 'campo' }, '¿Cómo paga?', elegirMedio),
      el('div', {}, zonaMonto),
      zonaCheque, zonaFiado,
      campo('Notas', notas)],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, falta > 0 && t && cobrable ? 'Después' : 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, 'Guardar')]
  })
  poner(zonaMonto, campo('Monto', monto, t && falta > 0 ? 'Si paga una parte, el resto queda fiado' : null))
  pintarZonas()
}
