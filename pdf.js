'use strict'
// PDF DEL PRESUPUESTO O DEL COMPROBANTE DE TRABAJO, con el logo.
// En el celular se comparte directo (WhatsApp, mail...); en la compu se baja.
// Si es una apertura, lleva la declaracion del que la pidio con lugar para firmar.

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
let cargandoJsPDF = null
function cargarJsPDF () {
  if (window.jspdf) return Promise.resolve()
  if (!cargandoJsPDF) {
    cargandoJsPDF = new Promise((ok, mal) => {
      const s = el('script', { src: JSPDF_URL })
      s.onload = ok
      s.onerror = () => { cargandoJsPDF = null; mal(new Error('No se pudo cargar el armador de PDF (¿hay internet?).')) }
      document.head.append(s)
    })
  }
  return cargandoJsPDF
}
async function imagenDatos (url) {
  const b = await (await fetch(url)).blob()
  const datos = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b) })
  const img = new Image()
  await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = datos })
  return { datos, ancho: img.width, alto: img.height }
}

async function pdfTrabajo (t) {
  toast('Armando el PDF…')
  try { await cargarJsPDF() } catch (e) { return toast(e.message, 'mal', 5) }
  const conf = Datos.config()
  const c = Datos.get(t.clienteId)
  const dom = c && (c.domicilios || []).find((d) => d.id === t.domicilioId)
  const veh = c && (c.vehiculos || []).find((v) => v.id === t.vehiculoId)
  const x = Calculo.totalesTrabajo(t)
  const presupuesto = t.clase === 'presupuesto'
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' })
  const AZUL = [33, 54, 112]; const NARANJA = [234, 88, 12]; const GRIS = [100, 108, 120]
  const M = 16; const W = 210 - 2 * M
  let y = 14

  // Encabezado: logo a la izquierda, datos a la derecha.
  try {
    const logo = await imagenDatos('logo.jpg')
    const lw = 58; const lh = lw * logo.alto / logo.ancho
    doc.addImage(logo.datos, 'JPEG', M, y, lw, lh)
  } catch (e) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...AZUL); doc.text(conf.negocio, M, y + 10)
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZUL)
  doc.text(conf.negocio + (conf.titular ? ' — ' + conf.titular : ''), 210 - M, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS)
  const datosNeg = [conf.rubro, conf.telefono ? 'Cel./WhatsApp ' + conf.telefono : '', [conf.direccion, conf.localidad].filter(Boolean).join(' — '), conf.email, conf.cuit ? 'CUIT ' + conf.cuit : ''].filter(Boolean)
  datosNeg.forEach((l, i) => doc.text(l, 210 - M, y + 9.5 + i * 4.6, { align: 'right' }))
  y = 50

  // Titulo
  doc.setFillColor(...AZUL); doc.rect(M, y, W, 11, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text((presupuesto ? 'PRESUPUESTO' : t.clase === 'venta' ? 'COMPROBANTE DE VENTA' : 'COMPROBANTE DE TRABAJO') + '  N° ' + String(t.numero).padStart(5, '0'), M + 4, y + 7.4)
  doc.setFontSize(10); doc.text(fechaLarga(presupuesto ? (t.creado || new Date().toISOString()) : (t.terminado || t.fecha || t.creado)), 210 - M - 4, y + 7.4, { align: 'right' })
  y += 18

  // Cliente
  const fila = (rot, val) => {
    if (!val) return
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GRIS); doc.text(rot, M, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 24, 32)
    const ls = doc.splitTextToSize(String(val), W - 30)
    doc.text(ls, M + 30, y); y += 5.4 * ls.length
  }
  fila('Cliente', c ? c.nombre : 'Consumidor final')
  if (c) fila('Teléfono', c.telefono)
  if (c && c.dni) fila('DNI / CUIT', c.dni)
  if (dom) fila('Domicilio', [dom.direccion, dom.localidad, dom.referencia].filter(Boolean).join(', '))
  if (veh) fila('Vehículo', [veh.marca, veh.modelo, veh.anio, veh.patente].filter(Boolean).join(' '))
  fila('Servicio', t.servicio)
  if (t.descripcion) fila('Detalle', t.descripcion)
  y += 4

  // Tabla
  const cols = [M, M + 16, 210 - M - 58, 210 - M - 28]
  doc.setFillColor(240, 242, 246); doc.rect(M, y, W, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...GRIS)
  doc.text('Cant.', cols[0] + 2, y + 5.4); doc.text('Descripción', cols[1], y + 5.4)
  doc.text('Precio unit.', cols[3] - 2, y + 5.4, { align: 'right' }); doc.text('Importe', 210 - M - 2, y + 5.4, { align: 'right' })
  y += 13
  doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 24, 32); doc.setFontSize(10)
  const renglon = (cant, desc, unit, imp) => {
    const ls = doc.splitTextToSize(desc, cols[2] - cols[1] + 20)
    if (y + ls.length * 5 > 262) { doc.addPage(); y = 20 }
    if (cant != null) doc.text(fmtCant(cant), cols[0] + 2, y)
    doc.text(ls, cols[1], y)
    if (unit != null) doc.text(plata(unit), cols[3] - 2, y, { align: 'right' })
    doc.text(imp, 210 - M - 2, y, { align: 'right' })
    y += 5 * ls.length + 1.6
    doc.setDrawColor(232, 235, 240); doc.line(M, y - 3.4, 210 - M, y - 3.4)
  }
  for (const it of t.items || []) renglon(it.cantidad, it.nombre, it.precio, plata(it.cantidad * it.precio))
  if (x.manoObra) renglon(null, 'Mano de obra' + (t.servicio && t.clase !== 'venta' ? ' — ' + t.servicio : ''), null, plata(x.manoObra))
  y += 2
  const tot = (rot, val, fuerte) => {
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal'); doc.setFontSize(fuerte ? 12.5 : 10); doc.setTextColor(...(fuerte ? AZUL : [20, 24, 32]))
    doc.text(rot, cols[3] - 2, y, { align: 'right' }); doc.text(val, 210 - M - 2, y, { align: 'right' }); y += fuerte ? 7.5 : 5.6
  }
  if (x.recargo || x.descuento) tot('Subtotal', plata(x.subtotal))
  if (x.recargo) tot('Recargo urgencia ' + t.recargoPct + '%', plata(x.recargo))
  if (x.descuento) tot('Descuento', '-' + plata(x.descuento))
  tot('TOTAL', plata(x.total), true)
  if (!presupuesto && t.clienteId) {
    const s = Calculo.saldoTrabajo(t, Datos.lista('trabajo').filter((y2) => y2.clienteId === t.clienteId), Datos.lista('pago').filter((p) => p.clienteId === t.clienteId))
    if (s.pagado) tot('Pagado', plata(s.pagado))
    if (Calculo.esCobrable(t)) tot(s.saldo > 0 ? 'Saldo' : 'Estado', s.saldo > 0 ? plata(s.saldo) : 'PAGADO', s.saldo > 0)
  }
  y += 4

  // Condiciones
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS)
  const notas = []
  if (presupuesto && conf.validezPresupuesto) notas.push('Presupuesto válido por ' + conf.validezPresupuesto + ' días.')
  if (t.garantiaDias && t.clase !== 'venta') notas.push('Garantía de ' + t.garantiaDias + ' días' + (presupuesto ? ' desde la terminación del trabajo.' : (t.terminado ? ', hasta el ' + fechaLarga(sumarDias(diaDe(t.terminado), t.garantiaDias)) + '.' : '.')) + ' No cubre roturas por mal uso o forzamiento.')
  if (t.urgencia) notas.push('Incluye recargo por servicio de urgencia / fuera de horario.')
  if (conf.alias) notas.push('Transferencias al alias ' + conf.alias + '.')
  for (const n of notas) { const ls = doc.splitTextToSize(n, W); doc.text(ls, M, y); y += 4.6 * ls.length }

  // Apertura: declaracion y firma.
  if (t.apertura && !presupuesto) {
    if (y > 225) { doc.addPage(); y = 20 }
    y += 6
    doc.setDrawColor(...NARANJA); doc.setLineWidth(0.6); doc.line(M, y, M + 30, y); doc.setLineWidth(0.2)
    y += 6
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 24, 32); doc.text('Declaración del solicitante de la apertura', M, y); y += 5.6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    const decl = 'Yo, ' + (t.apertura.nombre || '______________________') + ', DNI ' + (t.apertura.dni || '____________') + ', declaro ser ocupante legítimo del domicilio ' +
      (dom ? [dom.direccion, dom.localidad].filter(Boolean).join(', ') : '______________________') + ' y solicito la apertura, asumiendo la responsabilidad. ' +
      (t.apertura.como ? 'Acreditación: ' + t.apertura.como + '.' : '')
    const ls = doc.splitTextToSize(decl, W); doc.text(ls, M, y); y += 4.8 * ls.length + 16
    doc.setDrawColor(150, 150, 150); doc.line(M, y, M + 70, y); doc.line(210 - M - 70, y, 210 - M, y)
    doc.setFontSize(8.5); doc.setTextColor(...GRIS); doc.text('Firma y aclaración', M, y + 4); doc.text('Por ' + conf.negocio, 210 - M - 70, y + 4)
  }

  // Pie
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...NARANJA); doc.setLineWidth(0.8); doc.line(M, 284, 210 - M, 284); doc.setLineWidth(0.2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS)
    doc.text('Documento no válido como factura', M, 289)
    doc.text(conf.negocio + (conf.telefono ? ' · ' + conf.telefono : ''), 210 - M, 289, { align: 'right' })
  }

  const nombre = (presupuesto ? 'Presupuesto' : 'Trabajo') + '-' + t.numero + (c ? '-' + c.nombre.replace(/[^\wáéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '-') : '') + '.pdf'
  const blob = doc.output('blob')
  const archivo = new File([blob], nombre, { type: 'application/pdf' })
  const celular = matchMedia('(pointer: coarse)').matches
  if (celular && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: nombre }); return } catch (e) { if (e.name === 'AbortError') return }
  }
  doc.save(nombre)
  toast('PDF bajado: ' + nombre, 'ok', 5)
}

function fechaLarga (x) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(x + 'T12:00:00') : new Date(x)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}
