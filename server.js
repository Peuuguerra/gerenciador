const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Garantir que os diretórios necessários existam
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Diretório para armazenar os pedidos
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Arquivo para armazenar os pedidos
const pedidosFile = path.join(dataDir, 'pedidos.json');

// Inicializar o arquivo de pedidos se não existir
if (!fs.existsSync(pedidosFile)) {
  fs.writeFileSync(pedidosFile, JSON.stringify([]));
}

// Função para gerar ID único
function generateOrderId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Rota para obter todos os pedidos (GET)
app.get('/api/pedidos/get-orders', (req, res) => {
  try {
    const data = fs.readFileSync(pedidosFile, 'utf8');
    const pedidos = JSON.parse(data);
    
    // Retornar no formato que o sistema original espera
    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao ler pedidos:', error);
    res.status(500).json({ error: 'Erro ao ler pedidos' });
  }
});

// Rota para adicionar um novo pedido (POST)
app.post('/api/pedidos/get-orders', (req, res) => {
  try {
    console.log('Recebido pedido:', req.body);
    
    // Ler pedidos existentes
    const data = fs.readFileSync(pedidosFile, 'utf8');
    const pedidos = JSON.parse(data);
    
    // Extrair dados do pedido do corpo da requisição
    const { Cliente, Telefone, Endereço, Produtos, "Forma de Pagamento": formaPagamento } = req.body;
    
    // Criar novo pedido no formato que o sistema original espera
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
    
    // Adicionar o novo pedido
    pedidos.push(novoPedido);
    
    // Salvar os pedidos atualizados
    fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
    
    // Registrar o pedido em um log
    const logMessage = `[${new Date().toISOString()}] Novo pedido: ${JSON.stringify(novoPedido)}\n`;
    fs.appendFileSync(path.join(dataDir, 'pedidos.log'), logMessage);
    
    res.status(201).json({ 
      success: true, 
      message: 'Pedido recebido com sucesso',
      pedido: novoPedido
    });
  } catch (error) {
    console.error('Erro ao salvar pedido:', error);
    res.status(500).json({ error: 'Erro ao salvar pedido' });
  }
});

// Função simples para calcular valor total baseado na descrição do produto
function calcularValorTotal(descricaoProdutos) {
  // Lógica simplificada para estimar o valor
  let valor = 15.0; // Valor base
  
  // Adicionar valor baseado em palavras-chave
  if (descricaoProdutos.toLowerCase().includes('g')) valor += 5.0;
  if (descricaoProdutos.toLowerCase().includes('m')) valor += 3.0;
  if (descricaoProdutos.toLowerCase().includes('p')) valor += 0.0;
  if (descricaoProdutos.toLowerCase().includes('leite condensado')) valor += 2.0;
  if (descricaoProdutos.toLowerCase().includes('morango')) valor += 2.0;
  if (descricaoProdutos.toLowerCase().includes('banana')) valor += 1.5;
  
  return parseFloat(valor.toFixed(2));
}

// Rota para atualizar status de um pedido
app.post('/api/pedidos/update-status', (req, res) => {
  try {
    const { orderId, newStatus, telefone, nomeCliente, oldStatus } = req.body;
    
    // Ler pedidos existentes
    const data = fs.readFileSync(pedidosFile, 'utf8');
    const pedidos = JSON.parse(data);
    
    // Encontrar e atualizar o pedido
    const pedidoIndex = pedidos.findIndex(p => p.id === orderId);
    
    if (pedidoIndex !== -1) {
      // Guardar status antigo
      const oldStatus = pedidos[pedidoIndex].status;
      
      // Atualizar status
      pedidos[pedidoIndex].status = newStatus;
      
      // Salvar os pedidos atualizados
      fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
      
      // Registrar a atualização em um log
      const logMessage = `[${new Date().toISOString()}] Status atualizado: Pedido ${orderId} de ${oldStatus} para ${newStatus}\n`;
      fs.appendFileSync(path.join(dataDir, 'atualizacoes.log'), logMessage);
      
      res.json({ 
        success: true, 
        message: 'Status atualizado com sucesso',
        orderId: orderId,
        oldStatus: oldStatus,
        newStatus: newStatus
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Pedido não encontrado' 
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Rota para enviar notificação
app.post('/api/pedidos/notificar', (req, res) => {
  try {
    const { orderId, telefone, nomeCliente, oldStatus, newStatus } = req.body;
    
    // Criar mensagem baseada no status
    let mensagem = "";
    switch (newStatus) {
      case 'Pedido Recebido':
        mensagem = `Olá ${nomeCliente}! Recebemos seu pedido #${orderId.substring(0, 8)}. Estamos preparando tudo com muito carinho!`;
        break;
      case 'Em Preparo':
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} está sendo preparado neste momento. Logo estará pronto!`;
        break;
      case 'Pronto para Entrega':
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} está pronto e será enviado para entrega em breve.`;
        break;
      case 'Saiu para Entrega':
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} acabou de sair para entrega. Logo chegará até você!`;
        break;
      case 'Entregue':
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} foi entregue. Aproveite! Agradecemos a preferência.`;
        break;
      case 'Cancelado':
        mensagem = `Olá ${nomeCliente}! Infelizmente seu pedido #${orderId.substring(0, 8)} foi cancelado. Entre em contato conosco para mais informações.`;
        break;
      default:
        mensagem = `Olá ${nomeCliente}! Seu pedido #${orderId.substring(0, 8)} teve seu status atualizado para ${newStatus}.`;
    }
    
    // Registrar a notificação em um log
    const logMessage = `[${new Date().toISOString()}] Notificação para ${telefone}: "${mensagem}"\n`;
    fs.appendFileSync(path.join(dataDir, 'notificacoes.log'), logMessage);
    
    res.json({ 
      success: true, 
      message: 'Notificação enviada com sucesso',
      telefone: telefone,
      mensagem: mensagem
    });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

// Rota para verificar se o servidor está online (útil para pings de monitoramento)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota para servir o arquivo HTML principal - MODIFICADA PARA SERVIR HTML DIRETAMENTE
app.get('/', (req, res) => {
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mr. Shake - Gerenciamento de Pedidos</title>
    <style>
        /* Estilos para a página de gerenciamento de pedidos Mr. Shake */
        :root {
            --primary-color: #8A2BE2; /* Roxo */
            --secondary-color: #FF0000; /* Vermelho */
            --accent-color: #FFD700; /* Amarelo */
            --light-color: #f8f9fa;
            --dark-color: #343a40;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
            --info-color: #17a2b8;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
        }

        body {
            background-color: #f5f5f5;
            color: var(--dark-color);
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        /* Estilos do cabeçalho */
        .header {
            background-color: var(--primary-color);
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 5px;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .header-left {
            display: flex;
            align-items: center;
        }

        .logo {
            height: 60px;
            margin-right: 15px;
            border-radius: 50%;
        }

        .brand-name {
            font-size: 1.5rem;
            font-weight: bold;
        }

        .user-info {
            display: flex;
            align-items: center;
        }

        .user-name {
            margin-right: 15px;
            font-weight: bold;
        }

        .logout-btn {
            background-color: var(--secondary-color);
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.3s;
        }

        .logout-btn:hover {
            background-color: #c82333;
        }

        /* Estilos da tela de login */
        .login-container {
            max-width: 400px;
            margin: 100px auto;
            padding: 30px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            text-align: center;
        }

        .login-logo {
            width: 120px;
            margin-bottom: 20px;
            border-radius: 50%;
        }

        .login-title {
            color: var(--primary-color);
            margin-bottom: 20px;
            font-size: 1.8rem;
        }

        .login-form {
            display: flex;
            flex-direction: column;
        }

        .form-group {
            margin-bottom: 15px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: var(--dark-color);
        }

        .form-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
        }

        .btn-primary {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: bold;
            transition: background-color 0.3s;
            margin-top: 10px;
        }

        .btn-primary:hover {
            background-color: #7526c1;
        }

        .error-message {
            color: var(--danger-color);
            margin-top: 15px;
            font-size: 0.9rem;
        }

        /* Estilos das abas */
        .tabs {
            display: flex;
            margin-bottom: 20px;
            border-bottom: 2px solid var(--primary-color);
        }

        .tab {
            padding: 10px 20px;
            cursor: pointer;
            background-color: #e9ecef;
            border: none;
            border-radius: 5px 5px 0 0;
            margin-right: 5px;
            font-weight: bold;
            transition: background-color 0.3s;
        }

        .tab.active {
            background-color: var(--primary-color);
            color: white;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        /* Estilos da tabela de pedidos */
        .search-container {
            margin-bottom: 20px;
            display: flex;
        }

        .search-input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px 0 0 4px;
            font-size: 1rem;
        }

        .search-btn {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 0 4px 4px 0;
            cursor: pointer;
            font-weight: bold;
        }

        .orders-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .orders-table th, .orders-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        .orders-table th {
            background-color: var(--primary-color);
            color: white;
            font-weight: bold;
        }

        .orders-table tr:hover {
            background-color: #f5f5f5;
        }

        .status-badge {
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            text-align: center;
            display: inline-block;
            min-width: 120px;
        }

        .status-received {
            background-color: var(--info-color);
            color: white;
        }

        .status-preparing {
            background-color: var(--warning-color);
            color: black;
        }

        .status-ready {
            background-color: var(--accent-color);
            color: black;
        }

        .status-delivering {
            background-color: var(--primary-color);
            color: white;
        }

        .status-delivered {
            background-color: var(--success-color);
            color: white;
        }

        .status-canceled {
            background-color: var(--danger-color);
            color: white;
        }

        .action-btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-right: 5px;
            transition: background-color 0.3s;
        }

        .details-btn {
            background-color: var(--info-color);
            color: white;
        }

        .details-btn:hover {
            background-color: #138496;
        }

        .delete-btn {
            background-color: var(--danger-color);
            color: white;
        }

        .delete-btn:hover {
            background-color: #bd2130;
        }

        .refresh-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .refresh-btn {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
        }

        .refresh-btn:hover {
            background-color: #7526c1;
        }

        .refresh-icon {
            margin-right: 5px;
        }

        .auto-refresh {
            display: flex;
            align-items: center;
        }

        .auto-refresh label {
            margin-right: 10px;
        }

        .auto-refresh select {
            padding: 6px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }

        /* Estilos do modal de detalhes do pedido */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }

        .modal-content {
            background-color: white;
            margin: 10% auto;
            padding: 20px;
            border-radius: 8px;
            width: 80%;
            max-width: 600px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            position: relative;
        }

        .close {
            position: absolute;
            right: 20px;
            top: 15px;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            color: #aaa;
        }

        .close:hover {
            color: black;
        }

        .order-details {
            margin-top: 20px;
        }

        .order-details h3 {
            color: var(--primary-color);
            margin-bottom: 15px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }

        .detail-row {
            display: flex;
            margin-bottom: 10px;
        }

        .detail-label {
            font-weight: bold;
            width: 150px;
            color: var(--dark-color);
        }

        .detail-value {
            flex: 1;
        }

        .products-list {
            list-style-type: none;
            padding-left: 0;
        }

        .products-list li {
            padding: 5px 0;
            border-bottom: 1px dashed #ddd;
        }

        .status-actions {
            margin-top: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .status-btn {
            padding: 8px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.3s;
            flex: 1;
            min-width: 120px;
            margin-bottom: 10px;
        }

        .btn-received {
            background-color: var(--info-color);
            color: white;
        }

        .btn-preparing {
            background-color: var(--warning-color);
            color: black;
        }

        .btn-ready {
            background-color: var(--accent-color);
            color: black;
        }

        .btn-delivering {
            background-color: var(--primary-color);
            color: white;
        }

        .btn-delivered {
            background-color: var(--success-color);
            color: white;
        }

        .btn-canceled {
            background-color: var(--danger-color);
            color: white;
        }

        /* Estilos para notificações */
        .notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
        }

        .notification {
            background-color: var(--primary-color);
            color: white;
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            animation: slideIn 0.3s ease-out;
        }

        .notification.error {
            background-color: var(--danger-color);
        }

        .notification.success {
            background-color: var(--success-color);
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        /* Estilos para o log de notificações */
        .notification-log-container {
            margin-top: 30px;
            background-color: white;
            border-radius: 5px;
            padding: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .notification-log-title {
            color: var(--primary-color);
            margin-bottom: 15px;
            font-size: 1.2rem;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }

        .notification-log {
            max-height: 200px;
            overflow-y: auto;
        }

        .log-entry {
            padding: 8px 0;
            border-bottom: 1px dashed #ddd;
            display: flex;
        }

        .log-time {
            font-weight: bold;
            color: var(--primary-color);
            margin-right: 10px;
            min-width: 80px;
        }

        .log-message {
            flex: 1;
        }

        /* Estilos para o botão de adicionar pedido de teste */
        .add-test-order {
            background-color: var(--accent-color);
            color: black;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-left: 10px;
        }

        .add-test-order:hover {
            background-color: #e6c200;
        }

        /* Estilos para o botão de configuração */
        .config-button {
            background-color: var(--accent-color);
            color: black;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-left: 10px;
        }

        .config-button:hover {
            background-color: #e6c200;
        }

        /* Responsividade */
        @media (max-width: 768px) {
            .header {
                flex-direction: column;
                text-align: center;
            }

            .header-left {
                margin-bottom: 10px;
                flex-direction: column;
            }

            .logo {
                margin-right: 0;
                margin-bottom: 10px;
            }

            .user-info {
                flex-direction: column;
            }

            .user-name {
                margin-right: 0;
                margin-bottom: 10px;
            }

            .orders-table {
                display: block;
                overflow-x: auto;
            }

            .modal-content {
                width: 95%;
                margin: 5% auto;
            }

            .status-actions {
                flex-direction: column;
            }

            .status-btn {
                width: 100%;
            }

            .refresh-container {
                flex-direction: column;
                align-items: flex-start;
            }

            .auto-refresh {
                margin-top: 10px;
            }
        }

        /* Estilos para o botão de simulação de pedido */
        .simulate-order-btn {
            background-color: var(--accent-color);
            color: black;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-left: 10px;
        }

        .simulate-order-btn:hover {
            background-color: #e6c200;
        }

        /* Estilos para o formulário de configuração */
        #integrationConfigForm .form-group {
            margin-bottom: 20px;
        }

        #integrationConfigForm label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="notification-container" id="notificationContainer"></div>

    <div class="container">
        <div class="header">
            <div class="header-left">
                <img src="https://via.placeholder.com/60/8A2BE2/FFFFFF?text=MS" alt="Logo" class="logo">
                <div class="brand-name">Mr. Shake - Gerenciamento de Pedidos</div>
            </div>
            <div class="user-info">
                <div class="user-name">Administrador</div>
                <button class="config-button" id="configButton">Configurações</button>
                <button class="logout-btn">Sair</button>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" data-tab="orders">Pedidos</button>
            <button class="tab" data-tab="notifications">Notificações</button>
        </div>

        <div class="tab-content active" id="ordersTab">
            <div class="refresh-container">
                <div>
                    <button class="refresh-btn" id="refreshButton">
                        <span class="refresh-icon">↻</span> Atualizar
                    </button>
                    <button class="add-test-order" id="addTestOrderButton">Adicionar Pedido de Teste</button>
                    <button class="simulate-order-btn" id="simulateOrderButton">Simular Pedido WhatsApp</button>
                </div>
                <div class="auto-refresh">
                    <label for="refreshInterval">Atualização automática:</label>
                    <select id="refreshInterval">
                        <option value="0">Desativada</option>
                        <option value="5000">5 segundos</option>
                        <option value="10000">10 segundos</option>
                        <option value="30000" selected>30 segundos</option>
                        <option value="60000">1 minuto</option>
                    </select>
                </div>
            </div>

            <div class="search-container">
                <input type="text" class="search-input" id="searchInput" placeholder="Buscar por nome, telefone ou status...">
                <button class="search-btn">Buscar</button>
            </div>

            <table class="orders-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Telefone</th>
                        <th>Produtos</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th>Data/Hora</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="ordersTableBody">
                    <!-- Os pedidos serão carregados dinamicamente aqui -->
                </tbody>
            </table>
        </div>

        <div class="tab-content" id="notificationsTab">
            <div class="notification-log-container">
                <h3 class="notification-log-title">Histórico de Notificações</h3>
                <div class="notification-log" id="notificationLog">
                    <!-- As notificações serão carregadas dinamicamente aqui -->
                </div>
            </div>
        </div>
    </div>

    <!-- Modal de Detalhes do Pedido -->
    <div class="modal" id="orderDetailsModal">
        <div class="modal-content">
            <span class="close" id="closeModal">&times;</span>
            <h2>Detalhes do Pedido</h2>
            <div class="order-details" id="orderDetails">
                <!-- Os detalhes do pedido serão carregados dinamicamente aqui -->
            </div>
            <div class="status-actions" id="statusActions">
                <!-- Os botões de status serão carregados dinamicamente aqui -->
            </div>
        </div>
    </div>

    <!-- Modal de Configuração -->
    <div class="modal" id="configModal">
        <div class="modal-content">
            <span class="close" id="closeConfigModal">&times;</span>
            <h2>Configurações de Integração</h2>
            <form id="integrationConfigForm">
                <div class="form-group">
                    <label for="webhookUrl">URL do Webhook (n8n):</label>
                    <input type="text" id="webhookUrl" placeholder="https://seu-n8n.com/webhook/abc123">
                </div>
                <div class="form-group">
                    <label for="statusWebhookUrl">URL do Webhook para Status (n8n):</label>
                    <input type="text" id="statusWebhookUrl" placeholder="https://seu-n8n.com/webhook/def456">
                </div>
                <div class="form-group">
                    <label for="apiKey">Chave de API (opcional):</label>
                    <input type="text" id="apiKey" placeholder="Chave secreta para autenticação">
                </div>
                <button type="submit" class="btn-primary">Salvar Configurações</button>
            </form>
        </div>
    </div>

    <script>
        // Variáveis globais
        let orders = [];
        let notificationLog = [];
        let refreshIntervalId = null;
        let config = {
            webhookUrl: localStorage.getItem('webhookUrl') || '',
            statusWebhookUrl: localStorage.getItem('statusWebhookUrl') || '',
            apiKey: localStorage.getItem('apiKey') || ''
        };

        // Elementos DOM
        const ordersTableBody = document.getElementById('ordersTableBody');
        const notificationContainer = document.getElementById('notificationContainer');
        const notificationLogElement = document.getElementById('notificationLog');
        const orderDetailsModal = document.getElementById('orderDetailsModal');
        const orderDetailsContent = document.getElementById('orderDetails');
        const statusActionsContent = document.getElementById('statusActions');
        const closeModalBtn = document.getElementById('closeModal');
        const refreshButton = document.getElementById('refreshButton');
        const addTestOrderButton = document.getElementById('addTestOrderButton');
        const simulateOrderButton = document.getElementById('simulateOrderButton');
        const refreshIntervalSelect = document.getElementById('refreshInterval');
        const searchInput = document.getElementById('searchInput');
        const configButton = document.getElementById('configButton');
        const configModal = document.getElementById('configModal');
        const closeConfigModalBtn = document.getElementById('closeConfigModal');
        const integrationConfigForm = document.getElementById('integrationConfigForm');
        const webhookUrlInput = document.getElementById('webhookUrl');
        const statusWebhookUrlInput = document.getElementById('statusWebhookUrl');
        const apiKeyInput = document.getElementById('apiKey');

        // Inicialização
        document.addEventListener('DOMContentLoaded', () => {
            loadOrders();
            setupTabNavigation();
            setupEventListeners();
            loadConfig();
            startAutoRefresh();
        });

        // Configurar navegação por abas
        function setupTabNavigation() {
            const tabs = document.querySelectorAll('.tab');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.getAttribute('data-tab');
                    
                    // Remover classe active de todas as abas
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    
                    // Adicionar classe active à aba clicada
                    tab.classList.add('active');
                    document.getElementById(tabId + 'Tab').classList.add('active');
                });
            });
        }

        // Configurar event listeners
        function setupEventListeners() {
            refreshButton.addEventListener('click', loadOrders);
            addTestOrderButton.addEventListener('click', addTestOrder);
            simulateOrderButton.addEventListener('click', simulateWhatsAppOrder);
            closeModalBtn.addEventListener('click', () => orderDetailsModal.style.display = 'none');
            configButton.addEventListener('click', () => {
                loadConfig();
                configModal.style.display = 'block';
            });
            closeConfigModalBtn.addEventListener('click', () => configModal.style.display = 'none');
            integrationConfigForm.addEventListener('submit', saveConfig);
            refreshIntervalSelect.addEventListener('change', startAutoRefresh);
            searchInput.addEventListener('input', filterOrders);
            
            // Fechar modal ao clicar fora dele
            window.addEventListener('click', (event) => {
                if (event.target === orderDetailsModal) {
                    orderDetailsModal.style.display = 'none';
                }
                if (event.target === configModal) {
                    configModal.style.display = 'none';
                }
            });
        }

        // Carregar configurações
        function loadConfig() {
            webhookUrlInput.value = config.webhookUrl;
            statusWebhookUrlInput.value = config.statusWebhookUrl;
            apiKeyInput.value = config.apiKey;
        }

        // Salvar configurações
        function saveConfig(event) {
            event.preventDefault();
            
            config.webhookUrl = webhookUrlInput.value;
            config.statusWebhookUrl = statusWebhookUrlInput.value;
            config.apiKey = apiKeyInput.value;
            
            localStorage.setItem('webhookUrl', config.webhookUrl);
            localStorage.setItem('statusWebhookUrl', config.statusWebhookUrl);
            localStorage.setItem('apiKey', config.apiKey);
            
            showNotification('Configurações salvas com sucesso!', 'success');
            configModal.style.display = 'none';
        }

        // Iniciar atualização automática
        function startAutoRefresh() {
            const interval = parseInt(refreshIntervalSelect.value);
            
            // Limpar intervalo existente
            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
                refreshIntervalId = null;
            }
            
            // Configurar novo intervalo se não for zero
            if (interval > 0) {
                refreshIntervalId = setInterval(loadOrders, interval);
            }
        }

        // Carregar pedidos da API
        function loadOrders() {
            fetch('/api/pedidos/get-orders')
                .then(response => response.json())
                .then(data => {
                    orders = data;
                    renderOrders(orders);
                })
                .catch(error => {
                    console.error('Erro ao carregar pedidos:', error);
                    showNotification('Erro ao carregar pedidos. Tente novamente.', 'error');
                });
        }

        // Renderizar pedidos na tabela
        function renderOrders(ordersToRender) {
            ordersTableBody.innerHTML = '';
            
            if (ordersToRender.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="8" style="text-align: center;">Nenhum pedido encontrado</td>';
                ordersTableBody.appendChild(row);
                return;
            }
            
            // Ordenar pedidos do mais recente para o mais antigo
            ordersToRender.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            ordersToRender.forEach(order => {
                const row = document.createElement('tr');
                
                const formattedDate = new Date(order.timestamp).toLocaleString('pt-BR');
                const formattedValue = 'R$ ' + order.valorTotal.toFixed(2);
                const statusClass = getStatusClass(order.status);
                
                row.innerHTML = 
                    '<td>' + order.id.substring(0, 8) + '</td>' +
                    '<td>' + order.nomeCliente + '</td>' +
                    '<td>' + order.telefone + '</td>' +
                    '<td>' + order.produtos.join(', ') + '</td>' +
                    '<td>' + formattedValue + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + order.status + '</span></td>' +
                    '<td>' + formattedDate + '</td>' +
                    '<td>' +
                        '<button class="action-btn details-btn" data-id="' + order.id + '">Detalhes</button>' +
                    '</td>';
                
                ordersTableBody.appendChild(row);
                
                // Adicionar event listener para o botão de detalhes
                const detailsBtn = row.querySelector('.details-btn');
                detailsBtn.addEventListener('click', () => showOrderDetails(order));
            });
        }

        // Filtrar pedidos
        function filterOrders() {
            const searchTerm = searchInput.value.toLowerCase();
            
            if (!searchTerm) {
                renderOrders(orders);
                return;
            }
            
            const filteredOrders = orders.filter(order => 
                order.nomeCliente.toLowerCase().includes(searchTerm) ||
                order.telefone.toLowerCase().includes(searchTerm) ||
                order.status.toLowerCase().includes(searchTerm) ||
                order.produtos.some(p => p.toLowerCase().includes(searchTerm))
            );
            
            renderOrders(filteredOrders);
        }

        // Obter classe CSS para status
        function getStatusClass(status) {
            switch (status) {
                case 'Pedido Recebido': return 'status-received';
                case 'Em Preparo': return 'status-preparing';
                case 'Pronto para Entrega': return 'status-ready';
                case 'Saiu para Entrega': return 'status-delivering';
                case 'Entregue': return 'status-delivered';
                case 'Cancelado': return 'status-canceled';
                default: return '';
            }
        }

        // Mostrar detalhes do pedido
        function showOrderDetails(order) {
            orderDetailsContent.innerHTML = 
                '<h3>Pedido #' + order.id.substring(0, 8) + '</h3>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Cliente:</div>' +
                    '<div class="detail-value">' + order.nomeCliente + '</div>' +
                '</div>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Telefone:</div>' +
                    '<div class="detail-value">' + order.telefone + '</div>' +
                '</div>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Endereço:</div>' +
                    '<div class="detail-value">' + (order.endereco || 'Não informado') + '</div>' +
                '</div>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Produtos:</div>' +
                    '<div class="detail-value">' +
                        '<ul class="products-list">' +
                            order.produtos.map(p => '<li>' + p + '</li>').join('') +
                        '</ul>' +
                    '</div>' +
                '</div>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Valor Total:</div>' +
                    '<div class="detail-value">R$ ' + order.valorTotal.toFixed(2) + '</div>' +
                '</div>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Forma de Pagamento:</div>' +
                    '<div class="detail-value">' + (order.formaPagamento || 'Não informado') + '</div>' +
                '</div>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Status Atual:</div>' +
                    '<div class="detail-value">' +
                        '<span class="status-badge ' + getStatusClass(order.status) + '">' + order.status + '</span>' +
                    '</div>' +
                '</div>' +
                
                '<div class="detail-row">' +
                    '<div class="detail-label">Data/Hora:</div>' +
                    '<div class="detail-value">' + new Date(order.timestamp).toLocaleString('pt-BR') + '</div>' +
                '</div>';
            
            // Configurar botões de status
            statusActionsContent.innerHTML = 
                '<button class="status-btn btn-received" data-status="Pedido Recebido" data-id="' + order.id + '">Pedido Recebido</button>' +
                '<button class="status-btn btn-preparing" data-status="Em Preparo" data-id="' + order.id + '">Em Preparo</button>' +
                '<button class="status-btn btn-ready" data-status="Pronto para Entrega" data-id="' + order.id + '">Pronto para Entrega</button>' +
                '<button class="status-btn btn-delivering" data-status="Saiu para Entrega" data-id="' + order.id + '">Saiu para Entrega</button>' +
                '<button class="status-btn btn-delivered" data-status="Entregue" data-id="' + order.id + '">Entregue</button>' +
                '<button class="status-btn btn-canceled" data-status="Cancelado" data-id="' + order.id + '">Cancelado</button>';
            
            // Adicionar event listeners para os botões de status
            const statusButtons = statusActionsContent.querySelectorAll('.status-btn');
            statusButtons.forEach(button => {
                button.addEventListener('click', () => updateOrderStatus(button.getAttribute('data-id'), button.getAttribute('data-status'), order.telefone, order.nomeCliente, order.status));
            });
            
            // Mostrar modal
            orderDetailsModal.style.display = 'block';
        }

        // Atualizar status do pedido
        function updateOrderStatus(orderId, newStatus, telefone, nomeCliente, oldStatus) {
            fetch('/api/pedidos/update-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId,
                    newStatus,
                    telefone,
                    nomeCliente,
                    oldStatus
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Status atualizado para: ' + newStatus, 'success');
                    
                    // Atualizar pedido na lista local
                    const orderIndex = orders.findIndex(o => o.id === orderId);
                    if (orderIndex !== -1) {
                        orders[orderIndex].status = newStatus;
                        renderOrders(orders);
                    }
                    
                    // Enviar notificação
                    sendNotification(orderId, telefone, nomeCliente, oldStatus, newStatus);
                    
                    // Fechar modal
                    orderDetailsModal.style.display = 'none';
                } else {
                    showNotification('Erro ao atualizar status', 'error');
                }
            })
            .catch(error => {
                console.error('Erro ao atualizar status:', error);
                showNotification('Erro ao atualizar status. Tente novamente.', 'error');
            });
        }

        // Enviar notificação
        function sendNotification(orderId, telefone, nomeCliente, oldStatus, newStatus) {
            fetch('/api/pedidos/notificar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId,
                    telefone,
                    nomeCliente,
                    oldStatus,
                    newStatus
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Adicionar ao log de notificações
                    addToNotificationLog('Notificação enviada para ' + telefone + ': "' + data.mensagem + '"');
                }
            })
            .catch(error => {
                console.error('Erro ao enviar notificação:', error);
            });
            
            // Enviar para webhook do n8n se configurado
            if (config.statusWebhookUrl) {
                fetch(config.statusWebhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': config.apiKey || ''
                    },
                    body: JSON.stringify({
                        evento: 'atualizacao_status',
                        pedido: {
                            id: orderId,
                            telefone: telefone,
                            nomeCliente: nomeCliente,
                            statusAntigo: oldStatus,
                            statusNovo: newStatus,
                            timestamp: new Date().toISOString()
                        }
                    })
                })
                .then(response => {
                    if (response.ok) {
                        addToNotificationLog('Notificação enviada para n8n: Atualização de status para ' + newStatus);
                    }
                })
                .catch(error => {
                    console.error('Erro ao enviar para webhook:', error);
                });
            }
        }

        // Adicionar pedido de teste
        function addTestOrder() {
            const testOrder = {
                Cliente: "Cliente de Teste",
                Telefone: "11999999999",
                Endereço: "Rua de Teste, 123",
                Produtos: "Milk Shake de Chocolate G com leite condensado",
                "Forma de Pagamento": "Dinheiro"
            };
            
            fetch('/api/pedidos/get-orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testOrder)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Pedido de teste adicionado com sucesso!', 'success');
                    loadOrders();
                    
                    // Enviar para webhook do n8n se configurado
                    if (config.webhookUrl) {
                        fetch(config.webhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-Key': config.apiKey || ''
                            },
                            body: JSON.stringify({
                                evento: 'novo_pedido',
                                pedido: data.pedido
                            })
                        })
                        .then(response => {
                            if (response.ok) {
                                addToNotificationLog('Notificação enviada para n8n: Novo pedido de teste');
                            }
                        })
                        .catch(error => {
                            console.error('Erro ao enviar para webhook:', error);
                        });
                    }
                } else {
                    showNotification('Erro ao adicionar pedido de teste', 'error');
                }
            })
            .catch(error => {
                console.error('Erro ao adicionar pedido de teste:', error);
                showNotification('Erro ao adicionar pedido de teste. Tente novamente.', 'error');
            });
        }

        // Simular pedido via WhatsApp
        function simulateWhatsAppOrder() {
            const flavors = ['Chocolate', 'Morango', 'Baunilha', 'Caramelo', 'Cookies'];
            const sizes = ['P', 'M', 'G'];
            const extras = ['com leite condensado', 'com calda extra', 'com granulado', 'com banana', 'com morango'];
            
            const randomFlavor = flavors[Math.floor(Math.random() * flavors.length)];
            const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
            const randomExtra = extras[Math.floor(Math.random() * extras.length)];
            
            const names = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Lúcia', 'Fernando', 'Juliana'];
            const randomName = names[Math.floor(Math.random() * names.length)];
            
            // Gerar número de telefone aleatório
            const randomPhone = '11' + (Math.floor(Math.random() * 90000000) + 10000000);
            
            // Gerar endereço aleatório
            const streets = ['Rua das Flores', 'Av. Paulista', 'Rua Augusta', 'Av. Brasil', 'Rua dos Pinheiros'];
            const randomStreet = streets[Math.floor(Math.random() * streets.length)];
            const randomNumber = Math.floor(Math.random() * 1000) + 1;
            
            const whatsappOrder = {
                Cliente: randomName + ' (WhatsApp)',
                Telefone: randomPhone,
                Endereço: randomStreet + ', ' + randomNumber,
                Produtos: 'Milk Shake de ' + randomFlavor + ' ' + randomSize + ' ' + randomExtra,
                "Forma de Pagamento": Math.random() > 0.5 ? "Dinheiro" : "Cartão de Crédito"
            };
            
            fetch('/api/pedidos/get-orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(whatsappOrder)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Simulação de pedido via WhatsApp recebida!', 'success');
                    loadOrders();
                    
                    // Enviar para webhook do n8n se configurado
                    if (config.webhookUrl) {
                        fetch(config.webhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-Key': config.apiKey || ''
                            },
                            body: JSON.stringify({
                                evento: 'novo_pedido',
                                pedido: data.pedido,
                                origem: 'whatsapp'
                            })
                        })
                        .then(response => {
                            if (response.ok) {
                                addToNotificationLog('Notificação enviada para n8n: Novo pedido via WhatsApp');
                            }
                        })
                        .catch(error => {
                            console.error('Erro ao enviar para webhook:', error);
                        });
                    }
                } else {
                    showNotification('Erro ao simular pedido via WhatsApp', 'error');
                }
            })
            .catch(error => {
                console.error('Erro ao simular pedido via WhatsApp:', error);
                showNotification('Erro ao simular pedido via WhatsApp. Tente novamente.', 'error');
            });
        }

        // Mostrar notificação
        function showNotification(message, type = '') {
            const notification = document.createElement('div');
            notification.className = 'notification ' + type;
            notification.textContent = message;
            
            notificationContainer.appendChild(notification);
            
            // Remover notificação após 5 segundos
            setTimeout(() => {
                notification.remove();
            }, 5000);
            
            // Adicionar ao log de notificações
            addToNotificationLog(message);
        }

        // Adicionar ao log de notificações
        function addToNotificationLog(message) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('pt-BR');
            
            notificationLog.unshift({
                time: timeString,
                message: message
            });
            
            // Limitar a 50 entradas
            if (notificationLog.length > 50) {
                notificationLog.pop();
            }
            
            // Atualizar a exibição do log
            renderNotificationLog();
        }

        // Renderizar log de notificações
        function renderNotificationLog() {
            notificationLogElement.innerHTML = '';
            
            notificationLog.forEach(entry => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                
                logEntry.innerHTML = 
                    '<div class="log-time">' + entry.time + '</div>' +
                    '<div class="log-message">' + entry.message + '</div>';
                
                notificationLogElement.appendChild(logEntry);
            });
        }
    </script>
</body>
</html>`;

  res.send(htmlContent);
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
