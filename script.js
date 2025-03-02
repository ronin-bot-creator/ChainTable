const socket = io('http://localhost:3000');
let currentUser = '';
let playerHand = [];
let turnCount = 0;
let playerStats = [];

function startGame() {
  const username = document.getElementById('username').value;
  if (username) {
    currentUser = username;
    document.getElementById('login').style.display = 'none';
    document.getElementById('game-list').style.display = 'block';
  }
}

function joinGame(game) {
  document.getElementById('game-list').style.display = 'none';
  document.getElementById('game-room').style.display = 'block';
  socket.emit('join', { room: 'uno-room', user: currentUser });
}

function updateHand() {
  const cardsDiv = document.getElementById('cards');
  cardsDiv.innerHTML = `<div class="hand-container">Jugador: ${currentUser} | Turno #${turnCount}<br>`;
  if (playerHand.length > 0) {
    playerHand.forEach(card => {
      const [color, value] = card.split(' ');
      const cardColor = getCardColor(color);
      cardsDiv.innerHTML += `<p class="card" style="color: ${cardColor}">${card} <button onclick="playCard('${card}')">Jugar</button></p>`;
    });
  } else {
    cardsDiv.innerHTML += `<p>No tienes cartas.</p>`;
  }
  cardsDiv.innerHTML += '</div>';
  // Botón "Robar carta" fuera del contenedor, a la izquierda
  const drawButton = `<button onclick="drawCard()" class="draw-button">Robar carta</button>`;
  cardsDiv.insertAdjacentHTML('beforebegin', drawButton);

  // Mostrar estadísticas de jugadores
  updatePlayerList();
}

function updatePlayerList() {
  const playerListDiv = document.getElementById('player-list');
  if (playerListDiv) {
    playerListDiv.innerHTML = '<h3>Jugadores en la partida:</h3>';
    playerStats.forEach(stat => {
      const isCurrent = stat.user === currentUser;
      const cardCount = isCurrent ? playerHand.length : stat.cardCount;
      playerListDiv.innerHTML += `
        <div class="player-stat">
          <span class="silhouette">👤</span>
          <span class="player-name">${stat.user}</span>
          <span class="card-count">Cartas: ${cardCount}</span>
        </div>
      `;
    });
  }
}

function playCard(card) {
  socket.emit('playCard', { user: currentUser, card: card });
}

function skipTurn() {
  socket.emit('skipTurn', { user: currentUser });
}

function drawCard() {
  socket.emit('drawCard', { user: currentUser });
}

function chooseColor() {
  const color = prompt('Elige un color (Rojo, Azul, Verde, Amarillo):');
  if (color && ['Rojo', 'Azul', 'Verde', 'Amarillo'].includes(color)) {
    socket.emit('chooseColor', { user: currentUser, color: color });
  } else {
    alert('Color inválido. Elige entre Rojo, Azul, Verde o Amarillo.');
    chooseColor();
  }
}

function getCardColor(color) {
  switch (color) {
    case 'Rojo': return '#ff0000';
    case 'Azul': return '#0000ff';
    case 'Verde': return '#00ff00';
    case 'Amarillo': return '#ffff00';
    default: return '#ffffff';
  }
}

socket.on('yourHand', (hand) => {
  playerHand = hand;
  updateHand();
  console.log(`Mano actual de ${currentUser}: ${playerHand.join(', ')}`);
});

socket.on('message', (msg) => {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML += `<p>${msg}</p>`;
});

socket.on('playerList', (players) => {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML += `<p>Jugadores en la partida: ${players.join(', ')}</p>`;
});

socket.on('turn', (data) => {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML += `<p>Turno de: ${data.user}</p>`;
});

socket.on('gameState', (data) => {
  const discardDiv = document.getElementById('discard');
  const [color, value] = (data.discardTop || '').split(' ');
  const cardColor = getCardColor(color);
  discardDiv.innerHTML = `Carta en la mesa: <span style="color: ${cardColor}">${data.discardTop || 'No hay carta inicial'}</span>`;
  turnCount = data.turnCount;
  updateHand();
});

socket.on('updatePlayerStats', (stats) => {
  playerStats = stats;
  updatePlayerList();
});

socket.on('chooseColor', () => {
  chooseColor();
});

socket.on('gameOver', (data) => {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML += `<p>¡Juego terminado! Ganador: ${data.winner}</p>`;
  document.getElementById('game-room').style.display = 'none';
  document.getElementById('login').style.display = 'block';
});