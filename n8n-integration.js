// Arquivo para configurar a integração com n8n
// Este arquivo deve ser incluído no seu projeto para facilitar a integração

// Configurações para integração com n8n
const n8nConfig = {
  // URL do webhook do n8n que receberá as notificações de novos pedidos
  // Substitua pela URL real do seu webhook no n8n
  webhookUrlNovoPedido: "https://seu-n8n.com/webhook/novo-pedido",
  
  // URL do webhook do n8n que receberá as notificações de atualização de status
  // Substitua pela URL real do seu webhook no n8n
  webhookUrlAtualizacaoStatus: "https://seu-n8n.com/webhook/atualizacao-status",
  
  // Habilitar envio automático de notificações para o n8n
  enviarNotificacoesAutomaticas: true,
  
  // Chave de API para autenticação (opcional, implemente se necessário)
  apiKey: "sua-chave-secreta"
};

// Função para enviar notificação de novo pedido para o n8n
async function notificarNovoPedido(pedido) {
  if (!n8nConfig.enviarNotificacoesAutomaticas) return;
  
  try {
    const response = await fetch(n8nConfig.webhookUrlNovoPedido, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': n8nConfig.apiKey
      },
      body: JSON.stringify({
        evento: 'novo_pedido',
        pedido: {
          id: pedido.id,
          nomeCliente: pedido.nomeCliente,
          telefone: pedido.telefone,
          produtos: pedido.produtos,
          valorTotal: pedido.valorTotal,
          status: pedido.status,
          timestamp: pedido.timestamp
        }
      })
    });
    
    console.log(`Notificação de novo pedido enviada para n8n. Status: ${response.status}`);
    return response;
  } catch (error) {
    console.error('Erro ao enviar notificação para n8n:', error);
    return null;
  }
}

// Função para enviar notificação de atualização de status para o n8n
async function notificarAtualizacaoStatus(pedido, statusAntigo, statusNovo) {
  if (!n8nConfig.enviarNotificacoesAutomaticas) return;
  
  try {
    const response = await fetch(n8nConfig.webhookUrlAtualizacaoStatus, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': n8nConfig.apiKey
      },
      body: JSON.stringify({
        evento: 'atualizacao_status',
        pedido: {
          id: pedido.id,
          nomeCliente: pedido.nomeCliente,
          telefone: pedido.telefone,
          statusAntigo: statusAntigo,
          statusNovo: statusNovo,
          timestamp: new Date().toISOString()
        }
      })
    });
    
    console.log(`Notificação de atualização de status enviada para n8n. Status: ${response.status}`);
    return response;
  } catch (error) {
    console.error('Erro ao enviar notificação para n8n:', error);
    return null;
  }
}

module.exports = {
  n8nConfig,
  notificarNovoPedido,
  notificarAtualizacaoStatus
};
