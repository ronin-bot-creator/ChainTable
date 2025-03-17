const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "../public")));
app.use("/src", express.static(path.join(__dirname, "../src")));

// Rutas para diferentes páginas
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/home.html"));
});

app.get("/lobby", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/lobby.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Ruta por defecto: redirige a /login
app.get("/", (req, res) => {
  res.redirect("/login");
});

const colors = ["red", "blue", "green", "yellow"];
const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+2", "skip", "reverse"];
const wilds = ["wild", "wild+4"];

function createDeck() {
  let deck = [];
  for (let color of colors) {
    for (let value of values) {
      deck.push({ color, value });
      if (value !== "0") deck.push({ color, value });
    }
  }
  for (let wild of wilds) {
    for (let i = 0; i < 4; i++) {
      deck.push({ color: null, value: wild });
    }
  }
  if (deck.length !== 108) {
    console.error("Error al crear el mazo: se esperaban 108 cartas, pero se crearon", deck.length);
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

let gameState = {
  deck: shuffle(createDeck()),
  discardPile: [],
  players: [],
  currentPlayerIndex: 0,
  direction: 1,
  currentColor: null,
  started: false,
  pendingDraw: { active: false, count: 0, targetIndex: null, type: null },
  hasDrawn: false
};

function dealCardsToPlayer(player) {
  player.hand = [];
  console.log(`Repartiendo cartas a ${player.username}... Mazo inicial: ${gameState.deck.length} cartas`);

  if (gameState.deck.length < 7) {
    console.log(`Mazo insuficiente (${gameState.deck.length} cartas) para repartir 7 cartas a ${player.username}. Reiniciando mazo...`);
    gameState.deck = shuffle(createDeck());
  }

  for (let i = 0; i < 7; i++) {
    const card = gameState.deck.pop();
    if (card) {
      player.hand.push(card);
    } else {
      console.error(`Error al repartir carta ${i + 1} a ${player.username}: carta indefinida. Reiniciando mazo...`);
      gameState.deck = shuffle(createDeck());
      const newCard = gameState.deck.pop();
      if (newCard) {
        player.hand.push(newCard);
      } else {
        console.error(`No se pudo obtener una carta después de reiniciar el mazo para ${player.username}`);
        return false;
      }
    }
  }

  console.log(`${player.username} recibió ${player.hand.length} cartas`);
  return true;
}

function startGame() {
  if (gameState.started) {
    return;
  }
  if (gameState.players.length < 2) {
    return;
  }

  console.log(`Iniciando juego con ${gameState.players.length} jugadores. Mazo inicial: ${gameState.deck.length} cartas`);

  const requiredCards = gameState.players.length * 7 + 1;
  if (gameState.deck.length < requiredCards) {
    console.log(`Mazo insuficiente (${gameState.deck.length} cartas) para repartir ${requiredCards} cartas. Reiniciando mazo...`);
    gameState.deck = shuffle(createDeck());
  }

  for (let player of gameState.players) {
    if (!dealCardsToPlayer(player)) {
      console.error("No se pudieron repartir cartas a", player.username);
      return;
    }
  }

  if (gameState.deck.length === 0) {
    console.log("Mazo agotado después de repartir. Reiniciando mazo...");
    gameState.deck = shuffle(createDeck());
  }

  let firstCard = gameState.deck.pop();
  if (!firstCard) {
    console.error("No se pudo obtener una carta inicial válida");
    return;
  }

  while (firstCard.value === "wild" || firstCard.value === "wild+4") {
    gameState.deck.push(firstCard);
    shuffle(gameState.deck);
    if (gameState.deck.length === 0) {
      console.log("Mazo agotado al buscar carta inicial. Reiniciando mazo...");
      gameState.deck = shuffle(createDeck());
    }
    firstCard = gameState.deck.pop();
    if (!firstCard) {
      console.error("No se pudo obtener una carta inicial válida después de barajar");
      return;
    }
  }

  gameState.discardPile = [firstCard];
  gameState.currentColor = firstCard.color || colors[0];
  gameState.started = true;
  console.log(`Juego iniciado. Mazo restante: ${gameState.deck.length} cartas`);
  broadcastGameState();
}

function drawCards(playerId, count) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return;
  }
  for (let i = 0; i < count && gameState.deck.length > 0; i++) {
    player.hand.push(gameState.deck.pop());
  }
  if (gameState.deck.length === 0 && gameState.discardPile.length > 1) {
    const topCard = gameState.discardPile.pop();
    gameState.deck = shuffle([...gameState.discardPile]);
    gameState.discardPile = [topCard];
  }
}

function isCardPlayable(card, topCard, currentColor) {
  return (
    card.color === currentColor ||
    card.value === topCard.value ||
    card.value === "wild" ||
    card.value === "wild+4"
  );
}

function canCounter(card, pendingType) {
  return (pendingType === "+2" && card.value === "+2") || (pendingType === "wild+4" && card.value === "wild+4");
}

function resetGameState() {
  gameState = {
    deck: shuffle(createDeck()),
    discardPile: [],
    players: [],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: null,
    started: false,
    pendingDraw: { active: false, count: 0, targetIndex: null, type: null },
    hasDrawn: false
  };
  console.log("Estado del juego reiniciado. Mazo inicial: ", gameState.deck.length, " cartas");
}

io.on("connection", (socket) => {
  socket.on("join", (username) => {
    if (!username || typeof username !== "string" || username.trim() === "") {
      console.error("Nombre de usuario inválido:", username);
      return;
    }

    gameState.players = gameState.players.filter(p => p.id !== socket.id);

    const newPlayer = { id: socket.id, username: username.trim(), hand: [] };
    gameState.players.push(newPlayer);

    if (gameState.started) {
      if (!dealCardsToPlayer(newPlayer)) {
        console.error("No se pudieron repartir cartas al nuevo jugador", newPlayer.username);
        gameState.players = gameState.players.filter(p => p.id !== socket.id);
        return;
      }
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    }

    io.emit("playerList", gameState.players.map(p => ({ id: p.id, username: p.username })));
    socket.emit("gameState", { ...gameState, isCurrentPlayer: gameState.players[gameState.currentPlayerIndex]?.id === socket.id });
    broadcastGameState();
  });

  socket.on("startGame", () => {
    if (gameState.players.length >= 2 && !gameState.started) {
      console.log("Iniciando juego a solicitud del usuario...");
      startGame();
      io.emit("gameStarted"); // Notificar a los clientes que el juego ha comenzado
    }
  });

  socket.on("grabCard", () => {
    if (gameState.players[gameState.currentPlayerIndex].id !== socket.id) {
      return;
    }
    if (gameState.pendingDraw.active) {
      return;
    }
    drawCards(socket.id, 1);
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + gameState.direction) % gameState.players.length;
    if (gameState.currentPlayerIndex < 0) gameState.currentPlayerIndex = gameState.players.length - 1;
    io.emit("turnChange");
    broadcastGameState();
    checkWinCondition(gameState.players[gameState.currentPlayerIndex - (gameState.direction === -1 ? 1 : 0)]);
  });

  socket.on("playCard", ({ index, colorChoice }) => {
    const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      return;
    }

    const player = gameState.players[playerIndex];
    const card = player.hand[index];
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    if (gameState.pendingDraw.active && !canCounter(card, gameState.pendingDraw.type)) {
      return;
    }
    if (!gameState.pendingDraw.active && !isCardPlayable(card, topCard, gameState.currentColor)) {
      return;
    }

    gameState.discardPile.push(player.hand.splice(index, 1)[0]);
    let nextPlayerIndex = (gameState.currentPlayerIndex + gameState.direction) % gameState.players.length;
    if (nextPlayerIndex < 0) nextPlayerIndex = gameState.players.length - 1;

    if (card.color) {
      gameState.currentColor = card.color;
    }

    if (gameState.pendingDraw.active && canCounter(card, gameState.pendingDraw.type)) {
      gameState.pendingDraw.count += (card.value === "+2" ? 2 : 4);
      gameState.pendingDraw.targetIndex = (gameState.pendingDraw.targetIndex + gameState.direction * -1) % gameState.players.length;
      if (gameState.pendingDraw.targetIndex < 0) gameState.pendingDraw.targetIndex = gameState.players.length - 1;
      if (card.value === "wild+4" && colors.includes(colorChoice)) gameState.currentColor = colorChoice;
      gameState.currentPlayerIndex = nextPlayerIndex;
      gameState.hasDrawn = false;
    } else {
      switch (card.value) {
        case "reverse":
          gameState.direction *= -1;
          if (gameState.players.length === 2) {
            nextPlayerIndex = gameState.currentPlayerIndex;
          } else {
            nextPlayerIndex = (gameState.currentPlayerIndex + gameState.direction) % gameState.players.length;
            if (nextPlayerIndex < 0) nextPlayerIndex = gameState.players.length - 1;
          }
          break;
        case "skip":
          nextPlayerIndex = (nextPlayerIndex + gameState.direction) % gameState.players.length;
          if (nextPlayerIndex < 0) nextPlayerIndex = gameState.players.length - 1;
          break;
        case "+2":
          gameState.pendingDraw = { active: true, count: 2, targetIndex: nextPlayerIndex, type: "+2" };
          break;
        case "wild":
          if (!colors.includes(colorChoice)) {
            return;
          }
          gameState.currentColor = colorChoice;
          break;
        case "wild+4":
          if (!colors.includes(colorChoice)) {
            return;
          }
          gameState.currentColor = colorChoice;
          gameState.pendingDraw = { active: true, count: 4, targetIndex: nextPlayerIndex, type: "wild+4" };
          break;
        default:
          if (card.color) gameState.currentColor = card.color;
          break;
      }
      gameState.currentPlayerIndex = nextPlayerIndex;
      gameState.hasDrawn = false;
    }

    io.emit("turnChange");
    broadcastGameState();
    checkWinCondition(player);
  });

  socket.on("passTurn", () => {
    if (gameState.players[gameState.currentPlayerIndex].id !== socket.id) {
      return;
    }
    if (gameState.pendingDraw.active) {
      drawCards(gameState.players[gameState.pendingDraw.targetIndex].id, gameState.pendingDraw.count);
      gameState.pendingDraw = { active: false, count: 0, targetIndex: null, type: null };
    }
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + gameState.direction) % gameState.players.length;
    if (gameState.currentPlayerIndex < 0) gameState.currentPlayerIndex = gameState.players.length - 1;
    gameState.hasDrawn = false;
    io.emit("turnChange");
    broadcastGameState();
  });

  socket.on("disconnect", () => {
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    io.emit("playerList", gameState.players.map(p => ({ id: p.id, username: p.username })));
    if (gameState.players.length < 2) {
      resetGameState();
    }
    broadcastGameState();
  });

  socket.on("requestGameState", () => {
    socket.emit("gameState", { ...gameState, isCurrentPlayer: gameState.players[gameState.currentPlayerIndex]?.id === socket.id });
  });

  function checkWinCondition(player) {
    if (player.hand.length === 0) {
      io.emit("gameWon", { winner: player.username });
      resetGameState();
    }
  }
});

function broadcastGameState() {
  gameState.players.forEach(p => {
    io.to(p.id).emit("gameState", { ...gameState, isCurrentPlayer: p.id === gameState.players[gameState.currentPlayerIndex]?.id });
  });
}

server.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});