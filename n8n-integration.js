// Arquivo para configurar a integração com n8n no Render.com
// Este arquivo deve ser incluído no seu projeto para facilitar a integração

const fs = require("fs");
const path = require("path");

// **MODIFICADO:** Ler configurações do arquivo config.json
const dataDir = path.join(__dirname, "data");
const configFile = path.join(dataDir, "config.json");

let n8nConfig = {
  webhookUrlNovoPedido: "", // Será lido do arquivo
  webhookUrlAtualizacaoStatus: "", // Será lido do arquivo
  apiKey: "", // Será lido do arquivo
  enviarNotificacoesAutomaticas: true, // Manter como padrão ou ler do arquivo se necessário
};

try {
  if (fs.existsSync(configFile)) {
    const configData = fs.readFileSync(configFile, "utf8");
    const loadedConfig = JSON.parse(configData);
    // Atualiza as URLs e a chave de API com os valores do arquivo
    n8nConfig.webhookUrlNovoPedido = loadedConfig.webhookUrlNovoPedido || "";
    n8nConfig.webhookUrlAtualizacaoStatus = loadedConfig.webhookUrlAtualizacaoStatus || "";
    n8nConfig.apiKey = loadedConfig.apiKey || "";
    console.log("Configurações do n8n carregadas de config.json");
  } else {
    console.warn("Arquivo config.json não encontrado em /data. Usando URLs vazias para n8n.");
  }
} catch (error) {
  console.error("Erro ao ler config.json para integração n8n:", error);
}


// Função para recarregar configurações (pode ser útil se o config.json mudar sem reiniciar o servidor)
function reloadN8nConfig() {
  try {
    if (fs.existsSync(configFile)) {
      const configData = fs.readFileSync(configFile, "utf8");
      const loadedConfig = JSON.parse(configData);
      n8nConfig.webhookUrlNovoPedido = loadedConfig.webhookUrlNovoPedido || "";
      n8nConfig.webhookUrlAtualizacaoStatus = loadedConfig.webhookUrlAtualizacaoStatus || "";
      n8nConfig.apiKey = loadedConfig.apiKey || "";
      console.log("Configurações do n8n recarregadas.");
    } else {
       console.warn("Tentativa de recarregar config.json falhou: arquivo não encontrado.");
    }
  } catch (error) {
    console.error("Erro ao recarregar config.json para integração n8n:", error);
  }
}

// Função para enviar notificação de novo pedido para o n8n
async function notificarNovoPedido(pedido) {
  reloadN8nConfig(); // Recarrega as configs antes de enviar
  if (!n8nConfig.enviarNotificacoesAutomaticas || !n8nConfig.webhookUrlNovoPedido) {
      if (!n8nConfig.webhookUrlNovoPedido) console.warn("URL do webhook de novo pedido não configurada. Notificação n8n não enviada.");
      return;
  }
  
  try {
    const response = await fetch(n8nConfig.webhookUrlNovoPedido, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': n8nConfig.apiKey // Usa a chave lida do config
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
    return response;
  } catch (error) {
    // Verifica se o erro é ENOTFOUND e dá uma mensagem mais clara
    if (error.code === 'ENOTFOUND') {
        console.error(`Erro ao enviar notificação para n8n: Não foi possível encontrar o host ${error.hostname}. Verifique a URL do webhook de novo pedido nas configurações.`);
    } else {
        console.error('Erro ao enviar notificação de novo pedido para n8n:', error);
    }
    return null;
  }
}

// Função para enviar notificação de atualização de status para o n8n
async function notificarAtualizacaoStatus(pedido, statusAntigo, statusNovo) {
  reloadN8nConfig(); // Recarrega as configs antes de enviar
  if (!n8nConfig.enviarNotificacoesAutomaticas || !n8nConfig.webhookUrlAtualizacaoStatus) {
      if (!n8nConfig.webhookUrlAtualizacaoStatus) console.warn("URL do webhook de atualização de status não configurada. Notificação n8n não enviada.");
      return;
  }
  
  try {
    const response = await fetch(n8nConfig.webhookUrlAtualizacaoStatus, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': n8nConfig.apiKey // Usa a chave lida do config
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
    return response;
  } catch (error) {
     // Verifica se o erro é ENOTFOUND e dá uma mensagem mais clara
    if (error.code === 'ENOTFOUND') {
        console.error(`Erro ao enviar notificação para n8n: Não foi possível encontrar o host ${error.hostname}. Verifique a URL do webhook de atualização de status nas configurações.`);
    } else {
        console.error('Erro ao enviar notificação de atualização para n8n:', error);
    }
    return null;
  }
}

module.exports = {
  // n8nConfig, // Não precisa exportar o config diretamente
  notificarNovoPedido,
  notificarAtualizacaoStatus,
  reloadN8nConfig // Exporta a função de recarregar, caso seja útil
};
