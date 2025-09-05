// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const path = require('path');   // 👈 ESTA LINEA FALTABA


app.use(express.static(path.join(__dirname, 'public')));




// Ruta raíz explícita → index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Estructura de datos para los lobbies y el juego
const lobbies = {};
let lobbyCounter = 0;

// Definición de cartas
const COLORS = ['Red', 'Blue', 'Green', 'Yellow'];
const TYPES = ['Number', 'Action', 'Wild'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTIONS = ['Skip', 'Reverse', 'DrawTwo'];
const WILD_ACTIONS = ['Wild', 'WildDrawFour'];

// ---------- Utilidades de juego ----------

function createDeck() {
  const deck = [];
  
  // Numeradas + acción por color
  COLORS.forEach(color => {
    deck.push({ color, value: '0', type: 'Number', variant: 'a' }); // cero tiene también a/b
    deck.push({ color, value: '0', type: 'Number', variant: 'b' });

    NUMBERS.slice(1).forEach(n => {
      deck.push({ color, value: n, type: 'Number', variant: 'a' });
      deck.push({ color, value: n, type: 'Number', variant: 'b' });
    });

    ACTIONS.forEach(a => {
      deck.push({ color, value: a, type: 'Action', variant: 'a' });
      deck.push({ color, value: a, type: 'Action', variant: 'b' });
    });
  });

  // Wilds con 4 variantes distintas
  const wildVariants = ['a','b','c','d'];
  wildVariants.forEach(v => {
    deck.push({ color: 'Wild', value: 'Wild', type: 'Wild', variant: v });
  });

  // WildDrawFour (+4) → todas iguales
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'Wild', value: 'WildDrawFour', type: 'Wild' });
  }

  return deck;
}



function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealCards(lobby) {
  for (const player of lobby.players) {
    player.hand = [];
    for (let i = 0; i < 7; i++) player.hand.push(lobby.drawPile.pop());
  }
}

function drawCardFromDeck(lobby) {
  if (lobby.drawPile.length === 0) {
    const topCard = lobby.discardPile.pop();
    lobby.drawPile = lobby.discardPile;
    shuffleDeck(lobby.drawPile);
    lobby.discardPile = [topCard];
  }
  return lobby.drawPile.pop();
}

function isValidPlay(card, topDiscardCard, currentActiveColor, drawStackActive) {
  if (card.color === 'Wild' && !drawStackActive) return true;
  if (drawStackActive) {
    if (card.value === 'DrawTwo' && topDiscardCard.value === 'DrawTwo') return true;
    if (card.value === 'WildDrawFour' && topDiscardCard.value === 'WildDrawFour') return true;
    return false;
  }
  const colorMatch = card.color === currentActiveColor;
  const valueMatch = card.value === topDiscardCard.value;
  return colorMatch || valueMatch;
}

// ---- helpers robustos para estado de partida ----
function endGame(io, lobbyId, lobby) {
  if (!lobby || lobby.status === 'finished') return;
  lobby.status = 'finished';
  io.to(lobbyId).emit('gameOver', { lobbyState: lobby });
}

function advanceTurn(lobby, steps = 1) {
  if (lobby.players.length === 0) {
    lobby.currentTurnIndex = 0;
    return;
  }
  let idx = lobby.currentTurnIndex + steps * lobby.direction;
  idx %= lobby.players.length;
  if (idx < 0) idx += lobby.players.length;
  lobby.currentTurnIndex = idx;
  lobby.hasDrawnCard = {};
}

function awardWinner(io, lobbyId, lobby, currentPlayerIndex, lastPlayedCard, playerJustWon) {
  if (!lobby.finishedIds) lobby.finishedIds = new Set();
  if (lobby.finishedIds.has(playerJustWon.socketId)) return;

  // Asignar puesto
  const rank = lobby.winners.length + 1;
  lobby.winners.push({
    username: playerJustWon.username,
    socketId: playerJustWon.socketId,
    rank
  });
  lobby.finishedIds.add(playerJustWon.socketId);

  io.to(lobbyId).emit('winnerFound', {
    username: playerJustWon.username,
    rank,
    lobbyState: lobby
  });

  // Quitar jugador de la lista activa
  lobby.players.splice(currentPlayerIndex, 1);

  // ================= CASOS ESPECIALES =================

  // Caso: solo 1 jugador restante
  if (lobby.players.length === 1) {
    const last = lobby.players[0];
    const nextRank = lobby.winners.length + 1;

    lobby.winners.push({
      username: last.username,
      socketId: last.socketId,
      rank: nextRank
    });
    lobby.finishedIds.add(last.socketId);
    lobby.players.splice(0, 1);

    io.to(lobbyId).emit('winnerFound', {
      username: last.username,
      rank: nextRank,
      lobbyState: lobby
    });

    endGame(io, lobbyId, lobby);
    return true;
  }

  // Caso: ya hay 3 ganadores → terminar partida
  if (lobby.winners.length >= 3) {
    endGame(io, lobbyId, lobby);
    return true;
  }

  // ================= CONTINUAR JUEGO =================
  io.to(lobbyId).emit('gameUpdate', {
    lobbyState: lobby,
    playedCard: lastPlayedCard,
    playerPlayed: playerJustWon.username,
    newTurnIndex: lobby.currentTurnIndex % lobby.players.length,
    action: 'play',
    currentPlayerName: lobby.players[lobby.currentTurnIndex]?.username || null,
    currentActiveColor: lobby.currentActiveColor
  });

  return false;
}


// ---------------------------------------------------
// Servidor Socket.IO
// ---------------------------------------------------
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Crear Lobby
  socket.on('createLobby', ({ username, lobbyName, isPrivate, password }) => {
    const lobbyId = `lobby_${++lobbyCounter}`;

    lobbies[lobbyId] = {
      id: lobbyId,
      name: lobbyName,
      hostId: socket.id,
      isPrivate,
      password,
      players: [{ id: socket.id, username, socketId: socket.id, hand: [] }],
      status: 'waiting',
      drawPile: [],
      discardPile: [],
      currentTurnIndex: 0,
      direction: 1,
      currentActiveColor: null,
      winners: [],
      finishedIds: new Set(),
      drawStackCount: 0,
      drawStackActive: false,
      hasDrawnCard: {}
    };

    socket.join(lobbyId);
    socket.emit('lobbyCreated', lobbies[lobbyId]);
    console.log(`Lobby creado: ${lobbyName} por ${username} (ID: ${lobbyId})`);
  });

  // Unirse a Lobby
  socket.on('joinLobby', ({ lobbyId, username, password }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return socket.emit('lobbyError', 'Lobby no encontrado.');
    if (lobby.status !== 'waiting') return socket.emit('lobbyError', 'La partida ya ha comenzado.');
    if (lobby.isPrivate && lobby.password !== password) return socket.emit('lobbyError', 'Contraseña incorrecta.');
    if (lobby.players.length >= 8) return socket.emit('lobbyError', 'El lobby está lleno.');
    if (lobby.players.some(p => p.socketId === socket.id)) return socket.emit('lobbyError', 'Ya estás en este lobby.');

    lobby.players.push({ id: socket.id, username, socketId: socket.id, hand: [] });
    socket.join(lobbyId);
    socket.emit('lobbyJoined', lobby);
    io.to(lobbyId).emit('lobbyUpdate', lobby);
    console.log(`Usuario ${username} (${socket.id}) se unió al lobby ${lobbyId}`);
  });

  // Listar Lobbies
  socket.on('listLobbies', () => {
    const publicLobbies = Object.values(lobbies)
      .filter(lobby => !lobby.isPrivate && lobby.status === 'waiting')
      .map(lobby => ({ id: lobby.id, name: lobby.name, playersCount: lobby.players.length, maxPlayers: 8 }));
    socket.emit('lobbiesList', publicLobbies);
  });

  // Iniciar Partida
  socket.on('startGame', ({ lobbyId }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby || lobby.hostId !== socket.id) return socket.emit('lobbyError', 'Solo el host puede iniciar la partida.');
    if (lobby.players.length < 2) return socket.emit('lobbyError', 'Se necesitan al menos 2 jugadores para iniciar.');

    lobby.status = 'in_game';
    lobby.drawPile = createDeck();
    shuffleDeck(lobby.drawPile);
    dealCards(lobby);

    // Primera carta debe ser Number
    let firstCard = null;
    do {
      firstCard = drawCardFromDeck(lobby);
      if (firstCard.type !== 'Number') {
        lobby.drawPile.unshift(firstCard);
        shuffleDeck(lobby.drawPile);
        firstCard = null;
      }
    } while (!firstCard);

    lobby.discardPile = [firstCard];
    lobby.currentActiveColor = firstCard.color;

    io.to(lobbyId).emit('gameStarted', { lobby, firstCard });
    lobby.players.forEach(player => io.to(player.socketId).emit('yourHand', player.hand));
    console.log(`Partida iniciada en el lobby ${lobbyId}`);
  });

  // Jugar una Carta
  socket.on('playCard', ({ lobbyId, cardIndex }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return socket.emit('lobbyError', 'Lobby no encontrado o partida terminada.');
    if (lobby.status !== 'in_game') return socket.emit('lobbyError', 'No estás en una partida activa.');
    if (lobby.finishedIds?.has(socket.id)) return;

    const currentPlayerIndex = lobby.currentTurnIndex;
    const currentPlayer = lobby.players[currentPlayerIndex];
    if (!currentPlayer || currentPlayer.socketId !== socket.id) return socket.emit('lobbyError', 'No es tu turno.');

    const cardToPlay = currentPlayer.hand[cardIndex];
    const topDiscardCard = lobby.discardPile[lobby.discardPile.length - 1];
    if (!cardToPlay) return socket.emit('lobbyError', 'Carta no válida o índice incorrecto.');

    if (!isValidPlay(cardToPlay, topDiscardCard, lobby.currentActiveColor, lobby.drawStackActive)) {
      if (lobby.drawStackActive) return socket.emit('lobbyError', 'Debes jugar una carta +2/+4 o robar las cartas acumuladas.');
      return socket.emit('lobbyError', 'No puedes jugar esa carta. Debe coincidir con el color o el número/acción.');
    }

    // mover carta
    currentPlayer.hand.splice(cardIndex, 1);
    lobby.discardPile.push(cardToPlay);
    if (lobby.hasDrawnCard[socket.id]) lobby.hasDrawnCard = {};

    let turnsToAdvance = 1;
    let action = 'play';

    // ¿ganó?
    if (currentPlayer.hand.length === 0) {
      const finished = awardWinner(io, lobbyId, lobby, currentPlayerIndex, cardToPlay, currentPlayer);
      if (finished) return;
      return;
    }

    // Acciones
    if (cardToPlay.value === 'Skip') {
      turnsToAdvance = 2;
      action = 'skip';
    } else if (cardToPlay.value === 'DrawTwo') {
      lobby.drawStackCount += 2;
      lobby.drawStackActive = true;
      turnsToAdvance = 1;
      action = 'drawTwo_played';
    } else if (cardToPlay.value === 'WildDrawFour') {
      lobby.drawStackCount += 4;
      lobby.drawStackActive = true;
      turnsToAdvance = 1;
      action = 'drawFour_played';
      io.to(socket.id).emit('promptColor', { lobbyId, playedCardIndex: lobby.discardPile.length - 1 });
      io.to(socket.id).emit('yourHand', currentPlayer.hand);
      return;
    } else if (cardToPlay.value === 'Reverse') {
      lobby.direction *= -1;
      action = 'reverse';
      turnsToAdvance = (lobby.players.length === 2) ? 0 : 1;
    } else if (cardToPlay.type === 'Wild') {
      io.to(socket.id).emit('promptColor', { lobbyId, playedCardIndex: lobby.discardPile.length - 1 });
      io.to(socket.id).emit('yourHand', currentPlayer.hand);
      return;
    }

    if (cardToPlay.color !== 'Wild') lobby.currentActiveColor = cardToPlay.color;

    advanceTurn(lobby, turnsToAdvance);

    io.to(lobbyId).emit('gameUpdate', {
      lobbyState: lobby,
      playedCard: cardToPlay,
      playerPlayed: currentPlayer.username,
      newTurnIndex: lobby.currentTurnIndex,
      action,
      currentPlayerName: lobby.players[lobby.currentTurnIndex]?.username || null,
      currentActiveColor: lobby.currentActiveColor
    });

    io.to(socket.id).emit('yourHand', currentPlayer.hand);
  });

  // Robar una Carta
  socket.on('drawCard', ({ lobbyId }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return socket.emit('lobbyError', 'Lobby no encontrado o partida terminada.');
    if (lobby.status !== 'in_game') return socket.emit('lobbyError', 'No estás en una partida activa.');
    if (lobby.players.length === 0) return socket.emit('lobbyError', 'No hay jugadores activos.');

    const currentPlayerIndex = lobby.currentTurnIndex;
    const currentPlayer = lobby.players[currentPlayerIndex] || lobby.players[0];
    if (!currentPlayer || currentPlayer.socketId !== socket.id) return socket.emit('lobbyError', 'Acción no válida. No es tu turno.');

    if (lobby.hasDrawnCard[socket.id]) return socket.emit('lobbyError', 'Solo puedes robar una carta por turno.');

    if (lobby.drawStackActive) {
      const cardsToDraw = lobby.drawStackCount;
      for (let i = 0; i < cardsToDraw; i++) currentPlayer.hand.push(drawCardFromDeck(lobby));
      lobby.drawStackCount = 0;
      lobby.drawStackActive = false;
      lobby.hasDrawnCard = {};
      advanceTurn(lobby, 1);

      io.to(lobbyId).emit('gameUpdate', {
        lobbyState: lobby,
        playerPlayed: currentPlayer.username,
        action: 'draw_penalty',
        cardsDrawn: cardsToDraw,
        newTurnIndex: lobby.currentTurnIndex,
        currentPlayerName: lobby.players[lobby.currentTurnIndex]?.username || null,
        currentActiveColor: lobby.currentActiveColor
      });
      io.to(socket.id).emit('yourHand', currentPlayer.hand);
      return;
    }

    const drawnCard = drawCardFromDeck(lobby);
    currentPlayer.hand.push(drawnCard);
    lobby.hasDrawnCard[socket.id] = true;

    io.to(socket.id).emit('yourHand', currentPlayer.hand);
    io.to(lobbyId).emit('gameUpdate', {
      lobbyState: lobby,
      playedCard: null,
      playerPlayed: currentPlayer.username,
      action: 'draw',
      newTurnIndex: lobby.currentTurnIndex,
      currentPlayerName: lobby.players[lobby.currentTurnIndex]?.username || null,
      currentActiveColor: lobby.currentActiveColor
    });
  });

  // Pasar Turno (con regla: solo si ya robó una carta en este turno)
  socket.on('passTurn', ({ lobbyId }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return socket.emit('lobbyError', 'Lobby no encontrado o partida terminada.');
    if (lobby.status !== 'in_game') return socket.emit('lobbyError', 'No estás en una partida activa.');

    const currentPlayerIndex = lobby.currentTurnIndex;
    const currentPlayer = lobby.players[currentPlayerIndex];
    if (!currentPlayer || currentPlayer.socketId !== socket.id) return socket.emit('lobbyError', 'Acción no válida. No es tu turno.');

    if (lobby.drawStackActive)
      return socket.emit('lobbyError', 'No puedes pasar turno con penalización activa. Debes jugar +2/+4 o robar las cartas.');

    if (!lobby.hasDrawnCard[socket.id])
      return socket.emit('lobbyError', 'Debes jugar una carta o robar una antes de pasar el turno.');

    advanceTurn(lobby, 1);

    io.to(lobbyId).emit('gameUpdate', {
      lobbyState: lobby,
      playedCard: null,
      playerPlayed: currentPlayer.username,
      action: 'pass',
      newTurnIndex: lobby.currentTurnIndex,
      currentPlayerName: lobby.players[lobby.currentTurnIndex]?.username || null,
      currentActiveColor: lobby.currentActiveColor
    });
  });

  // Elegir Color para Carta WILD
  socket.on('chooseColor', ({ lobbyId, color, cardIndex }) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    if (lobby.status !== 'in_game') return;

    const currentPlayer = lobby.players[lobby.currentTurnIndex];
    if (!currentPlayer || currentPlayer.socketId !== socket.id) return socket.emit('lobbyError', 'No es tu turno.');

    lobby.currentActiveColor = color;
    advanceTurn(lobby, 1);

    io.to(lobbyId).emit('gameUpdate', {
      lobbyState: lobby,
      playedCard: lobby.discardPile[cardIndex],
      playerPlayed: currentPlayer.username,
      newTurnIndex: lobby.currentTurnIndex,
      action: 'color_chosen',
      currentPlayerName: lobby.players[lobby.currentTurnIndex]?.username || null,
      currentActiveColor: lobby.currentActiveColor
    });
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);

    for (const lobbyId in lobbies) {
      const lobby = lobbies[lobbyId];
      const playerIndex = lobby.players.findIndex(p => p.socketId === socket.id);

      if (playerIndex !== -1) {
        lobby.players.splice(playerIndex, 1);
        console.log(`Usuario ${socket.id} abandonó el lobby ${lobbyId}. Jugadores restantes: ${lobby.players.length}`);

        if (lobby.players.length === 0) {
          delete lobbies[lobbyId];
          console.log(`Lobby ${lobbyId} eliminado.`);
          return;
        }

        if (lobby.hostId === socket.id && lobby.players.length > 0) {
          lobby.hostId = lobby.players[0].socketId;
          console.log(`Nuevo host del lobby ${lobbyId} es ${lobby.players[0].username}`);
        }

        if (lobby.status === 'in_game') {
          if (lobby.currentTurnIndex >= lobby.players.length) lobby.currentTurnIndex = 0;

          // AUTO-ASIGNAR 3er puesto si la partida era de 3 y queda 1 jugador activo
          if (lobby.winners.length === 2 && lobby.players.length === 1) {
            const last = lobby.players[0];
            if (last && !lobby.finishedIds.has(last.socketId)) {
              lobby.winners.push({ username: last.username, socketId: last.socketId, rank: 3 });
              lobby.finishedIds.add(last.socketId);
              lobby.players.splice(0, 1);
              io.to(lobbyId).emit('winnerFound', { username: last.username, rank: 3, lobbyState: lobby });
            }
            endGame(io, lobbyId, lobby);
            return; // este lobby ya cerró
          }

          io.to(lobbyId).emit('gameUpdate', {
            lobbyState: lobby,
            action: 'player_disconnected',
            playerPlayed: null,
            newTurnIndex: lobby.currentTurnIndex,
            currentPlayerName: lobby.players[lobby.currentTurnIndex]?.username || null,
            currentActiveColor: lobby.currentActiveColor
          });
        }

        io.to(lobbyId).emit('lobbyUpdate', lobby);
      }
    }
  });
});

// Iniciar el servidor
server.listen(3000, () => {
  console.log('Servidor escuchando en http://localhost:3000');
});
