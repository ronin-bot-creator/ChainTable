# 🎮 UNO Game - Sistema de Lobbies con WebSockets

Este proyecto implementa un sistema completo de lobbies para el juego UNO usando WebSockets para comunicación en tiempo real.

## 🚀 Cómo usar

### 1. Instalar dependencias del servidor

```bash
cd server
npm install
```

### 2. Iniciar el servidor WebSocket

```bash
cd server
npm run dev
```

El servidor se iniciará en `http://localhost:3001`

### 3. Iniciar el cliente (en otra terminal)

```bash
# Desde la raíz del proyecto
npm run dev
```

El cliente se iniciará en `http://localhost:5177`

## ✨ Funcionalidades

### 🎯 **Lobbies en Tiempo Real**
- **Lobbies Públicos**: Hasta 8 jugadores, sin contraseña
- **Lobbies Privados**: Hasta 6 jugadores, requiere contraseña
- **Lobbies de Pago**: Hasta 4 jugadores, requiere costo de entrada

### 🔄 **Sincronización Automática**
- Los lobbies se sincronizan automáticamente entre todas las pestañas/ventanas
- Cuando alguien crea un lobby, aparece inmediatamente en todas las instancias
- Los jugadores pueden unirse y ver actualizaciones en tiempo real

### 🌐 **Múltiples Clientes**
- Abre múltiples pestañas en `http://localhost:5177`
- Crea lobbies en una pestaña y verás cómo aparecen en las otras
- Los cambios se reflejan instantáneamente en todos los clientes conectados

## 🎮 **Cómo Probar**

1. **Abrir múltiples pestañas**: Ve a `http://localhost:5177` en diferentes pestañas
2. **Crear lobbies**: Usa los formularios para crear diferentes tipos de lobbies
3. **Ver sincronización**: Los lobbies aparecerán automáticamente en todas las pestañas
4. **Unirse a lobbies**: Haz clic en "Unirse" para conectarte a un lobby existente
5. **Actualizar**: Usa el botón "Actualizar lobbies" para refrescar la lista

## 🛠 **Arquitectura Técnica**

### **Frontend (React + TypeScript)**
- `useSocket` hook para manejar conexiones WebSocket
- `socketService` para la comunicación con el servidor
- Estado sincronizado automáticamente con el servidor

### **Backend (Node.js + Socket.io)**
- Gestión de lobbies en memoria
- Eventos en tiempo real para todas las operaciones
- Validación de permisos y estados de lobbies

### **Comunicación**
- **Cliente → Servidor**: `lobby:create`, `lobby:join`, `lobby:leave`, `lobby:list`
- **Servidor → Cliente**: `lobby:created`, `lobby:joined`, `lobby:list-updated`

## 📝 **Estado del Proyecto**

✅ **Completado:**
- Sistema de lobbies con WebSockets
- Tres tipos de lobbies (público, privado, pago)
- Sincronización en tiempo real
- Interfaz de usuario completa
- Servidor WebSocket funcional

🔄 **Próximos Pasos:**
- Sistema de autenticación de usuarios
- Lógica del juego UNO
- Persistencia en base de datos
- Sistema de pagos para lobbies premium

## 🔧 **Troubleshooting**

**El cliente no se conecta al servidor:**
- Verifica que el servidor esté corriendo en puerto 3001
- Revisa la consola del navegador para errores de CORS

**Los lobbies no se sincronizan:**
- Asegúrate de que todas las pestañas estén conectadas (botón debe mostrar "Conectado")
- Revisa la consola del servidor para logs de conexión

**Error de contraseña en lobby privado:**
- La contraseña se solicita mediante `prompt()` - ingresa la contraseña correcta cuando se solicite