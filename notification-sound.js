// Funções para gerenciar o som de notificação

// Variável para rastrear o número de pedidos anterior
let previousOrdersCount = 0;

// Inicializar o som de notificação
let notificationSound = null;

function initNotificationSound() {
    notificationSound = new Audio('notification.wav');
    notificationSound.volume = 1.0; // Volume máximo
    console.log('Som de notificação inicializado');
}

// Tocar o som de notificação
function playNotificationSound() {
    if (notificationSound) {
        // Reinicia o som para garantir que toque mesmo se já estiver tocando
        notificationSound.pause();
        notificationSound.currentTime = 0;
        
        // Tenta tocar o som (pode falhar se o usuário não interagiu com a página)
        const playPromise = notificationSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('Não foi possível tocar o som de notificação:', error);
            });
        }
    } else {
        console.warn('Som de notificação não inicializado');
        // Tenta inicializar novamente
        initNotificationSound();
    }
}

// Verificar se há novos pedidos e tocar som se necessário
function checkForNewOrders(orders) {
    if (!Array.isArray(orders)) return;
    
    // Se é a primeira vez que carregamos pedidos, apenas armazenar o número
    if (previousOrdersCount === 0) {
        previousOrdersCount = orders.length;
        return;
    }
    
    // Se há mais pedidos agora do que antes, tocar o som
    if (orders.length > previousOrdersCount) {
        console.log(`Novos pedidos detectados! Anterior: ${previousOrdersCount}, Atual: ${orders.length}`);
        playNotificationSound();
        
        // Mostrar notificação visual também
        const newOrdersCount = orders.length - previousOrdersCount;
        const message = newOrdersCount === 1 
            ? "1 novo pedido recebido!" 
            : `${newOrdersCount} novos pedidos recebidos!`;
        
        if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        }
    }
    
    // Atualizar o contador para a próxima verificação
    previousOrdersCount = orders.length;
}

// Inicializar o som quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', initNotificationSound);
