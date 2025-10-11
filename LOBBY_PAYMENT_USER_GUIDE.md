# Guía de Usuario - Sistema de Lobbies de Pago

## 🎮 Cómo crear un lobby de pago

### Paso 1: Acceder a la sección de Lobbies
1. Conecta tu wallet (MetaMask recomendado)
2. Navega a la sección "Lobbies"
3. Localiza la tarjeta de "Lobby Pago"

### Paso 2: Configurar el lobby
Complete los siguientes campos:

#### Información Básica
- **Nombre del lobby**: Un nombre descriptivo para tu sala (ej: "Torneo de la Tarde")

#### Configuración de Pago
- **Costo de entrada**: El monto que cada jugador debe pagar para unirse
  - Acepta decimales (ej: 0.001, 0.01, 1.5)
  - Usa punto (.) como separador decimal
  
- **Moneda**: Selecciona el token de pago
  - Se actualiza automáticamente según la red seleccionada
  - Ejemplos: ETH, RON, RONKE

#### Configuración de Red
- **Red Blockchain**: Selecciona dónde se procesarán los pagos
  - **Sepolia** (Testnet): Ideal para pruebas - ETH de prueba
  - **Ronin**: Soporta RON y RONKE
  - **Base**: Usa ETH en Base chain
  - **Ethereum**: Mainnet de Ethereum - ETH
  - **Abstract**: Testnet de Abstract - ETH

> ⚠️ **Importante**: Al cambiar la red, la moneda se actualiza automáticamente

#### Modo de Reparto
Selecciona cómo se distribuirán las ganancias:

**BEAST Mode** 🔥
- El ganador se lleva el 95% del pozo total
- 5% va como fee al proyecto
- Ideal para: Competencias intensas, winner-takes-all

**CLASSIC Mode** 🏆
- 1er lugar: 60% del pozo
- 2do lugar: 20% del pozo
- 3er lugar: 15% del pozo
- Fee del proyecto: 5%
- Ideal para: Juegos más equilibrados, premios distribuidos

### Paso 3: Revisar configuración
Antes de crear, revisa el **Resumen de configuración**:
- ✅ Red seleccionada
- ✅ Moneda de pago
- ✅ Modo de reparto
- ✅ Costo total de entrada

### Paso 4: Crear lobby
1. Haz clic en "Crear lobby"
2. **Si seleccionaste Sepolia**: MetaMask se abrirá para confirmar la transacción
   - Revisa el gas fee
   - Confirma la transacción
   - Espera la confirmación en blockchain
3. El lobby se creará automáticamente tras la confirmación

## 💰 Cómo unirse a un lobby de pago

### Encontrar lobbies
Los lobbies de pago se muestran en la lista de "Lobbies Activos" con:
- 🟡 Badge amarillo "Pago"
- Información de red y moneda
- Costo de entrada visible

### Proceso de unión
1. Haz clic en "Unirse" en el lobby deseado
2. Verifica la configuración de pago
3. **MetaMask se abrirá** para solicitar el pago
   - Cantidad: Costo de entrada mostrado
   - Red: Debe coincidir con la configuración del lobby
4. Confirma la transacción
5. Espera la confirmación blockchain
6. ¡Entrarás automáticamente al lobby!

### Errores comunes

**"Por favor cambia tu red de MetaMask"**
- Solución: Cambia tu red en MetaMask a la red requerida por el lobby
- Ejemplo: Si el lobby usa Sepolia, cambia a Sepolia en MetaMask

**"Fondos insuficientes"**
- Solución: Agrega fondos a tu wallet
- Para testnets (Sepolia, Abstract): Usa un faucet para obtener tokens de prueba

**"Timeout fetching lobby info"**
- Solución: Refresca la página y intenta nuevamente
- Verifica tu conexión a internet

## 🌐 Redes y Tokens Soportados

### Sepolia Testnet (Recomendado para pruebas)
- **Moneda**: ETH (testnet)
- **Cómo obtener**: [Faucet de Sepolia](https://sepoliafaucet.com/)
- **Estado**: ✅ Completamente funcional

### Ronin
- **Monedas**: RON (nativo), RONKE (token)
- **Estado**: ⚠️ Implementación pendiente
- **Próximamente**: Soporte completo

### Base
- **Moneda**: ETH
- **Estado**: ⚠️ Implementación pendiente
- **Próximamente**: Soporte completo

### Ethereum Mainnet
- **Moneda**: ETH
- **Estado**: ⚠️ Implementación pendiente
- **Advertencia**: Usa ETH real, no recomendado hasta finalizar testing

### Abstract Testnet
- **Moneda**: ETH (testnet)
- **Estado**: ⚠️ Implementación pendiente
- **Próximamente**: Soporte completo

## 📊 Ejemplos de Configuración

### Ejemplo 1: Torneo Casual (Sepolia)
```
Nombre: "Torneo de Principiantes"
Red: Sepolia
Moneda: ETH
Costo: 0.001 ETH
Modo: CLASSIC
```
**Resultado**: Lobby de prueba, bajo costo, reparto equilibrado

### Ejemplo 2: Competencia Alta (Ronin)
```
Nombre: "High Stakes Championship"
Red: Ronin
Moneda: RON
Costo: 10 RON
Modo: BEAST
```
**Resultado**: Competencia intensa, ganador se lleva casi todo

### Ejemplo 3: Juego Amistoso (Sepolia)
```
Nombre: "Partida entre amigos"
Red: Sepolia
Moneda: ETH
Costo: 0.0001 ETH
Modo: CLASSIC
```
**Resultado**: Costo mínimo, distribución justa

## 🔐 Seguridad y Mejores Prácticas

### Antes de crear un lobby:
- ✅ Verifica que tienes fondos suficientes + gas
- ✅ Confirma la red seleccionada
- ✅ Revisa el monto de entrada (¡los decimales importan!)
- ✅ Entiende el modo de reparto

### Antes de unirte a un lobby:
- ✅ Lee la configuración completa del lobby
- ✅ Verifica que tienes la red correcta en MetaMask
- ✅ Confirma que tienes fondos suficientes
- ✅ Revisa el gas estimado

### Durante el juego:
- ⚠️ No cierres el navegador durante transacciones
- ⚠️ Mantén MetaMask desbloqueado
- ⚠️ No cambies de red durante el juego

## 🆘 Soporte y Ayuda

### Problemas técnicos
1. Revisa la documentación: `LOBBY_PAYMENT_SYSTEM.md`
2. Verifica los logs del navegador (F12 > Console)
3. Reporta issues en GitHub

### Preguntas frecuentes

**¿Puedo cambiar la configuración después de crear el lobby?**
- No, la configuración es inmutable una vez creado

**¿Qué pasa si la transacción falla?**
- El lobby no se creará y tus fondos permanecen en tu wallet
- Revisa el error en MetaMask para más detalles

**¿Cuánto tiempo tarda la confirmación?**
- Depende de la red:
  - Sepolia: ~15 segundos
  - Ethereum: ~15 segundos a 2 minutos
  - Ronin: ~3 segundos
  - Base: ~2 segundos

**¿Puedo recuperar mi entrada si salgo del lobby?**
- Actualmente no hay sistema de reembolso implementado
- No salgas del lobby después de pagar

## 📈 Roadmap

### Próximas funcionalidades:
- [ ] Sistema de reembolso automático
- [ ] Soporte para más tokens ERC20
- [ ] Torneos multi-lobby
- [ ] Sistema de escrow mejorado
- [ ] Dashboard de estadísticas
- [ ] Integración con NFTs

---

**¿Necesitas ayuda?** Contacta al equipo de ChainTable en Discord o Telegram.
