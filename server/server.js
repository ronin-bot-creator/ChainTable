const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { ethers } = require('ethers');

// Cargar variables de entorno PRIMERO
require('dotenv').config({ path: '../.env' });

// Luego cargar contractService (que usa process.env)
const contractService = require('./contractService');

// Initialize RPC providers for different networks
const RPC_SEPOLIA = process.env.RPC_URL_SEPOLIA || process.env.RPC_URL || '';
const RPC_RONIN_SAIGON = process.env.RPC_URL_RONIN_TESTNET || '';

let sepoliaProvider = null;
let roninSaigonProvider = null;

// Sepolia provider
if (RPC_SEPOLIA && RPC_SEPOLIA.length > 0) {
  sepoliaProvider = new ethers.JsonRpcProvider(RPC_SEPOLIA);
  console.log('✅ Using RPC_SEPOLIA provider from env');
} else {
  // fallback to public Sepolia RPC
  try {
    sepoliaProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
    console.warn('⚠️  RPC_URL_SEPOLIA not configured, using public Sepolia RPC (may be rate limited).');
  } catch (e) {
    console.warn('❌ Could not create fallback Sepolia provider:', e);
    sepoliaProvider = null;
  }
}

// Ronin Saigon provider
if (RPC_RONIN_SAIGON && RPC_RONIN_SAIGON.length > 0) {
  roninSaigonProvider = new ethers.JsonRpcProvider(RPC_RONIN_SAIGON);
  console.log('✅ Using RPC_RONIN_SAIGON provider from env');
} else {
  console.warn('⚠️  RPC_URL_RONIN_TESTNET not configured, Ronin Saigon validation disabled');
}

// Helper to get provider by chain name
function getProviderForChain(chain) {
  switch(chain) {
    case 'sepolia':
      return sepoliaProvider;
    case 'ronin-saigon':
      return roninSaigonProvider;
    default:
      return null;
  }
}

const app = express();
const server = http.createServer(app);

// Configurar CORS
app.use(cors());

const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// ===== MODELOS BÁSICOS =====
class Card {
  constructor(color, value, type, variant = 'a') {
    this.color = color; // Red, Blue, Green, Yellow, Wild
    this.value = value; // 0-9, Skip, Reverse, DrawTwo, WildDrawFour
    this.type = type;   // 'Number' | 'Action' | 'Wild'
    this.variant = variant; // a/b/c/d for artwork variants
  }
}

class UnoGame {
  constructor(lobbyId, players, lobbyData = {}) {
    this.lobbyId = lobbyId;
    this.players = players.map(p => ({ ...p }));
    this.drawPile = this.createDeck();
    this.discardPile = [];
    this.currentTurnIndex = 0;
    this.direction = 1;
    this.currentActiveColor = null;
    this.drawStackCount = 0;
    this.drawStackActive = false;
    this.hasDrawnCard = {};
    this.finishedIds = new Set();
    this.winners = [];
    
    // CRITICAL: Incluir información del lobby para auto-distribución de premios
    this.type = lobbyData.type; // 'gratuito' | 'pago'
    this.onchainLobbyId = lobbyData.onchainLobbyId; // ID del lobby en el contrato
    this.onchain = lobbyData.onchain; // Objeto completo con contract, chain, token, etc.
    this.entryCost = lobbyData.entryCost; // Costo de entrada (para referencia)

    this.shuffleDeck();
    this.dealInitialCards();
    this.setFirstCard();
  }

  createDeck() {
    const deck = [];
    const colors = ['Red', 'Blue', 'Green', 'Yellow'];
    const numbers = ['0','1','2','3','4','5','6','7','8','9'];
    const actions = ['Skip','Reverse','DrawTwo'];
    const variants = ['a','b'];

    colors.forEach(color => {
      // 0 variants
      variants.forEach(v => deck.push(new Card(color, '0', 'Number', v)));
      // 1-9 two variants
      numbers.slice(1).forEach(num => variants.forEach(v => deck.push(new Card(color, num, 'Number', v))));
      // actions
      actions.forEach(action => variants.forEach(v => deck.push(new Card(color, action, 'Action', v))));
    });

    // Wilds
    ['a','b','c','d'].forEach(v => deck.push(new Card('Wild', 'Wild', 'Wild', v)));
    // Wild Draw Four x4
    for (let i=0;i<4;i++) deck.push(new Card('Wild','WildDrawFour','Wild','a'));

    return deck;
  }

  shuffleDeck() {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
    }
  }

  dealInitialCards() {
    this.players.forEach(player => {
      player.hand = [];
      for (let i = 0; i < 7; i++) {
        if (this.drawPile.length > 0) player.hand.push(this.drawPile.pop());
      }
      player.cardCount = player.hand.length;
    });
  }

  setFirstCard() {
    let firstCard;
    do {
      if (this.drawPile.length === 0) this.reshuffleDiscardPile();
      firstCard = this.drawPile.pop();
    } while (firstCard.type === 'Wild');
    this.discardPile.push(firstCard);
    this.currentActiveColor = firstCard.color;
  }

  getCurrentCard() {
    return this.discardPile[this.discardPile.length - 1];
  }

  isValidPlay(cardToPlay, topDiscardCard, currentActiveColor, drawStackActive) {
    if (cardToPlay.color === 'Wild' && !drawStackActive) return true;
    if (drawStackActive) {
      if (cardToPlay.value === 'DrawTwo' && topDiscardCard.value === 'DrawTwo') return true;
      if (cardToPlay.value === 'WildDrawFour' && topDiscardCard.value === 'WildDrawFour') return true;
      return false;
    }
    if (cardToPlay.color === topDiscardCard.color || cardToPlay.color === currentActiveColor) return true;
    if (cardToPlay.value === topDiscardCard.value) return true;
    return false;
  }

  drawCard(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;
    if (this.drawPile.length === 0) this.reshuffleDiscardPile();
    if (this.drawPile.length === 0) return null;
    const card = this.drawPile.pop();
    player.hand.push(card);
    player.cardCount = player.hand.length;
    return card;
  }

  reshuffleDiscardPile() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.drawPile = [...this.discardPile];
    this.discardPile = [top];
    this.shuffleDeck();
  }

  nextTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + this.direction + this.players.length) % this.players.length;
    Object.keys(this.hasDrawnCard).forEach(k => { this.hasDrawnCard[k] = false; });
  }

  checkWinner() {
    const finished = this.players.filter(p => p.cardCount === 0 && !this.finishedIds.has(p.id));
    finished.forEach(p => {
      this.finishedIds.add(p.id);
      this.winners.push({ username: p.username, walletAddress: p.walletAddress, socketId: p.socketId, rank: this.winners.length + 1 });
    });
    const remaining = this.players.filter(p => !this.finishedIds.has(p.id));
    if (remaining.length <= 1) {
      if (remaining.length === 1) {
        const lp = remaining[0];
        if (!this.finishedIds.has(lp.id)) {
          this.finishedIds.add(lp.id);
          this.winners.push({ username: lp.username, walletAddress: lp.walletAddress, socketId: lp.socketId, rank: this.winners.length + 1 });
        }
      }
      this.status = 'finished';
      return true;
    }
    return false;
  }
}

// ===== GESTOR DE LOBBIES =====
class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.games = new Map();
    this.playerLobbyMap = new Map();
    this.disconnectTimeouts = new Map();
  }

  handleDisconnectGrace(lobbyId, playerId, onExpel) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return;
    player.isConnected = false;
    player.disconnectTimestamp = Date.now();
    const timeoutId = setTimeout(() => {
      onExpel();
      this.disconnectTimeouts.delete(playerId);
    }, 30000);
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

  createLobby(data, creatorId, creatorUsername, walletAddress, socketId) {
    const lobbyId = `lobby_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const lobby = {
      id: lobbyId,
      name: data.name,
      type: data.type,
      status: 'waiting',
      hostId: creatorId,
      maxPlayers: data.type === 'publico' ? 8 : data.type === 'privado' ? 6 : 4,
      players: [{ id: creatorId, username: creatorUsername, walletAddress, socketId, isHost: true, isReady: false, joinedAt: new Date(), isConnected: true }],
      createdAt: new Date(),
      ...(data.onchain && { onchain: data.onchain }),
      ...(data.token && { token: data.token }),
      ...(data.mode && { mode: data.mode }),
      ...(data.network && { network: data.network }),
      ...(data.password && { password: data.password }),
      ...(data.entryCost && { entryCost: data.entryCost })
    };
    this.lobbies.set(lobbyId, lobby);
    this.playerLobbyMap.set(creatorId, lobbyId);
    return { success: true, lobby };
  }

  joinLobby(lobbyId, playerId, username, walletAddress, socketId, password) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby no encontrado' };
    if (lobby.players.length >= lobby.maxPlayers) return { success: false, error: 'Lobby lleno' };
    if (lobby.password && lobby.password !== password) return { success: false, error: 'Contraseña incorrecta' };
    if (this.playerLobbyMap.has(playerId)) return { success: false, error: 'Ya estás en otro lobby' };
    const player = { id: playerId, username, walletAddress, socketId, isHost: false, isReady: false, joinedAt: new Date(), isConnected: true };
    lobby.players.push(player);
    this.playerLobbyMap.set(playerId, lobbyId);
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
      if (lobby.status === 'waiting' || lobby.status === 'starting') {
        waitingForPlayers.push({ 
          id: lobby.id, 
          name: lobby.name, 
          type: lobby.type, 
          currentPlayers: lobby.players.length, 
          maxPlayers: lobby.maxPlayers,
          ...(lobby.onchain && { onchain: lobby.onchain }),
          ...(lobby.entryCost && { entryCost: lobby.entryCost })
        });
      } else if (lobby.status === 'in-progress') {
        inGame.push({ 
          id: lobby.id, 
          name: lobby.name, 
          type: lobby.type, 
          players: lobby.players.length,
          ...(lobby.onchain && { onchain: lobby.onchain }),
          ...(lobby.entryCost && { entryCost: lobby.entryCost })
        });
      }
    }
    return { waitingForPlayers, inGame };
  }

  startGame(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, error: 'Lobby no encontrado' };
    const player = lobby.players.find(p => p.id === playerId);
    if (!player || !player.isHost) return { success: false, error: 'Solo el host puede iniciar la partida' };
    if (lobby.players.length < 2) return { success: false, error: 'Se necesitan al menos 2 jugadores' };
    
    // CRITICAL: Pasar información del lobby al juego para auto-distribución de premios
    const lobbyData = {
      type: lobby.type,
      onchainLobbyId: lobby.onchain?.lobbyId || lobby.onchainLobbyId,
      onchain: lobby.onchain, // Pass the complete onchain object with contract, chain, token, etc.
      entryCost: lobby.entryCost
    };
    
    const game = new UnoGame(lobbyId, lobby.players, lobbyData);
    this.games.set(lobbyId, game);
    lobby.status = 'in_game';
    return { success: true, game };
  }

  getGame(lobbyId) {
    return this.games.get(lobbyId);
  }

  playCard(lobbyId, playerId, cardIndex) {
    const game = this.games.get(lobbyId);
    if (!game) return { success: false, error: 'Juego no encontrado' };
    const player = game.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Jugador no encontrado' };
    const currentPlayer = game.players[game.currentTurnIndex];
    if (currentPlayer.id !== playerId) return { success: false, error: 'No es tu turno' };
    if (cardIndex < 0 || cardIndex >= player.hand.length) return { success: false, error: 'Índice de carta inválido' };

    const cardToPlay = player.hand[cardIndex];
    const topCard = game.getCurrentCard();

    // If there is an active draw stack, only allow stacking the same draw-type
    if (game.drawStackActive) {
      const topVal = topCard?.value;
      if (cardToPlay.value !== topVal) {
        return { success: false, error: 'Debes jugar un +2/+4 igual o robar/pasar' };
      }
    }

    if (!game.isValidPlay(cardToPlay, topCard, game.currentActiveColor, game.drawStackActive)) return { success: false, error: 'Jugada no válida' };

    player.hand.splice(cardIndex,1);
    player.cardCount = player.hand.length;
    game.discardPile.push(cardToPlay);

    let action = 'play';
    let skipNextTurn = false;
    let drawCards = 0;
    let needsColorChoice = false;

    if (cardToPlay.type === 'Action') {
      switch (cardToPlay.value) {
        case 'Skip': action = 'skip'; skipNextTurn = true; break;
        case 'Reverse': action = 'reverse'; game.direction *= -1; if (game.players.length === 2) skipNextTurn = true; break;
        case 'DrawTwo': action = 'drawTwo_played'; game.drawStackCount += 2; game.drawStackActive = true; break;
      }
    } else if (cardToPlay.type === 'Wild') {
      if (cardToPlay.value === 'WildDrawFour') { action = 'drawFour_played'; game.drawStackCount += 4; game.drawStackActive = true; }
      needsColorChoice = true;
    }


    // For non-wild cards set active color immediately. For wilds (including WildDrawFour)
    // the active color must be chosen by the player via chooseColor before we change turns
    if (cardToPlay.color !== 'Wild') game.currentActiveColor = cardToPlay.color;

    // Advance turn only if we don't need the player to choose a color first.
    if (!needsColorChoice) {
      if (skipNextTurn) game.nextTurn();
      game.nextTurn();
    } else {
      // When a wild requiring color is played, we hold the turn until chooseColor is called.
      // Notify caller that a color choice is needed; the server will advance turns after chooseColor.
    }

    // If there's an active draw stack after advancing the turn, DO NOT apply the penalty here.
    // We must give the penalized player the opportunity to respond (stack another +2/+4)
    // or to draw/pass. The actual penalty (drawing the accumulated cards and skipping the
    // player's turn) will be applied by `drawCardForPlayer` or `passTurn` when the penalized
    // player chooses to draw or explicitly passes.
    if (game.drawStackActive && !needsColorChoice) {
      const penalizedIndex = game.currentTurnIndex;
      const penalizedPlayer = game.players[penalizedIndex];
      const lastPlayed = game.getCurrentCard();
      const canDefend = penalizedPlayer.hand.some(card => (
        lastPlayed.value === 'WildDrawFour' && card.value === 'WildDrawFour'
      ) || (
        lastPlayed.value === 'DrawTwo' && card.value === 'DrawTwo'
      ));
      // Notify clients whether stacking is allowed. Do NOT apply the penalty here.
      if (canDefend) {
        action = 'stack_allowed';
      } else {
        action = 'stack_not_allowed';
      }
      // Note: the actual penalty will be applied when the penalized player chooses to draw
      // (drawCardForPlayer) or explicitly passes (passTurn).
    }

    // NOTE: do not apply draw stack penalty immediately here. We must give the next player
    // the chance to respond (stack another DrawTwo / WildDrawFour). The penalty will be
    // applied when the next player chooses to draw (handled in drawCardForPlayer) or fails
    // to play a defending draw card.

    const gameEnded = game.checkWinner();

  return { success: true, game, playedCard: cardToPlay, action, needsColorChoice, gameEnded, drawCards };
  }

  drawCardForPlayer(lobbyId, playerId) {
    const game = this.games.get(lobbyId);
    if (!game) return { success: false, error: 'Juego no encontrado' };
    const currentPlayer = game.players[game.currentTurnIndex];
    if (currentPlayer.id !== playerId) return { success: false, error: 'No es tu turno' };
    // If there's an active draw stack (e.g., accumulated +2/+4), the player must take the full penalty
    if (game.drawStackActive) {
      const n = game.drawStackCount || 0;
      if (n <= 0) {
        // fallback to single draw
      } else {
        for (let i = 0; i < n; i++) game.drawCard(playerId);
        game.drawStackCount = 0;
        game.drawStackActive = false;
        // After receiving penalty, skip this player's turn
        game.nextTurn();
        return { success: true, game, action: 'draw_penalty', cardsDrawn: n };
      }
    }

    // Prevent drawing more than once per turn
    if (game.hasDrawnCard[playerId]) return { success: false, error: 'Ya robaste esta ronda' };
    const drawn = game.drawCard(playerId);
    if (!drawn) return { success: false, error: 'No hay más cartas en el mazo' };
    game.hasDrawnCard[playerId] = true;
    return { success: true, game, drawnCard: drawn };
  }

  passTurn(lobbyId, playerId) {
    const game = this.games.get(lobbyId);
    if (!game) return { success: false, error: 'Juego no encontrado' };
    const currentPlayer = game.players[game.currentTurnIndex];
    if (currentPlayer.id !== playerId) return { success: false, error: 'No es tu turno' };
    // If there's an active draw stack, passing means you decline to defend and must take the penalty
    if (game.drawStackActive) {
      const n = game.drawStackCount || 0;
      if (n > 0) {
        for (let i = 0; i < n; i++) game.drawCard(playerId);
        game.drawStackCount = 0;
        game.drawStackActive = false;
        // After penalizing, skip this player's turn
        game.nextTurn();
        return { success: true, game, action: 'draw_penalty', cardsDrawn: n };
      }
    }

    if (!game.hasDrawnCard[playerId]) return { success: false, error: 'Debes robar una carta antes de pasar' };
    game.nextTurn();
    return { success: true, game };
  }

  chooseColor(lobbyId, playerId, color) {
    const game = this.games.get(lobbyId);
    if (!game) return { success: false, error: 'Juego no encontrado' };
    const validColors = ['Red','Blue','Green','Yellow'];
    if (!validColors.includes(color)) return { success: false, error: 'Color inválido' };
    game.currentActiveColor = color;
    // If there is an active draw stack (e.g. WildDrawFour) we must apply it now
    let drawCards = 0;
    let action = null;
    if (game.drawStackActive) {
      const lastPlayed = game.getCurrentCard();
      // Calculate the penalized player's index (the next in turn order)
      const penalizedIndex = (game.currentTurnIndex + game.direction + game.players.length) % game.players.length;
      const penalizedPlayer = game.players[penalizedIndex];

      // Determine if the penalized player can defend (stack) with same-value draw cards
      const canDefend = penalizedPlayer.hand.some(card => (
        lastPlayed.value === 'WildDrawFour' && card.value === 'WildDrawFour'
      ) || (
        lastPlayed.value === 'DrawTwo' && card.value === 'DrawTwo'
      ));

      if (canDefend) {
        // Give the penalized player the turn so they may respond (stack)
        game.currentTurnIndex = penalizedIndex;
        action = 'stack_allowed';
      } else {
        // Apply the draw penalty to the penalized player and skip their turn
        for (let i = 0; i < game.drawStackCount; i++) game.drawCard(penalizedPlayer.id);
        drawCards = game.drawStackCount;
        game.drawStackCount = 0;
        game.drawStackActive = false;
        action = 'draw_penalty';
        // Set turn to the player after the penalized one
        game.currentTurnIndex = (penalizedIndex + game.direction + game.players.length) % game.players.length;
      }
    }

    // If there was no draw stack (regular Wild), advance the turn normally
    if (!game.drawStackActive) {
      // regular wild: after choosing color, next player's turn
      game.nextTurn();
    }

    return { success: true, game, chosenColor: color, action, drawCards };
  }
}

const lobbyManager = new LobbyManager();

// Manejar conexiones WebSocket
io.on('connection', (socket) => {
  console.log(`👤 Usuario conectado: ${socket.id}`);
  let currentUserId = null;

  // Enviar lista de lobbies al conectar
  socket.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
  socket.emit('lobbiesList', lobbyManager.getActiveLobbiesInfo());

  // Crear lobby
  socket.on('lobby:create', async (data) => {
    console.log('🎮 Creando lobby:', data);
    currentUserId = data.creatorId;
    // store onchain metadata if provided
    const meta = {};
    if (data.onchain) meta.onchain = data.onchain;
    const walletAddress = data.walletAddress || data.creatorUsername; // use wallet address from client
    const result = await lobbyManager.createLobby({ ...data, ...meta }, data.creatorId, data.creatorUsername, walletAddress, socket.id);
    socket.emit('lobby:created', result);
    socket.emit('lobbyCreated', result);
    if (result.success) {
      socket.join(result.lobby.id);
      io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
      io.emit('lobbiesList', lobbyManager.getActiveLobbiesInfo());
      io.to(result.lobby.id).emit('lobby:updated', { lobbyId: result.lobby.id });
      io.to(result.lobby.id).emit('lobbyUpdate', { lobbyId: result.lobby.id });
    }

    // If onchain metadata provided, try to resolve on-chain lobbyId from receipt and store it
    if (data.onchain && data.onchain.chain && data.onchain.txHash) {
      const provider = getProviderForChain(data.onchain.chain);
      if (!provider) {
        console.warn(`⚠️  No provider available for chain: ${data.onchain.chain}, skipping on-chain resolution`);
      } else {
        (async () => {
          try {
            const txHash = data.onchain.txHash;
            console.log(`Resolving on-chain lobbyId for tx ${txHash} on ${data.onchain.chain}`);
            let receipt = null;
            try {
              receipt = await provider.waitForTransaction(txHash, 1, 60000);
            } catch (e) {
              try { receipt = await provider.getTransactionReceipt(txHash); } catch (e2) { receipt = null; }
            }
            if (!receipt) { console.warn('Could not obtain receipt for createLobby tx', txHash); return; }
            if (receipt.status === 0) { console.warn('createLobby tx reverted', txHash); return; }

            // parse logs looking for LobbyCreated
            const iface = new ethers.Interface(['event LobbyCreated(uint256 indexed lobbyId, address indexed creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode)']);
            for (const log of receipt.logs) {
              try {
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'LobbyCreated') {
                  const onchainLobbyId = parsed.args?.lobbyId?.toString?.() || null;
                  if (onchainLobbyId) {
                    const serverLobby = lobbyManager.lobbies.get(result.lobby.id);
                    if (serverLobby) {
                      // Guardar en ambos lugares para compatibilidad
                      serverLobby.onchainLobbyId = Number(onchainLobbyId);
                      serverLobby.onchain = serverLobby.onchain || {};
                      serverLobby.onchain.lobbyId = onchainLobbyId;
                      console.log('✅ Stored onchainLobbyId for server lobby', result.lobby.id, '→', onchainLobbyId);
                      io.to(result.lobby.id).emit('lobby:updated', { lobbyId: result.lobby.id });
                    }
                  }
                  break;
                }
              } catch (e) {
                // non-matching log
              }
            }
          } catch (e) {
            console.error('Error resolving onchain lobbyId for create', e);
          }
        })();
      }
    }
  });

  // Unirse a lobby
  socket.on('lobby:join', async (data) => {
    console.log('👋 Uniéndose a lobby:', data);
    currentUserId = data.playerId;
    const walletAddress = data.walletAddress || data.username;
    
    // joinLobby ahora es async y maneja la verificación on-chain internamente
    const result = await lobbyManager.joinLobby(
      data.lobbyId, 
      data.playerId, 
      data.username, 
      walletAddress, 
      socket.id, 
      data.password,
      data.onchain?.txHash // Pasar el txHash si existe
    );
    
    socket.emit('lobby:joined', result);
    socket.emit('lobbyJoined', result);
    if (result.success) {
      socket.join(data.lobbyId);
      io.to(data.lobbyId).emit('lobby:updated', { lobbyId: data.lobbyId });
      io.to(data.lobbyId).emit('lobbyUpdate', { lobbyId: data.lobbyId });
      io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
      io.emit('lobbiesList', lobbyManager.getActiveLobbiesInfo());
    }
  });

  // Salir de lobby
  socket.on('lobby:leave', (data) => {
    console.log('🚪 Saliendo de lobby:', data);
    const result = lobbyManager.leaveLobby(data.lobbyId, data.playerId);
    socket.emit('lobby:left', result);
    socket.emit('lobbyLeft', result);
    if (result.success) {
      socket.leave(data.lobbyId);
      io.to(data.lobbyId).emit('lobby:updated', { lobbyId: data.lobbyId });
      io.to(data.lobbyId).emit('lobbyUpdate', { lobbyId: data.lobbyId });
      io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
      io.emit('lobbiesList', lobbyManager.getActiveLobbiesInfo());
    }
  });

  // Solicitar lista
  socket.on('lobby:list', () => {
    socket.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
    socket.emit('lobbiesList', lobbyManager.getActiveLobbiesInfo());
  });

  // Ready (placeholder)
  socket.on('lobby:ready', (data) => { console.log('✅ Jugador listo:', data); });

  // Start game
  socket.on('game:start', (data) => {
    console.log('🎮 Iniciando partida:', data);
    const result = lobbyManager.startGame(data.lobbyId, currentUserId);
    if (result.success) {
      const game = result.game;
      const firstCard = game.getCurrentCard();
      io.to(data.lobbyId).emit('game:started', { gameState: game, firstCard });
      io.to(data.lobbyId).emit('gameStarted', { gameState: game, firstCard });
      game.players.forEach(player => {
        io.to(player.socketId).emit('game:yourHand', player.hand);
        io.to(player.socketId).emit('yourHand', player.hand);
      });
      io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
      io.emit('lobbiesList', lobbyManager.getActiveLobbiesInfo());
    } else {
      socket.emit('game:error', result.error);
    }
  });

  // Game actions
  socket.on('game:playCard', (data) => {
    console.log('🃏 Jugando carta:', data);
    const result = lobbyManager.playCard(data.lobbyId, currentUserId, data.cardIndex);
    if (result.success) {
      const game = result.game;
      const updateData = {
        gameState: game,
        playedCard: result.playedCard,
        playerPlayed: game.players.find(p => p.id === currentUserId)?.username || 'Unknown',
        newTurnIndex: game.currentTurnIndex,
        action: result.action,
        currentPlayerName: game.players[game.currentTurnIndex]?.username || null,
        currentActiveColor: game.currentActiveColor,
        ...(result.drawCards && { cardsDrawn: result.drawCards })
      };
      io.to(data.lobbyId).emit('game:update', updateData);
      const player = game.players.find(p => p.id === currentUserId);
      if (player) io.to(socket.id).emit('game:yourHand', player.hand);
      // If a penalty was applied immediately, send the penalized player's updated hand
      if (result.penalizedPlayerId) {
        const penalized = game.players.find(p => p.id === result.penalizedPlayerId);
        if (penalized) io.to(penalized.socketId).emit('game:yourHand', penalized.hand);
      }
      if (result.needsColorChoice) socket.emit('game:promptColor', { lobbyId: data.lobbyId, playedCardIndex: data.cardIndex });
      if (result.gameEnded) {
        io.to(data.lobbyId).emit('game:over', { gameState: game });
        game.winners.forEach(w => {
          const winnerSocket = game.players.find(p => p.username === w.username)?.socketId;
          if (winnerSocket) io.to(winnerSocket).emit('game:winner', { username: w.username, rank: w.rank, gameState: game });
        });
        
        // Distribuir premios on-chain para lobbies de pago
        const lobby = lobbyManager.lobbies.get(data.lobbyId);
        if (lobby && lobby.type === 'pago') {
          if (!lobby.onchainLobbyId || lobby.onchainLobbyId === '0' || lobby.onchainLobbyId === 0) {
            console.error('❌ Este lobby de pago NO tiene un lobbyId on-chain válido.');
            console.error('   Esto significa que el lobby NO se creó on-chain correctamente.');
            console.error('   Los fondos no pueden distribuirse automáticamente.');
            console.error('   TIP: Asegúrate de crear el lobby usando createLobby del contrato primero.');
            
            // Notificar al host
            const hostPlayer = lobby.players?.find(p => p.isHost);
            if (hostPlayer) {
              io.to(hostPlayer.socketId).emit('game:prizeError', {
                error: 'Este lobby no fue creado on-chain. No se pueden distribuir premios automáticamente.'
              });
            }
            return;
          }
          
          (async () => {
            try {
              console.log('💰 Distribuyendo premios on-chain...');
              console.log('📊 Game winners:', JSON.stringify(game.winners, null, 2));
              console.log('👥 Game players:', JSON.stringify(game.players.map(p => ({ 
                id: p.id, 
                username: p.username, 
                walletAddress: p.walletAddress 
              })), null, 2));
              
              // Extraer addresses de ganadores en orden
              const winnerAddresses = game.winners.map(w => w.walletAddress).filter(addr => addr);
              
              console.log('🏆 Winner addresses extraídas:', winnerAddresses);
              
              if (winnerAddresses.length === 0) {
                console.error('❌ No hay direcciones de ganadores válidas');
                console.error('   Esto puede ser porque:');
                console.error('   1. Los jugadores no tienen walletAddress definido');
                console.error('   2. game.winners está vacío');
                console.error('   3. walletAddress es undefined/null');
                return;
              }
              
              console.log('✅ Datos de distribución de premios:');
              console.log('   Winners:', winnerAddresses);
              console.log('   Lobby ID on-chain:', lobby.onchainLobbyId);
              console.log('   Mode:', lobby.mode);
              console.log('   Network:', lobby.paymentConfig?.network);
              
              // Emitir evento al host para que ejecute la distribución
              const hostPlayer = lobby.players.find(p => p.isHost);
              console.log('\n👤 Buscando host del lobby...');
              console.log('   Host player found:', hostPlayer ? 'YES' : 'NO');
              
              if (hostPlayer) {
                console.log('   Host ID:', hostPlayer.id);
                console.log('   Host username:', hostPlayer.username);
                console.log('   Host socketId:', hostPlayer.socketId);
                console.log('   Host isConnected:', hostPlayer.isConnected);
                
                console.log('\n📤 Emitiendo evento game:distributePrizes al host...');
                io.to(hostPlayer.socketId).emit('game:distributePrizes', {
                  lobbyId: lobby.onchainLobbyId,
                  winners: winnerAddresses,
                  mode: lobby.mode
                });
                console.log('✅ Evento game:distributePrizes emitido al socketId:', hostPlayer.socketId);
              } else {
                console.error('❌ NO se encontró el host del lobby!');
                console.error('   Jugadores actuales:', lobby.players.map(p => ({ id: p.id, isHost: p.isHost, socketId: p.socketId })));
              }
              
            } catch (error) {
              console.error('❌ Error preparando distribución de premios:', error.message);
            }
          })();
        }
      }
    } else {
      socket.emit('game:error', result.error);
    }
  });

  socket.on('game:drawCard', (data) => {
    console.log('🎯 Robando carta:', data);
    const result = lobbyManager.drawCardForPlayer(data.lobbyId, currentUserId);
    if (result.success) {
      const game = result.game;
      const player = game.players.find(p => p.id === currentUserId);
      if (player) io.to(socket.id).emit('game:yourHand', player.hand);
      const updateData = { gameState: game, playerPlayed: game.players.find(p => p.id === currentUserId)?.username || 'Unknown', newTurnIndex: game.currentTurnIndex, action: 'draw', currentPlayerName: game.players[game.currentTurnIndex]?.username || null, currentActiveColor: game.currentActiveColor };
      io.to(data.lobbyId).emit('game:update', updateData);
    } else {
      socket.emit('game:error', result.error);
    }
  });

  socket.on('game:passTurn', (data) => {
    console.log('⏭️ Pasando turno:', data);
    const result = lobbyManager.passTurn(data.lobbyId, currentUserId);
    if (result.success) {
      const game = result.game;
      const updateData = { gameState: game, playerPlayed: game.players.find(p => p.id === currentUserId)?.username || 'Unknown', newTurnIndex: game.currentTurnIndex, action: 'pass', currentPlayerName: game.players[game.currentTurnIndex]?.username || null, currentActiveColor: game.currentActiveColor };
      io.to(data.lobbyId).emit('game:update', updateData);
    } else {
      socket.emit('game:error', result.error);
    }
  });

  socket.on('game:chooseColor', (data) => {
    console.log('🎨 Eligiendo color:', data);
    const result = lobbyManager.chooseColor(data.lobbyId, currentUserId, data.color, data.cardIndex);
    if (result.success) {
      const game = result.game;
      const updateData = { gameState: game, playerPlayed: game.players.find(p => p.id === currentUserId)?.username || 'Unknown', newTurnIndex: game.currentTurnIndex, action: 'color_chosen', currentPlayerName: game.players[game.currentTurnIndex]?.username || null, currentActiveColor: game.currentActiveColor };
      io.to(data.lobbyId).emit('game:update', updateData);
    } else {
      socket.emit('game:error', result.error);
    }
  });

  socket.on('game:getLobbyInfo', (data) => {
    console.log('📋 Solicitando info del lobby:', data);
    const lobby = lobbyManager.lobbies.get(data.lobbyId);
    if (lobby) {
      socket.emit('game:lobbyInfo', { success: true, lobby });
      const game = lobbyManager.getGame(data.lobbyId);
      if (game) {
        socket.emit('game:gameInfo', { success: true, game });
        const player = game.players.find(p => p.id === currentUserId);
        if (player) socket.emit('game:yourHand', player.hand);
      }
    } else {
      socket.emit('game:lobbyInfo', { success: false, error: 'Lobby no encontrado' });
    }
  });

  // Manejador para cuando el host confirma la distribución de premios
  socket.on('game:prizeDistributed', async (data) => {
    console.log('💰 Recibiendo confirmación de distribución de premios:', data);
    
    try {
      const { txHash, lobbyId } = data;
      
      if (!txHash) {
        console.error('❌ No se proporcionó txHash de distribución');
        return;
      }
      
      // Verificar que la transacción fue exitosa
      const receipt = await contractService.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        console.error('❌ Transacción no encontrada');
        socket.emit('game:prizeError', { error: 'Transacción no encontrada' });
        return;
      }
      
      if (receipt.status === 0) {
        console.error('❌ Transacción de distribución falló');
        socket.emit('game:prizeError', { error: 'La transacción de distribución falló' });
        return;
      }
      
      console.log('✅ Premios distribuidos exitosamente!');
      
      // Notificar a todos en el lobby
      io.to(lobbyId).emit('game:prizesDistributed', {
        success: true,
        txHash,
        message: 'Los premios han sido distribuidos on-chain'
      });
      
    } catch (error) {
      console.error('❌ Error verificando distribución de premios:', error.message);
      socket.emit('game:prizeError', { error: error.message });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('👤 Usuario desconectado:', socket.id, { reason, currentUserId });
    if (currentUserId && lobbyManager.playerLobbyMap.has(currentUserId)) {
      const lobbyId = lobbyManager.playerLobbyMap.get(currentUserId);
      console.log(`⏳ Marcando usuario ${currentUserId} como desconectado en lobby ${lobbyId}`);
      lobbyManager.handleDisconnectGrace(lobbyId, currentUserId, () => {
        // Before expelling, ensure lobby still exists (it might have been cancelled)
        if (!lobbyManager.lobbies.has(lobbyId)) {
          console.log(`⚠️ Lobby ${lobbyId} not present at expel time, skipping expel for ${currentUserId}`);
          return;
        }
        console.log(`� Expulsando finalmente a ${currentUserId} del lobby ${lobbyId}`);
        const result = lobbyManager.leaveLobby(lobbyId, currentUserId);
        if (result.success) {
          io.to(lobbyId).emit('lobby:updated', { lobbyId });
          io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
        }
      });
      io.to(lobbyId).emit('lobby:updated', { lobbyId });
      io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
    }
  });

  // Cancel lobby explicitly by host before starting
  socket.on('lobby:cancel', (data) => {
    console.log('🛑 Lobby cancel requested:', data);
    const { lobbyId, playerId } = data;
    const lobby = lobbyManager.lobbies.get(lobbyId);
    if (!lobby) { socket.emit('lobby:left', { success: false, lobbyId }); return; }
    if (lobby.hostId !== playerId) { socket.emit('lobby:left', { success: false, lobbyId }); return; }
    if (lobby.status !== 'waiting') { socket.emit('lobby:left', { success: false, lobbyId }); return; }
    // Notify clients in the lobby that it was cancelled
    io.to(lobbyId).emit('lobby:cancelled', { lobbyId });
    io.to(lobbyId).emit('lobbyCancelled', { lobbyId });

    // Central cleanup using LobbyManager helper
    try {
      // Direct cleanup since cleanupLobby method doesn't exist
      lobby.players.forEach(p => { 
        if (lobbyManager.playerLobbyMap.has(p.id)) {
          lobbyManager.playerLobbyMap.delete(p.id); 
        }
      });
      lobbyManager.lobbies.delete(lobbyId);
      console.log(`Lobby ${lobbyId} cleaned up successfully`);
    } catch (e) {
      console.error('Error during cleanup:', e);
    }

    socket.emit('lobby:left', { success: true, lobbyId });
    io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
    io.emit('lobbiesList', lobbyManager.getActiveLobbiesInfo());
  });

  socket.on('lobby:reconnect', ({ lobbyId, userId }) => {
    console.log(`🔄 Usuario ${userId} reconectando a lobby ${lobbyId} con socket ${socket.id}`);
    lobbyManager.handleReconnect(lobbyId, userId, socket.id);
    io.to(lobbyId).emit('lobby:updated', { lobbyId });
    io.emit('lobby:list-updated', lobbyManager.getActiveLobbiesInfo());
  });
});

const PORT = process.env.PORT || 3001;

// Inicializar contractService
(async () => {
  try {
    await contractService.initialize();
    console.log('✅ ContractService inicializado correctamente');
  } catch (error) {
    console.error('⚠️ Error inicializando ContractService:', error.message);
    console.error('El servidor funcionará pero no podrá verificar pagos on-chain');
  }
})();

server.listen(PORT, () => {
  console.log(`🚀 Servidor WebSocket corriendo en puerto ${PORT}`);
  console.log(`🔗 Clientes pueden conectarse desde: http://localhost:5173`);
  console.log(`📋 Eventos disponibles: lobby:*, game:*`);
});