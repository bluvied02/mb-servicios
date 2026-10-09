'use strict'
// DONDE SE GUARDA TODO
//
// Todo (clientes, productos, trabajos, pagos, gastos...) es una lista de
// "fichas". Cada ficha se guarda entera:
//   - en este navegador (para que abra al instante y ande sin señal), y
//   - en la nube (Supabase), para verlo igual en la compu y en el celular.
// Lo que se anota sin señal queda en una cola y sube solo cuando vuelve.
//
// Con ?prueba en el link no se toca la nube: es una copia de mentira en este
// navegador, con clientes y trabajos de ejemplo (sirve para mostrarlo).
//
// Nada se borra de verdad: se marca "borrado" (asi se puede recuperar).

const PRUEBA = /[?&]prueba\b/.test(location.search)
const PRE = PRUEBA ? 'mbp.' : 'mb.'

const SERVICIOS = ['Apertura de puerta', 'Cambio de combinación', 'Instalación de cerradura', 'Reparación de cerradura', 'Copia de llaves', 'Llave de auto', 'Caja fuerte', 'Puerta blindada', 'Cámaras de seguridad', 'Alarmas', 'Venta de mostrador', 'Otro']
const TIPOS_CERRADURA = ['Doble paleta', 'Cilindro (tipo Yale)', 'Multipunto', 'Cerrojo / pasador', 'Puerta blindada', 'Candado', 'Electrónica / digital', 'Portero eléctrico / electroimán', 'Barral antipánico', 'Caja fuerte', 'Otra']
const TIPOS_CLIENTE = ['Particular', 'Inmobiliaria / agencia', 'Consorcio / edificio', 'Comercio', 'Empresa', 'Otro']
const TIPOS_LLAVE_AUTO = ['Común (sin chip)', 'Con chip (transponder)', 'Navaja con control', 'Presencia (keyless)', 'Solo control']
const CATEGORIAS_GASTO = ['Combustible', 'Mercadería', 'Herramientas', 'Alquiler', 'Servicios (luz, internet, celular)', 'Impuestos', 'Sueldos', 'Otros']
const CONFIG_INICIAL = {
  negocio: 'MB Servicios', titular: 'Marcelo Barrios', rubro: 'Cerrajería · Cámaras y alarmas · Servicio 24 h', telefono: '3585 723 253', direccion: 'Dr. Carlos Sodini 587', localidad: 'Alejandro Roca, Córdoba', cuit: '', email: '', alias: '',
  recargoPct: 50, garantiaDias: 90, diasFiado: 15, redondeo: 10, margen: 40, seguimientoDias: 7,
  validezPresupuesto: 15, pinLlaves: null, servicios: SERVICIOS
}

// --- la nube (Supabase) -------------------------------------------------------------------------
const Nube = {
  sb: null,
  async iniciar () {
    let conf = leerLocal('mb.proyecto', null)
    try {
      const r = await fetch('proyecto.json', { cache: 'no-store' })
      if (r.ok) { conf = await r.json(); guardarLocal('mb.proyecto', conf) }
    } catch (e) {}
    if (!conf || !conf.url || !conf.anon) throw new Error(conf ? 'falta_nube' : 'sin_conexion')
    this.sb = window.supabase.createClient(conf.url, conf.anon, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mb-servicios' } })
  },
  async sesion () {
    const { data } = await this.sb.auth.getSession()
    return data.session ? data.session.user.email : null
  },
  async entrar (email, clave) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password: clave })
    if (error) throw error
  },
  recuperarClave (email) { return this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }) },
  async nuevaClave (clave) { const { error } = await this.sb.auth.updateUser({ password: clave }); if (error) throw error },
  async salir () { await this.sb.auth.signOut() },
  async traer (desde) {
    const out = []
    for (let i = 0; ; i += 1000) {
      let q = this.sb.from('mb_fichas').select('id,tipo,datos,borrado,actualizado').order('actualizado', { ascending: true }).range(i, i + 999)
      if (desde) q = q.gt('actualizado', desde)
      const { data, error } = await q
      if (error) throw error
      out.push(...data)
      if (data.length < 1000) break
    }
    return out
  },
  async subir (filas) {
    const { error } = await this.sb.from('mb_fichas').upsert(filas)
    if (error) throw error
  }
}

// --- prueba: sin nube ---------------------------------------------------------------------------
const SinNube = {
  async iniciar () {},
  async sesion () { return leerLocal(PRE + 'entro', false) ? 'prueba' : null },
  async entrar () { guardarLocal(PRE + 'entro', true) },
  async recuperarClave () { return {} },
  async nuevaClave () {},
  async salir () { guardarLocal(PRE + 'entro', false) },
  async traer () { return [] },
  async subir () {}
}

const Nubes = PRUEBA ? SinNube : Nube

// --- las fichas -------------------------------------------------------------------------------
const Datos = {
  fichas: new Map(), // id -> ficha
  cola: new Map(), // id -> version local que falta subir
  ultimo: null, // hasta cuando ya se trajo de la nube
  estado: 'ok', // 'ok' | 'sinc' | 'off'
  error: null,
  oyentes: [],
  subiendo: false,

  cargarLocal () {
    for (const f of leerLocal(PRE + 'fichas', [])) this.fichas.set(f.id, f)
    this.cola = new Map(leerLocal(PRE + 'cola', []))
    this.ultimo = leerLocal(PRE + 'ultimo', null)
  },
  guardarLocal () {
    try {
      localStorage.setItem(PRE + 'fichas', JSON.stringify([...this.fichas.values()]))
      localStorage.setItem(PRE + 'cola', JSON.stringify([...this.cola]))
      localStorage.setItem(PRE + 'ultimo', JSON.stringify(this.ultimo))
    } catch (e) {
      toast('El navegador se quedó sin lugar para guardar. Hacé un respaldo desde Ajustes.', 'mal', 8)
    }
  },
  borrarLocal () {
    for (const k of ['fichas', 'cola', 'ultimo', 'entro']) try { localStorage.removeItem(PRE + k) } catch (e) {}
    this.fichas.clear(); this.cola.clear(); this.ultimo = null
  },
  alCambiar (fn) { this.oyentes.push(fn); return () => { this.oyentes = this.oyentes.filter((x) => x !== fn) } },
  avisar (deLaNube) { for (const fn of this.oyentes) try { fn(deLaNube) } catch (e) { console.error(e) } },
  ponerEstado (e, error) {
    this.estado = e
    this.error = error || null
    const n = document.getElementById('conexion')
    if (n) pintarConexion(n)
  },

  // --- leer ---
  lista (tipo) { const out = []; for (const f of this.fichas.values()) if (f.tipo === tipo && !f.borrado) out.push(f); return out },
  get (id) { const f = this.fichas.get(id); return f && !f.borrado ? f : null },
  config () { return Object.assign({}, CONFIG_INICIAL, this.fichas.get('config') || {}, { id: 'config', tipo: 'config' }) },
  siguienteNumero () {
    let n = 0
    for (const f of this.fichas.values()) if (f.tipo === 'trabajo' && f.numero > n) n = f.numero
    return n + 1
  },

  // --- escribir ---
  guardar (ficha) {
    if (!ficha.tipo) throw new Error('ficha sin tipo')
    const ahora = new Date().toISOString()
    const f = Object.assign({}, ficha)
    if (!f.id) f.id = uuid()
    if (!f.creado) f.creado = ahora
    f.modificado = ahora
    f._v = ((this.fichas.get(f.id) || {})._v || 0) + 1
    this.fichas.set(f.id, f)
    this.cola.set(f.id, f._v)
    this.guardarLocal()
    this.avisar(false)
    this.subir()
    return f
  },
  guardarVarias (fichas) {
    const ahora = new Date().toISOString()
    const out = fichas.map((ficha) => {
      const f = Object.assign({}, ficha)
      if (!f.id) f.id = uuid()
      if (!f.creado) f.creado = ahora
      f.modificado = ahora
      f._v = ((this.fichas.get(f.id) || {})._v || 0) + 1
      this.fichas.set(f.id, f)
      this.cola.set(f.id, f._v)
      return f
    })
    this.guardarLocal()
    this.avisar(false)
    this.subir()
    return out
  },
  borrar (id) {
    const f = this.fichas.get(id)
    if (f) this.guardar(Object.assign({}, f, { borrado: true }))
  },

  // --- nube ---
  async subir () {
    if (this.subiendo || !this.cola.size) { if (!this.cola.size && this.estado === 'sinc') this.ponerEstado('ok'); return }
    this.subiendo = true
    this.ponerEstado('sinc')
    try {
      while (this.cola.size) {
        const ids = [...this.cola.keys()].slice(0, 200)
        const versiones = ids.map((id) => this.cola.get(id))
        const filas = ids.map((id) => {
          const f = this.fichas.get(id)
          const datos = Object.assign({}, f)
          for (const k of ['id', 'tipo', 'borrado', '_v', '_nube']) delete datos[k]
          return { id: f.id, tipo: f.tipo, datos, borrado: !!f.borrado }
        })
        await Nubes.subir(filas)
        ids.forEach((id, i) => { if (this.cola.get(id) === versiones[i]) this.cola.delete(id) })
        this.guardarLocal()
      }
      this.ponerEstado('ok')
    } catch (e) {
      this.ponerEstado('off', e)
    } finally {
      this.subiendo = false
    }
  },
  async traer () {
    try {
      // Se piden 2 minutos para atras por las dudas (lo repetido no molesta).
      const desde = this.ultimo ? new Date(new Date(this.ultimo).getTime() - 120000).toISOString() : null
      const filas = await Nubes.traer(desde)
      let cambio = false
      for (const r of filas) {
        if (!this.ultimo || r.actualizado > this.ultimo) this.ultimo = r.actualizado
        if (this.cola.has(r.id)) continue // lo de aca es mas nuevo y todavia no subio
        const actual = this.fichas.get(r.id)
        if (actual && actual._nube === r.actualizado) continue
        this.fichas.set(r.id, Object.assign({}, r.datos, { id: r.id, tipo: r.tipo, borrado: r.borrado || undefined, _nube: r.actualizado, _v: actual ? actual._v : 0 }))
        cambio = true
      }
      this.guardarLocal()
      if (cambio) this.avisar(true)
      if (this.estado === 'off' && !this.cola.size) this.ponerEstado('ok')
      return cambio
    } catch (e) {
      this.ponerEstado('off', e)
      throw e
    }
  },
  async sincronizar () {
    await this.subir()
    try { await this.traer() } catch (e) {}
  }
}

function pintarConexion (n) {
  const pend = Datos.cola.size
  n.className = 'conexion' + (Datos.estado === 'sinc' ? ' sinc' : Datos.estado === 'off' ? ' off' : '')
  const txt = PRUEBA ? 'Prueba' : Datos.estado === 'off' ? (pend ? 'Sin señal · ' + pend + ' sin subir' : 'Sin señal') : Datos.estado === 'sinc' ? 'Guardando…' : 'Guardado'
  poner(n, el('span', { clase: 'punto' }), txt)
  n.title = Datos.error ? String(Datos.error.message || Datos.error) : ''
}

window.addEventListener('online', () => Datos.sincronizar())
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && APP.listo) Datos.sincronizar() })
setInterval(() => { if (document.visibilityState === 'visible' && APP.listo) Datos.sincronizar() }, 60000)

const esDeRed = (e) => !!e && (e instanceof TypeError || /fetch|network|Failed to|Load failed|conexi/i.test(String(e.message || e)))
function textoError (e) {
  if (!e) return 'Algo salió mal.'
  if (typeof e === 'string') return e
  if (esDeRed(e)) return 'Sin conexión. Revisá el wifi o los datos y probá de nuevo.'
  return e.message || String(e)
}
