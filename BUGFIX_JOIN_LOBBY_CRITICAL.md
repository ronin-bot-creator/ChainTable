# 🐛 BUGFIX CRÍTICO: Jugadores No Se Registraban en el Contrato

## Fecha: 2025-10-10

## Problema Identificado

**Los jugadores NO se estaban registrando en el contrato al unirse al lobby.**

### Síntoma
- Los jugadores enviaban ETH al contrato
- El ETH llegaba al contrato (visible en Etherscan como "Transfer")
- Al terminar la partida y llamar `endLobby()`, **NO se distribuían premios**
- El balance del contrato quedaba en 0 ETH inmediatamente

### Causa Raíz

En `src/pages/Lobbies.tsx`, la función `handleJoinLobby` para lobbies de pago estaba usando:

```typescript
// ❌ INCORRECTO - Solo envía ETH, NO llama a joinLobby
const tx = await signer.sendTransaction({ 
  to: contractAddress, 
  value: entryFeeWei,
  gasLimit: 100000
});
```

Esto provocaba que:
1. ✅ El ETH llegaba al contrato (función `receive()`)
2. ❌ **NO se emitía el evento `PlayerJoined`**
3. ❌ **NO se agregaba al jugador al array `L.players`**
4. ❌ El contrato no sabía qué jugador pagó ni a qué lobby pertenece

Cuando se llamaba `endLobby()`:
```solidity
uint256 total = L.entryFee * L.players.length; // L.players.length = 0 o 1
```
Si solo había 1 jugador (el creador), el cálculo era:
- Total: 0.000015 ETH × 1 = 0.000015 ETH
- Pero el contrato tenía 0.000015 ETH del creador + 0.000015 ETH del jugador que "solo envió"
- Al distribuir, solo se consideraba el balance del creador

## Solución Implementada

### Cambio en `src/pages/Lobbies.tsx`

**ANTES (INCORRECTO):**
```typescript
const tx = await signer.sendTransaction({ 
  to: contractAddress, 
  value: entryFeeWei,
  gasLimit: 100000
});
```

**DESPUÉS (CORRECTO):**
```typescript
// IMPORTANTE: Necesitamos el lobbyId ON-CHAIN
const onchainLobbyId = lobbyInfo.onchain?.lobbyId || lobbyInfo.onchainLobbyId;
if (!onchainLobbyId || onchainLobbyId === '0' || onchainLobbyId === 0) {
  throw new Error('Este lobby no tiene un ID on-chain válido.');
}

// Llamar a joinLobby del contrato (NO solo enviar ETH)
const contract = new ethers.Contract(contractAddress, UNO_ABI, signer);
const tx = await contract.joinLobby(onchainLobbyId, { value: entryFeeWei });
```

### Validación Agregada

También se agregó validación para verificar que el lobby tenga un `onchainLobbyId` válido antes de permitir que alguien se una.

## Impacto

### Antes del Fix
- ❌ Jugadores enviaban ETH pero no se registraban
- ❌ Premios NO se distribuían
- ❌ Fondos quedaban bloqueados en el contrato (o se perdían)

### Después del Fix
- ✅ Jugadores llaman a `joinLobby(lobbyId)` correctamente
- ✅ Se emite evento `PlayerJoined` con la dirección del jugador
- ✅ El jugador se agrega al array `L.players` del lobby
- ✅ Al llamar `endLobby()`, los premios se distribuyen correctamente

## Cómo Verificar

### En Sepolia Etherscan

Después del fix, deberías ver:

**Transacción de unirse (CORRECTO):**
```
Method: joinLobby (no "Transfer" solo)
Status: Success
Value: 0.000015 ETH (o el entry fee)
Logs:
  - PlayerJoined(lobbyId=1, player=0x...)
```

**NO debe aparecer solo "Transfer"** - Debe mostrar `joinLobby` como método.

### En la Consola del Navegador

Al unirse, deberías ver:
```
💰 Uniéndose al lobby on-chain: {
  lobbyId: '1',
  entryFee: '0.000015 ETH',
  contractAddress: '0xC34055...'
}
Transacción de unión enviada. Esperando confirmación...
¡Pago confirmado! Uniéndote al lobby...
```

### En el Contrato

Puedes verificar que el jugador se registró correctamente:
```solidity
// Llamar a getLobbyPlayers(lobbyId)
address[] memory players = contract.getLobbyPlayers(1);
// Debería incluir la dirección del jugador que se unió
```

## Flujo Correcto Ahora

1. **Crear Lobby:**
   ```
   Host → createLobby(token, entryFee, maxPlayers, mode)
   → Evento: LobbyCreated(lobbyId=1, ...)
   ```

2. **Jugador Se Une:**
   ```
   Player → joinLobby(1) + 0.000015 ETH
   → Evento: PlayerJoined(lobbyId=1, player=0xPlayer...)
   → L.players.push(player)
   ```

3. **Jugar:**
   ```
   Partida normal en el servidor
   ```

4. **Distribuir Premios:**
   ```
   Host → endLobby(1, [0xWinner])
   → Calcula: total = 0.000015 × 2 = 0.00003 ETH
   → BEAST: 95% = 0.0000285 ETH al ganador
   → Fee: 5% = 0.0000015 ETH al devWallet
   → Eventos: 
      - Payout(lobbyId=1, to=0xWinner, amount=0.0000285)
      - FeeTaken(lobbyId=1, to=devWallet, amount=0.0000015)
      - LobbyEnded(lobbyId=1, endedBy=host, winners=[0xWinner])
   ```

## Testing

Para probar que el fix funciona:

1. **Reinicia el frontend**
   ```bash
   npm run dev
   ```

2. **Crea un nuevo lobby de pago en Sepolia**
   - Asegúrate de que se ejecute `createLobby` on-chain
   - Verifica el `lobbyId` on-chain

3. **Únete con otra cuenta**
   - Ahora debe llamar a `joinLobby(lobbyId)` con el ETH
   - Verifica en Etherscan que el método sea `joinLobby`, NO solo "Transfer"

4. **Juega hasta terminar**

5. **Verifica la distribución**
   - En Etherscan, la transacción `endLobby` debe mostrar:
     - Internal Transactions con las transferencias
     - Eventos `Payout` y `FeeTaken`

## Archivos Modificados

- ✅ `src/pages/Lobbies.tsx` - Corregido `handleJoinLobby` para llamar a `contract.joinLobby()`
- ✅ Validación de `onchainLobbyId` antes de unirse

## Lecciones Aprendidas

1. **No confundir `sendTransaction` con `contract.method()`**
   - `sendTransaction` = envío simple de ETH (función `receive()`)
   - `contract.method()` = llamada a función específica del contrato

2. **Siempre verificar eventos en Etherscan**
   - Si no ves `PlayerJoined`, algo está mal

3. **El contrato necesita registrar a los jugadores**
   - No basta con que el ETH llegue al contrato
   - Debe agregarse al array de jugadores para distribuir premios

4. **Testing end-to-end es crucial**
   - Probar todo el flujo: crear → unirse → jugar → distribuir

---

**Desarrollador:** GitHub Copilot + Alva  
**Fecha del fix:** 2025-10-10  
**Status:** ✅ CRÍTICO - Fix implementado, listo para testing
