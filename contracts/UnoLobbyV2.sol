// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UnoLobbyV2
 * @notice Contrato mejorado para gestionar lobbies de UNO con pagos
 * @dev Mejoras v2:
 *      - Función de emergencia para recuperar fondos atrapados
 *      - Wallet dev configurable para recibir fees
 *      - Cualquier jugador puede llamar endLobby (para auto-distribución desde frontend)
 *      - Mejor manejo de estados y validaciones
 *      - Eventos mejorados para tracking
 */
contract UnoLobbyV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // ENUMS Y STRUCTS
    // ============================================
    
    enum LobbyState { OPEN, STARTED, ENDED, CANCELLED }
    enum PaymentMode { BEAST, CLASSIC }

    struct Lobby {
        address creator;
        address token;
        uint256 entryFee;
        uint16 maxPlayers;
        PaymentMode mode;
        LobbyState state;
        address[] players;
        uint256 createdAt;
    }

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    uint256 public lobbyCount;
    address public devWallet;
    uint256 public constant FEE_PERCENTAGE = 5; // 5% fee
    
    mapping(uint256 => Lobby) public lobbies;

    // ============================================
    // EVENTS
    // ============================================
    
    event LobbyCreated(
        uint256 indexed lobbyId,
        address indexed creator,
        address token,
        uint256 entryFee,
        uint16 maxPlayers,
        uint8 mode
    );
    
    event PlayerJoined(uint256 indexed lobbyId, address indexed player);
    
    event LobbyStarted(uint256 indexed lobbyId, uint256 playerCount);
    
    event LobbyEnded(
        uint256 indexed lobbyId,
        address indexed endedBy,
        address[] winners
    );
    
    event Payout(
        uint256 indexed lobbyId,
        address indexed to,
        uint256 amount
    );
    
    event FeeTaken(
        uint256 indexed lobbyId,
        address indexed devWallet,
        uint256 amount
    );
    
    event LobbyCancelled(
        uint256 indexed lobbyId,
        address indexed cancelledBy,
        uint256 refundedPlayers
    );
    
    event DevWalletUpdated(address indexed oldWallet, address indexed newWallet);
    
    event EmergencyWithdrawal(address indexed token, uint256 amount, address indexed to);

    // ============================================
    // ERRORS
    // ============================================
    
    error InvalidEntryFee();
    error InvalidMaxPlayers();
    error LobbyNotOpen();
    error LobbyNotEnded();
    error AlreadyJoined();
    error LobbyFull();
    error NotAPlayer();
    error InvalidWinners();
    error InvalidDevWallet();
    error NoFundsToWithdraw();

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(address _devWallet) Ownable(msg.sender) {
        if (_devWallet == address(0)) revert InvalidDevWallet();
        devWallet = _devWallet;
    }

    // ============================================
    // EXTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Crea un nuevo lobby
     * @param token Dirección del token ERC20 (address(0) para ETH nativo)
     * @param entryFee Costo de entrada en wei o tokens
     * @param maxPlayers Número máximo de jugadores (2-4)
     * @param mode Modo de pago (0=BEAST, 1=CLASSIC)
     */
    function createLobby(
        address token,
        uint256 entryFee,
        uint16 maxPlayers,
        uint8 mode
    ) external returns (uint256) {
        if (entryFee == 0) revert InvalidEntryFee();
        if (maxPlayers < 2 || maxPlayers > 8) revert InvalidMaxPlayers(); // Cambiado de 4 a 8
        if (mode > 1) revert("Invalid payment mode");

        uint256 lobbyId = ++lobbyCount;
        
        Lobby storage lobby = lobbies[lobbyId];
        lobby.creator = msg.sender;
        lobby.token = token;
        lobby.entryFee = entryFee;
        lobby.maxPlayers = maxPlayers;
        lobby.mode = PaymentMode(mode);
        lobby.state = LobbyState.OPEN;
        lobby.createdAt = block.timestamp;

        emit LobbyCreated(
            lobbyId,
            msg.sender,
            token,
            entryFee,
            maxPlayers,
            mode
        );

        return lobbyId;
    }

    /**
     * @notice Unirse a un lobby existente
     * @param lobbyId ID del lobby
     */
    function joinLobby(uint256 lobbyId) external payable nonReentrant {
        Lobby storage lobby = lobbies[lobbyId];
        
        if (lobby.state != LobbyState.OPEN) revert LobbyNotOpen();
        if (lobby.players.length >= lobby.maxPlayers) revert LobbyFull();
        
        // Verificar que no esté ya unido
        for (uint i = 0; i < lobby.players.length; i++) {
            if (lobby.players[i] == msg.sender) revert AlreadyJoined();
        }

        // Manejar pago
        if (lobby.token == address(0)) {
            // ETH nativo
            if (msg.value != lobby.entryFee) revert InvalidEntryFee();
        } else {
            // Token ERC20
            IERC20(lobby.token).safeTransferFrom(
                msg.sender,
                address(this),
                lobby.entryFee
            );
        }

        lobby.players.push(msg.sender);
        
        emit PlayerJoined(lobbyId, msg.sender);

        // Auto-start si está lleno
        if (lobby.players.length == lobby.maxPlayers) {
            lobby.state = LobbyState.STARTED;
            emit LobbyStarted(lobbyId, lobby.players.length);
        }
    }

    /**
     * @notice Finaliza un lobby y distribuye premios
     * @dev CUALQUIER JUGADOR del lobby puede llamar esta función (para auto-distribución)
     * @param lobbyId ID del lobby
     * @param winners Array de ganadores en orden (1ro, 2do, 3ro)
     */
    function endLobby(uint256 lobbyId, address[] calldata winners) external nonReentrant {
        Lobby storage lobby = lobbies[lobbyId];
        
        // Validaciones
        if (lobby.state != LobbyState.STARTED && lobby.state != LobbyState.OPEN) {
            revert LobbyNotEnded();
        }
        
        // Verificar que quien llama sea un jugador del lobby
        bool isPlayer = false;
        for (uint i = 0; i < lobby.players.length; i++) {
            if (lobby.players[i] == msg.sender) {
                isPlayer = true;
                break;
            }
        }
        if (!isPlayer) revert NotAPlayer();
        
        // Validar ganadores
        if (winners.length == 0 || winners.length > 3) revert InvalidWinners();
        for (uint i = 0; i < winners.length; i++) {
            bool found = false;
            for (uint j = 0; j < lobby.players.length; j++) {
                if (lobby.players[j] == winners[i]) {
                    found = true;
                    break;
                }
            }
            if (!found) revert InvalidWinners();
        }

        lobby.state = LobbyState.ENDED;

        // Calcular pool total
        uint256 totalPool = lobby.entryFee * lobby.players.length;
        uint256 fee = (totalPool * FEE_PERCENTAGE) / 100;
        uint256 prizePool = totalPool - fee;

        // Transferir fee a devWallet
        if (fee > 0) {
            _transfer(lobby.token, devWallet, fee);
            emit FeeTaken(lobbyId, devWallet, fee);
        }

        // Distribuir premios según el modo
        if (lobby.mode == PaymentMode.BEAST) {
            // BEAST: 95% al ganador, 5% fee
            _transfer(lobby.token, winners[0], prizePool);
            emit Payout(lobbyId, winners[0], prizePool);
        } else {
            // CLASSIC: 60% / 20% / 15%, 5% fee
            uint256 firstPrize = (prizePool * 60) / 100;
            uint256 secondPrize = (prizePool * 20) / 100;
            uint256 thirdPrize = (prizePool * 15) / 100;

            _transfer(lobby.token, winners[0], firstPrize);
            emit Payout(lobbyId, winners[0], firstPrize);

            if (winners.length > 1) {
                _transfer(lobby.token, winners[1], secondPrize);
                emit Payout(lobbyId, winners[1], secondPrize);
            }

            if (winners.length > 2) {
                _transfer(lobby.token, winners[2], thirdPrize);
                emit Payout(lobbyId, winners[2], thirdPrize);
            }
        }

        emit LobbyEnded(lobbyId, msg.sender, winners);
    }

    /**
     * @notice Cancela un lobby y reembolsa a los jugadores
     * @dev Solo el creador puede cancelar antes de que empiece
     * @param lobbyId ID del lobby
     */
    function cancelLobby(uint256 lobbyId) external nonReentrant {
        Lobby storage lobby = lobbies[lobbyId];
        
        if (lobby.state != LobbyState.OPEN) revert LobbyNotOpen();
        if (msg.sender != lobby.creator && msg.sender != owner()) {
            revert("Only creator or owner can cancel");
        }

        // Cambiar estado ANTES de hacer refunds (checks-effects-interactions pattern)
        lobby.state = LobbyState.CANCELLED;

        // Reembolsar a todos los jugadores
        uint256 refundedCount = lobby.players.length;
        
        // Validar que haya jugadores y fondos suficientes
        if (refundedCount > 0) {
            uint256 totalRefund = lobby.entryFee * refundedCount;
            
            // Verificar balance del contrato
            uint256 contractBalance;
            if (lobby.token == address(0)) {
                contractBalance = address(this).balance;
            } else {
                contractBalance = IERC20(lobby.token).balanceOf(address(this));
            }
            
            require(contractBalance >= totalRefund, "Insufficient contract balance for refunds");
            
            // Ejecutar refunds
            for (uint i = 0; i < lobby.players.length; i++) {
                address player = lobby.players[i];
                _transfer(lobby.token, player, lobby.entryFee);
                emit Payout(lobbyId, player, lobby.entryFee);
            }
        }

        emit LobbyCancelled(lobbyId, msg.sender, refundedCount);
    }

    // ============================================
    // OWNER FUNCTIONS
    // ============================================
    
    /**
     * @notice Actualiza la wallet que recibe los fees
     * @param _newDevWallet Nueva dirección de la wallet dev
     */
    function setDevWallet(address _newDevWallet) external onlyOwner {
        if (_newDevWallet == address(0)) revert InvalidDevWallet();
        address oldWallet = devWallet;
        devWallet = _newDevWallet;
        emit DevWalletUpdated(oldWallet, _newDevWallet);
    }

    /**
     * @notice Función de emergencia para recuperar fondos atrapados
     * @dev Solo puede ser llamada por el owner en casos excepcionales
     * @param token Dirección del token (address(0) para ETH)
     * @param amount Cantidad a retirar
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert NoFundsToWithdraw();
        
        uint256 balance;
        if (token == address(0)) {
            balance = address(this).balance;
        } else {
            balance = IERC20(token).balanceOf(address(this));
        }
        
        if (balance < amount) revert NoFundsToWithdraw();
        
        _transfer(token, owner(), amount);
        emit EmergencyWithdrawal(token, amount, owner());
    }

    /**
     * @notice Fuerza el fin de un lobby atascado (solo emergencias)
     * @param lobbyId ID del lobby
     * @param winners Array de ganadores
     */
    function emergencyEndLobby(uint256 lobbyId, address[] calldata winners) external onlyOwner {
        Lobby storage lobby = lobbies[lobbyId];
        
        if (lobby.state == LobbyState.ENDED || lobby.state == LobbyState.CANCELLED) {
            revert("Lobby already finished");
        }

        // Cambiar temporalmente el estado para que endLobby funcione
        lobby.state = LobbyState.STARTED;
        
        // Llamar a endLobby internamente (sin verificar si msg.sender es jugador)
        lobby.state = LobbyState.ENDED;

        uint256 totalPool = lobby.entryFee * lobby.players.length;
        uint256 fee = (totalPool * FEE_PERCENTAGE) / 100;
        uint256 prizePool = totalPool - fee;

        if (fee > 0) {
            _transfer(lobby.token, devWallet, fee);
            emit FeeTaken(lobbyId, devWallet, fee);
        }

        if (lobby.mode == PaymentMode.BEAST) {
            _transfer(lobby.token, winners[0], prizePool);
            emit Payout(lobbyId, winners[0], prizePool);
        } else {
            uint256 firstPrize = (prizePool * 60) / 100;
            uint256 secondPrize = (prizePool * 20) / 100;
            uint256 thirdPrize = (prizePool * 15) / 100;

            _transfer(lobby.token, winners[0], firstPrize);
            emit Payout(lobbyId, winners[0], firstPrize);

            if (winners.length > 1) {
                _transfer(lobby.token, winners[1], secondPrize);
                emit Payout(lobbyId, winners[1], secondPrize);
            }

            if (winners.length > 2) {
                _transfer(lobby.token, winners[2], thirdPrize);
                emit Payout(lobbyId, winners[2], thirdPrize);
            }
        }

        emit LobbyEnded(lobbyId, msg.sender, winners);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Obtiene los jugadores de un lobby
     */
    function getLobbyPlayers(uint256 lobbyId) external view returns (address[] memory) {
        return lobbies[lobbyId].players;
    }

    /**
     * @notice Obtiene información completa de un lobby
     */
    function getLobbyInfo(uint256 lobbyId) external view returns (
        address creator,
        address token,
        uint256 entryFee,
        uint16 maxPlayers,
        PaymentMode mode,
        LobbyState state,
        address[] memory players,
        uint256 createdAt
    ) {
        Lobby storage lobby = lobbies[lobbyId];
        return (
            lobby.creator,
            lobby.token,
            lobby.entryFee,
            lobby.maxPlayers,
            lobby.mode,
            lobby.state,
            lobby.players,
            lobby.createdAt
        );
    }

    /**
     * @notice Verifica si una dirección está en un lobby
     */
    function isPlayerInLobby(uint256 lobbyId, address player) external view returns (bool) {
        Lobby storage lobby = lobbies[lobbyId];
        for (uint i = 0; i < lobby.players.length; i++) {
            if (lobby.players[i] == player) return true;
        }
        return false;
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Función interna para transferir tokens o ETH
     */
    function _transfer(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            // ETH nativo
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // Token ERC20
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @notice Permite recibir ETH
     */
    receive() external payable {}
}
