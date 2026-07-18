const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "futcat_user",
  password: "TerritoriFutcat/2026",
  database: "futcat",
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
