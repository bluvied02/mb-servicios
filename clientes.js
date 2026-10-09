'use strict'
// CLIENTES: cada uno con todos los domicilios que quiera (una inmobiliaria con
// 20 departamentos, un particular con su casa y su negocio). En cada domicilio:
// las cerraduras que tiene, las llaves (protegidas con clave) y la historia de
// todo lo que se hizo ahi. Tambien los autos, para las llaves codificadas.

const UBICACIONES = ['Puerta principal', 'Puerta trasera', 'Puerta del garaje', 'Portón', 'Reja', 'Puerta interna', 'Ventana', 'Caja fuerte', 'Buzón']
const SISTEMAS_LLAVE = ['Común', 'Amaestrada (abre con la maestra)', 'Llave maestra', 'Combinación / código', 'Tarjeta o llavero electrónico']

// --- la lista ---------------------------------------------------------------------------------
VISTAS.clientes = function (main) {
  const busq = APP.filtros.clientesBusca || ''
  const filtro = APP.filtros.clientes || 'todos'
  const cs = Calculo.cuentas(Datos.lista('trabajo'), Datos.lista('pago'))
  const todos = Datos.lista('cliente')
  const tipos = [...new Set(todos.map(claseCliente))]
  const buscar = el('input', { type: 'search', placeholder: 'Nombre, dirección, teléfono, patente', valor: busq })
  const caja = el('div', {})
  const pintarLista = () => {
    const q = buscar.value.trim()
    APP.filtros.clientesBusca = q
    let lista = filtro === 'deben' ? todos.filter((c) => (cs.get(c.id) || {}).debe > 0) : filtro === 'todos' ? todos : todos.filter((c) => claseCliente(c) === filtro)
    if (q) lista = lista.filter((c) => coincide(textoCliente(c), q))
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
    poner(caja, lista.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, lista.slice(0, 400).map((c) => {
      const k = cs.get(c.id)
      const n = (c.domicilios || []).length
      return el('button', { clase: 'item', onclick: () => verCliente(c.id) },
        el('div', { clase: 'avatar', 'aria-hidden': 'true' }, iniciales(c.nombre)),
        el('div', { clase: 'cuerpo' }, el('b', {}, c.nombre),
          el('span', { clase: 'sub' }, [claseCliente(c) !== 'Particular' ? claseCliente(c) : null, n > 1 ? n + ' domicilios' : n === 1 ? c.domicilios[0].direccion : null, c.telefono].filter(Boolean).join(' · '))),
        k && k.debe > 0 ? el('div', { clase: 'fin pila' }, el('b', { clase: 'num rojo' }, plata(k.debe)), el('span', { clase: 'sub' }, 'debe')) : null)
    })) : vacio(q ? 'No hay ningún cliente así.' : 'Todavía no hay clientes.', 'cliente', el('button', { clase: 'btn primario', onclick: () => editarCliente({ nombre: q }, (c) => verCliente(c.id)) }, icono('sumar'), 'Cliente nuevo')))
  }
  buscar.addEventListener('input', pintarLista)
  poner(main,
    cabecera('Clientes', todos.length + ' clientes', el('button', { clase: 'btn primario', onclick: () => editarCliente(null, (c) => verCliente(c.id)) }, icono('sumar'), 'Cliente nuevo')),
    el('div', { clase: 'filtros' }, [['todos', 'Todos'], ['deben', 'Deben']].concat(tipos.filter((t) => t !== 'Particular').map((t) => [t, t])).map(([id, n]) =>
      el('button', { clase: 'filtro' + (filtro === id ? ' activo' : ''), onclick: () => irA('clientes', id) }, n))),
    el('div', { clase: 'buscador' }, icono('buscar'), buscar),
    caja)
  pintarLista()
}
const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

// --- cargar o editar los datos del cliente -----------------------------------------------------
function editarCliente (base, alGuardar) {
  const c = JSON.parse(JSON.stringify(Object.assign({ clase: 'Particular', domicilios: [], vehiculos: [] }, base || {})))
  const nuevo = !c.id
  const nombre = entrada(c.nombre, { placeholder: 'Nombre y apellido, o nombre de la empresa', autocapitalize: 'words' })
  const tipo = selector(TIPOS_CLIENTE, claseCliente(c))
  const telefono = entrada(c.telefono, { type: 'tel', inputmode: 'tel', placeholder: 'Ej.: 351 555-1234' })
  const telefono2 = entrada(c.telefono2, { type: 'tel', inputmode: 'tel' })
  const dni = entrada(c.dni, { placeholder: 'DNI o CUIT' })
  const email = entrada(c.email, { type: 'email', inputmode: 'email' })
  const notas = areaTexto(c.notas, { rows: 2 })
  // Al crear, se puede cargar el primer domicilio ahi mismo.
  const direccion = entrada('', { placeholder: 'Calle y número' })
  const localidad = entrada(leerLocal('mb.ultimaLocalidad', 'Alejandro Roca'), { placeholder: 'Localidad' })
  const guardar = () => {
    if (!nombre.value.trim()) { toast('Poné el nombre.', 'mal'); nombre.focus(); return }
    Object.assign(c, { nombre: nombre.value.trim(), telefono: telefono.value.trim(), telefono2: telefono2.value.trim(), dni: dni.value.trim(), email: email.value.trim(), notas: notas.value.trim() })
    c.tipo = 'cliente'
    c.clase = tipo.value
    if (nuevo && direccion.value.trim()) {
      c.domicilios.push({ id: uuid(), nombre: '', direccion: direccion.value.trim(), localidad: localidad.value.trim(), cerraduras: [], llaves: [] })
      guardarLocal('mb.ultimaLocalidad', localidad.value.trim())
    }
    const f = Datos.guardar(c)
    h.cerrar()
    toast('Cliente guardado', 'ok')
    if (alGuardar) alGuardar(f)
  }
  const h = hoja({
    titulo: nuevo ? 'Cliente nuevo' : 'Editar cliente',
    cuerpo: [
      campo('Nombre', nombre), campo('Tipo de cliente', tipo),
      el('div', { clase: 'dos' }, campo('Celular', telefono, 'Con código de área, para WhatsApp'), campo('Otro teléfono', telefono2)),
      el('div', { clase: 'dos' }, campo('DNI / CUIT', dni), campo('Email', email)),
      nuevo ? [el('h3', {}, 'Primer domicilio (opcional)'), el('div', { clase: 'dos' }, campo('Dirección', direccion), campo('Localidad', localidad)), el('p', { clase: 'sub', estilo: { marginTop: '-4px' } }, 'Después le agregás todos los que quieras, cada uno con sus cerraduras.')] : null,
      campo('Notas', notas)
    ],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, 'Guardar')]
  })
}
// El "tipo" de la ficha es 'cliente'; la clase (particular, inmobiliaria...) va en 'clase'.
// Para leerla: claseCliente(c).
const claseCliente = (c) => c.clase || 'Particular'

// --- ver un cliente -----------------------------------------------------------------------------
function verCliente (id) {
  const cuerpo = el('div', {})
  let h = null
  const pintarTodo = () => {
    const c = Datos.get(id)
    if (!c) { if (h) h.cerrar(); return }
    if (h) h.cuerpo.parentNode.querySelector('.cab-hoja h2').textContent = c.nombre
    const hoy = hoyISO()
    const ts = Datos.lista('trabajo').filter((t) => t.clienteId === c.id)
    const ps = Datos.lista('pago').filter((p) => p.clienteId === c.id)
    const k = Calculo.cuentaCliente(ts, ps)
    const doms = c.domicilios || []
    const vehs = c.vehiculos || []

    poner(cuerpo,
      el('div', { clase: 'chips', estilo: { marginBottom: '10px' } },
        chip(claseCliente(c), 'info'),
        c.telefono ? el('a', { clase: 'btn chico', href: linkTelefono(c.telefono) }, icono('telefono'), c.telefono) : null,
        c.telefono ? el('button', { clase: 'btn chico', onclick: () => abrirWhatsApp(c.telefono, '') }, icono('whatsapp'), 'WhatsApp') : null,
        c.telefono2 ? el('a', { clase: 'btn chico', href: linkTelefono(c.telefono2) }, icono('telefono'), c.telefono2) : null,
        el('button', { clase: 'btn chico', onclick: () => editarCliente(c) }, icono('editar'), 'Editar')),

      // La cuenta
      el('div', { clase: 'tarjeta' },
        el('div', { clase: 'tarjeta-cab' }, el('h2', {}, 'Cuenta'),
          el('div', { clase: 'chips' }, el('button', { clase: 'btn chico primario', onclick: () => registrarPago({ clienteId: c.id }) }, icono('plata'), 'Cobrar'),
            k.deudas.length && c.telefono ? el('button', { clase: 'btn chico', onclick: () => recordarDeuda(c, k.deudas) }, icono('whatsapp'), 'Recordar') : null)),
        el('div', { clase: 'dato-grande' },
          el('div', {}, el('div', { clase: 'r' }, 'Debe'), el('div', { clase: 'v ' + (k.debe > 0 ? 'rojo' : '') }, plata(k.debe))),
          el('div', {}, el('div', { clase: 'r' }, 'A favor'), el('div', { clase: 'v ' + (k.aFavor > 0 ? 'verde' : '') }, plata(k.aFavor))),
          el('div', {}, el('div', { clase: 'r' }, 'Trabajos'), el('div', { clase: 'v' }, String(ts.filter((t) => t.clase !== 'presupuesto' && t.estado !== 'cancelado').length)))),
        k.deudas.map((d) => {
          const e = Calculo.estadoVence(d.vence, hoy)
          return el('button', { clase: 'item', estilo: { padding: '10px 0' }, onclick: () => verTrabajo(d.trabajo.id) },
            el('div', { clase: 'cuerpo' }, el('b', {}, '#' + d.trabajo.numero + ' · ' + (d.trabajo.servicio || 'Trabajo')), el('span', { clase: 'sub ' + (e.clase === 'vencido' ? 'rojo' : e.clase === 'hoy' || e.clase === 'pronto' ? 'ambar' : '') }, e.texto)),
            el('div', { clase: 'fin num' }, el('b', {}, plata(d.saldo))))
        }),
        k.senias.length ? el('div', { clase: 'sub', estilo: { marginTop: '6px' } }, 'Señas de trabajos sin terminar: ' + k.senias.map((s) => '#' + s.trabajo.numero + ' ' + plata(s.pagado)).join(' · ')) : null),

      // Domicilios
      el('div', { clase: 'tarjeta-cab', estilo: { marginTop: '16px' } }, el('h2', {}, doms.length === 1 ? '1 domicilio' : doms.length + ' domicilios'),
        el('button', { clase: 'btn chico suave', onclick: () => editarDomicilio(c, null) }, icono('sumar'), 'Domicilio')),
      doms.length ? doms.map((d) => tarjetaDomicilio(c, d, ts, hoy)) : el('div', { clase: 'aviso' }, 'Sin domicilios. Agregá uno para anotar sus cerraduras y llaves.'),

      // Autos
      el('div', { clase: 'tarjeta-cab', estilo: { marginTop: '16px' } }, el('h2', {}, 'Autos'),
        el('button', { clase: 'btn chico suave', onclick: () => editarVehiculo(c, null) }, icono('sumar'), 'Auto')),
      vehs.length ? vehs.map((v) => tarjetaVehiculo(c, v, ts, hoy)) : el('p', { clase: 'sub' }, 'Para las llaves de auto: marca, modelo, año y tipo de llave.'),

      // Todos los trabajos
      el('div', { clase: 'tarjeta-cab', estilo: { marginTop: '16px' } }, el('h2', {}, 'Trabajos y presupuestos'),
        el('button', { clase: 'btn chico suave', onclick: () => editarTrabajo({ clase: 'trabajo', clienteId: c.id }) }, icono('sumar'), 'Trabajo')),
      ts.length ? el('div', { clase: 'tarjeta sin-relleno lista' }, ts.slice().sort((a, b) => b.numero - a.numero).map((t) => filaTrabajo(t, hoy))) : el('p', { clase: 'sub' }, 'Todavía no hay trabajos.'),
      ps.length ? [el('h3', {}, 'Pagos'), el('div', { clase: 'tarjeta sin-relleno lista' }, ps.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 30).map((p) => filaPago(p)))] : null,

      [c.dni, c.email, c.notas].some(Boolean) ? el('div', { clase: 'tarjeta', estilo: { marginTop: '14px' } },
        c.dni ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'DNI / CUIT'), el('b', {}, c.dni)) : null,
        c.email ? el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Email'), el('b', {}, c.email)) : null,
        c.notas ? el('p', { estilo: { margin: '8px 0 0', whiteSpace: 'pre-wrap' } }, c.notas) : null) : null,
      el('button', { clase: 'btn peligro chico', estilo: { marginTop: '18px' }, onclick: async () => {
        if (ts.some((t) => t.estado !== 'cancelado') || ps.length) return toast('Tiene trabajos o pagos: no se puede borrar.', 'mal', 5)
        if (await confirmar('Borrar cliente', '¿Borrar a ' + c.nombre + '?', 'Borrar', true)) { Datos.borrar(c.id); h.cerrar() }
      } }, icono('basura'), 'Borrar cliente'))
  }
  const quitar = Datos.alCambiar(() => { if (!h.cerrado) pintarTodo() })
  h = hoja({ titulo: (Datos.get(id) || {}).nombre || 'Cliente', completa: true, cuerpo, alCerrar: quitar })
  pintarTodo()
  return h
}

function tarjetaDomicilio (c, d, ts, hoy) {
  const hechos = ts.filter((t) => t.domicilioId === d.id && t.clase !== 'presupuesto' && t.estado !== 'cancelado').sort((a, b) => b.numero - a.numero)
  const conGarantia = hechos.map((t) => ({ t, g: Calculo.garantia(t, hoy) })).filter((x) => x.g && x.g.vigente)
  return el('div', { clase: 'tarjeta domicilio' },
    el('div', { clase: 'tarjeta-cab' },
      el('div', { estilo: { minWidth: 0 } }, el('b', { clase: 'grande-texto' }, d.nombre || d.direccion), el('div', { clase: 'sub' }, [d.nombre ? d.direccion : null, d.localidad, d.referencia].filter(Boolean).join(' · '))),
      el('button', { clase: 'btn-ico', 'aria-label': 'Editar domicilio', onclick: () => editarDomicilio(c, d) }, icono('editar'))),
    d.contacto ? el('div', { clase: 'sub' }, 'Contacto en el lugar: ' + d.contacto) : null,
    el('div', { clase: 'chips', estilo: { margin: '8px 0' } },
      el('a', { clase: 'btn chico', href: linkMapa(d.direccion, d.localidad), target: '_blank', rel: 'noopener' }, icono('mapa'), 'Cómo llegar'),
      el('button', { clase: 'btn chico', onclick: () => verLlaves(c.id, d.id) }, icono('candado'), 'Llaves' + ((d.llaves || []).length ? ' (' + d.llaves.length + ')' : '')),
      el('button', { clase: 'btn chico', onclick: () => editarTrabajo({ clase: 'trabajo', clienteId: c.id, domicilioId: d.id }) }, icono('sumar'), 'Trabajo acá')),
    (d.cerraduras || []).length ? el('div', { clase: 'cerraduras' }, d.cerraduras.map((k) => el('div', { clase: 'cerradura' },
      icono('cerradura'), el('div', {}, el('b', {}, k.ubicacion || 'Cerradura'), el('div', { clase: 'sub' }, [k.tipo, k.marca, k.modelo].filter(Boolean).join(' · ')), k.notas ? el('div', { clase: 'sub' }, k.notas) : null)))) : el('div', { clase: 'sub' }, 'Sin cerraduras anotadas.'),
    conGarantia.length ? el('div', { clase: 'aviso ok', estilo: { margin: '10px 0 0' } }, el('b', {}, 'En garantía'), conGarantia.map((x) => '#' + x.t.numero + ' ' + (x.t.servicio || '') + ' hasta ' + fechaCorta(x.g.hasta)).join(' · ')) : null,
    hechos.length ? el('details', { clase: 'detalles', estilo: { marginTop: '10px', marginBottom: 0 } }, el('summary', {}, 'Historial (' + hechos.length + ')'),
      el('div', { clase: 'lista' }, hechos.map((t) => filaTrabajo(t, hoy)))) : null)
}

function tarjetaVehiculo (c, v, ts, hoy) {
  const hechos = ts.filter((t) => t.vehiculoId === v.id && t.clase !== 'presupuesto' && t.estado !== 'cancelado')
  return el('div', { clase: 'tarjeta' },
    el('div', { clase: 'tarjeta-cab' },
      el('div', {}, el('b', { clase: 'grande-texto' }, [v.marca, v.modelo, v.anio].filter(Boolean).join(' ')), el('div', { clase: 'sub' }, [v.patente, v.tipoLlave, v.chip ? 'Chip ' + v.chip : null].filter(Boolean).join(' · '))),
      el('button', { clase: 'btn-ico', 'aria-label': 'Editar auto', onclick: () => editarVehiculo(c, v) }, icono('editar'))),
    v.notas ? el('div', { clase: 'sub' }, v.notas) : null,
    el('div', { clase: 'chips', estilo: { marginTop: '8px' } },
      el('button', { clase: 'btn chico', onclick: () => verCodigoAuto(c.id, v.id) }, icono('candado'), 'Código de llave'),
      el('button', { clase: 'btn chico', onclick: () => editarTrabajo({ clase: 'trabajo', clienteId: c.id, vehiculoId: v.id, servicio: 'Llave de auto' }) }, icono('sumar'), 'Trabajo')),
    hechos.length ? el('details', { clase: 'detalles', estilo: { marginTop: '10px', marginBottom: 0 } }, el('summary', {}, 'Historial (' + hechos.length + ')'), el('div', { clase: 'lista' }, hechos.map((t) => filaTrabajo(t, hoy)))) : null)
}

// --- domicilio con sus cerraduras --------------------------------------------------------------
function editarDomicilio (cliente, base, alGuardar) {
  const d = JSON.parse(JSON.stringify(Object.assign({ cerraduras: [], llaves: [] }, base || {})))
  const nuevo = !d.id
  const nombre = entrada(d.nombre, { placeholder: 'Ej.: Casa, Local, Depto 4°B, Oficina centro' })
  const direccion = entrada(d.direccion, { placeholder: 'Calle y número' })
  const localidad = entrada(d.localidad != null ? d.localidad : leerLocal('mb.ultimaLocalidad', 'Alejandro Roca'))
  const referencia = entrada(d.referencia, { placeholder: 'Piso, timbre, entre calles…' })
  const contacto = entrada(d.contacto, { placeholder: 'Ej.: Portero Luis 351 444-5555' })
  const zona = el('div', {})
  const pintarCerraduras = () => poner(zona,
    d.cerraduras.map((k, i) => {
      const ubic = entrada(k.ubicacion, { placeholder: 'Dónde', list: 'lista-ubicaciones', oninput: (ev) => { k.ubicacion = ev.target.value } })
      const tipo = selector([{ valor: '', texto: 'Tipo…' }].concat(TIPOS_CERRADURA.map((x) => ({ valor: x, texto: x }))), k.tipo || '', { onchange: (ev) => { k.tipo = ev.target.value } })
      const marca = entrada(k.marca, { placeholder: 'Marca (Kallay, Trabex, Prive…)', oninput: (ev) => { k.marca = ev.target.value } })
      const modelo = entrada(k.modelo, { placeholder: 'Modelo / medida', oninput: (ev) => { k.modelo = ev.target.value } })
      const notas = entrada(k.notas, { placeholder: 'Notas (ej.: cilindro 60 mm, llave de seguridad)', oninput: (ev) => { k.notas = ev.target.value } })
      return el('div', { clase: 'tarjeta cerradura-editar' },
        el('div', { clase: 'tarjeta-cab' }, el('b', {}, 'Cerradura ' + (i + 1)), el('button', { type: 'button', clase: 'btn-ico', 'aria-label': 'Sacar cerradura', onclick: () => { d.cerraduras.splice(i, 1); pintarCerraduras() } }, icono('basura'))),
        el('div', { clase: 'dos' }, ubic, tipo), el('div', { clase: 'dos', estilo: { marginTop: '8px' } }, marca, modelo), el('div', { estilo: { marginTop: '8px' } }, notas))
    }),
    el('button', { type: 'button', clase: 'btn suave ancho', onclick: () => { d.cerraduras.push({ id: uuid(), ubicacion: d.cerraduras.length ? '' : 'Puerta principal', tipo: '' }); pintarCerraduras() } }, icono('sumar'), 'Agregar cerradura'))
  const guardar = () => {
    if (!direccion.value.trim()) { toast('Poné la dirección.', 'mal'); direccion.focus(); return }
    const c = JSON.parse(JSON.stringify(Datos.get(cliente.id) || cliente))
    c.domicilios = c.domicilios || []
    Object.assign(d, { nombre: nombre.value.trim(), direccion: direccion.value.trim(), localidad: localidad.value.trim(), referencia: referencia.value.trim(), contacto: contacto.value.trim() })
    d.cerraduras = d.cerraduras.filter((k) => k.ubicacion || k.tipo || k.marca || k.modelo || k.notas)
    if (nuevo) { d.id = uuid(); c.domicilios.push(d) } else {
      const i = c.domicilios.findIndex((x) => x.id === d.id)
      // Las llaves no se tocan desde aca (estan protegidas): se conservan las que hay.
      if (i >= 0) c.domicilios[i] = Object.assign({}, d, { llaves: c.domicilios[i].llaves || [] })
    }
    guardarLocal('mb.ultimaLocalidad', d.localidad)
    Datos.guardar(c)
    h.cerrar()
    toast('Domicilio guardado', 'ok')
    if (alGuardar) alGuardar(d)
  }
  const borrar = async () => {
    const usado = Datos.lista('trabajo').some((t) => t.domicilioId === d.id)
    if (usado) return toast('Tiene trabajos hechos: no se puede borrar (sirve de historial).', 'mal', 5)
    if (!(await confirmar('Borrar domicilio', '¿Borrar ' + (d.nombre || d.direccion) + ' con sus cerraduras y llaves?', 'Borrar', true))) return
    const c = JSON.parse(JSON.stringify(Datos.get(cliente.id)))
    c.domicilios = c.domicilios.filter((x) => x.id !== d.id)
    Datos.guardar(c)
    h.cerrar()
  }
  const h = hoja({
    titulo: nuevo ? 'Domicilio nuevo · ' + cliente.nombre : 'Domicilio · ' + cliente.nombre,
    completa: true,
    cuerpo: [
      el('datalist', { id: 'lista-ubicaciones' }, UBICACIONES.map((u) => el('option', { value: u }))),
      campo('Dirección', direccion),
      el('div', { clase: 'dos' }, campo('Localidad', localidad), campo('Nombre (opcional)', nombre)),
      campo('Referencia', referencia), campo('Contacto en el lugar', contacto, 'Útil para inmobiliarias y consorcios: encargado, inquilino, portero'),
      el('h3', {}, 'Cerraduras de este domicilio'), zona,
      nuevo ? null : el('button', { clase: 'btn peligro chico', estilo: { marginTop: '18px' }, onclick: borrar }, icono('basura'), 'Borrar domicilio')
    ],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, 'Guardar')]
  })
  pintarCerraduras()
  if (nuevo) setTimeout(() => direccion.focus(), 60)
}

// --- autos ----------------------------------------------------------------------------------
function editarVehiculo (cliente, base, alGuardar) {
  const v = Object.assign({}, base || {})
  const nuevo = !v.id
  const marca = entrada(v.marca, { placeholder: 'Ford, Fiat, VW…' })
  const modelo = entrada(v.modelo, { placeholder: 'Ka, Palio, Gol…' })
  const anio = entrada(v.anio, { inputmode: 'numeric', placeholder: '2015' })
  const patente = entrada(v.patente, { placeholder: 'AB123CD', autocapitalize: 'characters' })
  const tipoLlave = selector([{ valor: '', texto: 'Elegí…' }].concat(TIPOS_LLAVE_AUTO.map((x) => ({ valor: x, texto: x }))), v.tipoLlave || '')
  const chipT = entrada(v.chip, { placeholder: 'Ej.: ID46, ID48, 4D63' })
  const notas = areaTexto(v.notas, { rows: 2 })
  const guardar = () => {
    if (!marca.value.trim() && !modelo.value.trim()) { toast('Poné al menos la marca o el modelo.', 'mal'); return }
    const c = JSON.parse(JSON.stringify(Datos.get(cliente.id) || cliente))
    c.vehiculos = c.vehiculos || []
    Object.assign(v, { marca: marca.value.trim(), modelo: modelo.value.trim(), anio: anio.value.trim(), patente: patente.value.trim().toUpperCase(), tipoLlave: tipoLlave.value, chip: chipT.value.trim(), notas: notas.value.trim() })
    if (nuevo) { v.id = uuid(); c.vehiculos.push(v) } else {
      const i = c.vehiculos.findIndex((x) => x.id === v.id)
      if (i >= 0) c.vehiculos[i] = Object.assign({}, v, { codigo: c.vehiculos[i].codigo })
    }
    Datos.guardar(c)
    h.cerrar()
    if (alGuardar) alGuardar(v)
  }
  const h = hoja({
    titulo: nuevo ? 'Auto nuevo' : 'Auto',
    cuerpo: [el('div', { clase: 'dos' }, campo('Marca', marca), campo('Modelo', modelo)), el('div', { clase: 'dos' }, campo('Año', anio), campo('Patente', patente)),
      el('div', { clase: 'dos' }, campo('Tipo de llave', tipoLlave), campo('Chip / transponder', chipT)), campo('Notas', notas),
      el('p', { clase: 'sub' }, 'El código de la llave se guarda aparte, protegido con tu clave de llaves.'),
      nuevo ? null : el('button', { clase: 'btn peligro chico', onclick: async () => {
        if (Datos.lista('trabajo').some((t) => t.vehiculoId === v.id)) return toast('Tiene trabajos hechos: no se puede borrar.', 'mal')
        if (!(await confirmar('Borrar auto', '¿Borrarlo?', 'Borrar', true))) return
        const c = JSON.parse(JSON.stringify(Datos.get(cliente.id))); c.vehiculos = c.vehiculos.filter((x) => x.id !== v.id); Datos.guardar(c); h.cerrar()
      } }, icono('basura'), 'Borrar auto')],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: guardar }, 'Guardar')]
  })
}

// --- llaves (protegidas con clave) ------------------------------------------------------------
// La clave de llaves es aparte de la de entrar: si alguien agarra el celular
// desbloqueado, igual no ve los codigos. Queda abierta 5 minutos.
const LLAVES = { hasta: 0 }
async function desbloquearLlaves () {
  if (Date.now() < LLAVES.hasta) return true
  const conf = Datos.config()
  if (!conf.pinLlaves) {
    return new Promise((ok) => {
      let listo = false
      const p1 = el('input', { type: 'password', inputmode: 'numeric', placeholder: '4 a 8 números', autocomplete: 'new-password' })
      const p2 = el('input', { type: 'password', inputmode: 'numeric', placeholder: 'Repetila', autocomplete: 'new-password' })
      const error = el('div', { clase: 'error' })
      const h = hoja({
        titulo: 'Clave de llaves',
        cuerpo: [el('p', { clase: 'tenue' }, 'Los códigos de llaves son delicados. Elegí una clave de números para verlos (es distinta de la de entrar).'), campo('Clave nueva', p1), campo('Otra vez', p2), error],
        pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: async () => {
          if (!/^\d{4,8}$/.test(p1.value)) { error.textContent = 'Tienen que ser de 4 a 8 números.'; return }
          if (p1.value !== p2.value) { error.textContent = 'No son iguales.'; return }
          Datos.guardar(Object.assign(Datos.config(), { pinLlaves: await sha256('mb-llaves:' + p1.value) }))
          LLAVES.hasta = Date.now() + 5 * 60000
          listo = true
          h.cerrar()
        } }, 'Guardar clave')],
        alCerrar: () => ok(listo)
      })
    })
  }
  return new Promise((ok) => {
    let listo = false
    const pin = el('input', { type: 'password', inputmode: 'numeric', placeholder: 'Clave de llaves', autocomplete: 'off', clase: 'numero-grande centro' })
    const error = el('div', { clase: 'error centro' })
    const probar = async () => {
      if ((await sha256('mb-llaves:' + pin.value)) === Datos.config().pinLlaves) { LLAVES.hasta = Date.now() + 5 * 60000; listo = true; h.cerrar() } else { error.textContent = 'Clave equivocada.'; pin.value = ''; vibrar(120) }
    }
    pin.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') probar() })
    const h = hoja({
      titulo: 'Clave de llaves',
      cuerpo: [el('div', { clase: 'ico-grande' }, icono('candado')), pin, error, el('p', { clase: 'sub centro' }, '¿No te acordás? Se cambia en Ajustes.')],
      pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: probar }, 'Ver')],
      alCerrar: () => ok(listo)
    })
  })
}

async function verLlaves (clienteId, domicilioId) {
  if (!(await desbloquearLlaves())) return
  const cuerpo = el('div', {})
  let h = null
  const pintarLlaves = () => {
    const c = Datos.get(clienteId)
    const d = c && (c.domicilios || []).find((x) => x.id === domicilioId)
    if (!d) { h.cerrar(); return }
    const llaves = d.llaves || []
    poner(cuerpo,
      el('p', { clase: 'sub' }, [d.nombre, d.direccion].filter(Boolean).join(' · ')),
      llaves.length ? llaves.map((k) => {
        const total = (k.copias || []).reduce((s, x) => s + (Number(x.cantidad) || 0), 0)
        return el('div', { clase: 'tarjeta' },
          el('div', { clase: 'tarjeta-cab' }, el('div', {}, el('b', { clase: 'grande-texto' }, k.puerta || 'Llave'), el('div', { clase: 'sub' }, [k.sistema, k.marca].filter(Boolean).join(' · '))),
            el('button', { clase: 'btn-ico', 'aria-label': 'Editar', onclick: () => editarLlave(clienteId, domicilioId, k) }, icono('editar'))),
          k.codigo ? el('div', { clase: 'codigo-llave' }, el('span', { clase: 'sub' }, 'Código'), el('b', { clase: 'num' }, k.codigo), el('button', { clase: 'btn-ico', 'aria-label': 'Copiar', onclick: () => copiarTexto(k.codigo) }, icono('copiar'))) : null,
          k.notas ? el('div', { clase: 'sub' }, k.notas) : null,
          el('div', { clase: 'fila' }, el('span', { clase: 'tenue' }, 'Copias entregadas'), el('b', {}, String(total))),
          (k.copias || []).slice().reverse().map((x) => el('div', { clase: 'sub' }, fechaCorta(x.fecha) + ' · ' + x.cantidad + (x.cantidad === 1 ? ' copia' : ' copias') + (x.aQuien ? ' a ' + x.aQuien : ''))),
          el('button', { clase: 'btn chico suave', estilo: { marginTop: '8px' }, onclick: () => anotarCopias(clienteId, domicilioId, k) }, icono('sumar'), 'Anotar copias entregadas'))
      }) : vacio('Sin llaves anotadas.', 'llave'),
      el('button', { clase: 'btn suave ancho', onclick: () => editarLlave(clienteId, domicilioId, null) }, icono('sumar'), 'Agregar llave'))
  }
  const quitar = Datos.alCambiar(() => { if (!h.cerrado) pintarLlaves() })
  h = hoja({ titulo: 'Llaves', completa: true, cuerpo, alCerrar: quitar })
  pintarLlaves()
}
function guardarLlaves (clienteId, domicilioId, cambiar) {
  const c = JSON.parse(JSON.stringify(Datos.get(clienteId)))
  const d = c.domicilios.find((x) => x.id === domicilioId)
  d.llaves = cambiar(d.llaves || [])
  Datos.guardar(c)
}
function editarLlave (clienteId, domicilioId, base) {
  const k = Object.assign({ copias: [] }, base || {})
  const puerta = entrada(k.puerta, { placeholder: 'Ej.: Puerta principal', list: 'lista-ubicaciones-llave' })
  const sistema = selector(SISTEMAS_LLAVE, k.sistema || SISTEMAS_LLAVE[0])
  const marca = entrada(k.marca, { placeholder: 'Marca del cilindro / llave' })
  const codigo = entrada(k.codigo, { placeholder: 'Código de corte o combinación', clase: 'num' })
  const notas = areaTexto(k.notas, { rows: 2 })
  const h = hoja({
    titulo: base ? 'Editar llave' : 'Llave nueva',
    cuerpo: [el('datalist', { id: 'lista-ubicaciones-llave' }, UBICACIONES.map((u) => el('option', { value: u }))),
      campo('Qué abre', puerta), el('div', { clase: 'dos' }, campo('Sistema', sistema), campo('Marca', marca)), campo('Código', codigo), campo('Notas', notas),
      base ? el('button', { clase: 'btn peligro chico', onclick: async () => { if (await confirmar('Borrar llave', '¿Borrar esta llave?', 'Borrar', true)) { guardarLlaves(clienteId, domicilioId, (ls) => ls.filter((x) => x.id !== k.id)); h.cerrar() } } }, icono('basura'), 'Borrar llave') : null],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: () => {
      Object.assign(k, { puerta: puerta.value.trim(), sistema: sistema.value, marca: marca.value.trim(), codigo: codigo.value.trim(), notas: notas.value.trim() })
      if (!k.id) { k.id = uuid(); guardarLlaves(clienteId, domicilioId, (ls) => ls.concat([k])) } else guardarLlaves(clienteId, domicilioId, (ls) => ls.map((x) => (x.id === k.id ? Object.assign({}, x, k) : x)))
      h.cerrar()
    } }, 'Guardar')]
  })
}
function anotarCopias (clienteId, domicilioId, k) {
  const cant = entrada('1', { inputmode: 'numeric', clase: 'num numero-grande' })
  const aQuien = entrada('', { placeholder: 'Ej.: inquilino nuevo, Sra. Gómez' })
  const fecha = entradaFecha(hoyISO())
  const h = hoja({
    titulo: 'Copias de ' + (k.puerta || 'la llave'),
    cuerpo: [el('div', { clase: 'dos' }, campo('Cantidad', cant), campo('Fecha', fecha)), campo('A quién se entregaron', aQuien)],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: () => {
      const n = Number(cant.value)
      if (!(n > 0)) { toast('Poné cuántas copias.', 'mal'); return }
      guardarLlaves(clienteId, domicilioId, (ls) => ls.map((x) => (x.id === k.id ? Object.assign({}, x, { copias: (x.copias || []).concat([{ fecha: fecha.value || hoyISO(), cantidad: n, aQuien: aQuien.value.trim() }]) }) : x)))
      h.cerrar()
    } }, 'Anotar')]
  })
}
async function verCodigoAuto (clienteId, vehiculoId) {
  if (!(await desbloquearLlaves())) return
  const c = Datos.get(clienteId)
  const v = (c.vehiculos || []).find((x) => x.id === vehiculoId)
  const codigo = entrada(v.codigo, { placeholder: 'Código de llave / PIN del inmovilizador', clase: 'num' })
  const h = hoja({
    titulo: 'Código · ' + [v.marca, v.modelo].filter(Boolean).join(' '),
    cuerpo: [campo('Código', codigo)],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cerrar'), el('button', { clase: 'btn primario', onclick: () => {
      const cc = JSON.parse(JSON.stringify(Datos.get(clienteId)))
      cc.vehiculos = cc.vehiculos.map((x) => (x.id === vehiculoId ? Object.assign({}, x, { codigo: codigo.value.trim() }) : x))
      Datos.guardar(cc); h.cerrar(); toast('Guardado', 'ok')
    } }, 'Guardar')]
  })
}
