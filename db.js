const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "db5020951893.hosting-data.io",
  user: "dbu3815614",
  password: "TerritoriFutcat/2026",
  database: "dbs15909928",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
