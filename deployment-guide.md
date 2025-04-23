# Guia de Implantação e Integração com n8n

Este guia explica como implantar o sistema Mr. Shake gratuitamente e integrá-lo com o n8n via HTTP requests.

## 1. Preparação para Implantação

Antes de implantar, certifique-se de que os seguintes arquivos estão organizados:

- `server.js` - Servidor principal
- `n8n-integration.js` - Módulo de integração com n8n
- `package.json` - Dependências do projeto
- `public/index.html` - Interface do usuário
- `data/` - Diretório para armazenar dados (criado automaticamente)

## 2. Opções de Implantação Gratuita

### Opção 1: Render.com (Recomendada)

1. Crie uma conta em [render.com](https://render.com)
2. Clique em "New" e selecione "Web Service"
3. Conecte ao seu repositório GitHub ou use a opção "Upload"
4. Configure o serviço:
   - Nome: `mrshake-app`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Plano: `Free`
5. Clique em "Create Web Service"

### Opção 2: Glitch.com

1. Crie uma conta em [glitch.com](https://glitch.com)
2. Crie um novo projeto
3. Faça upload dos arquivos do projeto
4. O serviço será implantado automaticamente

### Opção 3: Replit.com

1. Crie uma conta em [replit.com](https://replit.com)
2. Crie um novo repl com Node.js
3. Faça upload dos arquivos do projeto
4. Execute o comando `node server.js`

## 3. Integração com n8n

### Configuração no n8n

1. Acesse seu n8n
2. Crie um novo workflow
3. Adicione um nó "Webhook" para receber novos pedidos:
   - Método: POST
   - Caminho: `/webhook/novo-pedido`
   - Resposta: Imediata
4. Adicione outro nó "Webhook" para receber atualizações de status:
   - Método: POST
   - Caminho: `/webhook/atualizacao-status`
   - Resposta: Imediata
5. Ative os webhooks e copie as URLs geradas

### Configuração no Seu Sistema

1. Abra o arquivo `n8n-integration.js`
2. Substitua as URLs dos webhooks pelas URLs reais do n8n:
   ```javascript
   webhookUrlNovoPedido: "https://seu-n8n.com/webhook/novo-pedido",
   webhookUrlAtualizacaoStatus: "https://seu-n8n.com/webhook/atualizacao-status",
   ```

3. Modifique o `server.js` para incluir a integração com n8n:
   - Adicione no topo do arquivo:
     ```javascript
     const n8nIntegration = require('./n8n-integration');
     ```
   
   - Na rota POST `/api/pedidos/get-orders`, após salvar o pedido, adicione:
     ```javascript
     // Notificar o n8n sobre o novo pedido
     n8nIntegration.notificarNovoPedido(novoPedido)
       .then(response => console.log('Notificação enviada para n8n com sucesso'))
       .catch(error => console.error('Erro ao notificar n8n:', error));
     ```
   
   - Na rota POST `/api/pedidos/update-status`, após atualizar o status, adicione:
     ```javascript
     // Notificar o n8n sobre a atualização de status
     n8nIntegration.notificarAtualizacaoStatus(pedidos[pedidoIndex], oldStatus, newStatus)
       .then(response => console.log('Notificação de atualização enviada para n8n com sucesso'))
       .catch(error => console.error('Erro ao notificar n8n sobre atualização:', error));
     ```

## 4. Testando a Integração

### Enviar um Pedido de Teste para o Sistema

```bash
curl -X POST https://sua-url-implantada.com/api/pedidos/get-orders \
  -H "Content-Type: application/json" \
  -d '{
    "Cliente": "Nome do Cliente",
    "Telefone": "11999999999",
    "Endereço": "Rua Exemplo, 123",
    "Produtos": "Milk Shake de Chocolate G com leite condensado",
    "Forma de Pagamento": "Dinheiro"
  }'
```

### Atualizar o Status de um Pedido

```bash
curl -X POST https://sua-url-implantada.com/api/pedidos/update-status \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "id-do-pedido",
    "newStatus": "Em Preparo",
    "telefone": "11999999999",
    "nomeCliente": "Nome do Cliente"
  }'
```

## 5. Configuração do n8n para Processar os Dados

No n8n, após os nós Webhook, você pode adicionar:

1. **Para novos pedidos**:
   - Nó "HTTP Request" para enviar mensagem via WhatsApp
   - Nó "Telegram" para notificar a equipe
   - Nó "Google Sheets" para registrar pedidos

2. **Para atualizações de status**:
   - Nó "HTTP Request" para enviar atualização ao cliente
   - Nó "IF" para executar ações diferentes com base no status

## 6. Mantendo o Serviço Online

Os serviços gratuitos geralmente hibernam após períodos de inatividade. Para manter seu serviço online:

1. Configure um "ping" periódico usando:
   - UptimeRobot (gratuito)
   - Cron-job.org (gratuito)
   - Um workflow no n8n que faz uma requisição HTTP a cada 5-10 minutos

2. Adicione esta rota ao seu `server.js`:
   ```javascript
   app.get('/ping', (req, res) => {
     res.status(200).send('pong');
   });
   ```

## 7. Solução de Problemas

- **Webhook não recebe dados**: Verifique se as URLs estão corretas e se o serviço está online
- **Erros de CORS**: Adicione o domínio do n8n às origens permitidas no CORS
- **Serviço hibernando**: Configure um ping periódico como mencionado acima
- **Dados não persistem**: Considere usar um banco de dados externo como MongoDB Atlas (gratuito)

## 8. Próximos Passos

- Implemente autenticação para proteger suas APIs
- Configure um banco de dados externo para maior confiabilidade
- Adicione monitoramento para ser alertado sobre falhas
