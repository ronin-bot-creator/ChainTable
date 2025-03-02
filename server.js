const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('.'));

let players = [];
let currentTurn = 0;
let deck = [];
let discardPile = [];
let direction = 1; // 1 para normal, -1 para reversa
let turnCount = 0;

const colors = ['Rojo', 'Azul', 'Verde', 'Amarillo'];
const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const specials = ['+2', 'Reversa', 'Salto'];

function initializeDeck() {
  deck = [];
  for (let color of colors) {
    for (let num of numbers) {
      deck.push(`${color} ${num}`);
      if (num !== 0) deck.push(`${color} ${num}`);
    }
    for (let special of specials) {
      deck.push(`${color} ${special}`);
      deck.push(`${color} ${special}`);
    }
  }
  deck.push('Comodín', 'Comodín', 'Comodín +4', 'Comodín +4');
  shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function isValidPlay(card, currentCard) {
  if (!currentCard) return true;
  const [cardColor, cardValue] = card.split(' ');
  const [currentColor, currentValue] = currentCard.split(' ');
  if (card.includes('Comodín')) return true;
  if (cardColor === currentColor) return true;
  if (cardValue === currentValue) return true;
  return false;
}

function hasValidCard(playerHand, currentCard) {
  return playerHand.some(card => isValidPlay(card, currentCard));
}

io.on('connection', (socket) => {
  console.log('Un jugador se conectó');

  if (players.length === 0) {
    initializeDeck();
    let firstCard = deck.pop();
    while (firstCard.includes('Comodín')) {
      deck.push(firstCard);
      shuffle(deck);
      firstCard = deck.pop();
    }
    discardPile = [firstCard];
  }

  socket.on('join', (data) => {
    socket.join(data.room);
    const player = { id: socket.id, user: data.user, hand: [] };
    for (let i = 0; i < 7; i++) {
      if (deck.length > 0) player.hand.push(deck.pop());
    }
    players.push(player);
    io.to(data.room).emit('message', `${data.user} se unió`);
    io.to(data.room).emit('playerList', players.map(p => p.user));
    io.to(data.room).emit('gameState', { discardTop: discardPile[discardPile.length - 1], players, turnCount });
    io.to(data.room).emit('updatePlayerStats', players.map(p => ({ user: p.user, cardCount: p.hand.length })));
    socket.emit('yourHand', player.hand);
    if (players.length === 1) {
      io.to(data.room).emit('turn', { user: players[0].user });
    }
  });

  socket.on('playCard', (data) => {
    const player = players.find(p => p.user === data.user);
    const cardIndex = player.hand.indexOf(data.card);
    const currentCard = discardPile[discardPile.length - 1];
    if (cardIndex !== -1 && players[currentTurn].user === data.user && isValidPlay(data.card, currentCard)) {
      player.hand.splice(cardIndex, 1);
      discardPile.push(data.card);
      io.to('uno-room').emit('message', `${data.user} jugó ${data.card}`);

      if (data.card.includes('+2')) {
        const nextPlayerIndex = (currentTurn + direction + players.length) % players.length;
        const nextPlayer = players[nextPlayerIndex];
        const drawnCards = [];
        for (let i = 0; i < 2 && deck.length > 0; i++) {
          const card = deck.pop();
          nextPlayer.hand.push(card);
          drawnCards.push(card);
        }
        console.log(`Añadiendo al jugador ${nextPlayer.user}: ${drawnCards.join(', ')} (cartas +2)`);
        io.to('uno-room').emit('message', `${nextPlayer.user} roba 2 cartas (${drawnCards.join(', ')}) y pierde su turno`);
        io.to(nextPlayer.id).emit('yourHand', nextPlayer.hand);
        currentTurn = nextPlayerIndex;
      } else if (data.card.includes('Reversa')) {
        direction *= -1;
        if (players.length > 2) {
          currentTurn = (currentTurn + direction) % players.length;
        } else {
          currentTurn = (currentTurn + direction + players.length) % players.length;
        }
        io.to('uno-room').emit('message', 'La dirección de los turnos se invirtió');
      } else if (data.card.includes('Salto')) {
        currentTurn = (currentTurn + direction + players.length) % players.length;
        const skippedPlayer = players[(currentTurn - direction + players.length) % players.length];
        io.to('uno-room').emit('message', `El turno de ${skippedPlayer.user} fue saltado`);
      } else if (data.card.includes('Comodín')) {
        io.to('uno-room').emit('message', `${data.user} jugó un Comodín - debe elegir un color`);
        socket.emit('chooseColor', player.user);
      } else if (data.card.includes('+4')) {
        const nextPlayerIndex = (currentTurn + direction + players.length) % players.length;
        const nextPlayer = players[nextPlayerIndex];
        const drawnCards = [];
        for (let i = 0; i < 4 && deck.length > 0; i++) {
          const card = deck.pop();
          nextPlayer.hand.push(card);
          drawnCards.push(card);
        }
        console.log(`Añadiendo al jugador ${nextPlayer.user}: ${drawnCards.join(', ')} (cartas +4)`);
        io.to('uno-room').emit('message', `${nextPlayer.user} roba 4 cartas (${drawnCards.join(', ')}) y pierde su turno`);
        io.to('uno-room').emit('message', `${data.user} jugó un +4 - debe elegir un color`);
        io.to(nextPlayer.id).emit('yourHand', nextPlayer.hand);
        currentTurn = nextPlayerIndex;
        socket.emit('chooseColor', player.user);
      }

      if (player.hand.length === 1) {
        io.to('uno-room').emit('message', `${player.user} tiene UNA carta!`);
      }

      if (player.hand.length === 0) {
        io.to('uno-room').emit('message', `${player.user} ¡GANÓ el juego!`);
        io.to('uno-room').emit('gameOver', { winner: player.user });
        players = [];
        deck = [];
        discardPile = [];
        currentTurn = 0;
        direction = 1;
        turnCount = 0;
        return;
      }

      turnCount++;
      currentTurn = (currentTurn + direction + players.length) % players.length;
      io.to('uno-room').emit('gameState', { discardTop: discardPile[discardPile.length - 1], players, turnCount });
      io.to('uno-room').emit('turn', { user: players[currentTurn].user });
      io.to('uno-room').emit('updatePlayerStats', players.map(p => ({ user: p.user, cardCount: p.hand.length })));
      players.forEach(p => {
        io.to(p.id).emit('yourHand', p.hand);
      });
    } else {
      socket.emit('message', 'Movimiento inválido o no es tu turno.');
    }
  });

  socket.on('skipTurn', (data) => {
    if (players[currentTurn].user === data.user) {
      io.to('uno-room').emit('message', `${data.user} no pudo jugar y saltó su turno`);
      turnCount++;
      currentTurn = (currentTurn + direction + players.length) % players.length;
      io.to('uno-room').emit('gameState', { discardTop: discardPile[discardPile.length - 1], players, turnCount });
      io.to('uno-room').emit('turn', { user: players[currentTurn].user });
      io.to('uno-room').emit('updatePlayerStats', players.map(p => ({ user: p.user, cardCount: p.hand.length })));
      players.forEach(p => {
        io.to(p.id).emit('yourHand', p.hand);
      });
    }
  });

  socket.on('drawCard', (data) => {
    if (players[currentTurn].user === data.user) {
      const player = players.find(p => p.user === data.user);
      if (deck.length > 0) {
        const drawnCard = deck.pop();
        player.hand.push(drawnCard);
        io.to('uno-room').emit('message', `${data.user} robó una carta: ${drawnCard}`);
        socket.emit('yourHand', player.hand);
        io.to('uno-room').emit('gameState', { discardTop: discardPile[discardPile.length - 1], players, turnCount });
        io.to('uno-room').emit('updatePlayerStats', players.map(p => ({ user: p.user, cardCount: p.hand.length })));

        if (isValidPlay(drawnCard, discardPile[discardPile.length - 1])) {
          io.to('uno-room').emit('message', `${data.user} puede jugar la carta robada: ${drawnCard}`);
        } else {
          turnCount++;
          currentTurn = (currentTurn + direction + players.length) % players.length;
          io.to('uno-room').emit('turn', { user: players[currentTurn].user });
          io.to('uno-room').emit('message', `${data.user} no pudo jugar y el turno pasa al siguiente`);
        }
      } else {
        socket.emit('message', 'No hay más cartas en el mazo.');
      }
    }
  });

  socket.on('chooseColor', (data) => {
    const player = players.find(p => p.user === data.user);
    if (player) {
      discardPile[discardPile.length - 1] = `${data.color} ${discardPile[discardPile.length - 1].includes('+4') ? '+4' : 'Comodín'}`;
      io.to('uno-room').emit('message', `${player.user} eligió el color ${data.color}`);
      io.to('uno-room').emit('gameState', { discardTop: discardPile[discardPile.length - 1], players, turnCount });
      io.to('uno-room').emit('updatePlayerStats', players.map(p => ({ user: p.user, cardCount: p.hand.length })));
    }
  });

  socket.on('disconnect', () => {
    const index = players.findIndex(p => p.id === socket.id);
    if (index !== -1) {
      io.to('uno-room').emit('message', `${players[index].user} se desconectó`);
      players.splice(index, 1);
      io.to('uno-room').emit('playerList', players.map(p => p.user));
      io.to('uno-room').emit('gameState', { discardTop: discardPile[discardPile.length - 1], players, turnCount });
      io.to('uno-room').emit('updatePlayerStats', players.map(p => ({ user: p.user, cardCount: p.hand.length })));
      if (players.length > 0) {
        currentTurn = (currentTurn % players.length + players.length) % players.length;
        io.to('uno-room').emit('turn', { user: players[currentTurn].user });
      }
    }
  });
});

http.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});