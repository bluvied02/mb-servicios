'use strict'
// AGENDA DE TRABAJOS
//
// Los trabajos (y las visitas para presupuestar) que tienen fecha, por dia:
// una tira con la semana (o el mes entero) y abajo lo de ese dia por hora.
// Tambien lo que quedo atrasado y lo que todavia no tiene fecha, para agendarlo.
// Desde cada trabajo: cambiar la fecha y avisarle el turno al cliente por WhatsApp.

const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

// Lo agendado (sin cancelados ni ventas de mostrador).
const enAgenda = (t) => !!t.fecha && t.estado !== 'cancelado' && t.clase !== 'venta'
const horaDe = (t) => (/T\d/.test(t.fecha || '') ? horaCorta(t.fecha) : '')
function agendaPorDia () {
  const m = new Map()
  for (const t of Datos.lista('trabajo')) {
    if (!enAgenda(t)) continue
    const d = diaDe(t.fecha)
    if (!m.has(d)) m.set(d, [])
    m.get(d).push(t)
  }
  for (const l of m.values()) l.sort((a, b) => (horaDe(a) || '99').localeCompare(horaDe(b) || '99') || a.numero - b.numero)
  return m
}
function trabajosDelDia (dia, menosId) { return (agendaPorDia().get(dia) || []).filter((t) => t.id !== menosId) }

// "Lista | Agenda" arriba de Trabajos y de la Agenda.
function segTrabajos (actual) {
  return el('div', { clase: 'seg', estilo: { marginBottom: '12px' } },
    el('button', { clase: actual === 'trabajos' ? 'activo' : '', onclick: () => irA('trabajos') }, 'Lista'),
    el('button', { clase: actual === 'agenda' ? 'activo' : '', onclick: () => irA('agenda') }, 'Agenda'))
}

VISTAS.agenda = function (main) {
  const hoy = hoyISO()
  const dia = APP.filtros.agendaDia || hoy
  const modo = APP.filtros.agendaModo || 'semana'
  const porDia = agendaPorDia()
  const elegir = (d, m) => { APP.filtros.agendaDia = d; if (m) APP.filtros.agendaModo = m; pintar() }
  const abiertos = Datos.lista('trabajo').filter((t) => t.clase === 'trabajo' && (t.estado === 'pendiente' || t.estado === 'en_curso'))
  const atrasados = abiertos.filter((t) => t.fecha && diaDe(t.fecha) < hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const sinFecha = abiertos.filter((t) => !t.fecha).sort((a, b) => a.numero - b.numero)
  const cuenta = (d) => (porDia.get(d) || []).length

  // Navegacion: semana o mes
  let nav, tira
  if (modo === 'mes') {
    const [a, m] = dia.split('-').map(Number)
    const primero = Calculo.diaISO(new Date(a, m - 1, 1))
    const ultimo = Calculo.diaISO(new Date(a, m, 0))
    const desde = Calculo.inicioSemana(primero)
    const celdas = []
    for (let d = desde; d <= ultimo || celdas.length % 7; d = sumarDias(d, 1)) celdas.push(d)
    const titulo = new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    nav = navAgenda(titulo, () => elegir(Calculo.diaISO(new Date(a, m - 2, 1))), () => elegir(Calculo.diaISO(new Date(a, m, 1))))
    tira = el('div', { clase: 'mes-agenda' },
      DIAS_CORTOS.map((x) => el('div', { clase: 'dow' }, x)),
      celdas.map((d) => {
        const n = cuenta(d)
        return el('button', { clase: 'celda' + (d.slice(0, 7) !== dia.slice(0, 7) ? ' fuera' : '') + (d === hoy ? ' hoy' : '') + (d === dia ? ' sel' : ''), onclick: () => elegir(d, 'semana') },
          el('span', {}, String(Number(d.slice(8)))), n ? el('i', { clase: 'puntos' }, n > 3 ? n : '•'.repeat(n)) : null)
      }))
  } else {
    const lunes = Calculo.inicioSemana(dia)
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
    const titulo = fechaCorta(lunes).replace(/^\S+ /, '') + ' al ' + fechaCorta(dias[6]).replace(/^\S+ /, '')
    nav = navAgenda(titulo, () => elegir(sumarDias(dia, -7)), () => elegir(sumarDias(dia, 7)))
    tira = el('div', { clase: 'semana-agenda' }, dias.map((d, i) => {
      const n = cuenta(d)
      return el('button', { clase: 'dia' + (d === hoy ? ' hoy' : '') + (d === dia ? ' sel' : ''), onclick: () => elegir(d) },
        el('span', { clase: 'dow' }, DIAS_CORTOS[i]), el('b', {}, String(Number(d.slice(8)))), el('i', { clase: 'puntos' }, n ? (n > 3 ? n : '•'.repeat(n)) : ''))
    }))
  }

  const delDia = porDia.get(dia) || []
  poner(main,
    cabecera('Agenda', null, el('button', { clase: 'btn primario', onclick: () => editarTrabajo({ clase: 'trabajo', fecha: dia + 'T09:00' }) }, icono('sumar'), 'Agendar trabajo')),
    segTrabajos('agenda'),
    el('div', { clase: 'tarjeta agenda' },
      el('div', { clase: 'nav-agenda' }, nav,
        el('div', { clase: 'chips' },
          dia !== hoy ? el('button', { clase: 'btn chico', onclick: () => elegir(hoy) }, 'Hoy') : null,
          el('div', { clase: 'seg' }, [['semana', 'Semana'], ['mes', 'Mes']].map(([id, n]) => el('button', { clase: modo === id ? 'activo' : '', onclick: () => elegir(dia, id) }, n))))),
      tira),
    el('div', { clase: 'tarjeta sin-relleno' },
      el('div', { clase: 'tarjeta-cab', estilo: { padding: '10px 16px 0' } }, el('h2', {}, dia === hoy ? 'Hoy, ' + fechaCorta(dia) : dia === sumarDias(hoy, 1) ? 'Mañana, ' + fechaCorta(dia) : fechaCorta(dia)),
        el('span', { clase: 'sub' }, cuantos(delDia.length, 'trabajo', 'trabajos'))),
      delDia.length ? el('div', { clase: 'lista' }, delDia.map((t) => filaAgenda(t))) : vacio('No hay nada agendado este día.', 'calendario', el('button', { clase: 'btn', onclick: () => editarTrabajo({ clase: 'trabajo', fecha: dia + 'T09:00' }) }, icono('sumar'), 'Agendar un trabajo acá'))),
    atrasados.length ? el('div', { clase: 'tarjeta sin-relleno' },
      el('h2', { estilo: { padding: '10px 16px 0' }, clase: 'rojo' }, 'Quedaron sin terminar'),
      el('p', { clase: 'sub', estilo: { padding: '0 16px' } }, 'Tenían fecha de antes de hoy. Marcalos terminados o cambiales la fecha.'),
      el('div', { clase: 'lista' }, atrasados.map((t) => filaAgenda(t, true)))) : null,
    sinFecha.length ? el('div', { clase: 'tarjeta sin-relleno' },
      el('h2', { estilo: { padding: '10px 16px 0' } }, 'Sin fecha'),
      el('div', { clase: 'lista' }, sinFecha.map((t) => filaAgenda(t, true)))) : null)
}

function navAgenda (titulo, antes, despues) {
  return el('div', { clase: 'nav-titulo' },
    el('button', { clase: 'btn-ico', 'aria-label': 'Anterior', onclick: antes }, icono('atras')),
    el('b', {}, titulo.charAt(0).toUpperCase() + titulo.slice(1)),
    el('button', { clase: 'btn-ico', 'aria-label': 'Siguiente', onclick: despues }, icono('flecha')))
}

function filaAgenda (t, conFecha) {
  const c = Datos.get(t.clienteId)
  const lugar = lugarTrabajo(t)
  const dom = c && (c.domicilios || []).find((d) => d.id === t.domicilioId)
  const hora = horaDe(t)
  return el('div', { clase: 'item agenda-item' + (t.estado === 'terminado' ? ' inactivo' : '') },
    el('button', { clase: 'enlace agenda-cuerpo', onclick: () => verTrabajo(t.id) },
      el('div', { clase: 'hora num' }, conFecha && t.fecha ? fechaCorta(t.fecha).replace(/^\S+ /, '') : hora || '—'),
      el('div', { clase: 'cuerpo' },
        el('b', {}, (c ? c.nombre : 'Sin cliente') + ' · #' + t.numero),
        el('span', { clase: 'sub' }, [t.servicio, lugar && lugar.direccion, conFecha && hora ? hora : null].filter(Boolean).join(' · ')),
        el('span', { clase: 'chips', estilo: { marginTop: '4px' } }, chipEstado(t), t.urgencia && t.estado !== 'terminado' ? chip('Urgente', 'mal') : null, t.turnoAvisado ? chip('Turno avisado', 'ok') : null))),
    el('div', { clase: 'rapidas' },
      dom ? el('a', { clase: 'btn-ico', href: linkMapa(dom.direccion, dom.localidad), target: '_blank', rel: 'noopener', 'aria-label': 'Cómo llegar' }, icono('mapa')) : null,
      t.estado !== 'terminado' ? el('button', { clase: 'btn-ico', 'aria-label': 'Cambiar fecha', onclick: () => cambiarFechaTrabajo(t) }, icono('calendario')) : null))
}

// --- cambiar la fecha de un trabajo ----------------------------------------------------------------
function cambiarFechaTrabajo (t) {
  const hoy = hoyISO()
  const dia = entradaFecha(t.fecha ? diaDe(t.fecha) : hoy)
  const hora = el('input', { type: 'time', valor: horaDe(t) || '09:00', step: 900 })
  const ese = el('div', {})
  const pintarEse = () => poner(ese, avisoMismoDia(dia.value, t.id))
  dia.addEventListener('change', pintarEse)
  const rapido = (d, txt) => el('button', { type: 'button', clase: 'chip-btn', onclick: () => { dia.value = d; pintarEse() } }, txt)
  const h = hoja({
    titulo: 'Fecha del trabajo #' + t.numero,
    cuerpo: [el('div', { clase: 'chips', estilo: { marginBottom: '10px' } }, rapido(hoy, 'Hoy'), rapido(sumarDias(hoy, 1), 'Mañana'), rapido(sumarDias(hoy, 2), 'Pasado')),
      el('div', { clase: 'dos' }, campo('Día', dia), campo('Hora', hora)), ese],
    pie: [t.fecha ? el('button', { clase: 'btn', onclick: () => { const x = Object.assign({}, Datos.get(t.id), { fecha: null }); delete x.turnoAvisado; Datos.guardar(x); h.cerrar() } }, 'Sacar fecha') : el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'),
      el('button', { clase: 'btn primario', onclick: () => {
        if (!dia.value) { toast('Elegí el día.', 'mal'); return }
        const nueva = dia.value + 'T' + (hora.value || '09:00')
        const x = Object.assign({}, Datos.get(t.id), { fecha: nueva })
        if (nueva !== t.fecha) delete x.turnoAvisado
        Datos.guardar(x)
        h.cerrar()
        toast('Agendado: ' + fechaCorta(nueva) + ' ' + horaCorta(nueva), 'ok')
      } }, 'Guardar')]
  })
  pintarEse()
}
// "Ese dia ya tenes: ..." (para no pisar turnos).
function avisoMismoDia (dia, menosId) {
  if (!dia) return null
  const otros = trabajosDelDia(dia, menosId).filter((x) => x.estado !== 'terminado')
  if (!otros.length) return el('p', { clase: 'sub' }, 'Ese día no tenés nada más agendado.')
  return el('div', { clase: 'aviso info' }, el('b', {}, 'Ese día ya tenés:'),
    otros.map((x) => el('div', {}, (horaDe(x) || 'sin hora') + ' · ' + ((Datos.get(x.clienteId) || {}).nombre || '') + ' · ' + (x.servicio || ''))))
}

// --- avisarle el turno al cliente ---------------------------------------------------------------
function avisarTurno (t) {
  const conf = Datos.config()
  const c = Datos.get(t.clienteId) || {}
  const dom = (c.domicilios || []).find((d) => d.id === t.domicilioId)
  const hora = horaDe(t)
  const cuando = diaDe(t.fecha) === hoyISO() ? 'hoy' : diaDe(t.fecha) === sumarDias(hoyISO(), 1) ? 'mañana ' + fechaCorta(t.fecha) : 'el ' + fechaCorta(t.fecha)
  const texto = 'Hola ' + primerNombre(c.nombre) + ', te escribimos de *' + conf.negocio + '*. Te confirmamos la visita ' + cuando + (hora ? ' a las ' + hora : '') +
    (dom ? ' en ' + [dom.direccion, dom.referencia].filter(Boolean).join(', ') : '') + (t.servicio ? ' (' + t.servicio.toLowerCase() + ')' : '') + '. Cualquier cambio avisanos. ¡Gracias!'
  abrirWhatsApp(c.telefono, texto)
  Datos.guardar(Object.assign({}, Datos.get(t.id), { turnoAvisado: new Date().toISOString() }))
}
