const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const session = require("express-session"); // Importar express-session
const { dataDir, configFile, pedidosFile } = require("./config"); // **NOVO:** Importar caminhos centralizados
const n8nIntegration = require("./n8n-integration"); // Importar módulo de integração n8n

const app = express();
const PORT = process.env.PORT || 10000; // **MODIFICADO:** Porta padrão alterada para 10000

// Middleware
app.use(cors()); // Habilitar CORS para todas as origens (ajustar em produção se necessário)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// **NOVA CONFIGURAÇÃO:** Confiar no primeiro proxy (importante para Render, Heroku, etc.)
app.set("trust proxy", 1);

// Configuração da Sessão
// const isProduction = process.env.NODE_ENV === "production"; // Temporariamente comentado
app.use(session({
  secret: "seu_segredo_super_secreto_troque_isso_agora", // !! IMPORTANTE: Troque por uma chave secreta forte e única
  resave: false,
  saveUninitialized: false, // Não salva sessões não inicializadas
  cookie: {
    // **MODIFICADO:** Forçar secure: false para teste, ignorando NODE_ENV por enquanto
    secure: false,
    httpOnly: true, // Ajuda a prevenir ataques XSS
    maxAge: 1000 * 60 * 60 * 24, // Tempo de vida do cookie (ex: 24 horas)
    // sameSite: 'lax' // Pode adicionar para proteção CSRF, mas teste se não quebra nada
  },
}));

// Garantir que os diretórios necessários existam
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Garantir que o diretório de dados exista
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Diretório de dados criado em: ${dataDir}`);
}

// Inicializar o arquivo de pedidos se não existir
if (!fs.existsSync(pedidosFile)) {
  fs.writeFileSync(pedidosFile, JSON.stringify([]));
  console.log(`Arquivo de pedidos inicializado em: ${pedidosFile}`);
}

// Credenciais de Usuário (em um cenário real, use um banco de dados)
const users = {
  admin: { password: "admin123", role: "admin" },
  funcionario: { password: "funcionario123", role: "funcionario" },
};

// Função para gerar ID único
function generateOrderId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Middleware de Autenticação - Verifica se o usuário está logado
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // Usuário está logado, continua
  } else {
    console.warn("Tentativa de acesso não autorizado (sem sessão):");
    return res
      .status(401)
      .json({ error: "Acesso não autorizado. Faça login primeiro." });
  }
}

// Middleware de Autorização - Verifica se o usuário tem a função de admin
function requireAdmin(req, res, next) {
  // Primeiro, verifica se está logado
  if (!req.session || !req.session.user) {
    console.warn("Tentativa de acesso admin não autorizado (sem sessão):");
    return res
      .status(401)
      .json({ error: "Acesso não autorizado. Faça login primeiro." });
  }
  // Depois, verifica a role
  if (req.session.user.role === "admin") {
    return next(); // Usuário é admin, continua
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
    // Credenciais corretas - Inicia a sessão
    req.session.user = {
      username: username,
      role: user.role,
    };
    // Garante que a sessão seja salva antes de responder
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
    // Credenciais inválidas
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
      res.clearCookie("connect.sid"); // Limpa o cookie da sessão (o nome padrão é connect.sid)
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
    // console.log("Verificando sessão - Usuário logado:", req.session.user.username, "Sessão ID:", req.sessionID);
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    // console.log("Verificando sessão - Nenhum usuário logado. Sessão ID:", req.sessionID);
    res.json({ loggedIn: false });
  }
});

// --- Rotas da API de Pedidos (Protegidas e Não Protegidas) ---

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

// Rota para adicionar um novo pedido (POST) - Não protegida, pois pode vir de sistema externo
app.post("/api/pedidos/get-orders", (req, res) => {
  try {
    console.log("Recebido pedido:", req.body);
    const data = fs.readFileSync(pedidosFile, "utf8");
    const pedidos = JSON.parse(data);

    // Extrair dados do corpo da requisição
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
    const valorTotalInput = req.body['ValorTotal'] || req.body.valorTotal;
    if (valorTotalInput !== undefined && !isNaN(parseFloat(valorTotalInput))) {
        valorTotalPedido = parseFloat(valorTotalInput);
        console.log(`Usando ValorTotal recebido: ${valorTotalPedido}`);
    } else {
        console.log(`ValorTotal não recebido ou inválido. Definido como null.`);
    }

    // *** NOVO: Verificação de duplicidade ***
    const DUPLICATE_CHECK_WINDOW_MS = 5 * 60 * 1000; // Janela de 5 minutos
    const now = Date.now();
    const potentialDuplicate = pedidos.find(p =>
        p.telefone === Telefone &&
        p.nomeCliente === Cliente && // Adiciona verificação de nome para maior precisão
        // Compara arrays de produtos (ordena para garantir consistência)
        JSON.stringify(p.produtos.sort()) === JSON.stringify(produtosArray.sort()) &&
        (now - new Date(p.timestamp).getTime()) < DUPLICATE_CHECK_WINDOW_MS
    );

    if (potentialDuplicate) {
        console.warn(`Pedido potencialmente duplicado detectado para ${Telefone}. Pedido existente: ${potentialDuplicate.id}. Ignorando.`);
        // Retorna sucesso (200 OK) mas com mensagem indicando duplicidade
        return res.status(200).json({
            success: true,
            message: "Pedido recebido, mas parece ser um duplicado de um pedido recente. Nenhuma nova entrada criada.",
            pedidoIdExistente: potentialDuplicate.id
        });
    }
    // *** FIM NOVO ***

    const novoPedido = {
      id: generateOrderId(),
      nomeCliente: Cliente,
      telefone: Telefone,
      endereco: Endereco,
      produtos: produtosArray,
      valorTotal: valorTotalPedido,
      status: "Pedido Recebido",
      timestamp: new Date().toISOString(), // Usa o timestamp atual
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
        console.log("Notificação de novo pedido enviada para n8n com sucesso");
      })
      .catch((error) => {
        console.error("Erro ao notificar n8n sobre novo pedido:", error);
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

// Função simples para calcular valor total baseado na descrição do produto
function calcularValorTotal(produtosArray) { // **MODIFICADO:** Recebe o array diretamente
  let valor = 15.0; // Valor base, ajustar se necessário
  // Se o array estiver vazio, retorna o valor base
  if (!produtosArray || produtosArray.length === 0) {
      return parseFloat(valor.toFixed(2));
  }

  produtosArray.forEach((produto) => {
    if (typeof produto === "string") {
      // Garante que é string
      const lowerProduto = produto.toLowerCase();
      if (lowerProduto.includes("g")) valor += 5.0;
      else if (lowerProduto.includes("m")) valor += 3.0;
      // Se não for G nem M, assume P (sem custo extra)

      if (lowerProduto.includes("leite condensado")) valor += 2.0;
      if (lowerProduto.includes("morango")) valor += 2.0;
      if (lowerProduto.includes("banana")) valor += 1.5;
      if (lowerProduto.includes("granola")) valor += 1.0;
      // Adicionar mais adicionais aqui se necessário
    }
  });
  return parseFloat(valor.toFixed(2));
}

// Rota para atualizar status de um pedido - Protegida por Login
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
          console.log(
            "Notificação de atualização enviada para n8n com sucesso"
          );
        })
        .catch((error) => {
          console.error("Erro ao notificar n8n sobre atualização:", error);
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
      const pedidoRemovido = pedidos.splice(pedidoIndex, 1)[0]; // Remove o pedido
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

// Rota para configurações (ex: URLs de webhook) - Protegida por Admin
// **REMOVIDO:** Definição duplicada de configFile, agora importado de ./config
// if (!fs.existsSync(configFile)) { ... } // Verificação/criação agora feita no n8n-integration.js

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
    res.json({ success: true, message: "Configurações salvas com sucesso" });
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    res.status(500).json({ error: "Erro ao salvar configuração" });
  }
});

// Rota para enviar notificação (POST) - Exemplo, ajustar conforme necessidade
// Esta rota pode precisar de autenticação dependendo de quem a chama
app.post("/api/pedidos/notificar", (req, res) => {
  try {
    const { orderId, telefone, nomeCliente, oldStatus, newStatus } = req.body;
    // Lógica para determinar a mensagem baseada no status
    let mensagem = `Olá ${nomeCliente}! O status do seu pedido #${orderId.substring(
      0,
      8
    )} foi atualizado para ${newStatus}.`;
    // ... (adicionar casos específicos como no código original se necessário)

    console.log(`Simulando envio de notificação para ${telefone}: "${mensagem}"`);
    const logMessage = `[${new Date().toISOString()}] Notificação para ${telefone}: "${mensagem}"\n`;
    fs.appendFileSync(path.join(dataDir, "notificacoes.log"), logMessage);

    // Aqui você chamaria a API de notificação real (ex: WhatsApp, SMS)
    // Ex: await enviarNotificacaoReal(telefone, mensagem);

    res.json({
      success: true,
      message: "Notificação (simulada) enviada com sucesso",
      telefone: telefone,
      mensagem: mensagem,
    });
  } catch (error) {
    console.error("Erro ao processar notificação:", error);
    res.status(500).json({ error: "Erro ao processar notificação" });
  }
});

// Rota de Ping (GET) - Não protegida
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Servir arquivos estáticos da pasta 'public' (se existir)
// app.use(express.static(path.join(__dirname, "public")));

// Rota principal para servir o index.html
app.get("*/", (req, res) => {
  // A verificação de sessão é feita no frontend ao carregar a página
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

