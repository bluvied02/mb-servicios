'use strict'
// AJUSTES: datos del negocio (salen en los PDF y los WhatsApp), los numeros
// de siempre (recargo, garantia, dias de fiado, redondeo), la clave de llaves,
// el respaldo y salir.

VISTAS.ajustes = function (main) {
  const conf = Datos.config()
  const c = (k, props) => entrada(conf[k], props)
  const f = {
    negocio: c('negocio'), titular: c('titular'), rubro: c('rubro'), telefono: c('telefono', { type: 'tel' }), direccion: c('direccion'), localidad: c('localidad'),
    cuit: c('cuit'), email: c('email', { type: 'email' }), alias: c('alias', { placeholder: 'Alias o CBU para transferencias' }),
    recargoPct: c('recargoPct', { inputmode: 'numeric', clase: 'num' }), garantiaDias: c('garantiaDias', { inputmode: 'numeric', clase: 'num' }),
    diasFiado: c('diasFiado', { inputmode: 'numeric', clase: 'num' }), margen: c('margen', { inputmode: 'numeric', clase: 'num' }),
    seguimientoDias: c('seguimientoDias', { inputmode: 'numeric', clase: 'num' }), validezPresupuesto: c('validezPresupuesto', { inputmode: 'numeric', clase: 'num' })
  }
  const redondeo = selector([{ valor: '0', texto: 'Sin redondear' }, { valor: '1', texto: 'A $1' }, { valor: '10', texto: 'A $10' }, { valor: '50', texto: 'A $50' }, { valor: '100', texto: 'A $100' }, { valor: '500', texto: 'A $500' }], String(conf.redondeo))
  const servicios = areaTexto((conf.servicios || SERVICIOS).join('\n'), { rows: 8 })
  const numeros = ['recargoPct', 'garantiaDias', 'diasFiado', 'margen', 'seguimientoDias', 'validezPresupuesto']
  const guardar = () => {
    const nuevo = Object.assign({}, conf)
    for (const k in f) nuevo[k] = numeros.includes(k) ? (Number(aNumero(f[k].value)) || 0) : f[k].value.trim()
    if (!nuevo.negocio) nuevo.negocio = 'MB Servicios'
    nuevo.redondeo = Number(redondeo.value)
    nuevo.servicios = servicios.value.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!nuevo.servicios.length) nuevo.servicios = SERVICIOS
    Datos.guardar(nuevo)
    toast('Ajustes guardados', 'ok')
  }
  poner(main,
    cabecera('Ajustes', 'Versión ' + VERSION_APP + (APP.email && !PRUEBA ? ' · ' + APP.email : '')),
    el('div', { clase: 'grilla' },
      el('div', { clase: 'tarjeta' }, el('h2', {}, 'Datos del negocio'), el('p', { clase: 'sub', estilo: { marginTop: '-6px' } }, 'Salen en los presupuestos y en los mensajes de WhatsApp.'),
        campo('Nombre', f.negocio), campo('Titular', f.titular), campo('Rubro / servicios', f.rubro),
        el('div', { clase: 'dos' }, campo('Celular', f.telefono), campo('CUIT', f.cuit)),
        el('div', { clase: 'dos' }, campo('Dirección', f.direccion), campo('Localidad', f.localidad)),
        campo('Email', f.email), campo('Alias para transferencias', f.alias, 'Se agrega en el recordatorio de pago')),
      el('div', { clase: 'tarjeta' }, el('h2', {}, 'Números de siempre'),
        el('div', { clase: 'dos' }, campo('Recargo urgencia %', f.recargoPct, 'Noche, feriado, 24 h'), campo('Garantía (días)', f.garantiaDias)),
        el('div', { clase: 'dos' }, campo('Fiado: paga en (días)', f.diasFiado), campo('Ganancia % de productos nuevos', f.margen)),
        el('div', { clase: 'dos' }, campo('Redondear precios', redondeo), campo('Presupuesto válido (días)', f.validezPresupuesto)),
        campo('Postventa: llamar a los (días)', f.seguimientoDias, 'Días después de terminar un trabajo. 0 = no avisar'),
        el('h3', {}, 'Servicios'), campo('Uno por renglón', servicios)),
      el('div', { clase: 'tarjeta' }, el('h2', {}, 'Clave de llaves'),
        el('p', { clase: 'sub' }, conf.pinLlaves ? 'Hay una clave puesta para ver los códigos de llaves.' : 'Todavía no hay clave. Se pide la primera vez que abrís las llaves de un domicilio.'),
        el('button', { clase: 'btn', onclick: cambiarClaveLlaves }, icono('candado'), conf.pinLlaves ? 'Cambiar la clave' : 'Poner clave')),
      el('div', { clase: 'tarjeta' }, el('h2', {}, 'Respaldo'),
        el('p', { clase: 'sub' }, 'Todo se guarda solo en la nube. Igual, cada tanto podés bajar una copia a la compu.'),
        el('div', { clase: 'chips' },
          el('button', { clase: 'btn', onclick: bajarRespaldo }, icono('descargar'), 'Bajar copia'),
          el('button', { clase: 'btn', onclick: subirRespaldo }, icono('compartir'), 'Recuperar una copia'))),
      el('div', { clase: 'tarjeta' }, el('h2', {}, 'Este dispositivo'),
        el('div', { clase: 'chips' }, botonInstalar(''),
          el('button', { clase: 'btn', onclick: () => Datos.sincronizar().then(() => toast(Datos.estado === 'off' ? 'Sin señal' : 'Todo guardado', Datos.estado === 'off' ? 'mal' : 'ok')) }, icono('refrescar'), 'Sincronizar'),
          PRUEBA ? el('button', { clase: 'btn peligro', onclick: async () => { if (await confirmar('Empezar de nuevo', 'Se borran los datos de prueba de este navegador y se cargan los de ejemplo otra vez.', 'Borrar', true)) { Datos.borrarLocal(); location.reload() } } }, 'Reiniciar la prueba')
            : el('button', { clase: 'btn peligro', onclick: salir }, icono('salir'), 'Salir'))),
      el('div', { clase: 'tarjeta' }, el('h2', {}, 'La tarjeta'), el('img', { src: 'logo.jpg', alt: 'Logo de ' + conf.negocio, estilo: { width: '100%', borderRadius: '10px' } }))),
    el('div', { clase: 'pie-fijo' }, el('button', { clase: 'btn primario grande', onclick: guardar }, icono('ok'), 'Guardar ajustes')))
}

async function salir () {
  const pend = Datos.cola.size
  if (pend && !(await confirmar('Hay cosas sin subir', pend + ' cambios todavía no llegaron a la nube (falta señal). Si salís ahora se pierden.', 'Salir igual', true))) return
  if (!pend && !(await confirmar('Salir', '¿Cerrar la sesión en este dispositivo?', 'Salir'))) return
  await Nubes.salir()
  Datos.borrarLocal()
  location.reload()
}

function cambiarClaveLlaves () {
  const conf = Datos.config()
  const actual = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off' })
  const p1 = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', placeholder: '4 a 8 números' })
  const p2 = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password' })
  const error = el('div', { clase: 'error' })
  const h = hoja({
    titulo: 'Clave de llaves',
    cuerpo: [conf.pinLlaves ? [campo('Clave actual', actual), el('p', { clase: 'sub', estilo: { marginTop: '-6px' } }, '¿No te la acordás? Escribí tu contraseña de entrar en lugar de la clave actual.')] : null,
      campo('Clave nueva', p1), campo('Otra vez', p2), error],
    pie: [el('button', { clase: 'btn', onclick: () => h.cerrar() }, 'Cancelar'), el('button', { clase: 'btn primario', onclick: async () => {
      if (conf.pinLlaves && (await sha256('mb-llaves:' + actual.value)) !== conf.pinLlaves) {
        // Si no se acuerda la clave, sirve la contraseña de entrar.
        let ok = PRUEBA
        if (!ok && actual.value) try { await Nubes.entrar(APP.email, actual.value); ok = true } catch (e) {}
        if (!ok) { error.textContent = 'La clave actual no es esa.'; return }
      }
      if (!/^\d{4,8}$/.test(p1.value)) { error.textContent = 'La nueva tiene que ser de 4 a 8 números.'; return }
      if (p1.value !== p2.value) { error.textContent = 'No son iguales.'; return }
      Datos.guardar(Object.assign(Datos.config(), { pinLlaves: await sha256('mb-llaves:' + p1.value) }))
      LLAVES.hasta = 0
      h.cerrar()
      toast('Clave cambiada', 'ok')
    } }, 'Guardar')]
  })
}

function bajarRespaldo () {
  const fichas = [...Datos.fichas.values()].map((f) => { const x = Object.assign({}, f); delete x._v; delete x._nube; return x })
  const blob = new Blob([JSON.stringify({ app: 'mb-servicios', version: VERSION_APP, fecha: new Date().toISOString(), fichas }, null, 1)], { type: 'application/json' })
  const a = el('a', { href: URL.createObjectURL(blob), download: 'mb-servicios-respaldo-' + hoyISO() + '.json' })
  document.body.append(a); a.click(); a.remove()
  toast('Copia bajada (' + fichas.length + ' fichas)', 'ok')
}
function subirRespaldo () {
  const archivo = el('input', { type: 'file', accept: '.json,application/json' })
  archivo.addEventListener('change', async () => {
    const f = archivo.files && archivo.files[0]
    if (!f) return
    let datos
    try { datos = JSON.parse(await f.text()) } catch (e) { return toast('Ese archivo no es una copia de MB Servicios.', 'mal') }
    if (!datos || datos.app !== 'mb-servicios' || !Array.isArray(datos.fichas)) return toast('Ese archivo no es una copia de MB Servicios.', 'mal')
    if (!(await confirmar('Recuperar copia', 'Copia del ' + fechaCorta(datos.fecha) + ' con ' + datos.fichas.length + ' fichas. Lo que está en la copia reemplaza a lo de ahora (lo nuevo que no está en la copia se mantiene).', 'Recuperar'))) return
    Datos.guardarVarias(datos.fichas)
    toast('Copia recuperada', 'ok')
  })
  archivo.click()
}
