const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

function notificarActualizacion(){
  io.emit("partidos-actualizados");
}

/* ======================
   CONFIG
====================== */

function safeJson(v){
  try { return JSON.parse(v); } catch { return null; }
}

const SHEET_ID = process.env.SHEET_ID || "";
const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_cambia_esto_en_render";

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
   LOGIN
====================== */

app.post("/login", async (req,res)=>{

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

  const rows = await getSheet("EQUIPOS!A2:C");

  res.json({
    data: rows
      .filter(r=>normalize(r[2])===liga)
      .map(r=>r[1])
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
   PARTIDOS
====================== */

app.get("/partidos", async (req,res)=>{

  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

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
    (!temporada || p.temporada===temporada)
  );

  res.json({ data });
});

/* ======================
   VALIDACION COMUN CREAR/UPDATE
====================== */

function validarPartido(body){

  const { liga, temporada, jornada, local, visitante } = body;

  if(isEmpty(liga) || isEmpty(temporada) || isEmpty(local) || isEmpty(visitante)){
    return "Liga, temporada, local y visitante son obligatorios";
  }

  if(isEmpty(jornada)){
    return "La jornada es obligatoria";
  }

  if(normalize(local)===normalize(visitante)){
    return "Un equipo no puede jugar contra sí mismo";
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
   UPDATE + BLOQUEO TEMPORADA (protegido, admin puede saltarse el bloqueo)
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

  // NUEVO: valida que "row" sea un número de fila real antes de nada más.
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
  const filaExiste = todasLasFilas[rowNum-2];

  if(!filaExiste){
    return res.status(404).json({
      ok:false,
      error:"El partido que intentas actualizar ya no existe en esa posición"
    });
  }

  const activeRows = await getSheet("PARTIDOS!B2:B");
  
  const activeRows = await getSheet("PARTIDOS!B2:B");

  const seasons = [...new Set(activeRows.map(r=>r[0]).filter(Boolean))];

  if(seasons.length>0){
    seasons.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
    const active = seasons[seasons.length-1];

    const all = await getSheet("PARTIDOS!A2:G");
    const current = all[row-2];

    const esAdmin = req.user && req.user.rol === "admin";

    if(!esAdmin){

      if(current && current[1] !== active){
        return res.status(403).json({
          ok:false,
          error:"No se pueden editar partidos de temporadas anteriores"
        });
      }

      if(temporada !== active){
        return res.status(403).json({
          ok:false,
          error:"No se puede asignar el partido a una temporada distinta de la activa"
        });
      }
    }
  }

  const client = await getClient();
  const sheets = google.sheets({ version:"v4", auth:client });

  await sheets.spreadsheets.values.update({
    spreadsheetId:SHEET_ID,
    range:`PARTIDOS!A${row}:G${row}`,
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
