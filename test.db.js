const db = require("./db");

async function test(){
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    console.log("CONEXION OK:", rows);
  } catch (err) {
    console.error("ERROR DB:", err);
  }
}

test();
