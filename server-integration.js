// Modificação do server.js para integrar com n8n

// Importar o módulo de integração com n8n
const n8nIntegration = require('./n8n-integration');

// Adicionar este código após a criação de um novo pedido (na rota POST /api/pedidos/get-orders)
// Dentro do bloco try, após salvar o pedido:

// Notificar o n8n sobre o novo pedido
n8nIntegration.notificarNovoPedido(novoPedido)
  .then(response => {
    console.log('Notificação enviada para n8n com sucesso');
  })
  .catch(error => {
    console.error('Erro ao notificar n8n:', error);
  });

// Adicionar este código na rota de atualização de status (na rota POST /api/pedidos/update-status)
// Dentro do bloco if (pedidoIndex !== -1), após atualizar o status:

// Notificar o n8n sobre a atualização de status
n8nIntegration.notificarAtualizacaoStatus(pedidos[pedidoIndex], oldStatus, newStatus)
  .then(response => {
    console.log('Notificação de atualização enviada para n8n com sucesso');
  })
  .catch(error => {
    console.error('Erro ao notificar n8n sobre atualização:', error);
  });
