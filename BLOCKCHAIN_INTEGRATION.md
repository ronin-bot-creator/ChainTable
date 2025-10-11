# Integración Blockchain - Sistema de Lobbies de Pago

## 🎯 Resumen

Este documento describe la integración completa del smart contract UnoLobby con el sistema de juego, permitiendo lobbies de pago con distribución automática de premios on-chain.

## 📋 Arquitectura del Sistema

### Smart Contract: UnoLobby

**Dirección en Sepolia:** `0xC34055c565B5789f05dec44585f074d1009Feb89`

**Funciones principales:**
- `createLobby()` - Crea un lobby y deposita el entry fee
- `joinLobby()` - Jugadores se unen pagando el entry fee
- `endLobby()` - Distribuye premios según el modo seleccionado (solo creador)
- `cancelLobby()` - Cancela lobby antes de comenzar y reembolsa

**Modos de distribución:**
- **BEAST (0)**: 95% al ganador, 5% comisión
- **CLASSIC (1)**: 60% 1er lugar, 20% 2do, 15% 3ro, 5% comisión

### Backend: contractService.js

Servicio Node.js que interactúa con el smart contract:

```javascript
const contractService = require('./contractService');

// Inicializar al arrancar servidor
await contractService.initialize();

// Obtener lobbyId on-chain desde transaction hash
const { lobbyId, creator, entryFee, mode } = await contractService.getLobbyIdFromTx(txHash);

// Verificar pago de jugador
const { success, player, amount } = await contractService.verifyJoinTransaction(txHash, lobbyId);

// Calcular distribución de premios
const prizes = contractService.calculatePrizeDistribution(totalAmount, mode, winners);
```

### Backend: lobbyManager.js

Gestiona los lobbies con verificación on-chain:

**createLobby()** - Async, verifica la transacción y extrae el lobbyId on-chain
**joinLobby()** - Async, verifica el pago antes de agregar al jugador

### Frontend: Flujo de Creación de Lobby

1. Usuario selecciona red (Sepolia, Base, etc.)
2. Usuario selecciona token (ETH, RON, RONKE)
3. Usuario define monto de entrada y modo (BEAST/CLASSIC)
4. Click en "Crear Lobby":
   - Se conecta a MetaMask
   - Se ejecuta transacción `createLobby()`
   - Se espera confirmación
   - Se envía al servidor: `lobby:create` con `txHash`
5. Servidor verifica el evento `LobbyCreated` y extrae el `lobbyId`
6. Lobby creado con vinculación on-chain

### Frontend: Flujo de Unirse a Lobby

1. Usuario ve lobby de pago disponible
2. Click en "Unirse":
   - Se conecta a MetaMask
   - Se ejecuta transacción `joinLobby(lobbyId)`
   - Se espera confirmación
   - Se envía al servidor: `lobby:join` con `txHash`
3. Servidor verifica el evento `PlayerJoined`
4. Si válido, usuario se agrega al lobby

### Frontend: Distribución de Premios

1. Partida termina, se determinan ganadores
2. Servidor emite evento `game:distributePrizes` al **host** del lobby
3. Host recibe solicitud y ejecuta automáticamente:
   ```javascript
   const contract = new ethers.Contract(contractAddress, abi, signer);
   const tx = await contract.endLobby(lobbyId, [winner1, winner2, ...], mode);
   await tx.wait();
   ```
4. Host envía confirmación: `game:prizeDistributed` con `txHash`
5. Servidor verifica y notifica a todos: `game:prizesDistributed`

## 🔧 Configuración

### Variables de Entorno (.env)

```bash
# Alchemy API
ALCHEMY_KEY=DhdmGOUM_Of7TEUK4xwZv

# RPC URLs (ya incluyen la API key)
RPC_URL_SEPOLIA=https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv

# Contratos
CONTRACT_ADDRESS_SEPOLIA=0xC34055c565B5789f05dec44585f074d1009Feb89
```

### Frontend (.env en raíz)

```bash
VITE_CONTRACT_ADDRESS_SEPOLIA=0xC34055c565B5789f05dec44585f074d1009Feb89
```

## 📂 Archivos Clave

### Backend
- `server/contractService.js` - Servicio de interacción con smart contract
- `server/lobbyManager.js` - Gestión de lobbies con verificación on-chain
- `server/server.js` - Manejadores de eventos WebSocket

### Frontend
- `src/types/lobby.ts` - Tipos para networks, tokens, configuración
- `src/pages/Lobbies.tsx` - UI de creación y lista de lobbies
- `src/components/PaymentConfigDisplay.tsx` - Mostrar info de pago
- `src/hooks/useGame.ts` - Lógica de juego y distribución de premios
- `src/services/socketService.ts` - Cliente WebSocket con tipos

### Smart Contract
- `contracts/UnoLobby.sol` - Contrato principal
- `script/DeployUnoLobby.s.sol` - Script de deployment

## 🚀 Flujo Completo (End-to-End)

### 1. Creación de Lobby de Pago

```
Usuario → MetaMask → Blockchain (createLobby)
   ↓
txHash confirmado
   ↓
Cliente → Servidor (lobby:create + txHash)
   ↓
contractService.getLobbyIdFromTx(txHash)
   ↓
LobbyCreated event → lobbyId extraído
   ↓
Lobby creado con onchainLobbyId
```

### 2. Jugador se Une

```
Usuario → MetaMask → Blockchain (joinLobby)
   ↓
txHash confirmado
   ↓
Cliente → Servidor (lobby:join + txHash)
   ↓
contractService.verifyJoinTransaction(txHash, lobbyId)
   ↓
PlayerJoined event verificado
   ↓
Jugador agregado al lobby
```

### 3. Juego y Distribución

```
Partida inicia y se juega normalmente
   ↓
Último jugador gana → game:over
   ↓
Servidor detecta lobby de pago
   ↓
Servidor → Host: game:distributePrizes
   ↓
Host → MetaMask → Blockchain (endLobby)
   ↓
Premios distribuidos on-chain
   ↓
Host → Servidor: game:prizeDistributed
   ↓
Servidor verifica txHash
   ↓
Todos reciben: game:prizesDistributed
```

## 🔐 Seguridad

- **Solo el creador puede distribuir premios** (endLobby tiene `onlyCreator` modifier)
- **Verificación on-chain de pagos** antes de agregar jugadores
- **Eventos blockchain auditables** para todas las transacciones
- **Reembolsos automáticos** si se cancela el lobby antes de iniciar

## ⚠️ Consideraciones Importantes

1. **Solo Sepolia desplegado actualmente** - Otras redes configuradas pero sin contrato
2. **Host debe tener ETH para gas** al distribuir premios
3. **Transacciones pueden fallar** - Manejadores de error implementados
4. **Tiempos de confirmación** - UI muestra estados de carga
5. **5% de comisión fija** en ambos modos (BEAST y CLASSIC)

## 🧪 Testing

### Crear Lobby de Prueba

1. Asegúrate de tener Sepolia ETH
2. Conecta MetaMask a Sepolia
3. Crea lobby con 0.001 ETH de entrada
4. Verifica que el lobby aparezca en la lista

### Unirse a Lobby

1. Con otra cuenta, únete al lobby
2. Paga el entry fee
3. Verifica que apareces en la lista de jugadores

### Finalizar y Distribuir

1. Juega la partida hasta que alguien gane
2. Host recibe solicitud automática de distribución
3. Confirma transacción en MetaMask
4. Verifica que los premios se transfieran

## 📊 Estructura de Eventos

### Eventos del Contrato

```solidity
event LobbyCreated(uint256 indexed lobbyId, address indexed creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode)
event PlayerJoined(uint256 indexed lobbyId, address indexed player, uint256 amount)
event LobbyEnded(uint256 indexed lobbyId, address[] winners)
event LobbyCancelled(uint256 indexed lobbyId)
```

### Eventos WebSocket

**Cliente → Servidor:**
- `lobby:create` - Crear lobby
- `lobby:join` - Unirse a lobby
- `game:prizeDistributed` - Confirmar distribución

**Servidor → Cliente:**
- `lobby:created` - Lobby creado
- `lobby:joined` - Unido exitosamente
- `game:distributePrizes` - Solicitud de distribución (solo host)
- `game:prizesDistributed` - Premios distribuidos
- `game:prizeError` - Error en distribución

## 🎨 UI/UX

### Indicadores Visuales

- 💰 Badge "Lobby de Pago" en lista
- 🔒 Candado para lobbies que requieren pago
- ⏳ Loading states durante transacciones
- ✅ Confirmaciones de pago exitoso
- ❌ Errores claros con mensajes descriptivos

### Información Mostrada

- Red blockchain (Sepolia, Base, etc.)
- Token usado (ETH, RON, RONKE)
- Monto de entrada
- Modo de distribución (BEAST/CLASSIC)
- Estado de la transacción

## 🔄 Próximos Pasos

1. [ ] Desplegar en mainnet (Base, Ronin, etc.)
2. [ ] Implementar soporte para tokens ERC20
3. [ ] Agregar historial de partidas on-chain
4. [ ] Implementar sistema de rankings
5. [ ] Agregar NFTs como premios adicionales
6. [ ] Optimizar costos de gas

---

**Última actualización:** 2025
**Versión del contrato:** v1.0
**Red principal:** Sepolia Testnet
