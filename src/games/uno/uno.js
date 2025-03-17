// Definir el mazo inicial
const colors = ["red", "blue", "green", "yellow"];
const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+2", "skip", "reverse"];
const wilds = ["wild", "wild+4"];

function createDeck() {
  let deck = [];
  for (let color of colors) {
    for (let value of values) {
      deck.push({ color, value });
      if (value !== "0") deck.push({ color, value }); // Dos copias excepto el 0
    }
  }
  for (let wild of wilds) {
    for (let i = 0; i < 4; i++) {
      deck.push({ color: null, value: wild });
    }
  }
  return deck;
}

// Barajar el mazo
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Estado del juego (solo se inicializa una vez)
let gameState = {
  deck: shuffle(createDeck()),
  discardPile: [],
  players: [{ id: 1, hand: [] }, { id: 2, hand: [] }],
  currentPlayer: 0,
  direction: 1,
  currentColor: null
};

// Repartir cartas
function dealCards() {
  for (let player of gameState.players) {
    for (let i = 0; i < 7; i++) {
      player.hand.push(gameState.deck.pop());
    }
  }
  gameState.discardPile.push(gameState.deck.pop());
  gameState.currentColor = gameState.discardPile[0].color;
}

// Función para robar cartas
function drawCards(playerIndex, count) {
  for (let i = 0; i < count && gameState.deck.length > 0; i++) {
    gameState.players[playerIndex].hand.push(gameState.deck.pop());
  }
}

export function init() {
  console.log("Iniciando UNO...");
  dealCards();
  console.log("Mano inicial del jugador 1:", gameState.players[0].hand);
  console.log("Mano inicial del jugador 2:", gameState.players[1].hand);
  renderGame();
}

function renderGame() {
  const discardDiv = document.getElementById("discard");
  const cardsDiv = document.getElementById("cards");
  if (!discardDiv || !cardsDiv) {
    console.error("Elementos del DOM no encontrados");
    return;
  }

  // Mostrar pila de descarte
  const discard = gameState.discardPile[gameState.discardPile.length - 1];
  const discardColor = discard.color || "black";
  const discardTextColor = discard.color ? "black" : "white";
  const discardColorText = discard.color ? capitalize(discard.color) : "";
  const discardValueText = capitalize(discard.value);
  discardDiv.innerHTML = `<div class="discard" style="background-color: ${discardColor}; color: ${discardTextColor}">Color actual: ${capitalize(gameState.currentColor)}<br>${discardColorText} ${discardValueText}</div>`;

  // Mostrar mano del jugador actual
  const currentPlayer = gameState.players[gameState.currentPlayer];
  console.log(`Mano del jugador ${gameState.currentPlayer + 1} antes de renderizar:`, currentPlayer.hand); // Depuración
  let handHtml = "<div class='hand'>";
  currentPlayer.hand.forEach((card, index) => {
    const cardColor = card.color || "black";
    const textColor = card.color ? "black" : "white";
    const colorText = card.color ? capitalize(card.color) : "";
    const valueText = capitalize(card.value);
    handHtml += `<div class="card" data-index="${index}" style="background-color: ${cardColor}; color: ${textColor}">${colorText} ${valueText}</div>`;
  });
  handHtml += "</div>";
  cardsDiv.innerHTML = handHtml;

  // Añadir interacción
  document.querySelectorAll(".card").forEach(card => {
    card.removeEventListener("click", playCard); // Evitar eventos duplicados
    card.addEventListener("click", () => playCard(parseInt(card.dataset.index)));
  });
}

// Función para poner la primera letra en mayúscula
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Jugar una carta
function playCard(index) {
  const player = gameState.players[gameState.currentPlayer];
  const card = player.hand[index];
  const topDiscard = gameState.discardPile[gameState.discardPile.length - 1];

  if (
    card.color === gameState.currentColor ||
    card.value === topDiscard.value ||
    !card.color
  ) {
    gameState.discardPile.push(player.hand.splice(index, 1)[0]);
    let nextPlayer = (gameState.currentPlayer + gameState.direction) % gameState.players.length;
    if (nextPlayer < 0) nextPlayer = gameState.players.length - 1;

    switch (card.value) {
      case "reverse":
        gameState.direction *= -1;
        break;
      case "skip":
        nextPlayer = (nextPlayer + gameState.direction) % gameState.players.length;
        if (nextPlayer < 0) nextPlayer = gameState.players.length - 1;
        break;
      case "+2":
        drawCards(nextPlayer, 2);
        nextPlayer = (nextPlayer + gameState.direction) % gameState.players.length;
        if (nextPlayer < 0) nextPlayer = gameState.players.length - 1;
        break;
      case "wild":
        gameState.currentColor = prompt("Elige un color (red, blue, green, yellow):").toLowerCase();
        while (!colors.includes(gameState.currentColor)) {
          gameState.currentColor = prompt("Color inválido. Elige: red, blue, green, yellow:").toLowerCase();
        }
        break;
      case "wild+4":
        gameState.currentColor = prompt("Elige un color (red, blue, green, yellow):").toLowerCase();
        while (!colors.includes(gameState.currentColor)) {
          gameState.currentColor = prompt("Color inválido. Elige: red, blue, green, yellow:").toLowerCase();
        }
        drawCards(nextPlayer, 4);
        nextPlayer = (nextPlayer + gameState.direction) % gameState.players.length;
        if (nextPlayer < 0) nextPlayer = gameState.players.length - 1;
        break;
      default:
        if (card.color) gameState.currentColor = card.color;
        break;
    }

    gameState.currentPlayer = nextPlayer;
    renderGame();
  } else {
    alert("¡Movimiento inválido!");
  }
}

export function getState() {
  return gameState;
}