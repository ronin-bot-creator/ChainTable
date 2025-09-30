@echo off
echo 🎮 Iniciando sistema de lobbies UNO con WebSockets...
echo.

echo 📦 Instalando dependencias del servidor...
cd server
call npm install
echo.

echo 🚀 Iniciando servidor WebSocket...
start "UNO WebSocket Server" cmd /k "npm run dev"

cd ..
echo.

echo ⏳ Esperando 3 segundos para que el servidor se inicie...
timeout /t 3 /nobreak > nul

echo 🌐 Iniciando cliente web...
start "UNO Client" cmd /k "npm run dev"

echo.
echo ✅ Sistema iniciado!
echo.
echo 📋 URLs importantes:
echo    - Servidor WebSocket: http://localhost:3001
echo    - Cliente Web: http://localhost:5177
echo.
echo 🎯 Para probar los lobbies sincronizados:
echo    1. Abre múltiples pestañas en http://localhost:5177
echo    2. Crea lobbies en una pestaña 
echo    3. Verás cómo aparecen automáticamente en las otras pestañas
echo.
pause