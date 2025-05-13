// Arquivo para configurar a integração com n8n
// **MODIFICADO:** URLs e API Key agora são definidas diretamente neste arquivo.

// const fs = require("fs"); // Não é mais necessário ler o config.json
// const path = require("path"); // Não é mais necessário para config
// const { dataDir, configFile } = require("./config"); // Não é mais necessário importar configFile
const { dataDir } = require("./config"); // Manter dataDir se ainda for usado para logs

// **REMOVIDO:** Lógica de criação/verificação do diretório de dados e config.json
// if (!fs.existsSync(dataDir)) { ... }
// if (!fs.existsSync(configFile)) { ... }

// **NOVO:** Configurações do n8n definidas diretamente como variáveis.
// Insira suas URLs e API Key abaixo.
const n8nConfig = {
  // !! IMPORTANTE: Substitua "" pela URL do seu webhook n8n para NOVOS PEDIDOS
  webhookUrlNovoPedido: "https://n8n-n8n-start.moas8k.easypanel.host/webhook/novoPedido",

  // !! IMPORTANTE: Substitua "" pela URL do seu webhook n8n para ATUALIZAÇÕES DE STATUS
  webhookUrlAtualizacaoStatus: "https://n8n-n8n-start.moas8k.easypanel.host/webhook-test/atualizaStatus",

  // !! IMPORTANTE: Substitua "" pela sua API Key do n8n (se usar autenticação por API Key)
  apiKey: "",

  // Define se as notificações devem ser enviadas automaticamente
  enviarNotificacoesAutomaticas: true,
};

// **REMOVIDO:** Função loadN8nConfig() não é mais necessária
// function loadN8nConfig() { ... }
// loadN8nConfig(); // Chamada inicial removida

// Função para enviar notificação de novo pedido para o n8n
async function notificarNovoPedido(pedido) {
  // **REMOVIDO:** loadN8nConfig();
  if (!n8nConfig.enviarNotificacoesAutomaticas || !n8nConfig.webhookUrlNovoPedido) {
      if (!n8nConfig.webhookUrlNovoPedido) console.warn("URL do webhook de novo pedido não configurada em n8n-integration.js. Notificação n8n não enviada.");
      return;
  }

  // Verifica se a URL foi preenchida
  if (n8nConfig.webhookUrlNovoPedido === "") {
      console.warn("URL do webhook de novo pedido está vazia em n8n-integration.js. Notificação n8n não enviada.");
      return;
  }

  try {
    const response = await fetch(n8nConfig.webhookUrlNovoPedido, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Adiciona a API Key apenas se ela estiver definida
        ...(n8nConfig.apiKey && { 'X-API-Key': n8nConfig.apiKey })
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

    console.log(`Notificação de novo pedido enviada para n8n (${n8nConfig.webhookUrlNovoPedido}). Status: ${response.status}`);
    if (!response.ok) {
        console.warn(`Resposta não OK (${response.status}) ao notificar novo pedido para n8n.`);
    }
  } catch (error) {
    if (error.cause && error.cause.code === 'ENOTFOUND') {
        console.error(`Erro ao enviar notificação para n8n: Não foi possível encontrar o host ${error.cause.hostname}. Verifique a URL do webhook de novo pedido em n8n-integration.js.`);
    } else {
        console.error('Erro ao enviar notificação de novo pedido para n8n:', error);
    }
  }
}

// Função para enviar notificação de atualização de status para o n8n
async function notificarAtualizacaoStatus(pedido, statusAntigo, statusNovo) {
  // **REMOVIDO:** loadN8nConfig();
  if (!n8nConfig.enviarNotificacoesAutomaticas || !n8nConfig.webhookUrlAtualizacaoStatus) {
      if (!n8nConfig.webhookUrlAtualizacaoStatus) console.warn("URL do webhook de atualização de status não configurada em n8n-integration.js. Notificação n8n não enviada.");
      return;
  }

  // Verifica se a URL foi preenchida
  if (n8nConfig.webhookUrlAtualizacaoStatus === "") {
      console.warn("URL do webhook de atualização de status está vazia em n8n-integration.js. Notificação n8n não enviada.");
      return;
  }

  try {
    const response = await fetch(n8nConfig.webhookUrlAtualizacaoStatus, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Adiciona a API Key apenas se ela estiver definida
        ...(n8nConfig.apiKey && { 'X-API-Key': n8nConfig.apiKey })
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

    console.log(`Notificação de atualização de status enviada para n8n (${n8nConfig.webhookUrlAtualizacaoStatus}). Status: ${response.status}`);
    if (!response.ok) {
        console.warn(`Resposta não OK (${response.status}) ao notificar atualização de status para n8n.`);
    }
  } catch (error) {
    if (error.cause && error.cause.code === 'ENOTFOUND') {
        console.error(`Erro ao enviar notificação para n8n: Não foi possível encontrar o host ${error.cause.hostname}. Verifique a URL do webhook de atualização de status em n8n-integration.js.`);
    } else {
        console.error('Erro ao enviar notificação de atualização para n8n:', error);
    }
  }
}

module.exports = {
  notificarNovoPedido,
  notificarAtualizacaoStatus,
};
