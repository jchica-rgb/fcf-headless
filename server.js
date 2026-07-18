const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { google } = require("googleapis");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

/* ======================
   CONFIG
====================== */
function safeJson(v){
  try { return JSON.parse(v); } catch { return null; }
}

const SHEET_ID = process.env.SHEET_ID || "";
const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);

// JWT_SECRET es obligatorio. Sin ella, el servidor no arranca
// (antes usaba un valor de desarrollo inseguro por defecto).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ Falta la variable de entorno JWT_SECRET. El servidor no puede arrancar sin ella.");
  process.exit(1);
}

/* ======================
   CORS (restringido por whitelist)
   Configura en Render la variable ALLOWED_ORIGINS con las URLs
   de Vercel separadas por comas, ej:
   ALLOWED_ORIGINS=https://territori-futcat.vercel.app,https://territori-futcat-admin.vercel.app
====================== */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn("⚠️  ALLOWED_ORIGINS no está configurada — CORS queda abierto a cualquier origen. Configúrala en Render en cuanto tengas las URLs finales de Vercel.");
}

const corsOptions = {
  origin: function (origin, callback) {
    // Sin origin = llamadas server-to-server, curl, etc. Se permiten.
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origen no permitido por CORS: " + origin));
  }
};

app.use(cors(corsOptions));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions
});

function notificarActualizacion(){
  io.emit("partidos-actualizados");
}

const authGoogle = credentials
  ? new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    })
  : null;

async function getClient(){
  return await authGoogle.getClient();
}

async function getSheet(range){
  const client = await getClient();
  const sheets = google.sheets({ version:"v4", auth:client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId:SHEET_ID,
    range
  });

  return res.data.values || [];
}

const normalize = v =>
  String(v||"").trim().toLowerCase();

const isEmpty = v =>
  v===undefined || v===null || String(v).trim()==="";

/* ======================
   AUTH MIDDLEWARE
====================== */
function requireAuth(req,res,next){
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if(!token){
    return res.status(401).json({ ok:false, error:"No autorizado" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch(err){
    return res.status(401).json({ ok:false, error:"Sesión inválida o caducada" });
  }
}

function requireAdmin(req,res,next){
  if(!req.user || req.user.rol !== "admin"){
    return res.status(403).json({ ok:false, error:"Solo un administrador puede hacer esto" });
  }
  next();
}

/* ======================
   RATE LIMIT LOGIN
   Máximo 10 intentos por IP cada 15 minutos, para dificultar
   ataques de fuerza bruta contra bcrypt.compareSync.
====================== */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok:false, error:"Demasiados intentos de login. Prueba de nuevo en unos minutos." }
});

/* ======================
   LOGIN
====================== */
app.post("/login", loginLimiter, async (req,res)=>{
  const { usuario, password } = req.body;

  if(isEmpty(usuario) || isEmpty(password)){
    return res.status(400).json({ ok:false, error:"Usuario y contraseña son obligatorios" });
  }

  const rows = await getSheet("USUARIOS!A2:C");
  const fila = rows.find(r => normalize(r[0])===normalize(usuario));

  if(!fila){
    return res.status(401).json({ ok:false, error:"Usuario o contraseña incorrectos" });
  }

  const [ , passwordHash, rol ] = fila;
  const valido = bcrypt.compareSync(password, passwordHash || "");

  if(!valido){
    return res.status(401).json({ ok:false, error:"Usuario o contraseña incorrectos" });
  }

  const token = jwt.sign(
    { usuario: fila[0], rol: normalize(rol) || "editor" },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ ok:true, token, rol: normalize(rol) || "editor", usuario: fila[0] });
});

/* ======================
   CREAR USUARIO (solo admin)
====================== */
app.post("/usuarios", requireAuth, requireAdmin, async (req,res)=>{
  const { usuario, password, rol } = req.body;

  if(isEmpty(usuario) || isEmpty(password) || isEmpty(rol)){
    return res.status(400).json({ ok:false, error:"Usuario, contraseña y rol son obligatorios" });
  }

  if(rol!=="admin" && rol!=="editor"){
    return res.status(400).json({ ok:false, error:"Rol debe ser 'admin' o 'editor'" });
  }

  const rows = await getSheet("USUARIOS!A2:C");
  const yaExiste = rows.some(r => normalize(r[0])===normalize(usuario));

  if(yaExiste){
    return res.status(409).json({ ok:false, error:"Ese usuario ya existe" });
  }

  const hash = bcrypt.hashSync(password, 10);

  const client = await getClient();
  const sheets = google.sheets({ version:"v4", auth:client });

  await sheets.spreadsheets.values.append({
    spreadsheetId:SHEET_ID,
    range:"USUARIOS!A:C",
    valueInputOption:"RAW",
    requestBody:{
      values:[[ usuario, hash, rol ]]
    }
  });

  res.json({ ok:true, message:"Usuario creado correctamente" });
});

/* ======================
   LIGAS
====================== */
app.get("/ligas", async (req,res)=>{
  const rows = await getSheet("LIGAS!A2:B");
  res.json({
    data: rows.map(r=>({
      id: normalize(r[0]),
      nombre: r[1]
    }))
  });
});

/* ======================
   EQUIPOS
====================== */
app.get("/equipos", async (req,res)=>{
  const liga = normalize(req.query.liga);
  const rows = await getSheet("EQUIPOS!A2:D");

  res.json({
    data: rows
      .filter(r=>normalize(r[2])===liga)
      .map(r=>({
        nombre: r[1],
        logo: isEmpty(r[3]) ? null : r[3]
      }))
  });
});

/* ======================
   TEMPORADAS
====================== */
app.get("/temporadas", async (req,res)=>{
  const rows = await getSheet("PARTIDOS!B2:B");
  const seasons = [...new Set(rows.map(r=>r[0]).filter(Boolean))];
  seasons.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  res.json({ data: seasons });
});

/* ======================
   TEMPORADA ACTIVA
====================== */
app.get("/temporada-activa", async (req,res)=>{
  const rows = await getSheet("PARTIDOS!B2:B");
  const seasons = [...new Set(rows.map(r=>r[0]).filter(Boolean))];

  if(seasons.length===0){
    return res.json({ data:null });
  }

  seasons.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));

  res.json({
    data: seasons[seasons.length-1]
  });
});

/* ======================
   JORNADA "EDITABLE" DE UNA LIGA (para bloquear UPDATE)
   Es la jornada con el número más bajo que todavía
   tiene algún partido pendiente (sin resultado). Si no
   queda ninguna pendiente, es la última jugada.
====================== */
function calcularJornadaActual(filasLigaTemporada){
  const porJornada = {};

  filasLigaTemporada.forEach(r=>{
    const j = Number(r[2]);
    if(isNaN(j)) return;
    if(!porJornada[j]) porJornada[j] = [];
    const pendiente = isEmpty(r[5]) || isEmpty(r[6]);
    porJornada[j].push(pendiente);
  });

  const jornadasConPendiente = Object.keys(porJornada)
    .map(Number)
    .filter(j => porJornada[j].some(p => p===true))
    .sort((a,b)=>a-b);

  if(jornadasConPendiente.length>0){
    return jornadasConPendiente[0];
  }

  const todasLasJornadas = Object.keys(porJornada).map(Number);

  if(todasLasJornadas.length===0){
    return null;
  }

  return Math.max(...todasLasJornadas);
}

/* ======================
   JORNADA "PERMITIDA PARA CREAR"
   Igual que la anterior, pero si la jornada actual ya
   está completa del todo (sin pendientes), permite abrir
   la SIGUIENTE jornada (jornadaActual + 1) — así se puede
   seguir avanzando la temporada. Si no hay datos todavía
   para esa liga+temporada, no se restringe nada (primera
   vez que se registra algo ahí).
====================== */
function calcularJornadaPermitidaParaCrear(filasLigaTemporada){
  const porJornada = {};

  filasLigaTemporada.forEach(r=>{
    const j = Number(r[2]);
    if(isNaN(j)) return;
    if(!porJornada[j]) porJornada[j] = [];
    const pendiente = isEmpty(r[5]) || isEmpty(r[6]);
    porJornada[j].push(pendiente);
  });

  const jornadasConPendiente = Object.keys(porJornada)
    .map(Number)
    .filter(j => porJornada[j].some(p => p===true))
    .sort((a,b)=>a-b);

  if(jornadasConPendiente.length>0){
    return jornadasConPendiente[0];
  }

  const todasLasJornadas = Object.keys(porJornada).map(Number);

  if(todasLasJornadas.length===0){
    return null;
  }

  return Math.max(...todasLasJornadas) + 1;
}

/* ======================
   JORNADA ACTIVA (endpoint público, usado por el filtro
   del panel para preseleccionar la jornada "editable")
====================== */
app.get("/jornada-activa", async (req,res)=>{
  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

  const rows = await getSheet("PARTIDOS!A2:G");
  const filasLigaTemporada = rows.filter(r =>
    normalize(r[0])===liga && r[1]===temporada
  );

  const jornada = calcularJornadaActual(filasLigaTemporada);
  res.json({ data: jornada });
});

/* ======================
   JORNADA PERMITIDA PARA CREAR (endpoint público,
   usado para autorellenar el campo Jornada en el
   panel de "Crear Partido")
====================== */
app.get("/jornada-permitida-crear", async (req,res)=>{
  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

  const rows = await getSheet("PARTIDOS!A2:G");
  const filasLigaTemporada = rows.filter(r =>
    normalize(r[0])===liga && r[1]===temporada
  );

  const jornada = calcularJornadaPermitidaParaCrear(filasLigaTemporada);
  res.json({ data: jornada });
});

/* ======================
   PARTIDOS
====================== */
app.get("/partidos", async (req,res)=>{
  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;
  const jornada = req.query.jornada;

  const rows = await getSheet("PARTIDOS!A2:G");

  const data = rows.map((r,i)=>({
      row:i+2,
      liga: normalize(r[0]),
      temporada:r[1],
      jornada:r[2],
      local:r[3],
      visitante:r[4],
      goles_local: r[5]===undefined || r[5]==="" ? null : Number(r[5]),
      goles_visitante: r[6]===undefined || r[6]==="" ? null : Number(r[6]),
      jugado: !(r[5]===undefined || r[5]==="" || r[6]===undefined || r[6]==="")
    }))
    .filter(p =>
      (!liga || p.liga===liga) &&
      (!temporada || p.temporada===temporada) &&
      (!jornada || String(p.jornada)===String(jornada))
    );

  res.json({ data });
});

/* ======================
   VALIDACION COMUN CREAR/UPDATE
====================== */

// Un valor de goles es válido si está vacío (partido no jugado)
// o si es un entero >= 0. Antes esto solo se comprobaba en el
// frontend (admin-panel.html); ahora también se exige en el
// backend, para que una petición directa a la API no pueda
// guardar goles negativos, decimales o texto arbitrario.
function golesValido(v){
  if(isEmpty(v)) return true;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0;
}

function validarPartido(body){
  const { liga, temporada, jornada, local, visitante, goles_local, goles_visitante } = body;

  if(isEmpty(liga) || isEmpty(temporada) || isEmpty(local) || isEmpty(visitante)){
    return "Liga, temporada, local y visitante son obligatorios";
  }

  if(isEmpty(jornada)){
    return "La jornada es obligatoria";
  }

  if(normalize(local)===normalize(visitante)){
    return "Un equipo no puede jugar contra sí mismo";
  }

  if(!golesValido(goles_local) || !golesValido(goles_visitante)){
    return "Los goles deben ser números enteros mayores o iguales a 0 (o quedar vacíos si el partido no se ha jugado)";
  }

  if(isEmpty(goles_local) !== isEmpty(goles_visitante)){
    return "Rellena ambos marcadores, o déjalos los dos vacíos si el partido no se ha jugado";
  }

  return null;
}

async function validarLigaYEquiposExisten(liga, local, visitante){
  const ligaNorm = normalize(liga);

  const [ligasRows, equiposRows] = await Promise.all([
    getSheet("LIGAS!A2:B"),
    getSheet("EQUIPOS!A2:C")
  ]);

  const ligaExiste = ligasRows.some(r => normalize(r[0])===ligaNorm);
  if(!ligaExiste){
    return `La liga "${liga}" no existe`;
  }

  const equiposDeLaLiga = equiposRows
    .filter(r => normalize(r[2])===ligaNorm)
    .map(r => normalize(r[1]));

  if(!equiposDeLaLiga.includes(normalize(local))){
    return `El equipo local "${local}" no existe en esa liga`;
  }

  if(!equiposDeLaLiga.includes(normalize(visitante))){
    return `El equipo visitante "${visitante}" no existe en esa liga`;
  }

  return null;
}

/* ======================
   CREAR PARTIDO (protegido)
====================== */
app.post("/partido", requireAuth, async (req,res)=>{
  const {
    liga,
    temporada,
    jornada,
    local,
    visitante,
    goles_local,
    goles_visitante
  } = req.body;

  const error = validarPartido(req.body);
  if(error){
    return res.status(400).json({ ok:false, error });
  }

  const errorEquipos = await validarLigaYEquiposExisten(liga, local, visitante);
  if(errorEquipos){
    return res.status(400).json({ ok:false, error: errorEquipos });
  }

  const rows = await getSheet("PARTIDOS!A2:G");

  const esAdmin = req.user && req.user.rol === "admin";

  if(!esAdmin){
    const seasons = [...new Set(rows.map(r=>r[1]).filter(Boolean))];

    if(seasons.length>0){
      seasons.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
      const activeSeason = seasons[seasons.length-1];

      if(temporada !== activeSeason){
        return res.status(403).json({
          ok:false,
          error:"Solo puedes crear partidos en la temporada activa"
        });
      }

      const filasLigaTemporada = rows.filter(r =>
        normalize(r[0])===normalize(liga) && r[1]===activeSeason
      );

      const jornadaPermitida = calcularJornadaPermitidaParaCrear(filasLigaTemporada);

      if(jornadaPermitida!==null && Number(jornada)!==jornadaPermitida){
        return res.status(403).json({
          ok:false,
          error:`Solo puedes crear partidos en la jornada ${jornadaPermitida} (la jornada actual)`
        });
      }
    }
  }

  const exists = rows.some(r =>
    normalize(r[0])===normalize(liga) &&
    r[1]===temporada &&
    String(r[2])===String(jornada) &&
    (
      (normalize(r[3])===normalize(local) && normalize(r[4])===normalize(visitante)) ||
      (normalize(r[3])===normalize(visitante) && normalize(r[4])===normalize(local))
    )
  );

  if(exists){
    return res.status(409).json({
      ok:false,
      error:"Partido duplicado"
    });
  }

  const client = await getClient();
  const sheets = google.sheets({ version:"v4", auth:client });

  await sheets.spreadsheets.values.append({
    spreadsheetId:SHEET_ID,
    range:"PARTIDOS!A:G",
    valueInputOption:"RAW",
    requestBody:{
      values:[[
        liga,
        temporada,
        jornada,
        local,
        visitante,
        goles_local,
        goles_visitante
      ]]
    }
  });

  notificarActualizacion();

  res.json({
    ok:true,
    message:"Partido creado correctamente"
  });
});

/* ======================
   UPDATE + BLOQUEO TEMPORADA/JORNADA (protegido, admin sin restricciones)
====================== */
app.post("/partido/update", requireAuth, async (req,res)=>{
  const {
    row,
    liga,
    temporada,
    jornada,
    local,
    visitante,
    goles_local,
    goles_visitante
  } = req.body;

  const rowNum = Number(row);

  if(isEmpty(row) || !Number.isInteger(rowNum) || rowNum < 2){
    return res.status(400).json({
      ok:false,
      error:"No se ha seleccionado ningún partido para actualizar. Haz clic en un partido de la lista antes de editarlo."
    });
  }

  const error = validarPartido(req.body);
  if(error){
    return res.status(400).json({ ok:false, error });
  }

  const errorEquipos = await validarLigaYEquiposExisten(liga, local, visitante);
  if(errorEquipos){
    return res.status(400).json({ ok:false, error: errorEquipos });
  }

  const todasLasFilas = await getSheet("PARTIDOS!A2:G");
  const current = todasLasFilas[rowNum-2];

  if(!current){
    return res.status(404).json({
      ok:false,
      error:"El partido que intentas actualizar ya no existe en esa posición"
    });
  }

  const esAdmin = req.user && req.user.rol === "admin";

  if(!esAdmin){
    const seasons = [...new Set(todasLasFilas.map(r=>r[1]).filter(Boolean))];

    if(seasons.length>0){
      seasons.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
      const activeSeason = seasons[seasons.length-1];

      if(current[1] !== activeSeason){
        return res.status(403).json({
          ok:false,
          error:"No se pueden editar partidos de temporadas anteriores"
        });
      }

      if(temporada !== activeSeason){
        return res.status(403).json({
          ok:false,
          error:"No se puede asignar el partido a una temporada distinta de la activa"
        });
      }

      const filasLigaTemporada = todasLasFilas.filter(r =>
        normalize(r[0])===normalize(current[0]) && r[1]===activeSeason
      );

      const jornadaActual = calcularJornadaActual(filasLigaTemporada);

      if(jornadaActual!==null){
        if(Number(current[2]) !== jornadaActual){
          return res.status(403).json({
            ok:false,
            error:`Solo puedes editar partidos de la jornada actual (jornada ${jornadaActual})`
          });
        }

        if(Number(jornada) !== jornadaActual){
          return res.status(403).json({
            ok:false,
            error:`No se puede mover el partido a una jornada distinta de la actual (jornada ${jornadaActual})`
          });
        }
      }
    }
  }

  const client = await getClient();
  const sheets = google.sheets({ version:"v4", auth:client });

  await sheets.spreadsheets.values.update({
    spreadsheetId:SHEET_ID,
    range:`PARTIDOS!A${rowNum}:G${rowNum}`,
    valueInputOption:"RAW",
    requestBody:{
      values:[[
        liga,
        temporada,
        jornada,
        local,
        visitante,
        goles_local,
        goles_visitante
      ]]
    }
  });

  notificarActualizacion();

  res.json({
    ok:true,
    message:"Partido actualizado correctamente"
  });
});

/* ======================
   CLASIFICACION (incluye GF / GC / DIF)
====================== */
app.get("/clasificacion", async (req,res)=>{
  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

  const rows = await getSheet("PARTIDOS!A2:G");

  const partidos = rows
    .map(r=>({
      liga:normalize(r[0]),
      temporada:r[1],
      local:r[3],
      visitante:r[4],
      gl: r[5]===undefined || r[5]==="" ? null : Number(r[5]),
      gv: r[6]===undefined || r[6]==="" ? null : Number(r[6])
    }))
    .filter(p =>
      (!liga || p.liga===liga) &&
      (!temporada || p.temporada===temporada) &&
      p.gl!==null && p.gv!==null
    );

  const tabla={};

  const init=t=>{
    if(!tabla[t]){
      tabla[t]={
        equipo:t,
        puntos:0,
        jugados:0,
        ganados:0,
        empatados:0,
        perdidos:0,
        goles_favor:0,
        goles_contra:0,
        diferencia:0
      };
    }
  };

  partidos.forEach(p=>{
    init(p.local);
    init(p.visitante);

    tabla[p.local].jugados++;
    tabla[p.visitante].jugados++;

    tabla[p.local].goles_favor += p.gl;
    tabla[p.local].goles_contra += p.gv;
    tabla[p.visitante].goles_favor += p.gv;
    tabla[p.visitante].goles_contra += p.gl;

    if(p.gl>p.gv){
      tabla[p.local].ganados++;
      tabla[p.local].puntos+=3;
      tabla[p.visitante].perdidos++;
    } else if(p.gl<p.gv){
      tabla[p.visitante].ganados++;
      tabla[p.visitante].puntos+=3;
      tabla[p.local].perdidos++;
    } else {
      tabla[p.local].empatados++;
      tabla[p.visitante].empatados++;
      tabla[p.local].puntos++;
      tabla[p.visitante].puntos++;
    }
  });

  const data = Object.values(tabla).map(t=>({
    ...t,
    diferencia: t.goles_favor - t.goles_contra
  }));

  data.sort((a,b)=>
    b.puntos - a.puntos ||
    b.diferencia - a.diferencia ||
    b.goles_favor - a.goles_favor
  );

  res.json({
    data,
    lastUpdate:Date.now()
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT,()=>{
  console.log("⚽ FUTCAT SERVER FINAL ESTABLE (NO CUT VERSION)");
});
