# Implementação de Som de Notificação para Novos Pedidos

Este documento descreve a implementação de um som de notificação para alertar quando novos pedidos chegam ao sistema Mr. Shake.

## Arquivos Modificados

1. **notification-sound.js** (novo arquivo)
   - Contém todas as funções necessárias para gerenciar o som de notificação
   - Rastreia o número de pedidos para detectar novos pedidos
   - Toca um som alto e curto quando novos pedidos são detectados

2. **index.html**
   - Adicionada referência ao script notification-sound.js
   - Modificada a função fetchOrders() para verificar novos pedidos

3. **notification.wav** (novo arquivo)
   - Arquivo de som curto e alto para notificação
   - Formato WAV para compatibilidade com todos os navegadores

## Como Funciona

1. O sistema mantém um contador do número de pedidos atual
2. Quando novos pedidos são recebidos (fetchOrders retorna mais pedidos que o contador anterior):
   - Um som de notificação é tocado
   - Uma notificação visual é exibida
   - O contador é atualizado

## Detalhes Técnicos

- O som é inicializado quando a página carrega (evento DOMContentLoaded)
- Volume configurado para máximo (1.0) para garantir que seja alto
- O som é reiniciado antes de tocar para garantir que seja reproduzido mesmo se já estiver tocando
- Tratamento de erros para casos onde o navegador não permite reprodução automática

## Personalização

Para alterar o som de notificação:
1. Substitua o arquivo notification.wav por outro arquivo de som
2. Mantenha o mesmo nome de arquivo ou atualize a referência em notification-sound.js
