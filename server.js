const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

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

async function getClient(){
  return await authGoogle.getClient();
}

const normalize = v =>
  String(v || "").trim().toLowerCase().replace(/\s+/g," ");

async function getSheet(range){

  const client = await getClient();
  const sheets = google.sheets({ version:"v4", auth:client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  return res.data.values || [];
}

/* ================= LIGAS ================= */

app.get("/ligas", async (req,res)=>{
  const rows = await getSheet("LIGAS!A2:B");

  res.json({
    data: rows.map(r=>({
      id: normalize(r[0]),
      nombre:r[1]
    }))
  });
});

/* ================= EQUIPOS ================= */

app.get("/equipos", async (req,res)=>{
  const liga = normalize(req.query.liga);

  const rows = await getSheet("EQUIPOS!A2:C");

  res.json({
    data: rows
      .filter(r => normalize(r[2]) === liga)
      .map(r => r[1])
  });
});

/* ================= TEMPORADAS (REAL) ================= */

app.get("/temporadas", async (req,res)=>{

  const rows = await getSheet("PARTIDOS!B2:B");

  const set = new Set();

  rows.forEach(r=>{
    if(r[0]) set.add(r[0]);
  });

  res.json({
    data: Array.from(set).sort()
  });
});

/* ================= PARTIDOS ================= */

app.get("/partidos", async (req,res)=>{

  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

  const rows = await getSheet("PARTIDOS!A2:G");

  const data = rows
    .map((r,i)=>({
      liga: normalize(r[0]),
      temporada: r[1],
      jornada: r[2],
      local: r[3],
      visitante: r[4],
      goles_local: Number(r[5]||0),
      goles_visitante: Number(r[6]||0)
    }))
    .filter(p =>
      p.liga === liga &&
      (!temporada || p.temporada === temporada)
    );

  res.json({data});
});

/* ================= CLASIFICACION ================= */

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
      p.liga === liga &&
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
    data:Object.values(tabla).sort((a,b)=>b.puntos-a.puntos),
    lastUpdate:Date.now()
  });
});

/* ================= ESTADISTICAS ================= */

app.get("/estadisticas", async (req,res)=>{

  const liga = normalize(req.query.liga);
  const temporada = req.query.temporada;

  const rows = await getSheet("PARTIDOS!A2:G");

  const partidos = rows
    .map(r=>({
      liga:normalize(r[0]),
      temporada:r[1],
      local:r[3],
      visitante:r[4],
      gl:Number(r[5]||0),
      gv:Number(r[6]||0)
    }))
    .filter(p =>
      p.liga === liga &&
      (!temporada || p.temporada === temporada)
    );

  const stats={};

  const init=t=>{
    if(!stats[t]){
      stats[t]={
        equipo:t,
        jugados:0,
        ganados:0,
        empatados:0,
        perdidos:0,
        goles_favor:0,
        goles_contra:0,
        puntos:0
      };
    }
  };

  partidos.forEach(p=>{

    init(p.local);
    init(p.visitante);

    stats[p.local].jugados++;
    stats[p.visitante].jugados++;

    stats[p.local].goles_favor+=p.gl;
    stats[p.local].goles_contra+=p.gv;

    stats[p.visitante].goles_favor+=p.gv;
    stats[p.visitante].goles_contra+=p.gl;

    if(p.gl>p.gv){
      stats[p.local].ganados++;
      stats[p.local].puntos+=3;
      stats[p.visitante].perdidos++;
    } else if(p.gl<p.gv){
      stats[p.visitante].ganados++;
      stats[p.visitante].puntos+=3;
      stats[p.local].perdidos++;
    } else {
      stats[p.local].empatados++;
      stats[p.visitante].empatados++;
      stats[p.local].puntos++;
      stats[p.visitante].puntos++;
    }
  });

  const result = Object.values(stats).map(t=>({
    ...t,
    diferencia:t.goles_favor-t.goles_contra
  }));

  res.json({data:result});
});

/* ================= PARTIDO ================= */

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

  const client = await getClient();
  const sheets = google.sheets({version:"v4",auth:client});

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

  res.json({ok:true});
});

/* ================= SERVER ================= */

app.listen(process.env.PORT||3000,()=>{
  console.log("FUTCAT SERVER FINAL V2 ⚽");
});
