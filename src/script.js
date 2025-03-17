import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

const socket = io("http://localhost:3000");

document.addEventListener("DOMContentLoaded", () => {
  const loginSection = document.getElementById("login");
  const lobbySection = document.getElementById("lobby");
  const gameRoomSection = document.getElementById("game-room");
  const enterButton = document.getElementById("enter-btn");
  const usernameInput = document.getElementById("username");
  const startGameButton = document.getElementById("start-game");
  const discardDiv = document.getElementById("discard");
  const cardsDiv = document.getElementById("cards");
  const playerListDiv = document.getElementById("player-list");
  const grabButton = document.getElementById("grab-button");
  const passTurnButton = document.getElementById("pass-turn");
  const currentTurnDisplay = document.getElementById("current-turn-display");

  let hasGrabbedCard = false;
  let currentUsername = "";

  // Detectar la página actual y mostrar la sección correspondiente
  function showSection() {
    const path = window.location.pathname;
    loginSection.style.display = path === "/login" ? "block" : "none";
    lobbySection.style.display = path === "/lobby" ? "block" : "none";
    gameRoomSection.style.display = path === "/game" ? "block" : "none";

    if (path === "/login" || path === "/lobby") {
      grabButton.style.display = "none";
      passTurnButton.style.display = "none";
    }
  }

  // Llamar a showSection al cargar la página
  showSection();

  // Evento para el botón "Entrar" en /login
  enterButton?.addEventListener("click", () => {
    currentUsername = usernameInput?.value.trim();
    if (currentUsername) {
      socket.emit("join", currentUsername);
      window.location.href = "/lobby"; // Redirigir a /lobby después de unirse
    } else {
      alert("Por favor, ingresa un nombre de usuario");
    }
  });

  // Manejo de la lista de jugadores y el botón "Iniciar Partida" en /lobby
  socket.on("playerList", (players) => {
    if (window.location.pathname === "/lobby") {
      playerListDiv.innerHTML = `<h3>Usuarios conectados</h3>` + players.map(p => `<div>${p.username}</div>`).join("");
      // Habilitar/deshabilitar el botón de iniciar partida
      startGameButton.disabled = players.length < 2;
      startGameButton.textContent = players.length < 2 ? "Iniciar Partida (Necesitas al menos 2 jugadores)" : "Iniciar Partida";
    } else if (window.location.pathname === "/game") {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      playerListDiv.innerHTML = `<h3>Usuarios</h3>` + players.map(p => {
        const isCurrentPlayer = p.username === currentPlayer?.username;
        return `<div class="${isCurrentPlayer ? 'current-player' : ''}">${p.username}</div>`;
      }).join("");
    }
  });

  // Evento para el botón "Iniciar Partida" en /lobby
  startGameButton?.addEventListener("click", () => {
    socket.emit("startGame");
  });

  // Redirigir a /game cuando el juego inicia
  socket.on("gameStarted", () => {
    window.location.href = "/game";
  });

  // Manejo del estado del juego en /game
  socket.on("gameState", (state) => {
    if (window.location.pathname !== "/game" || !state || !state.started) {
      return;
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    currentTurnDisplay.textContent = currentPlayer ? `Turno de: ${currentPlayer.username}` : "Esperando jugadores...";

    const players = state.players.map(p => ({
      id: p.id,
      username: p.username
    }));
    playerListDiv.innerHTML = `<h3>Usuarios</h3>` + players.map(p => {
      const isCurrentPlayer = p.username === currentPlayer?.username;
      return `<div class="${isCurrentPlayer ? 'current-player' : ''}">${p.username}</div>`;
    }).join("");

    const discard = state.discardPile[state.discardPile.length - 1];
    if (discard) {
      const discardColor = discard.color || "black";
      const discardTextColor = discard.color ? "black" : "white";
      const discardColorText = discard.color ? capitalize(discard.color) : "";
      const discardValueText = capitalize(discard.value);
      discardDiv.innerHTML = `<div class="discard ${discardColor}" style="color: ${discardTextColor}">Color actual: ${capitalize(state.currentColor || "black")}<br>${discardColorText} ${discardValueText}</div>`;
    } else {
      discardDiv.innerHTML = '<div class="discard">Sin carta inicial</div>';
    }

    grabButton.textContent = `Agarrar Carta (${state.deck.length} restantes)`;
    grabButton.onclick = () => {
      if (state.isCurrentPlayer && !state.pendingDraw.active && !hasGrabbedCard) {
        socket.emit("grabCard");
        hasGrabbedCard = true;
      }
    };

    const player = state.players.find(p => p.id === socket.id);
    cardsDiv.innerHTML = "";
    if (player && player.hand && Array.isArray(player.hand) && player.hand.length > 0) {
      console.log(`${currentUsername} tiene ${player.hand.length} cartas al inicio del juego`);
      let handHtml = "<div class='hand'>";
      player.hand.forEach((card, index) => {
        if (!card || !card.color || !card.value) {
          return;
        }
        const cardColor = card.color || "black";
        const textColor = card.color ? "black" : "white";
        const colorText = card.color ? capitalize(card.color) : "";
        const valueText = capitalize(card.value);
        handHtml += `<div class="card ${cardColor}" data-index="${index}" style="color: ${textColor}">${colorText} ${valueText}</div>`;
      });
      handHtml += "</div>";
      cardsDiv.innerHTML = handHtml;

      document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", () => {
          if (!state.isCurrentPlayer) {
            return;
          }
          const index = parseInt(card.dataset.index);
          let colorChoice = null;
          if (player.hand[index].value === "wild" || player.hand[index].value === "wild+4") {
            colorChoice = prompt("Elige un color (red, blue, green, yellow):").toLowerCase();
            if (!["red", "blue", "green", "yellow"].includes(colorChoice)) {
              alert("Color inválido");
              return;
            }
          }
          socket.emit("playCard", { index, colorChoice });
          hasGrabbedCard = false;
        });
      });
    } else {
      cardsDiv.innerHTML = "<p>No tienes cartas o no estás en el juego.</p>";
    }

    if (state.pendingDraw.active && state.players[state.currentPlayerIndex].id === socket.id) {
      cardsDiv.innerHTML += `<p>¡Debes contrarrestar con un ${state.pendingDraw.type} o robar ${state.pendingDraw.count} cartas!</p>`;
    }

    cardsDiv.style.pointerEvents = state.isCurrentPlayer ? "auto" : "none";
    grabButton.style.display = state.isCurrentPlayer && !state.pendingDraw.active && !hasGrabbedCard ? "block" : "none";
    passTurnButton.style.display = state.isCurrentPlayer ? "block" : "none";
    passTurnButton.onclick = () => {
      if (state.isCurrentPlayer) {
        socket.emit("passTurn");
        hasGrabbedCard = false;
      }
    };
  });

  socket.on("turnChange", () => {
    hasGrabbedCard = false;
  });

  socket.on("gameWon", (data) => {
    if (data.winner === currentUsername) {
      alert("Felicitaciones, has ganado!");
    } else {
      alert(`${data.winner} ha ganado!`);
    }
    document.getElementById("game-room").style.display = "none";
    document.getElementById("grab-button").style.display = "none";
    document.getElementById("pass-turn").style.display = "none";
    window.location.href = "/lobby"; // Redirigir a /lobby después de ganar
  });
});

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}