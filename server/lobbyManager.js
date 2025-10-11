const contractService = require('./contractService');

class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.playerLobbyMap = new Map();
    this.disconnectTimeouts = new Map();
    this.games = new Map();
  }

  // Graceful disconnect: schedule expel (test code may set short timers)
  handleDisconnectGrace(lobbyId, playerId, onExpel, ms = 30000) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = false;
    player.disconnectTimestamp = Date.now();
    const timeoutId = setTimeout(() => {
      onExpel();
      this.disconnectTimeouts.delete(playerId);
    }, ms);
    this.disconnectTimeouts.set(playerId, timeoutId);
  }

  handleReconnect(lobbyId, playerId, newSocketId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = true;
    player.disconnectTimestamp = null;
    player.socketId = newSocketId;
    if (this.disconnectTimeouts.has(playerId)) {
      clearTimeout(this.disconnectTimeouts.get(playerId));
      this.disconnectTimeouts.delete(playerId);
    }
  }

  async createLobby(data, creatorId, creatorUsername, walletAddress, socketId) {
    const lobbyId = `lobby_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    
    let onchainLobbyId = null;
    let onchainInfo = null;

    // Para lobbies de pago, obtener el lobbyId on-chain
    if (data.type === 'pago' && data.onchain) {
      try {
        // Si el cliente ya envió el lobbyId, usarlo directamente
        if (data.onchain.lobbyId) {
          onchainLobbyId = data.onchain.lobbyId;
          console.log('✅ Lobby ID on-chain recibido del cliente:', onchainLobbyId);
          
          // Opcionalmente, verificar el lobby on-chain
          if (data.onchain.txHash) {
            try {
              onchainInfo = await contractService.getLobbyIdFromTx(data.onchain.txHash);
              if (onchainInfo.lobbyId !== onchainLobbyId) {
                console.warn('⚠️ Lobby ID del cliente no coincide con el evento:', {
                  clientLobbyId: onchainLobbyId,
                  eventLobbyId: onchainInfo.lobbyId
                });
              }
            } catch (err) {
              console.warn('⚠️ No se pudo verificar el lobby ID con el evento:', err.message);
            }
          }
        } 
        // Si no viene lobbyId pero sí txHash, extraerlo del evento
        else if (data.onchain.txHash) {
          console.log('🔗 Resolviendo lobbyId on-chain para tx:', data.onchain.txHash);
          onchainInfo = await contractService.getLobbyIdFromTx(data.onchain.txHash);
          onchainLobbyId = onchainInfo.lobbyId;
          
          console.log('✅ Lobby on-chain vinculado:', {
            serverLobbyId: lobbyId,
            onchainLobbyId,
            creator: onchainInfo.creator,
            entryFee: onchainInfo.entryFee,
            mode: onchainInfo.mode
          });
        }
      } catch (error) {
        console.error('❌ Error resolviendo lobby on-chain:', error.message);
        return { success: false, error: 'No se pudo verificar el lobby en la blockchain: ' + error.message };
      }
    }

    // Para lobbies on-chain, iniciar sin jugadores (se agregarán vía joinLobby)
    // Para lobbies off-chain (publico/privado), el creador se agrega automáticamente
    const initialPlayers = (data.type === 'pago' && onchainLobbyId) ? [] : [{ 
      id: creatorId, 
      username: creatorUsername, 
      walletAddress, 
      socketId, 
      isHost: true, 
      isReady: false, 
      joinedAt: new Date(), 
      isConnected: true 
    }];

    const lobby = {
      id: lobbyId,
      onchainLobbyId, // Guardar el ID on-chain
      name: data.name,
      type: data.type,
      status: 'waiting',
      hostId: creatorId,
      maxPlayers: data.type === 'publico' ? 8 : data.type === 'privado' ? 6 : (onchainInfo?.maxPlayers || 4),
      players: initialPlayers,
      createdAt: new Date(),
      // Configuración de pago para lobbies pagos
      ...(data.type === 'pago' && {
        paymentConfig: {
          network: data.network,
          token: data.token,
          amount: data.entryCost,
          tokenAddress: data.tokenAddress,
        },
        mode: data.mode || onchainInfo?.mode || 'BEAST',
        onchain: {
          ...data.onchain,
          lobbyId: onchainLobbyId
        }
      }),
      // Contraseña para lobbies privados
      ...(data.type === 'privado' && data.password && { password: data.password })
    };
    this.lobbies.set(lobbyId, lobby);
    this.playerLobbyMap.set(creatorId, lobbyId);
    
    console.log(`✅ Lobby creado: ${lobbyId} (on-chain: ${onchainLobbyId || 'N/A'})`);
    return { success: true, lobby };
  }

  async joinLobby(lobbyId, playerId, username, walletAddress, socketId, password, paymentTxHash) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby no encontrado' };
    if (lobby.players.length >= lobby.maxPlayers) return { success: false, error: 'Lobby lleno' };
    if (this.playerLobbyMap.has(playerId)) return { success: false, error: 'Ya estás en otro lobby' };
    
    // Verificar contraseña para lobbies privados
    if (lobby.type === 'privado' && lobby.password) {
      if (lobby.password !== password) {
        return { success: false, error: 'Contraseña incorrecta' };
      }
    }

    // Verificar pago on-chain para lobbies de pago
    if (lobby.type === 'pago') {
      if (!paymentTxHash) {
        return { success: false, error: 'Se requiere comprobante de pago (txHash)' };
      }

      if (!lobby.onchainLobbyId) {
        return { success: false, error: 'Lobby on-chain no configurado correctamente' };
      }

      try {
        console.log('🔍 Verificando pago on-chain...');
        const verification = await contractService.verifyJoinTransaction(
          paymentTxHash,
          lobby.onchainLobbyId
        );

        if (!verification.success) {
          return { success: false, error: 'Pago no verificado: ' + verification.error };
        }

        console.log('✅ Pago verificado para:', walletAddress);
      } catch (error) {
        console.error('❌ Error verificando pago:', error.message);
        return { success: false, error: 'No se pudo verificar el pago on-chain' };
      }
    }

    const player = { 
      id: playerId, 
      username, 
      walletAddress, 
      socketId, 
      isHost: false, 
      isReady: false, 
      joinedAt: new Date(), 
      isConnected: true 
    };
    lobby.players.push(player);
    this.playerLobbyMap.set(playerId, lobbyId);
    
    console.log(`✅ ${username} se unió al lobby ${lobbyId} (${lobby.players.length}/${lobby.maxPlayers})`);
    return { success: true, lobby };
  }

  leaveLobby(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby no encontrado' };
    lobby.players = lobby.players.filter(p => p.id !== playerId);
    this.playerLobbyMap.delete(playerId);
    if (lobby.players.length === 0) {
      this.lobbies.delete(lobbyId);
    } else {
      const hasHost = lobby.players.some(p => p.isHost);
      if (!hasHost && lobby.players.length > 0) {
        lobby.players[0].isHost = true;
        lobby.hostId = lobby.players[0].id;
      }
    }
    return { success: true, lobbyId };
  }

  getActiveLobbiesInfo() {
    const waitingForPlayers = [];
    const inGame = [];
    for (const lobby of this.lobbies.values()) {
      const lobbyInfo = {
        id: lobby.id,
        name: lobby.name,
        type: lobby.type,
        currentPlayers: lobby.players.length,
        maxPlayers: lobby.maxPlayers,
        hasPassword: !!lobby.password,
        // Incluir información de pago si existe
        ...(lobby.paymentConfig && {
          paymentConfig: lobby.paymentConfig,
          mode: lobby.mode,
          entryCost: lobby.paymentConfig.amount,
          onchain: lobby.onchain
        })
      };
      
      if (lobby.status === 'waiting' || lobby.status === 'starting') {
        waitingForPlayers.push(lobbyInfo);
      } else if (lobby.status === 'in-progress') {
        inGame.push({ ...lobbyInfo, players: lobby.players.length });
      }
    }
    return { waitingForPlayers, inGame };
  }

  // Cleanup helper: cancel timeouts, remove player mappings, delete lobby and its game
  cleanupLobby(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return false;
    // Clear timeouts
    try {
      lobby.players.forEach(p => {
        if (this.disconnectTimeouts && this.disconnectTimeouts.has(p.id)) {
          clearTimeout(this.disconnectTimeouts.get(p.id));
          this.disconnectTimeouts.delete(p.id);
        }
      });
    } catch (e) {}
    // Remove player mappings
    lobby.players.forEach(p => { if (this.playerLobbyMap.has(p.id)) this.playerLobbyMap.delete(p.id); });
    // Delete game if present
    if (this.games && this.games.has(lobbyId)) this.games.delete(lobbyId);
    // Delete lobby
    this.lobbies.delete(lobbyId);
    return true;
  }
}

module.exports = { LobbyManager };
