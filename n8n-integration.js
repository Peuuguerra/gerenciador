// Arquivo para configurar a integração com n8n no Render.com
// Este arquivo deve ser incluído no seu projeto para facilitar a integração

const fs = require("fs");
const path = require("path");
const { dataDir, configFile } = require("./config"); // **NOVO:** Importar caminhos centralizados

// **MODIFICADO:** Garantir que o diretório de dados exista (usando dataDir importado)
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Diretório de dados criado em: ${dataDir}`);
  } catch (error) {
    console.error(`Erro ao criar diretório de dados ${dataDir}:`, error);
    // Lidar com o erro, talvez continuar com configurações padrão?
  }
}

// **MODIFICADO:** Inicializar o arquivo de configuração se não existir (usando configFile importado)
if (!fs.existsSync(configFile)) {
  try {
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        webhookUrlNovoPedido: "",
        webhookUrlAtualizacaoStatus: "",
        apiKey: "",
      }, null, 2) // Adiciona formatação para legibilidade
    );
    console.log(`Arquivo de configuração inicial criado em: ${configFile}`);
  } catch (error) {
     console.error(`Erro ao criar arquivo de configuração inicial ${configFile}:`, error);
  }
}


let n8nConfig = {
  webhookUrlNovoPedido: "",
  webhookUrlAtualizacaoStatus: "",
  apiKey: "",
  enviarNotificacoesAutomaticas: true, // Manter como padrão ou ler do arquivo se necessário
};

// **MODIFICADO:** Função unificada para carregar/recarregar configurações
function loadN8nConfig() {
  try {
    if (fs.existsSync(configFile)) {
      const configData = fs.readFileSync(configFile, "utf8");
      // Adiciona verificação para JSON vazio ou inválido
      if (configData.trim() === "") {
          console.warn(`Arquivo config.json (${configFile}) está vazio. Usando configurações padrão.`);
          // Resetar para padrão se o arquivo estiver vazio
          n8nConfig.webhookUrlNovoPedido = "";
          n8nConfig.webhookUrlAtualizacaoStatus = "";
          n8nConfig.apiKey = "";
          return; // Sai da função após resetar
      }
      const loadedConfig = JSON.parse(configData);
      n8nConfig.webhookUrlNovoPedido = loadedConfig.webhookUrlNovoPedido || "";
      n8nConfig.webhookUrlAtualizacaoStatus = loadedConfig.webhookUrlAtualizacaoStatus || "";
      n8nConfig.apiKey = loadedConfig.apiKey || "";
      console.log(`Configurações do n8n carregadas/recarregadas de ${configFile}`);
    } else {
      console.warn(`Arquivo config.json não encontrado em ${configFile}. Usando URLs vazias para n8n.`);
      // Garante que as configurações sejam resetadas se o arquivo não for encontrado
      n8nConfig.webhookUrlNovoPedido = "";
      n8nConfig.webhookUrlAtualizacaoStatus = "";
      n8nConfig.apiKey = "";
    }
  } catch (error) {
    console.error(`Erro ao ler/processar ${configFile} para integração n8n:`, error);
    // Resetar para padrão em caso de erro de leitura/parse
    n8nConfig.webhookUrlNovoPedido = "";
    n8nConfig.webhookUrlAtualizacaoStatus = "";
    n8nConfig.apiKey = "";
  }
}

// Carrega a configuração inicial quando o módulo é carregado
loadN8nConfig();


// Função para enviar notificação de novo pedido para o n8n
async function notificarNovoPedido(pedido) {
  loadN8nConfig(); // Recarrega as configs antes de enviar
  if (!n8nConfig.enviarNotificacoesAutomaticas || !n8nConfig.webhookUrlNovoPedido) {
      if (!n8nConfig.webhookUrlNovoPedido) console.warn("URL do webhook de novo pedido não configurada. Notificação n8n não enviada.");
      return;
  }

  try {
    // **MODIFICADO:** Usar fetch global (disponível no Node 18+)
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
    // Não retorna a response inteira, apenas loga o status
    if (!response.ok) {
        console.warn(`Resposta não OK (${response.status}) ao notificar novo pedido para n8n.`);
    }
  } catch (error) {
    // Verifica se o erro é ENOTFOUND e dá uma mensagem mais clara
    if (error.cause && error.cause.code === 'ENOTFOUND') {
        console.error(`Erro ao enviar notificação para n8n: Não foi possível encontrar o host ${error.cause.hostname}. Verifique a URL do webhook de novo pedido nas configurações.`);
    } else {
        console.error('Erro ao enviar notificação de novo pedido para n8n:', error);
    }
    // Não retorna null, apenas loga o erro
  }
}

// Função para enviar notificação de atualização de status para o n8n
async function notificarAtualizacaoStatus(pedido, statusAntigo, statusNovo) {
  loadN8nConfig(); // Recarrega as configs antes de enviar
  if (!n8nConfig.enviarNotificacoesAutomaticas || !n8nConfig.webhookUrlAtualizacaoStatus) {
      if (!n8nConfig.webhookUrlAtualizacaoStatus) console.warn("URL do webhook de atualização de status não configurada. Notificação n8n não enviada.");
      return;
  }

  try {
    // **MODIFICADO:** Usar fetch global
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
    if (!response.ok) {
        console.warn(`Resposta não OK (${response.status}) ao notificar atualização de status para n8n.`);
    }
  } catch (error) {
     // Verifica se o erro é ENOTFOUND e dá uma mensagem mais clara
    if (error.cause && error.cause.code === 'ENOTFOUND') {
        console.error(`Erro ao enviar notificação para n8n: Não foi possível encontrar o host ${error.cause.hostname}. Verifique a URL do webhook de atualização de status nas configurações.`);
    } else {
        console.error('Erro ao enviar notificação de atualização para n8n:', error);
    }
     // Não retorna null, apenas loga o erro
  }
}

module.exports = {
  notificarNovoPedido,
  notificarAtualizacaoStatus,
  // Não precisa mais exportar reloadN8nConfig separadamente
};
