require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const webhookRouter = require("./src/webhook");
const apiRouter = require("./src/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Webhook do Instagram (Meta chama estas rotas)
app.use("/", webhookRouter);

// API usada pelo dashboard
app.use("/api", apiRouter);

// Dashboard (frontend estático)
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});
