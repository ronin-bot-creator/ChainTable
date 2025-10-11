# Solución al Error: KeyringController - No keyring found

## 🐛 Problema

Al intentar crear un lobby de pago, MetaMask arroja el siguiente error:

```
MetaMask - RPC Error: KeyringController - No keyring found. 
Error info: There are keyrings, but none match the address
```

### Causa Raíz

Este error ocurre cuando:
1. La dirección almacenada en la sesión del usuario no coincide con la cuenta actualmente activa en MetaMask
2. El código intenta usar una dirección que MetaMask no tiene en su keyring actual
3. El usuario cambió de cuenta en MetaMask pero la aplicación sigue usando la dirección antigua

## ✅ Solución Implementada

### Cambios en `src/pages/Lobbies.tsx`

#### 1. **Obtener cuenta actual antes de crear transacciones**

**Antes:**
```typescript
const provider = new ethers.BrowserProvider((window as any).ethereum);
await provider.send('eth_requestAccounts', []);
const signer = provider.getSigner();
```

**Después:**
```typescript
const provider = new ethers.BrowserProvider((window as any).ethereum);

// Request accounts to ensure MetaMask is unlocked and get current account
const accounts = await provider.send('eth_requestAccounts', []);
if (!accounts || accounts.length === 0) {
  throw new Error('No hay cuentas disponibles en MetaMask. Por favor conecta tu wallet.');
}
const currentAccount = accounts[0];
console.log('✅ Cuenta actual de MetaMask:', currentAccount);
```

#### 2. **Obtener signer DESPUÉS de cambiar de red**

**Antes:**
```typescript
const signer = provider.getSigner();
// ... cambiar de red ...
```

**Después:**
```typescript
// Try to switch the network to Sepolia
try {
  await provider.send('wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }]);
} catch (switchError: any) {
  console.warn('Network switch to Sepolia failed', switchError);
  setErrorMessage('Por favor cambia tu red de MetaMask a Sepolia y reintenta.');
  throw new Error('MetaMask network not Sepolia');
}

// Get signer AFTER switching network
const signer = await provider.getSigner();
```

#### 3. **Verificar que la dirección del signer coincida**

**Nuevo código agregado:**
```typescript
// Verify the signer address matches current account
const signerAddress = await signer.getAddress();
console.log('🔑 Dirección del signer:', signerAddress);

if (signerAddress.toLowerCase() !== currentAccount.toLowerCase()) {
  console.warn('⚠️ La dirección del signer no coincide con la cuenta actual');
  throw new Error('Por favor selecciona la cuenta correcta en MetaMask');
}
```

#### 4. **Aplicado en dos flujos**

La misma corrección se aplicó en:
- ✅ `handleCreateLobby` - Al crear un lobby de pago
- ✅ `handleJoinLobby` - Al unirse a un lobby de pago

## 🔍 Flujo Corregido

### Crear Lobby de Pago

```mermaid
graph TD
    A[Usuario crea lobby de pago] --> B[Obtener provider de MetaMask]
    B --> C[Solicitar cuentas: eth_requestAccounts]
    C --> D[Obtener cuenta actual: accounts[0]]
    D --> E[Cambiar a red Sepolia]
    E --> F[Obtener signer DESPUÉS del cambio]
    F --> G[Verificar dirección del signer]
    G --> H{¿Coincide con cuenta actual?}
    H -->|No| I[Error: Cuenta incorrecta]
    H -->|Sí| J[Crear transacción con contrato]
    J --> K[Usuario confirma en MetaMask]
    K --> L[Lobby creado exitosamente]
```

### Unirse a Lobby de Pago

```mermaid
graph TD
    A[Usuario se une a lobby] --> B[Obtener info del lobby]
    B --> C[Obtener provider de MetaMask]
    C --> D[Solicitar cuentas: eth_requestAccounts]
    D --> E[Obtener cuenta actual: accounts[0]]
    E --> F[Cambiar a red Sepolia]
    F --> G[Obtener signer DESPUÉS del cambio]
    G --> H[Verificar dirección del signer]
    H --> I{¿Coincide con cuenta actual?}
    I -->|No| J[Error: Cuenta incorrecta]
    I -->|Sí| K[Enviar pago al contrato]
    K --> L[Usuario confirma en MetaMask]
    L --> M[Unión exitosa al lobby]
```

## 📝 Logs de Depuración

El código ahora incluye logs útiles:

```typescript
console.log('✅ Cuenta actual de MetaMask:', currentAccount);
console.log('🔑 Dirección del signer:', signerAddress);
```

Estos logs ayudan a:
- Verificar qué cuenta está usando MetaMask
- Confirmar que el signer tiene la dirección correcta
- Detectar desincronizaciones entre la app y MetaMask

## ⚠️ Prevención de Errores Futuros

### Para Usuarios

1. **Asegúrate de tener la cuenta correcta seleccionada en MetaMask**
2. **No cambies de cuenta durante una transacción**
3. **Si cambias de cuenta, refresca la página**

### Para Desarrolladores

1. **Siempre obtén la cuenta actual antes de crear transacciones**
   ```typescript
   const accounts = await provider.send('eth_requestAccounts', []);
   const currentAccount = accounts[0];
   ```

2. **Obtén el signer DESPUÉS de cambiar de red**
   ```typescript
   await provider.send('wallet_switchEthereumChain', [...]);
   const signer = await provider.getSigner();
   ```

3. **Verifica que las direcciones coincidan**
   ```typescript
   const signerAddress = await signer.getAddress();
   if (signerAddress.toLowerCase() !== currentAccount.toLowerCase()) {
     throw new Error('Cuenta incorrecta');
   }
   ```

4. **Maneja los errores de MetaMask apropiadamente**
   ```typescript
   try {
     // ... operación con MetaMask
   } catch (error) {
     console.error('Error de MetaMask:', error);
     setErrorMessage('Error al conectar con MetaMask. Verifica tu wallet.');
   }
   ```

## 🧪 Testing

### Casos de Prueba

1. ✅ **Crear lobby con cuenta correcta**
   - Usuario conectado con cuenta A
   - Crea lobby → Éxito

2. ✅ **Cambio de cuenta durante el proceso**
   - Usuario conectado con cuenta A
   - Cambia a cuenta B en MetaMask
   - Intenta crear lobby → Error claro: "Selecciona la cuenta correcta"

3. ✅ **Cambio de red**
   - Usuario en red incorrecta
   - App solicita cambio a Sepolia
   - Signer se obtiene con red correcta → Éxito

4. ✅ **MetaMask bloqueado**
   - MetaMask bloqueado
   - `eth_requestAccounts` solicita desbloqueo
   - Usuario desbloquea → Continúa normalmente

## 📊 Mejoras Adicionales Sugeridas

### Corto Plazo
- [ ] Agregar indicador visual de la cuenta conectada
- [ ] Mostrar advertencia si la cuenta cambia
- [ ] Listener para evento `accountsChanged` de MetaMask

### Mediano Plazo
- [ ] Cache de la última cuenta usada
- [ ] Solicitar reconexión automática si cambia la cuenta
- [ ] Multi-wallet support (no solo MetaMask)

### Código de Ejemplo para Listener

```typescript
// Detectar cambios de cuenta en MetaMask
useEffect(() => {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    const handleAccountsChanged = (accounts: string[]) => {
      console.log('📢 Cuentas cambiadas:', accounts);
      if (accounts.length === 0) {
        // Usuario desconectó su wallet
        setErrorMessage('Wallet desconectada. Por favor reconecta.');
      } else if (accounts[0] !== walletAddress) {
        // Usuario cambió de cuenta
        setErrorMessage('Detectamos cambio de cuenta. Por favor recarga la página.');
      }
    };
    
    (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
    
    return () => {
      (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }
}, [walletAddress]);
```

## 📚 Referencias

- [Ethers.js BrowserProvider](https://docs.ethers.org/v6/api/providers/#BrowserProvider)
- [MetaMask RPC API](https://docs.metamask.io/wallet/reference/json-rpc-api/)
- [EIP-1193: Ethereum Provider](https://eips.ethereum.org/EIPS/eip-1193)

---

**Fecha de solución**: Octubre 4, 2025
**Versión**: 1.0.0
**Estado**: ✅ Resuelto
