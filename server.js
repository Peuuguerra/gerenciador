const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const session = require("express-session"); // Importar express-session

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Habilitar CORS para todas as origens (ajustar em produção se necessário)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração da Sessão
app.use(session({
  secret: "seu_segredo_super_secreto", // Troque por uma chave secreta forte e única
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production", // Usar cookies seguros em produção (HTTPS)
    maxAge: 1000 * 60 * 60 * 24 // Tempo de vida do cookie (ex: 24 horas)
  }
}));

// Garantir que os diretórios necessários existam
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Diretório para armazenar os pedidos
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

// Credenciais de Usuário (em um cenário real, use um banco de dados)
const users = {
  admin: { password: "admin123", role: "admin" },
  funcionario: { password: "funcionario123", role: "funcionario" }
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
    return res.status(401).json({ error: "Acesso não autorizado. Faça login primeiro." });
  }
}

// Middleware de Autorização - Verifica se o usuário tem a função de admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") {
    return next(); // Usuário é admin, continua
  } else {
    return res.status(403).json({ error: "Acesso proibido. Requer privilégios de administrador." });
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
      role: user.role
    };
    console.log(`Usuário ${username} logado com sucesso.`);
    res.json({ success: true, message: "Login bem-sucedido!", user: req.session.user });
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
    req.session.destroy(err => {
      if (err) {
        console.error("Erro ao destruir sessão:", err);
        return res.status(500).json({ error: "Erro ao fazer logout." });
      }
      res.clearCookie("connect.sid"); // Limpa o cookie da sessão
      console.log(`Usuário ${username} deslogado.`);
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

// --- Rotas da API de Pedidos (Protegidas) ---

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
    const { Cliente, Telefone, Endereço, Produtos, "Forma de Pagamento": formaPagamento } = req.body;
    const novoPedido = {
      id: generateOrderId(),
      nomeCliente: Cliente,
      telefone: Telefone,
      endereco: Endereço,
      produtos: [Produtos],
      valorTotal: calcularValorTotal(Produtos),
      status: "Pedido Recebido",
      timestamp: new Date().toISOString(),
      formaPagamento: formaPagamento
    };
    pedidos.push(novoPedido);
    fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
    const logMessage = `[${new Date().toISOString()}] Novo pedido: ${JSON.stringify(novoPedido)}\n`;
    fs.appendFileSync(path.join(dataDir, "pedidos.log"), logMessage);
    res.status(201).json({ 
      success: true, 
      message: "Pedido recebido com sucesso",
      pedido: novoPedido
    });
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    res.status(500).json({ error: "Erro ao salvar pedido" });
  }
});

// Função simples para calcular valor total baseado na descrição do produto
function calcularValorTotal(descricaoProdutos) {
  let valor = 15.0;
  if (typeof descricaoProdutos === "string") { // Garante que é string
      if (descricaoProdutos.toLowerCase().includes("g")) valor += 5.0;
      if (descricaoProdutos.toLowerCase().includes("m")) valor += 3.0;
      if (descricaoProdutos.toLowerCase().includes("p")) valor += 0.0;
      if (descricaoProdutos.toLowerCase().includes("leite condensado")) valor += 2.0;
      if (descricaoProdutos.toLowerCase().includes("morango")) valor += 2.0;
      if (descricaoProdutos.toLowerCase().includes("banana")) valor += 1.5;
  }
  return parseFloat(valor.toFixed(2));
}

// Rota para atualizar status de um pedido - Protegida por Login
app.post("/api/pedidos/update-status", requireLogin, (req, res) => {
  try {
    const { orderId, newStatus } = req.body; // Simplificado, não precisa mais de telefone/nome aqui
    const data = fs.readFileSync(pedidosFile, "utf8");
    let pedidos = JSON.parse(data);
    const pedidoIndex = pedidos.findIndex(p => p.id === orderId);
    if (pedidoIndex !== -1) {
      const oldStatus = pedidos[pedidoIndex].status;
      pedidos[pedidoIndex].status = newStatus;
      fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
      const logMessage = `[${new Date().toISOString()}] Status atualizado por ${req.session.user.username}: Pedido ${orderId} de ${oldStatus} para ${newStatus}\n`;
      fs.appendFileSync(path.join(dataDir, "atualizacoes.log"), logMessage);
      
      // Aqui você pode adicionar a lógica para notificar o n8n se necessário
      // Ex: n8nIntegration.notificarAtualizacaoStatus(pedidos[pedidoIndex], oldStatus, newStatus);
      
      res.json({ 
        success: true, 
        message: "Status atualizado com sucesso",
        orderId: orderId,
        oldStatus: oldStatus,
        newStatus: newStatus
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
    const pedidoIndex = pedidos.findIndex(p => p.id === orderId);

    if (pedidoIndex !== -1) {
      const pedidoRemovido = pedidos.splice(pedidoIndex, 1)[0]; // Remove o pedido
      fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
      const logMessage = `[${new Date().toISOString()}] Pedido removido por ${req.session.user.username}: ${JSON.stringify(pedidoRemovido)}\n`;
      fs.appendFileSync(path.join(dataDir, "pedidos_removidos.log"), logMessage);
      console.log(`Pedido ${orderId} removido por ${req.session.user.username}`);
      res.json({ success: true, message: "Pedido removido com sucesso", orderId: orderId });
    } else {
      res.status(404).json({ success: false, message: "Pedido não encontrado" });
    }
  } catch (error) {
    console.error("Erro ao remover pedido:", error);
    res.status(500).json({ error: "Erro ao remover pedido" });
  }
});


// Rota para salvar configurações (ex: URLs de webhook) - Protegida por Admin
// Supondo que as configurações são salvas em um arquivo config.json
const configFile = path.join(dataDir, "config.json");
if (!fs.existsSync(configFile)) {
  fs.writeFileSync(configFile, JSON.stringify({ webhookUrlNovoPedido: "", webhookUrlAtualizacaoStatus: "", apiKey: "" }));
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
    const newConfig = { webhookUrlNovoPedido, webhookUrlAtualizacaoStatus, apiKey };
    fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
    console.log(`Configurações salvas por ${req.session.user.username}`);
    res.json({ success: true, message: "Configurações salvas com sucesso" });
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    res.status(500).json({ error: "Erro ao salvar configuração" });
  }
});


// Rota para enviar notificação (POST) - Não parece precisar de proteção, mas revisar caso necessário
app.post("/api/pedidos/notificar", (req, res) => {
  // ... (código original da rota notificar, sem alterações de autenticação por enquanto)
  try {
    const { orderId, telefone, nomeCliente, oldStatus, newStatus } = req.body;
    let mensagem = "";
    switch (newStatus) {
      case "Pedido Recebido":
        mensagem = `Olá ${nomeCliente}! Recebemos seu pedido #${orderId.substring(0, 8)}. Estamos preparando tudo com muito carinho!`;
        break;
      case "Em Preparo":
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} está sendo preparado neste momento. Logo estará pronto!`;
        break;
      case "Pronto para Entrega":
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} está pronto e será enviado para entrega em breve.`;
        break;
      case "Saiu para Entrega":
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} acabou de sair para entrega. Logo chegará até você!`;
        break;
      case "Entregue":
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} foi entregue. Aproveite! Agradecemos a preferência.`;
        break;
      case "Cancelado":
        mensagem = `Olá ${nomeCliente}! Infelizmente seu pedido #${orderId.substring(0, 8)} foi cancelado. Entre em contato conosco para mais informações.`;
        break;
      default:
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} teve seu status atualizado para ${newStatus}.`;
    }
    const logMessage = `[${new Date().toISOString()}] Notificação para ${telefone}: "${mensagem}"\n`;
    fs.appendFileSync(path.join(dataDir, "notificacoes.log"), logMessage);
    res.json({ 
      success: true, 
      message: "Notificação enviada com sucesso",
      telefone: telefone,
      mensagem: mensagem
    });
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    res.status(500).json({ error: "Erro ao enviar notificação" });
  }
});

// Rota de Ping (GET) - Não protegida
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Servir arquivos estáticos da pasta 'public' (se existir)
// Se o index.html estiver na raiz, esta linha pode não ser necessária ou precisar de ajuste
// app.use(express.static(path.join(__dirname, "public")));

// Rota principal para servir o index.html (se não estiver na pasta public)
// Removido o conteúdo inline, assumindo que index.html será servido como arquivo
app.get("*/", (req, res) => {
  // Verifica se o usuário está logado para decidir se mostra login ou app
  // A lógica principal será no frontend, mas podemos redirecionar aqui se não houver sessão
  // if (!req.session || !req.session.user) {
  //   // Poderia redirecionar para uma página de login específica, mas vamos tratar no frontend
  // }
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor Mr. Shake rodando na porta ${PORT}`);
});
