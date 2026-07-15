const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

/* ======================
   CONFIG SEGURA
====================== */

function safeJson(v){
  try { return JSON.parse(v); } catch { return null; }
}

const SHEET_ID = process.env.SHEET_ID || "";
const credentials = safeJson(process.env.GOOGLE_CREDENTIALS);

const authGoogle = credentials
  ? new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    })
  : null;

/* ======================
   CLIENT SAFE
====================== */

async function getClient(){
  if(!authGoogle){
    throw new Error("Google Auth no configurado");
  }
  return await authGoogle.getClient();
}

/* ======================
   SHEETS SAFE READ
====================== */

async function getSheet(range){

  try{

    const client = await getClient();
    const sheets = google.sheets({ version:"v4", auth:client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range
    });

    return res.data.values || [];

  } catch(err){
    console.error("SHEETS ERROR:", err.message);
    return [];
  }
}

const normalize = v =>
  String(v || "").trim().toLowerCase();

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
      .filter(r => normalize(r[2]) === liga)
      .map(r => r[1])
  });
});

/* ======================
   TEMPORADAS
====================== */

app.get("/temporadas", async (req,res)=>{

  const rows = await getSheet("PARTIDOS!B2:B");

  const seasons = [...new Set(rows.map(r=>r[0]).filter(Boolean))];

  res.json({ data: seasons });
});

/* ======================
   TEMPORADA ACTIVA
====================== */

app.get("/temporada-activa", async (req,res)=>{

  const rows = await getSheet("PARTIDOS!B2:B");

  const seasons = [...new Set(rows.map(r=>r[0]).filter(Boolean))];

  if(seasons.length === 0){
    return res.json({ data:null });
  }

  seasons.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));

  res.json({
    data: seasons[seasons.length - 1]
  });
});

/* ======================
   PARTIDOS (ROW REAL)
====================== */

app.get("/partidos", async (req,res)=>{

  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

  const rows = await getSheet("PARTIDOS!A2:G");

  const data = rows.map((r,i)=>({

    row: i + 2,

    liga: normalize(r[0]),
    temporada: r[1],
    jornada: r[2],
    local: r[3],
    visitante: r[4],
    goles_local: Number(r[5]||0),
    goles_visitante: Number(r[6]||0)
  }))
  .filter(p =>
    (!liga || p.liga === liga) &&
    (!temporada || p.temporada === temporada)
  );

  res.json({ data });
});

/* ======================
   CREAR PARTIDO (CON TODO CONTROL)
====================== */

app.post("/partido", async (req,res)=>{

  const {
    liga,
    temporada,
    jornada,
    local,
    visitante,
    goles_local,
    goles_visitante
  } = req.body;

  /* BLOQUEO MISMO EQUIPO */
  if(local === visitante){
    return res.status(400).json({
      ok:false,
      error:"Un equipo no puede jugar contra sí mismo"
    });
  }

  /* DUPLICADOS */
  const rows = await getSheet("PARTIDOS!A2:G");

  const exists = rows.some(r =>
    normalize(r[0]) === normalize(liga) &&
    r[1] === temporada &&
    r[2] === jornada &&
    (
      (r[3] === local && r[4] === visitante) ||
      (r[3] === visitante && r[4] === local)
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

  res.json({ ok:true });
});

/* ======================
   UPDATE (TEMPORADA + FIX FINAL)
====================== */

app.post("/partido/update", async (req,res)=>{

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

  /* BLOQUEO MISMO EQUIPO */
  if(local === visitante){
    return res.status(400).json({
      ok:false,
      error:"Un equipo no puede jugar contra sí mismo"
    });
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

  res.json({ ok:true });
});

/* ======================
   DEBUG (para detectar fallos)
====================== */

app.get("/debug", (req,res)=>{

  res.json({
    ok:true,
    sheetId: !!SHEET_ID,
    googleAuth: !!authGoogle
  });

});

/* ======================
   CLASIFICACION
====================== */

app.get("/clasificacion", async (req,res)=>{

  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

  const rows = await getSheet("PARTIDOS!A2:G");

  const partidos = rows
    .map(r=>({
      liga: normalize(r[0]),
      temporada:r[1],
      local:r[3],
      visitante:r[4],
      gl:Number(r[5]||0),
      gv:Number(r[6]||0)
    }))
    .filter(p =>
      (!liga || p.liga === liga) &&
      (!temporada || p.temporada === temporada)
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
        perdidos:0
      };
    }
  };

  partidos.forEach(p=>{

    init(p.local);
    init(p.visitante);

    tabla[p.local].jugados++;
    tabla[p.visitante].jugados++;

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

  res.json({
    data:Object.values(tabla),
    lastUpdate:Date.now()
  });
});

/* ======================
   START
====================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("⚽ FUTCAT SERVER COMPLETO FUNCIONAL V8");
});
