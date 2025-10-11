# 🎮 Sistema de Lobbies de Pago Multi-Red - ChainTable

## 🚀 Inicio Rápido

### Para Usuarios

**Crear un lobby de pago:**
1. Ve a la sección "Lobbies"
2. En la tarjeta "Lobby Pago":
   - Ingresa nombre del lobby
   - Selecciona la **red blockchain** (Sepolia, Ronin, Base, Ethereum, Abstract)
   - Selecciona la **moneda** (se actualiza automáticamente según la red)
   - Ingresa el **monto de entrada** (acepta decimales: 0.001, 0.01, etc.)
   - Elige el **modo de reparto**:
     - **BEAST** 🔥: 95% al ganador
     - **CLASSIC** 🏆: 60% / 20% / 15%
3. Revisa el resumen de configuración
4. Haz clic en "Crear lobby"
5. Confirma la transacción en MetaMask (si usas Sepolia)

### Para Desarrolladores

**Archivos modificados:**
- `src/types/lobby.ts` - Tipos y configuraciones de redes
- `src/pages/Lobbies.tsx` - UI de selección de red/moneda
- `server/lobbyManager.js` - Almacenamiento de configuración de pago

**Nuevos componentes:**
- `src/components/PaymentConfigDisplay.tsx` - Visualización de configuración de pago

**Documentación:**
- `LOBBY_PAYMENT_SYSTEM.md` - Documentación técnica completa
- `LOBBY_PAYMENT_USER_GUIDE.md` - Guía de usuario
- `CHANGELOG_LOBBY_PAYMENT.md` - Registro de cambios

---

## 🌐 Redes Soportadas

| Red | Chain ID | Moneda Nativa | Tokens Soportados | Estado |
|-----|----------|---------------|-------------------|--------|
| **Sepolia** | 11155111 | ETH | ETH | ✅ Funcional |
| **Ronin** | 2020 | RON | RON, RONKE | ⚠️ Pendiente |
| **Base** | 8453 | ETH | ETH | ⚠️ Pendiente |
| **Ethereum** | 1 | ETH | ETH | ⚠️ Pendiente |
| **Abstract** | 2741 | ETH | ETH | ⚠️ Pendiente |

---

## 💰 Modos de Reparto

### BEAST Mode 🔥
```
Ganador:  95%
Fee:       5%
```
**Ideal para:** Competencias intensas, winner-takes-all

### CLASSIC Mode 🏆
```
1er lugar: 60%
2do lugar: 20%
3er lugar: 15%
Fee:        5%
```
**Ideal para:** Distribución equilibrada

---

## 📋 Estructura de Configuración

```typescript
// Configuración de pago de un lobby
interface PaymentConfig {
  network: 'abstract' | 'base' | 'ethereum' | 'ronin' | 'sepolia';
  token: 'ETH' | 'RON' | 'RONKE';
  amount: string;  // "0.01"
  tokenAddress?: string;  // Para ERC20
}

// Lobby con pago
interface Lobby {
  id: string;
  name: string;
  type: 'pago';
  paymentConfig: PaymentConfig;
  mode: 'BEAST' | 'CLASSIC';
  // ... otros campos
}
```

---

## 🛠️ Configuración de Desarrollo

### Agregar nueva red

1. Actualiza `src/types/lobby.ts`:
```typescript
export type SupportedNetwork = '...' | 'nueva-red';

export const NETWORK_CONFIGS: Record<SupportedNetwork, NetworkConfig> = {
  // ... redes existentes
  'nueva-red': {
    name: 'Nueva Red',
    chainId: 12345,
    rpcUrl: 'https://rpc.nuevared.com',
    blockExplorer: 'https://explorer.nuevared.com',
    nativeCurrency: {
      symbol: 'NRE',
      name: 'Nueva Red Token',
      decimals: 18
    },
    supportedTokens: [/* ... */]
  }
};
```

2. La UI se actualiza automáticamente ✨

### Agregar nuevo token a una red

```typescript
export const NETWORK_CONFIGS = {
  ronin: {
    // ... configuración existente
    supportedTokens: [
      { symbol: 'RON', name: 'Ronin', decimals: 18 },
      { symbol: 'RONKE', name: 'Ronke Token', decimals: 18, address: '0x...' },
      { symbol: 'NUEVO', name: 'Nuevo Token', decimals: 18, address: '0x...' }  // ← Nuevo
    ]
  }
};
```

---

## 🔍 Ejemplos de Uso

### Crear lobby de prueba (Sepolia)
```typescript
{
  name: "Prueba de Pago",
  type: "pago",
  network: "sepolia",
  token: "ETH",
  entryCost: "0.001",
  mode: "BEAST"
}
```

### Crear torneo (Ronin - Próximamente)
```typescript
{
  name: "Torneo RON",
  type: "pago",
  network: "ronin",
  token: "RON",
  entryCost: "10",
  mode: "CLASSIC"
}
```

---

## ✅ Checklist de Implementación

### Completado ✓
- [x] Tipos y configuraciones de redes
- [x] Selector de red en UI
- [x] Selector de moneda dinámico
- [x] Validación de compatibilidad red-token
- [x] Resumen visual de configuración
- [x] Componentes de visualización
- [x] Documentación completa
- [x] Integración con servidor
- [x] Soporte para Sepolia (on-chain)

### Pendiente ⏳
- [ ] Desplegar contratos en todas las redes
- [ ] Dirección del token RONKE
- [ ] Implementar flujo de pago para todas las redes
- [ ] Sistema de escrow
- [ ] Sistema de reembolsos
- [ ] Testing completo

---

## 📖 Documentación Adicional

- **Técnica**: Ver `LOBBY_PAYMENT_SYSTEM.md`
- **Usuario**: Ver `LOBBY_PAYMENT_USER_GUIDE.md`
- **Changelog**: Ver `CHANGELOG_LOBBY_PAYMENT.md`

---

## 🆘 Soporte

### Problemas comunes

**"Token no soportado en la red"**
- Solución: Cambia la red o selecciona un token válido

**"Por favor cambia tu red de MetaMask"**
- Solución: En MetaMask, cambia a la red requerida

**"Fondos insuficientes"**
- Solución: Agrega fondos a tu wallet
- Testnets: Usa un faucet ([Sepolia Faucet](https://sepoliafaucet.com/))

### Reportar bugs
- GitHub Issues
- Discord: [Link del servidor]
- Telegram: [Link del grupo]

---

## 🎯 Roadmap

### v1.1 - Próximo Release
- Soporte completo para Ronin
- Implementación de RONKE token
- Mejoras de UX en selector de red

### v1.2 - Futuro
- Soporte para Base y Ethereum
- Sistema de escrow
- Dashboard de estadísticas

### v2.0 - Visión
- Soporte multi-token
- NFTs como entrada
- Torneos con múltiples lobbies

---

**Última actualización**: Octubre 4, 2025
**Versión**: 1.0.0
**Mantenido por**: ChainTable Team
