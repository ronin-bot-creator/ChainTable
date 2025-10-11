const { ethers } = require('ethers');

/**
 * Servicio para interactuar con el contrato UnoLobby en Sepolia
 * Maneja: verificación de pagos, obtención de lobbyId, cálculo de premios
 * Nota: Las variables de entorno deben cargarse antes de requerir este módulo
 */
class ContractService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.contractAddress = process.env.CONTRACT_ADDRESS_SEPOLIA;
    this.rpcUrl = process.env.RPC_URL_SEPOLIA;
    this.initialized = false;
    
    // ABI del contrato UnoLobbyV2
    this.ABI = [
      // Events
      "event LobbyCreated(uint256 indexed lobbyId, address indexed creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode)",
      "event PlayerJoined(uint256 indexed lobbyId, address indexed player)",
      "event LobbyStarted(uint256 indexed lobbyId, uint256 playerCount)",
      "event LobbyEnded(uint256 indexed lobbyId, address indexed endedBy, address[] winners)",
      "event Payout(uint256 indexed lobbyId, address indexed to, uint256 amount)",
      "event FeeTaken(uint256 indexed lobbyId, address indexed devWallet, uint256 amount)",
      "event LobbyCancelled(uint256 indexed lobbyId, address indexed cancelledBy, uint256 refundedPlayers)",
      "event DevWalletUpdated(address indexed oldWallet, address indexed newWallet)",
      "event EmergencyWithdrawal(address indexed token, uint256 amount, address indexed to)",
      
      // View functions
      "function getLobbyPlayers(uint256 lobbyId) external view returns (address[] memory)",
      "function getLobbyInfo(uint256 lobbyId) external view returns (address creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode, uint8 state, address[] memory players, uint256 createdAt)",
      "function isPlayerInLobby(uint256 lobbyId, address player) external view returns (bool)",
      "function lobbyCount() external view returns (uint256)",
      "function devWallet() external view returns (address)",
      "function FEE_PERCENTAGE() external view returns (uint256)",
      
      // Write functions
      "function createLobby(address token, uint256 entryFee, uint16 maxPlayers, uint8 mode) external returns (uint256)",
      "function joinLobby(uint256 lobbyId) external payable",
      "function endLobby(uint256 lobbyId, address[] calldata winners) external",
      "function cancelLobby(uint256 lobbyId) external",
      
      // Owner functions
      "function setDevWallet(address _newDevWallet) external",
      "function emergencyWithdraw(address token, uint256 amount) external",
      "function emergencyEndLobby(uint256 lobbyId, address[] calldata winners) external"
    ];
  }

  /**
   * Inicializa la conexión con el contrato
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔗 Inicializando ContractService...');
      console.log('📍 RPC URL:', this.rpcUrl?.substring(0, 60) + '...');
      console.log('📍 Contract:', this.contractAddress);

      if (!this.rpcUrl || !this.contractAddress) {
        throw new Error('RPC_URL_SEPOLIA o CONTRACT_ADDRESS_SEPOLIA no configurados');
      }

      // Crear provider
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      
      // Verificar conexión
      const network = await this.provider.getNetwork();
      console.log('✅ Conectado a red:', network.name, '| ChainId:', network.chainId.toString());

      // Crear instancia del contrato (solo lectura por ahora)
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.ABI,
        this.provider
      );

      this.initialized = true;
      console.log('✅ ContractService inicializado correctamente\n');
    } catch (error) {
      console.error('❌ Error inicializando ContractService:', error.message);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Obtiene el lobbyId on-chain del evento LobbyCreated a partir de un txHash
   * @param {string} txHash - Hash de la transacción createLobby
   * @returns {Promise<string>} - lobbyId on-chain
   */
  async getLobbyIdFromTx(txHash) {
    await this.initialize();

    try {
      console.log('🔍 Buscando evento LobbyCreated en tx:', txHash);
      
      // Obtener el receipt de la transacción
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        throw new Error('Transacción no encontrada o aún pendiente');
      }

      if (receipt.status !== 1) {
        throw new Error('La transacción falló on-chain');
      }

      // Parsear logs para encontrar el evento LobbyCreated
      const iface = new ethers.Interface(this.ABI);
      
      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'LobbyCreated') {
            const lobbyId = parsedLog.args.lobbyId.toString();
            const creator = parsedLog.args.creator;
            const entryFee = ethers.formatEther(parsedLog.args.entryFee);
            const maxPlayers = parsedLog.args.maxPlayers.toString();
            const mode = parsedLog.args.mode === 0 ? 'BEAST' : 'CLASSIC';
            
            console.log('✅ LobbyId on-chain encontrado:', {
              lobbyId,
              creator,
              entryFee: entryFee + ' ETH',
              maxPlayers,
              mode
            });
            
            return { lobbyId, creator, entryFee, maxPlayers, mode };
          }
        } catch (e) {
          // Log no es del contrato, continuar
          continue;
        }
      }

      throw new Error('Evento LobbyCreated no encontrado en la transacción');
    } catch (error) {
      console.error('❌ Error obteniendo lobbyId:', error.message);
      throw error;
    }
  }

  /**
   * Verifica si una transacción de joinLobby fue exitosa
   * @param {string} txHash - Hash de la transacción joinLobby
   * @param {string} expectedLobbyId - LobbyId esperado
   * @returns {Promise<Object>} - {success, player, lobbyId}
   */
  async verifyJoinTransaction(txHash, expectedLobbyId) {
    await this.initialize();

    try {
      console.log('🔍 Verificando pago - tx:', txHash, '| lobby:', expectedLobbyId);
      
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { success: false, error: 'Transacción no encontrada o pendiente' };
      }

      if (receipt.status !== 1) {
        return { success: false, error: 'La transacción falló on-chain' };
      }

      // Verificar que sea del evento PlayerJoined
      const iface = new ethers.Interface(this.ABI);
      
      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'PlayerJoined') {
            const lobbyId = parsedLog.args.lobbyId.toString();
            const player = parsedLog.args.player;
            
            if (lobbyId === expectedLobbyId) {
              // Obtener el total de jugadores actual
              const players = await this.contract.getLobbyPlayers(lobbyId);
              
              console.log('✅ Pago verificado:', {
                player,
                lobbyId,
                totalPlayers: players.length
              });
              
              return { 
                success: true, 
                player, 
                lobbyId,
                totalPlayers: players.length
              };
            }
          }
        } catch (e) {
          continue;
        }
      }

      return { success: false, error: 'Evento PlayerJoined no encontrado para este lobby' };
    } catch (error) {
      console.error('❌ Error verificando transacción:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene la lista de jugadores de un lobby on-chain
   * @param {string} lobbyId - ID del lobby on-chain
   * @returns {Promise<Array>} - Lista de direcciones de jugadores
   */
  async getLobbyPlayers(lobbyId) {
    await this.initialize();

    try {
      const players = await this.contract.getLobbyPlayers(lobbyId);
      console.log(`📋 Jugadores en lobby ${lobbyId}:`, players.length);
      return players;
    } catch (error) {
      console.error('❌ Error obteniendo jugadores:', error.message);
      throw error;
    }
  }

  /**
   * Calcula la distribución de premios según el modo
   * @param {string} totalPrize - Premio total en ETH (como string)
   * @param {string} mode - 'BEAST' o 'CLASSIC'
   * @param {number} winnersCount - Número de ganadores (1-3)
   * @returns {Object} - {prizes: Array, commission: string}
   */
  calculatePrizeDistribution(totalPrize, mode, winnersCount) {
    const total = parseFloat(totalPrize);
    const commission = total * 0.05; // 5% comisión fija
    const prizePool = total - commission;

    let prizes = [];

    if (mode === 'BEAST') {
      // BEAST: 95% al ganador
      prizes = [prizePool.toFixed(6)];
    } else if (mode === 'CLASSIC') {
      // CLASSIC: 60% / 20% / 15% del prizePool
      if (winnersCount >= 3) {
        prizes = [
          (prizePool * 0.60).toFixed(6),  // 1er lugar: 60%
          (prizePool * 0.20).toFixed(6),  // 2do lugar: 20%
          (prizePool * 0.15).toFixed(6)   // 3er lugar: 15%
        ];
      } else if (winnersCount === 2) {
        prizes = [
          (prizePool * 0.75).toFixed(6),  // 1er lugar: 75%
          (prizePool * 0.20).toFixed(6)   // 2do lugar: 20%
        ];
      } else {
        prizes = [prizePool.toFixed(6)];  // Solo 1 ganador: 95%
      }
    } else {
      throw new Error('Modo de juego no válido. Use BEAST o CLASSIC');
    }

    return {
      prizes,
      commission: commission.toFixed(6),
      total: total.toFixed(6)
    };
  }

  /**
   * Verifica si el servicio está inicializado y listo
   */
  isReady() {
    return this.initialized;
  }
}

// Exportar instancia singleton
module.exports = new ContractService();
