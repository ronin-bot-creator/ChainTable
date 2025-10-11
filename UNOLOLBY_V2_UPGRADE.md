# 🚀 UnoLobby V2 - Mejoras y Características

## 📍 Información del Deployment

- **Contrato:** UnoLobbyV2
- **Dirección Sepolia:** `0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B`
- **Owner:** `0xbf9a40bf3EEB8C0c9bAd4a9A8AD23beD2fa8fD78`
- **Dev Wallet:** `0x4CD7C806E1d1DFca2db3725ce57273270771fCF1`
- **Fee:** 5%
- **Etherscan:** https://sepolia.etherscan.io/address/0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B
- **TX Deploy:** https://sepolia.etherscan.io/tx/0x067581d7c74fc38a3d96c40e1d3847cfd5b255b28873fbc50aac61a488c85c63

---

## ✨ Nuevas Características V2

### 1. 🎯 Auto-Distribución de Premios
**Problema anterior:** Solo el creador del lobby podía llamar `endLobby()`, causando que los premios no se distribuyeran si el creador no ejecutaba la transacción.

**Solución V2:** 
- ✅ **CUALQUIER JUGADOR** del lobby puede llamar `endLobby()`
- ✅ El frontend puede llamar automáticamente cuando se muestra el podio
- ✅ No depende de que el creador esté conectado o ejecute la transacción

```solidity
// Ahora cualquier jugador puede distribuir premios
function endLobby(uint256 lobbyId, address[] calldata winners) external {
    // Verifica que msg.sender sea un jugador del lobby
    bool isPlayer = false;
    for (uint i = 0; i < lobby.players.length; i++) {
        if (lobby.players[i] == msg.sender) {
            isPlayer = true;
            break;
        }
    }
    if (!isPlayer) revert NotAPlayer();
    // ... resto del código
}
```

### 2. 💰 Dev Wallet Configurable
**Mejora:**
- ✅ Wallet dev configurada en el constructor: `0x4CD7C806E1d1DFca2db3725ce57273270771fCF1`
- ✅ Recibe automáticamente el 5% de cada lobby
- ✅ El owner puede cambiarla con `setDevWallet()`
- ✅ Evento `DevWalletUpdated` para tracking

```solidity
constructor(address _devWallet) Ownable(msg.sender) {
    if (_devWallet == address(0)) revert InvalidDevWallet();
    devWallet = _devWallet;
}
```

### 3. 🆘 Funciones de Emergencia

#### a) `emergencyWithdraw()` - Recuperar Fondos Atrapados
**Uso:** Solo owner puede recuperar fondos que queden atrapados en el contrato

```solidity
function emergencyWithdraw(address token, uint256 amount) external onlyOwner nonReentrant
```

**Ejemplo:**
```bash
# Recuperar ETH atrapado
cast send 0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B \
  "emergencyWithdraw(address,uint256)" \
  0x0000000000000000000000000000000000000000 \
  1000000000000000 \
  --rpc-url $RPC_URL_SEPOLIA \
  --private-key $PRIVATE_KEY
```

#### b) `emergencyEndLobby()` - Forzar Fin de Lobby
**Uso:** Si un lobby se queda atascado, el owner puede forzar su finalización

```solidity
function emergencyEndLobby(uint256 lobbyId, address[] calldata winners) external onlyOwner
```

### 4. 📊 Nuevos Eventos

```solidity
event LobbyStarted(uint256 indexed lobbyId, uint256 playerCount);
event FeeTaken(uint256 indexed lobbyId, address indexed devWallet, uint256 amount);
event LobbyCancelled(uint256 indexed lobbyId, address indexed cancelledBy, uint256 refundedPlayers);
event DevWalletUpdated(address indexed oldWallet, address indexed newWallet);
event EmergencyWithdrawal(address indexed token, uint256 amount, address indexed to);
```

**Beneficios:**
- ✅ Mejor tracking de fees para contabilidad
- ✅ Transparencia total de cancelaciones
- ✅ Auditoría de cambios en dev wallet
- ✅ Registro de withdrawals de emergencia

### 5. 🔍 Funciones de Vista Mejoradas

#### `getLobbyInfo()` - Información Completa
```solidity
function getLobbyInfo(uint256 lobbyId) external view returns (
    address creator,
    address token,
    uint256 entryFee,
    uint16 maxPlayers,
    PaymentMode mode,
    LobbyState state,
    address[] memory players,
    uint256 createdAt
)
```

#### `isPlayerInLobby()` - Verificar Jugador
```solidity
function isPlayerInLobby(uint256 lobbyId, address player) external view returns (bool)
```

**Uso en Frontend:**
```javascript
// Verificar si el usuario actual puede distribuir premios
const isPlayer = await contract.isPlayerInLobby(lobbyId, userAddress);
if (isPlayer) {
    await contract.endLobby(lobbyId, winners);
}
```

### 6. 🛡️ Mejoras de Seguridad

#### a) ReentrancyGuard
- ✅ Protección contra ataques de reentrada en todas las funciones críticas
- ✅ `joinLobby()`, `endLobby()`, `cancelLobby()` son nonReentrant

#### b) Custom Errors
- ✅ Ahorro de gas usando custom errors en vez de require strings
- ✅ Errores más claros: `InvalidEntryFee()`, `LobbyFull()`, `NotAPlayer()`

#### c) SafeERC20
- ✅ Uso de SafeERC20 de OpenZeppelin para transfers de tokens
- ✅ Protección contra tokens no estándar

### 7. 🎮 Auto-Start de Lobbies
**Nueva funcionalidad:**
- ✅ Cuando se llena un lobby (maxPlayers alcanzado), automáticamente cambia a `STARTED`
- ✅ Emite evento `LobbyStarted` para que el frontend sepa que ya puede empezar

```solidity
// En joinLobby()
if (lobby.players.length == lobby.maxPlayers) {
    lobby.state = LobbyState.STARTED;
    emit LobbyStarted(lobbyId, lobby.players.length);
}
```

---

## 🔄 Comparación V1 vs V2

| Característica | V1 | V2 |
|---------------|----|----|
| **Distribución de premios** | ❌ Solo creador | ✅ Cualquier jugador |
| **Dev Wallet** | ❌ Hardcoded | ✅ Configurable |
| **Recuperar fondos** | ❌ No disponible | ✅ emergencyWithdraw() |
| **Lobby atascado** | ❌ Sin solución | ✅ emergencyEndLobby() |
| **Auto-start** | ❌ Manual | ✅ Automático al llenarse |
| **Eventos** | 4 eventos básicos | 9 eventos completos |
| **Funciones vista** | 2 básicas | 5 completas |
| **ReentrancyGuard** | ❌ No | ✅ Sí |
| **Custom Errors** | ❌ No | ✅ Sí |
| **SafeERC20** | ⚠️ Básico | ✅ Completo |

---

## 📝 Guía de Migración

### 1. Actualizar Variables de Entorno
```bash
# .env
CONTRACT_ADDRESS_SEPOLIA=0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B
CONTRACT_ADDRESS_SEPOLIA_V1=0xC34055c565B5789f05dec44585f074d1009Feb89  # Backup
```

### 2. Actualizar ABI en el Código
✅ Ya actualizado en `server/contractService.js`

### 3. Código Frontend para Auto-Distribución

**Antes (V1):**
```javascript
// Solo el host podía distribuir
if (isHost) {
    await contract.endLobby(lobbyId, winners);
}
```

**Ahora (V2):**
```javascript
// Cualquier jugador puede distribuir
const isPlayer = await contract.isPlayerInLobby(lobbyId, userAddress);
if (isPlayer) {
    await contract.endLobby(lobbyId, winners);
}
```

### 4. Escuchar Nuevos Eventos

```javascript
// Evento cuando lobby se llena
contract.on('LobbyStarted', (lobbyId, playerCount) => {
    console.log(`Lobby ${lobbyId} iniciado con ${playerCount} jugadores`);
});

// Evento de fee para tracking
contract.on('FeeTaken', (lobbyId, devWallet, amount) => {
    console.log(`Fee de ${amount} enviado a ${devWallet}`);
});
```

---

## 🧪 Testing

### Comando de Test Local
```bash
forge test --match-contract UnoLobbyV2Test -vvv
```

### Verificar Deployment
```bash
# Ver info del contrato
cast call 0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B "devWallet()(address)" --rpc-url $RPC_URL_SEPOLIA
# Output: 0x4CD7C806E1d1DFca2db3725ce57273270771fCF1

cast call 0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B "FEE_PERCENTAGE()(uint256)" --rpc-url $RPC_URL_SEPOLIA
# Output: 5

cast call 0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B "owner()(address)" --rpc-url $RPC_URL_SEPOLIA
# Output: 0xbf9a40bf3EEB8C0c9bAd4a9A8AD23beD2fa8fD78
```

---

## 🎯 Próximos Pasos

1. ✅ **Testing E2E:** Probar flujo completo con el nuevo contrato
2. ✅ **Actualizar Frontend:** Implementar auto-distribución en el podio
3. ✅ **Monitoreo:** Configurar tracking de eventos `FeeTaken` para contabilidad
4. ⏳ **Documentación:** Actualizar guías de usuario

---

## 🐛 Solución al Problema Original

**Problema:** Los premios no se distribuían porque el evento `game:distributePrizes` llegaba al frontend pero nunca se ejecutaba `endLobby()`.

**Causa Raíz:** 
- El servidor emitía el evento solo al `hostPlayer.socketId`
- Si el host se desconectaba o su socket cambiaba, el evento no llegaba
- Solo el creador podía llamar `endLobby()` en V1

**Solución V2:**
1. ✅ **Cualquier jugador puede distribuir:** No depende del host
2. ✅ **Auto-distribución en podio:** El frontend llama automáticamente cuando muestra resultados
3. ✅ **Fallback de emergencia:** El owner puede forzar distribución con `emergencyEndLobby()`

**Flujo Mejorado:**
```
Game Over → Mostrar Podio → Auto-llamar endLobby() → Premios Distribuidos ✅
```

---

## 📊 Gas Costs

| Función | Gas Estimado |
|---------|-------------|
| `createLobby()` | ~100,000 |
| `joinLobby()` | ~80,000 |
| `endLobby()` (2 players) | ~150,000 |
| `endLobby()` (4 players) | ~200,000 |
| `cancelLobby()` (2 players) | ~120,000 |
| `emergencyWithdraw()` | ~30,000 |

---

## 🔒 Seguridad

### Auditoría
- ✅ Uso de OpenZeppelin contracts (audited)
- ✅ ReentrancyGuard en funciones críticas
- ✅ Ownable para funciones admin
- ✅ SafeERC20 para transfers
- ✅ Custom errors para clarity

### Permisos
- **Owner (0xbf9a...):** 
  - `setDevWallet()`
  - `emergencyWithdraw()`
  - `emergencyEndLobby()`
  - `cancelLobby()` (junto con creator)

- **Creator:**
  - `cancelLobby()` (solo si OPEN)

- **Any Player:**
  - `endLobby()` (distribuir premios)

---

## 📞 Contacto y Soporte

- **Smart Contract:** `0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B`
- **Network:** Sepolia Testnet
- **Repo:** ChainTable
- **Docs:** Ver README principal

---

**Deployed:** October 11, 2025  
**Version:** 2.0.0  
**Status:** ✅ Production Ready en Sepolia
