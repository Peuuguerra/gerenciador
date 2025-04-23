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

// Rota para servir o arquivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
