'use strict'
// DATOS DE EJEMPLO (solo en el modo prueba, ?prueba en el link).
// Muestran todo: una inmobiliaria con varios domicilios, un fiado vencido,
// un cheque para depositar, stock bajo el minimo, un presupuesto y la agenda.

function cargarEjemplo () {
  const hoy = hoyISO()
  const dia = (n, hora) => sumarDias(hoy, n) + 'T' + (hora || '10:00') + ':00'
  const id = () => uuid()
  const prod = (nombre, categoria, costo, porcentaje, minimo, hay, extra) => Object.assign({ id: id(), tipo: 'producto', nombre, categoria, costo, porcentaje, minimo, unidad: 'unidad', activo: true, _hay: hay }, extra || {})
  const productos = [
    prod('Cilindro Kallay 60 mm', 'Cilindros', 9800, 45, 3, 6, { marca: 'Kallay', codigo: 'K-60', proveedor: 'Distribuidora Río Cuarto' }),
    prod('Cilindro Trabex 70 mm', 'Cilindros', 12500, 45, 2, 1, { marca: 'Trabex', codigo: 'T-70', proveedor: 'Distribuidora Río Cuarto' }),
    prod('Cerradura doble paleta Prive 200', 'Cerraduras', 18500, 40, 2, 4, { marca: 'Prive', proveedor: 'Distribuidora Río Cuarto' }),
    prod('Cerradura multipunto Kallay 4005', 'Cerraduras', 64000, 35, 1, 1, { marca: 'Kallay', proveedor: 'Distribuidora Río Cuarto' }),
    prod('Candado Bronce 40 mm', 'Candados', 5200, 60, 4, 0, { marca: 'Bronzen', proveedor: 'Ferretería Central' }),
    prod('Llave virgen yale', 'Llaves vírgenes', 450, 250, 30, 85, { ubicacion: 'Tablero' }),
    prod('Llave virgen doble paleta', 'Llaves vírgenes', 900, 200, 20, 14, { ubicacion: 'Tablero' }),
    prod('Llave con chip ID46', 'Llaves de auto', 8500, 120, 2, 3, { proveedor: 'Keyline' }),
    prod('Cámara IP Wi-Fi 1080p', 'Cámaras y alarmas', 28000, 40, 2, 2, { marca: 'Imou' }),
    prod('Kit alarma 4 sensores', 'Cámaras y alarmas', 95000, 35, 1, 1, { marca: 'X-28' })
  ]
  const P = (nombre) => productos.find((p) => p.nombre.startsWith(nombre))
  // Proveedores con ficha (Ferretería Central queda escrito en los productos, para probar 'Crear fichas').
  const distri = { id: id(), tipo: 'proveedor', nombre: 'Distribuidora Río Cuarto', rubro: 'Cilindros y cerraduras', contacto: 'Sergio', telefono: '358 463-1200', cuit: '30-70011223-4', alias: 'distri.rio4', diasPago: 30, activo: true }
  const keyline = { id: id(), tipo: 'proveedor', nombre: 'Keyline', rubro: 'Llaves de auto y chips', contacto: 'Mariana', telefono: '11 4555-0101', diasPago: 15, activo: true }
  for (const p of productos) { if (p.proveedor === distri.nombre) p.proveedorId = distri.id; if (p.proveedor === keyline.nombre) p.proveedorId = keyline.id }
  const item = (p, cantidad) => ({ productoId: p.id, nombre: p.nombre, cantidad, precio: Calculo.precioProducto(p, 10), costo: p.costo })

  const dom = (nombre, direccion, cerraduras, extra) => Object.assign({ id: id(), nombre, direccion, localidad: 'Alejandro Roca', cerraduras: cerraduras.map((k) => Object.assign({ id: id() }, k)), llaves: [] }, extra || {})
  const rossi = { id: id(), tipo: 'cliente', nombre: 'Inmobiliaria Rossi', clase: 'Inmobiliaria / agencia', telefono: '358 412-3456', dni: '30-71234567-8', domicilios: [
    dom('Depto 1° A', 'San Martín 450', [{ ubicacion: 'Puerta principal', tipo: 'Cilindro (tipo Yale)', marca: 'Kallay', modelo: '60 mm' }], { contacto: 'Encargado Luis 358 400-1111',
      llaves: [{ id: id(), puerta: 'Puerta principal', sistema: 'Amaestrada (abre con la maestra)', marca: 'Kallay', codigo: 'K-3341-07', copias: [{ fecha: sumarDias(hoy, -40), cantidad: 2, aQuien: 'Inquilina nueva (Pérez)' }] }] }),
    dom('Depto 2° B', 'San Martín 450', [{ ubicacion: 'Puerta principal', tipo: 'Doble paleta', marca: 'Prive', modelo: '200' }]),
    dom('Local', 'Belgrano 120', [{ ubicacion: 'Puerta principal', tipo: 'Multipunto', marca: 'Kallay', modelo: '4005' }, { ubicacion: 'Reja', tipo: 'Candado', marca: 'Bronzen' }])
  ] }
  const gomez = { id: id(), tipo: 'cliente', nombre: 'Carlos Gómez', clase: 'Particular', telefono: '3585 41-2233', domicilios: [
    dom('Casa', 'Mitre 233', [{ ubicacion: 'Puerta principal', tipo: 'Doble paleta', marca: 'Prive' }, { ubicacion: 'Puerta trasera', tipo: 'Cerrojo / pasador' }]),
    dom('Campo', 'Ruta 8 km 590', [{ ubicacion: 'Portón', tipo: 'Candado', marca: 'Bronzen', notas: 'Candado de 50 mm, cadena gruesa' }])
  ], vehiculos: [{ id: id(), marca: 'Ford', modelo: 'Ka', anio: '2014', patente: 'NOP123', tipoLlave: 'Con chip (transponder)', chip: 'ID63' }] }
  const lopez = { id: id(), tipo: 'cliente', nombre: 'María López', clase: 'Particular', telefono: '358 155-6677', domicilios: [dom('', 'Sarmiento 87', [{ ubicacion: 'Puerta principal', tipo: 'Cilindro (tipo Yale)' }])] }
  const consorcio = { id: id(), tipo: 'cliente', nombre: 'Consorcio Edificio Libertad', clase: 'Consorcio / edificio', telefono: '358 470-0000', domicilios: [dom('Entrada', 'Libertad 1020', [{ ubicacion: 'Puerta principal', tipo: 'Portero eléctrico / electroimán' }, { ubicacion: 'Puerta del garaje', tipo: 'Cilindro (tipo Yale)' }], { contacto: 'Administradora Silvia' })] }

  const T = (n, base) => Object.assign({ id: id(), tipo: 'trabajo', clase: 'trabajo', numero: n, estado: 'terminado', items: [], manoObra: 0, descuento: 0, urgencia: false, recargoPct: 50, garantiaDias: 90 }, base)
  const trabajos = [
    T(1, { clienteId: rossi.id, domicilioId: rossi.domicilios[0].id, servicio: 'Cambio de combinación', descripcion: 'Cambio de combinación por cambio de inquilino', items: [item(P('Llave virgen yale'), 3)], manoObra: 15000, terminado: dia(-40), creado: dia(-41) }),
    T(2, { clienteId: rossi.id, domicilioId: rossi.domicilios[2].id, servicio: 'Instalación de cerradura', descripcion: 'Cerradura multipunto nueva en el local', items: [item(P('Cilindro Trabex'), 1)], manoObra: 25000, terminado: dia(-25), creado: dia(-26), vence: sumarDias(hoy, -10) }),
    T(3, { clienteId: gomez.id, domicilioId: gomez.domicilios[0].id, servicio: 'Apertura de puerta', descripcion: 'Se le quedaron las llaves adentro', urgencia: true, manoObra: 20000, terminado: dia(-9, '23:40'), creado: dia(-9, '23:00'),
      apertura: { nombre: 'Carlos Gómez', dni: '25.111.222', como: 'DNI con ese domicilio', notas: '' } }),
    T(4, { clienteId: lopez.id, domicilioId: lopez.domicilios[0].id, servicio: 'Reparación de cerradura', manoObra: 12000, items: [item(P('Cilindro Kallay'), 1)], terminado: dia(-3), creado: dia(-3), vence: sumarDias(hoy, 12) }),
    T(5, { clienteId: consorcio.id, domicilioId: consorcio.domicilios[0].id, servicio: 'Cámaras de seguridad', estado: 'pendiente', descripcion: 'Colocar 2 cámaras en el hall y la cochera', items: [item(P('Cámara IP'), 2)], manoObra: 45000, fecha: dia(0, '16:00'), creado: dia(-1), terminado: null }),
    T(6, { clienteId: gomez.id, vehiculoId: gomez.vehiculos[0].id, servicio: 'Llave de auto', estado: 'en_curso', descripcion: 'Copia de llave con chip para el Ka', items: [item(P('Llave con chip'), 1)], manoObra: 18000, fecha: dia(1, '10:00'), creado: dia(-1), terminado: null }),
    T(7, { clienteId: consorcio.id, domicilioId: consorcio.domicilios[0].id, clase: 'presupuesto', estado: 'pendiente', servicio: 'Alarmas', descripcion: 'Alarma para la cochera con 4 sensores', items: [item(P('Kit alarma'), 1)], manoObra: 60000, creado: dia(-2), terminado: null }),
    T(9, { clienteId: rossi.id, domicilioId: rossi.domicilios[1].id, servicio: 'Cambio de combinación', estado: 'pendiente', descripcion: 'Cambio de inquilino', manoObra: 15000, fecha: dia(2, '11:30'), creado: dia(-1), terminado: null }),
    T(10, { clienteId: lopez.id, domicilioId: lopez.domicilios[0].id, servicio: 'Reparación de cerradura', estado: 'pendiente', descripcion: 'La llave gira en falso', manoObra: 12000, fecha: dia(-1, '17:00'), creado: dia(-3), terminado: null }),
    T(11, { clienteId: rossi.id, domicilioId: rossi.domicilios[2].id, servicio: 'Reparación de cerradura', estado: 'pendiente', descripcion: 'Revisar la reja del local', manoObra: 9000, creado: dia(-1), terminado: null }),
    T(8, { clase: 'venta', servicio: 'Venta de mostrador', items: [item(P('Llave virgen yale'), 4), item(P('Candado'), 1)], terminado: dia(0, '09:30'), creado: dia(0, '09:30'), garantiaDias: 0 })
  ]
  const pagos = [
    { tipo: 'pago', fecha: dia(-40, '12:00'), clienteId: rossi.id, trabajoId: trabajos[0].id, medio: 'transferencia', monto: 10000 },
    { tipo: 'pago', fecha: dia(-9, '23:50'), clienteId: gomez.id, trabajoId: trabajos[2].id, medio: 'cheque', monto: 30000, cheque: { numero: '00451236', banco: 'Banco de Córdoba', fechaCobro: sumarDias(hoy, -1), librador: 'Carlos Gómez', estado: 'cartera' } },
    { tipo: 'pago', fecha: dia(0, '09:31'), clienteId: null, trabajoId: trabajos[7].id, medio: 'efectivo', monto: Calculo.totalesTrabajo(trabajos[7]).total }
  ]
  trabajos[0].vence = sumarDias(hoy, -25)
  const movs = productos.map((p) => ({ tipo: 'movstock', mov: 'inicial', productoId: p.id, cantidad: p._hay + trabajos.filter(Calculo.esCobrable).reduce((s, t) => s + (t.items || []).filter((i) => i.productoId === p.id).reduce((a, i) => a + i.cantidad, 0), 0), fecha: dia(-60) })).filter((m) => m.cantidad > 0)
  const gastos = [
    { tipo: 'gasto', fecha: hoy, categoria: 'Combustible', concepto: 'Nafta', monto: 15000, medio: 'efectivo' },
    { tipo: 'gasto', fecha: sumarDias(hoy, -5), categoria: 'Herramientas', concepto: 'Juego de ganzúas', monto: 32000, medio: 'transferencia' }
  ]
  for (const p of productos) delete p._hay
  // Compras: una a cuenta (vencida) y una pagada.
  const compra1 = { id: id(), tipo: 'compra', proveedorId: distri.id, fecha: sumarDias(hoy, -35), numero: 'A-0001-00012345', items: [{ productoId: P('Cilindro Kallay').id, nombre: P('Cilindro Kallay').nombre, cantidad: 5, costo: 9800 }, { productoId: P('Cerradura doble').id, nombre: P('Cerradura doble').nombre, cantidad: 2, costo: 18500 }], total: 86000, vence: sumarDias(hoy, -5) }
  const compra2 = { id: id(), tipo: 'compra', proveedorId: keyline.id, fecha: sumarDias(hoy, -12), numero: 'R-552', items: [{ productoId: P('Llave con chip').id, nombre: P('Llave con chip').nombre, cantidad: 3, costo: 8500 }], total: 25500, vence: null }
  gastos.push({ tipo: 'gasto', fecha: sumarDias(hoy, -35), categoria: 'Mercadería', concepto: 'Compra a ' + distri.nombre, monto: 30000, medio: 'transferencia', proveedorId: distri.id, pagoProveedor: true, compraId: compra1.id })
  gastos.push({ tipo: 'gasto', fecha: sumarDias(hoy, -12), categoria: 'Mercadería', concepto: 'Compra a Keyline', monto: 25500, medio: 'transferencia', proveedorId: keyline.id, pagoProveedor: true, compraId: compra2.id })
  Datos.guardarVarias([].concat(productos, [distri, keyline], [rossi, gomez, lopez, consorcio], trabajos, pagos, movs, gastos, [compra1, compra2]))
}
