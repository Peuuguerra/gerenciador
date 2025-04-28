const path = require('path');

// Define o diretório de dados. Usa a variável de ambiente DATA_DIR se definida,
// caso contrário, usa um diretório 'data' relativo ao local do script.
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');

// Define os caminhos completos para os arquivos de dados
const configFile = path.join(dataDir, 'config.json');
const pedidosFile = path.join(dataDir, 'pedidos.json');

// Exporta os caminhos para serem usados em outros módulos
module.exports = {
    dataDir,
    configFile,
    pedidosFile
};

