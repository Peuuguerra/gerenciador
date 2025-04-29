const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
// **MODIFICADO:** Remover configFile da importação, pois não é mais usado
const { dataDir, pedidosFile } = require("./config");
// **MODIFICADO:** Usar a versão hardcoded do n8n-integration
const n8nIntegration = require("./n8n-integration_hardcoded.js");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("trust proxy", 1);

// Configuração da Sessão
app.use(session({
  secret: "seu_segredo_super_secreto_troque_isso_agora",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Manter false para Render.com ou ajustar conforme necessidade
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

// Garantir que os diretórios necessários existam
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Diretório de dados criado em: ${dataDir}`);
}
if (!fs.existsSync(pedidosFile)) {
  fs.writeFileSync(pedidosFile, JSON.stringify([]));
  console.log(`Arquivo de pedidos inicializado em: ${pedidosFile}`);
}

// Credenciais de Usuário
const users = {
  admin: { password: "admin123", role: "admin" },
  funcionario: { password: "funcionario123", role: "funcionario" },
};

// Função para gerar ID único
function generateOrderId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Middleware de Autenticação
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    console.warn("Tentativa de acesso não autorizado (sem sessão):");
    return res.status(401).json({ error: "Acesso não autorizado. Faça login primeiro." });
  }
}

// Middleware de Autorização (Admin)
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    console.warn("Tentativa de acesso admin não autorizado (sem sessão):");
    return res.status(401).json({ error: "Acesso não autorizado. Faça login primeiro." });
  }
  if (req.session.user.role === "admin") {
    return next();
  } else {
    console.warn(`Tentativa de acesso admin não autorizado (usuário: ${req.session.user.username}, role: ${req.session.user.role}):`);
    return res.status(403).json({ error: "Acesso proibido. Requer privilégios de administrador." });
  }
}

// --- Rotas de Autenticação ---
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (user && user.password === password) {
    req.session.user = { username: username, role: user.role };
    req.session.save((err) => {
      if (err) {
        console.error("Erro ao salvar sessão após login:", err);
        return res.status(500).json({ success: false, message: "Erro interno ao iniciar sessão." });
      }
      console.log(`Usuário ${username} logado com sucesso. Sessão ID: ${req.sessionID}`);
      res.json({ success: true, message: "Login bem-sucedido!", user: req.session.user });
    });
  } else {
    console.log(`Tentativa de login falhou para o usuário: ${username}`);
    res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
  }
});

app.get("/logout", (req, res) => {
  if (req.session.user) {
    const username = req.session.user.username;
    const sessionId = req.sessionID;
    req.session.destroy((err) => {
      if (err) {
        console.error("Erro ao destruir sessão:", err);
        return res.status(500).json({ error: "Erro ao fazer logout." });
      }
      res.clearCookie("connect.sid");
      console.log(`Usuário ${username} deslogado. Sessão ID: ${sessionId}`);
      res.json({ success: true, message: "Logout bem-sucedido!" });
    });
  } else {
    res.status(400).json({ error: "Nenhum usuário logado para deslogar." });
  }
});

app.get("/session", (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// --- Rotas da API de Pedidos ---
app.get("/api/pedidos/get-orders", requireLogin, (req, res) => {
  try {
    const data = fs.readFileSync(pedidosFile, "utf8");
    const pedidos = JSON.parse(data);
    res.json(pedidos);
  } catch (error) {
    console.error("Erro ao ler pedidos:", error);
    res.status(500).json({ error: "Erro ao ler pedidos" });
  }
});

app.post("/api/pedidos/get-orders", (req, res) => {
  try {
    console.log("Recebido pedido:", req.body);
    const data = fs.readFileSync(pedidosFile, "utf8");
    const pedidos = JSON.parse(data);

    const Cliente = req.body.Cliente || "";
    const Telefone = req.body.Telefone || "";
    const Endereco = req.body.Endereço || "";
    const ProdutosInput = req.body.Produtos;
    const formaPagamento = req.body["Forma de Pagamento"] || "";
    let produtosArray = [];
    if (ProdutosInput) {
        produtosArray = Array.isArray(ProdutosInput) ? ProdutosInput : [ProdutosInput];
    }
    let valorTotalPedido = null;
    const valorTotalInput = req.body["ValorTotal"] || req.body.valorTotal;
    if (valorTotalInput !== undefined && !isNaN(parseFloat(valorTotalInput))) {
        valorTotalPedido = parseFloat(valorTotalInput);
        console.log(`Usando ValorTotal recebido: ${valorTotalPedido}`);
    } else {
        console.log(`ValorTotal não recebido ou inválido. Definido como null.`);
    }

    // Verificação de duplicidade
    const DUPLICATE_CHECK_WINDOW_MS = 5 * 60 * 1000;
    const now = Date.now();
    const potentialDuplicate = pedidos.find(p =>
        p.telefone === Telefone &&
        p.nomeCliente === Cliente &&
        JSON.stringify(p.produtos.sort()) === JSON.stringify(produtosArray.sort()) &&
        (now - new Date(p.timestamp).getTime()) < DUPLICATE_CHECK_WINDOW_MS
    );

    if (potentialDuplicate) {
        console.warn(`Pedido potencialmente duplicado detectado para ${Telefone}. Pedido existente: ${potentialDuplicate.id}. Ignorando.`);
        return res.status(200).json({
            success: true,
            message: "Pedido recebido, mas parece ser um duplicado de um pedido recente. Nenhuma nova entrada criada.",
            pedidoIdExistente: potentialDuplicate.id
        });
    }

    const novoPedido = {
      id: generateOrderId(),
      nomeCliente: Cliente,
      telefone: Telefone,
      endereco: Endereco,
      produtos: produtosArray,
      valorTotal: valorTotalPedido,
      status: "Pedido Recebido",
      timestamp: new Date().toISOString(),
      formaPagamento: formaPagamento,
    };

    pedidos.push(novoPedido);
    fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
    const logMessage = `[${new Date().toISOString()}] Novo pedido: ${JSON.stringify(novoPedido)}\n`;
    fs.appendFileSync(path.join(dataDir, "pedidos.log"), logMessage);

    // Notificar o n8n
    n8nIntegration.notificarNovoPedido(novoPedido)
      .catch(error => console.error("Erro ao notificar n8n sobre novo pedido:", error));

    res.status(201).json({ success: true, message: "Pedido recebido com sucesso", pedido: novoPedido });

  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    res.status(500).json({ error: "Erro ao salvar pedido" });
  }
});

app.post("/api/pedidos/update-status", requireLogin, (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    const data = fs.readFileSync(pedidosFile, "utf8");
    let pedidos = JSON.parse(data);
    const pedidoIndex = pedidos.findIndex((p) => p.id === orderId);
    if (pedidoIndex !== -1) {
      const oldStatus = pedidos[pedidoIndex].status;
      pedidos[pedidoIndex].status = newStatus;
      fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
      const logMessage = `[${new Date().toISOString()}] Status atualizado por ${req.session.user.username}: Pedido ${orderId} de ${oldStatus} para ${newStatus}\n`;
      fs.appendFileSync(path.join(dataDir, "atualizacoes.log"), logMessage);

      // Notificar o n8n
      n8nIntegration.notificarAtualizacaoStatus(pedidos[pedidoIndex], oldStatus, newStatus)
        .catch(error => console.error("Erro ao notificar n8n sobre atualização:", error));

      res.json({ success: true, message: "Status atualizado com sucesso", orderId, oldStatus, newStatus });
    } else {
      res.status(404).json({ success: false, message: "Pedido não encontrado" });
    }
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

app.delete("/api/pedidos/:orderId", requireAdmin, (req, res) => {
  try {
    const { orderId } = req.params;
    const data = fs.readFileSync(pedidosFile, "utf8");
    let pedidos = JSON.parse(data);
    const pedidoIndex = pedidos.findIndex((p) => p.id === orderId);
    if (pedidoIndex !== -1) {
      const pedidoRemovido = pedidos.splice(pedidoIndex, 1)[0];
      fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
      const logMessage = `[${new Date().toISOString()}] Pedido removido por ${req.session.user.username}: ${JSON.stringify(pedidoRemovido)}\n`;
      fs.appendFileSync(path.join(dataDir, "pedidos_removidos.log"), logMessage);
      console.log(`Pedido ${orderId} removido por ${req.session.user.username}`);
      res.json({ success: true, message: "Pedido removido com sucesso", orderId });
    } else {
      res.status(404).json({ success: false, message: "Pedido não encontrado" });
    }
  } catch (error) {
    console.error("Erro ao remover pedido:", error);
    res.status(500).json({ error: "Erro ao remover pedido" });
  }
});

// **REMOVIDO:** Rotas /api/config GET e POST
// app.get("/api/config", requireAdmin, (req, res) => { ... });
// app.post("/api/config", requireAdmin, (req, res) => { ... });

// **REMOVIDO:** Rota /api/pedidos/notificar (parece ser apenas simulação)
// app.post("/api/pedidos/notificar", (req, res) => { ... });

// Rota de Ping
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Rota principal para servir o index.html
app.get("*/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

