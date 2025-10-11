# 💰 RECUPERAR FONDOS DEL CONTRATO

## Situación Actual

- **Balance del contrato**: 0.001045 ETH (~$2.61 USD)
- **Fondos atrapados**: ~70 lobbies sin finalizar
- **Problema**: Lobbies creados pero premios no distribuidos

---

## 🔧 SOLUCIÓN: Cancelar Lobbies y Recuperar Fondos

### Opción 1: Verificar Balance del Contrato

```bash
forge script script/CancelLobbies.s.sol:CheckContractBalance \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv
```

**Salida esperada**:
```
Balance del contrato UnoLobby
Balance: 1045000000000000 wei
Balance: 0 ETH (entero)
Balance: 1 milli-ETH
Fondos atrapados de ~ 5 lobbies
```

---

### Opción 2: Cancelar Todos los Lobbies (1-18)

⚠️ **CUIDADO**: Esto cancelará TODOS los lobbies y reembolsará a los jugadores.

```bash
# Dry-run (simular sin ejecutar)
forge script script/CancelLobbies.s.sol:CancelAllLobbies \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv

# Ejecutar de verdad
forge script script/CancelLobbies.s.sol:CancelAllLobbies \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv \
  --private-key $PRIVATE_KEY \
  --broadcast
```

**Qué hace**:
- Itera lobbies del 1 al 18
- Para cada lobby con jugadores:
  - Llama `cancelLobby(lobbyId)`
  - Reembolsa el `entryFee` a cada jugador
  - Emite evento `Payout` por cada reembolso

**Costos**:
- Gas por cancelación: ~150k gas (~$0.50 USD en Sepolia)
- Si cancelas 10 lobbies: ~$5 USD en gas
- **Recuperas**: ~$2.61 USD en fondos atrapados

---

### Opción 3: Cancelar Lobby Específico

Si solo quieres cancelar un lobby en particular:

```bash
# Editar .env y agregar:
# LOBBY_ID=18

forge script script/CancelLobbies.s.sol:CancelSpecificLobby \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv \
  --private-key $PRIVATE_KEY \
  --broadcast
```

---

## 🎯 ¿QUÉ PASA CON LOS FONDOS?

### Cuando cancelas un lobby:

```solidity
function cancelLobby(uint256 lobbyId) external {
    // 1. Cambia estado a ENDED
    L.state = LobbyState.ENDED;
    
    // 2. Reembolsa a TODOS los jugadores
    for (uint i = 0; i < L.players.length; i++) {
        address player = L.players[i];
        // Envía el entryFee de vuelta
        _safeNativeTransfer(player, L.entryFee);
        emit Payout(lobbyId, player, L.entryFee);
    }
}
```

**Resultado**:
- ✅ Cada jugador recibe su `entryFee` de vuelta
- ✅ Balance del contrato disminuye
- ✅ NO hay comisiones (todo se reembolsa)

---

## 🔍 LOBBIES PENDIENTES EN SEPOLIA

Según tus transacciones recientes:

| Lobby ID | Estado | Jugadores | Entry Fee | Total |
|----------|--------|-----------|-----------|-------|
| 17 | OPEN | 1 (0x1eb8...) | 0.0001 ETH | 0.0001 ETH |
| 18 | OPEN | 2 (0xbf9a..., 0x1eb8...) | 0.0001 ETH | 0.0002 ETH |

**Total recuperable**: ~0.0003 ETH de estos 2 lobbies

**Otros ~68 lobbies**: Probablemente de pruebas anteriores

---

## ⚡ COMANDOS RÁPIDOS

### 1. Ver jugadores de un lobby:
```bash
cast call 0xC34055c565B5789f05dec44585f074d1009Feb89 \
  "getLobbyPlayers(uint256)(address[])" \
  18 \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv
```

### 2. Cancelar lobby 18 manualmente:
```bash
cast send 0xC34055c565B5789f05dec44585f074d1009Feb89 \
  "cancelLobby(uint256)" \
  18 \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv \
  --private-key $PRIVATE_KEY
```

### 3. Ver balance del contrato:
```bash
cast balance 0xC34055c565B5789f05dec44585f074d1009Feb89 \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv
```

---

## 🐛 POR QUÉ LOS PREMIOS NO SE DISTRIBUYEN

### Problema Actual:

El servidor SÍ está preparando los datos correctamente:

```javascript
✅ Datos de distribución de premios:
   Winners: [
     '0x1Eb8fF5966feB81A5326D311d238370717701AD8',
     '0xbf9a40bf3EEB8C0c9bAd4a9A8AD23beD2fa8fD78'
   ]
   Lobby ID on-chain: 18
```

Pero el frontend NO está ejecutando la transacción `endLobby()`.

### Posibles causas:

1. ❌ **Evento no llega al frontend**
   - El evento `game:distributePrizes` no se emite correctamente
   - O el frontend no está escuchando el evento

2. ❌ **MetaMask rechaza la transacción**
   - Usuario no es el creador del lobby
   - Usuario no está autorizado en el contrato

3. ❌ **Lobby ya fue finalizado**
   - Estado del lobby es `ENDED` en vez de `OPEN`

### Solución para testing:

He agregado más logging en `useGame.ts` para debug. En la próxima prueba verás:

```
💰 [FRONTEND] Evento game:distributePrizes recibido: {...}
📌 Lobby ID: 18
📌 Winners: [...]
✅ Signer obtenido: 0x...
📝 Contrato: 0xC34...
⏳ Enviando transacción endLobby...
```

Si NO ves estos logs, significa que el evento no está llegando al frontend.

---

## 📋 PASOS RECOMENDADOS

### Paso 1: Recuperar fondos

```bash
# Ver balance actual
forge script script/CancelLobbies.s.sol:CheckContractBalance \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv

# Cancelar todos los lobbies (dry-run primero)
forge script script/CancelLobbies.s.sol:CancelAllLobbies \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv

# Si todo se ve bien, ejecutar de verdad
forge script script/CancelLobbies.s.sol:CancelAllLobbies \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/DhdmGOUM_Of7TEUK4xwZv \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Paso 2: Probar nuevo lobby con logging mejorado

1. Crear nuevo lobby (verás 2 confirmaciones de MetaMask)
2. Otro jugador se une
3. Jugar hasta el final
4. Ver logs en consola del frontend:
   - Si ves `💰 [FRONTEND] Evento game:distributePrizes recibido` → El evento llega
   - Si NO lo ves → El evento no está llegando (problema de socket.io)

### Paso 3: Verificar en Etherscan

Después de que aparezca el popup de MetaMask:
- Confirmar la transacción `endLobby`
- Verificar en Etherscan que aparezcan los 3 eventos:
  - FeeTaken
  - Payout
  - LobbyEnded

---

**Creado**: 11 de octubre de 2025  
**Fondos atrapados**: 0.001045 ETH  
**Script**: `script/CancelLobbies.s.sol`
