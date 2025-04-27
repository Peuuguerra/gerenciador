const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const session = require("express-session"); // Importar express-session
const n8nIntegration = require("./n8n-integration"); // Importar módulo de integração n8n

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Habilitar CORS para todas as origens (ajustar em produção se necessário)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Confiar no primeiro proxy (importante para Render, Heroku, etc.)
app.set("trust proxy", 1);

// Configuração da Sessão
app.use(session({
  secret: "seu_segredo_super_secreto_troque_isso_agora", // !! IMPORTANTE: Troque por uma chave secreta forte e única
  resave: false,
  saveUninitialized: false, // Não salva sessões não inicializadas
  cookie: {
    secure: false, // Forçar secure: false para teste
    httpOnly: true, // Ajuda a prevenir ataques XSS
    maxAge: 1000 * 60 * 60 * 24, // Tempo de vida do cookie (ex: 24 horas)
  },
}));

// Garantir que os diretórios necessários existam
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Arquivo para armazenar os pedidos
const pedidosFile = path.join(dataDir, "pedidos.json");

// Inicializar o arquivo de pedidos se não existir
if (!fs.existsSync(pedidosFile)) {
  fs.writeFileSync(pedidosFile, JSON.stringify([]));
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
    return res
      .status(401)
      .json({ error: "Acesso não autorizado. Faça login primeiro." });
  }
}

// Middleware de Autorização Admin
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    console.warn("Tentativa de acesso admin não autorizado (sem sessão):");
    return res
      .status(401)
      .json({ error: "Acesso não autorizado. Faça login primeiro." });
  }
  if (req.session.user.role === "admin") {
    return next();
  } else {
    console.warn(
      `Tentativa de acesso admin não autorizado (usuário: ${req.session.user.username}, role: ${req.session.user.role}):`
    );
    return res
      .status(403)
      .json({ error: "Acesso proibido. Requer privilégios de administrador." });
  }
}

// --- Rotas de Autenticação ---

// Rota de Login (POST)
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users[username];

  if (user && user.password === password) {
    req.session.user = {
      username: username,
      role: user.role,
    };
    req.session.save((err) => {
      if (err) {
        console.error("Erro ao salvar sessão após login:", err);
        return res
          .status(500)
          .json({ success: false, message: "Erro interno ao iniciar sessão." });
      }
      console.log(
        `Usuário ${username} logado com sucesso. Sessão ID: ${req.sessionID}`
      );
      res.json({
        success: true,
        message: "Login bem-sucedido!",
        user: req.session.user,
      });
    });
  } else {
    console.log(`Tentativa de login falhou para o usuário: ${username}`);
    res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
  }
});

// Rota de Logout (GET)
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

// Rota para verificar status da sessão (GET)
app.get("/session", (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// --- Rotas da API de Pedidos ---

// Rota para obter todos os pedidos (GET) - Protegida por Login
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

// **NOVO:** Função para comparar arrays de produtos (ignora ordem)
function compareProductArrays(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) {
        return false;
    }
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

// Rota para adicionar um novo pedido (POST) - Não protegida
app.post("/api/pedidos/get-orders", (req, res) => {
  try {
    console.log("Recebido pedido:", req.body);
    const data = fs.readFileSync(pedidosFile, "utf8");
    const pedidos = JSON.parse(data);
    
    // Usar valores vazios para TODOS os campos se não forem enviados
    const Cliente = req.body.Cliente || ""; 
    const Telefone = req.body.Telefone || "";
    const Endereco = req.body.Endereço || ""; 
    const ProdutosInput = req.body.Produtos;
    const formaPagamento = req.body["Forma de Pagamento"] || "";

    // Tratar ProdutosInput para ser array vazio se não houver input ou for vazio
    let produtosArray = [];
    if (ProdutosInput && ProdutosInput.length > 0) {
        produtosArray = Array.isArray(ProdutosInput) ? ProdutosInput : [ProdutosInput];
    }

    // **NOVO:** Verificação de Duplicidade (Telefone + Produtos nos últimos 5 minutos)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const potentialDuplicate = pedidos.find(p => 
        p.telefone === Telefone &&
        compareProductArrays(p.produtos, produtosArray) && // Compara arrays de produtos
        new Date(p.timestamp).getTime() > fiveMinutesAgo
    );

    if (potentialDuplicate) {
        console.warn(`Pedido potencialmente duplicado detectado (Telefone: ${Telefone}, Produtos: ${JSON.stringify(produtosArray)}). Pedido original ID: ${potentialDuplicate.id}. Ignorando novo pedido.`);
        // Retorna sucesso para não causar erro na origem, mas não salva nem notifica
        return res.status(200).json({
            success: true,
            message: "Pedido potencialmente duplicado detectado e ignorado.",
            pedido_existente_id: potentialDuplicate.id
        });
    }
    // Fim da verificação de duplicidade

    const novoPedido = {
      id: generateOrderId(),
      nomeCliente: Cliente,
      telefone: Telefone,
      endereco: Endereco,
      produtos: produtosArray,
      valorTotal: calcularValorTotal(produtosArray),
      status: "Pedido Recebido",
      timestamp: new Date().toISOString(),
      formaPagamento: formaPagamento,
    };
    
    pedidos.push(novoPedido);
    fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
    const logMessage = `[${new Date().toISOString()}] Novo pedido: ${JSON.stringify(
      novoPedido
    )}\n`;
    fs.appendFileSync(path.join(dataDir, "pedidos.log"), logMessage);

    // Notificar o n8n sobre o novo pedido
    n8nIntegration
      .notificarNovoPedido(novoPedido)
      .then((response) => {
        // console.log("Notificação de novo pedido enviada para n8n com sucesso");
      })
      .catch((error) => {
        // console.error("Erro ao notificar n8n sobre novo pedido:", error);
      });

    res.status(201).json({
      success: true,
      message: "Pedido recebido com sucesso",
      pedido: novoPedido,
    });
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    res.status(500).json({ error: "Erro ao salvar pedido" });
  }
});

// Função para calcular valor total
function calcularValorTotal(produtosArray) {
  let valor = 15.0;
  if (!produtosArray || produtosArray.length === 0) {
      return parseFloat(valor.toFixed(2));
  }
  produtosArray.forEach((produto) => {
    if (typeof produto === "string") {
      const lowerProduto = produto.toLowerCase();
      if (lowerProduto.includes("g")) valor += 5.0;
      else if (lowerProduto.includes("m")) valor += 3.0;
      if (lowerProduto.includes("leite condensado")) valor += 2.0;
      if (lowerProduto.includes("morango")) valor += 2.0;
      if (lowerProduto.includes("banana")) valor += 1.5;
      if (lowerProduto.includes("granola")) valor += 1.0;
    }
  });
  return parseFloat(valor.toFixed(2));
}

// Rota para atualizar status - Protegida por Login
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

      // Notificar o n8n sobre a atualização de status
      n8nIntegration
        .notificarAtualizacaoStatus(pedidos[pedidoIndex], oldStatus, newStatus)
        .then((response) => {
          // console.log("Notificação de atualização enviada para n8n com sucesso");
        })
        .catch((error) => {
          // console.error("Erro ao notificar n8n sobre atualização:", error);
        });

      res.json({
        success: true,
        message: "Status atualizado com sucesso",
        orderId: orderId,
        oldStatus: oldStatus,
        newStatus: newStatus,
      });
    } else {
      res.status(404).json({ success: false, message: "Pedido não encontrado" });
    }
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// Rota para DELETAR um pedido - Protegida por Admin
app.delete("/api/pedidos/:orderId", requireAdmin, (req, res) => {
  try {
    const { orderId } = req.params;
    const data = fs.readFileSync(pedidosFile, "utf8");
    let pedidos = JSON.parse(data);
    const pedidoIndex = pedidos.findIndex((p) => p.id === orderId);

    if (pedidoIndex !== -1) {
      const pedidoRemovido = pedidos.splice(pedidoIndex, 1)[0];
      fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
      const logMessage = `[${new Date().toISOString()}] Pedido removido por ${req.session.user.username}: ${JSON.stringify(
        pedidoRemovido
      )}\n`;
      fs.appendFileSync(path.join(dataDir, "pedidos_removidos.log"), logMessage);
      console.log(`Pedido ${orderId} removido por ${req.session.user.username}`);
      res.json({
        success: true,
        message: "Pedido removido com sucesso",
        orderId: orderId,
      });
    } else {
      res.status(404).json({ success: false, message: "Pedido não encontrado" });
    }
  } catch (error) {
    console.error("Erro ao remover pedido:", error);
    res.status(500).json({ error: "Erro ao remover pedido" });
  }
});

// Rota para configurações - Protegida por Admin
const configFile = path.join(dataDir, "config.json");
if (!fs.existsSync(configFile)) {
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      webhookUrlNovoPedido: "",
      webhookUrlAtualizacaoStatus: "",
      apiKey: "",
    })
  );
}

app.get("/api/config", requireAdmin, (req, res) => {
  try {
    const configData = fs.readFileSync(configFile, "utf8");
    res.json(JSON.parse(configData));
  } catch (error) {
    console.error("Erro ao ler configuração:", error);
    res.status(500).json({ error: "Erro ao ler configuração" });
  }
});

app.post("/api/config", requireAdmin, (req, res) => {
  try {
    const { webhookUrlNovoPedido, webhookUrlAtualizacaoStatus, apiKey } = req.body;
    const newConfig = {
      webhookUrlNovoPedido,
      webhookUrlAtualizacaoStatus,
      apiKey,
    };
    fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
    console.log(`Configurações salvas por ${req.session.user.username}`);
    // Recarrega as configs no módulo n8n após salvar
    if (n8nIntegration.reloadN8nConfig) {
        n8nIntegration.reloadN8nConfig();
    }
    res.json({ success: true, message: "Configurações salvas com sucesso" });
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    res.status(500).json({ error: "Erro ao salvar configuração" });
  }
});

// Rota de Ping (GET) - Não protegida
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Rota principal para servir o index.html
app.get("*/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor Mr. Shake rodando na porta ${PORT}`);
  console.warn(
    "AVISO: Cookie de sessão configurado como secure: false para teste. Mude para secure: true em produção com HTTPS."
  );
});
