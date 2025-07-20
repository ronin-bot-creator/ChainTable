// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos (index.html, etc.)
app.use(express.static('public'));

// Estructura de datos para los lobbies y el juego
const lobbies = {};
let lobbyCounter = 0;

// Definición de cartas
const COLORS = ['Red', 'Blue', 'Green', 'Yellow'];
const TYPES = ['Number', 'Action', 'Wild'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTIONS = ['Skip', 'Reverse', 'DrawTwo'];
const WILD_ACTIONS = ['Wild', 'WildDrawFour'];

// Función para crear un mazo estándar de UNO
function createDeck() {
    const deck = [];

    // Cartas numeradas (0-9) y de acción (Skip, Reverse, DrawTwo)
    COLORS.forEach(color => {
        // Carta '0' (1 por color)
        deck.push({ color: color, value: '0', type: 'Number' });

        // Cartas '1' a '9', 'Skip', 'Reverse', 'DrawTwo' (2 por color)
        [...NUMBERS.slice(1), ...ACTIONS].forEach(value => {
            deck.push({ color: color, value: value, type: TYPES[1] });
            deck.push({ color: color, value: value, type: TYPES[1] });
        });
    });

    // Cartas WILD y WILD DRAW FOUR (4 de cada una)
    WILD_ACTIONS.forEach(value => {
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'Wild', value: value, type: TYPES[2] });
        }
    });

    return deck;
}

// Función para barajar el mazo (algoritmo Fisher-Yates)
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// Función para repartir cartas
function dealCards(lobby) {
    for (const player of lobby.players) {
        player.hand = [];
        for (let i = 0; i < 7; i++) {
            player.hand.push(lobby.drawPile.pop());
        }
    }
}

// Función para sacar una carta del mazo de robo. Si está vacío, recicla el descarte.
function drawCardFromDeck(lobby) {
    if (lobby.drawPile.length === 0) {
        // Reciclar el descarte (excepto la carta superior)
        const topCard = lobby.discardPile.pop();
        lobby.drawPile = lobby.discardPile;
        shuffleDeck(lobby.drawPile);
        lobby.discardPile = [topCard];
    }
    return lobby.drawPile.pop();
}

// Función de validación de jugada
function isValidPlay(card, topDiscardCard, currentActiveColor, drawStackActive) {
    // Si la carta es WILD, siempre es válida
    if (card.color === 'Wild') {
        return true;
    }

    // Si hay una pila de robo activa (+2 o +4), solo se puede jugar si es del mismo tipo de acción
    if (drawStackActive) {
        if (card.value === 'DrawTwo' || card.value === 'WildDrawFour') {
             // Solo se permite apilar si la carta jugada es el mismo tipo de acción (+2 sobre +2)
             if (topDiscardCard.value === 'DrawTwo' && card.value === 'DrawTwo') {
                 return true;
             }
             // Lógica para apilar +4 sobre +4 (cuando se implemente)
        }
        
        // Si hay una pila activa y no es una carta de apilamiento válida, la jugada NO es válida.
        return false; 
    }
    
    // Jugada normal: coincide el color activo O el valor de la carta superior
    const colorMatch = card.color === currentActiveColor;
    const valueMatch = card.value === topDiscardCard.value;
    
    return colorMatch || valueMatch;
}

// ---------------------------------------------------
// Servidor Socket.IO
// ---------------------------------------------------
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // ---------------------------------------------------
    // Evento: Crear Lobby
    // ---------------------------------------------------
    socket.on('createLobby', ({ username, lobbyName, isPrivate, password }) => {
        const lobbyId = `lobby_${++lobbyCounter}`;
        
        lobbies[lobbyId] = {
            id: lobbyId,
            name: lobbyName,
            hostId: socket.id,
            isPrivate: isPrivate,
            password: password,
            players: [{ id: socket.id, username: username, socketId: socket.id, hand: [] }],
            status: 'waiting',
            drawPile: [],
            discardPile: [],
            currentTurnIndex: 0,
            direction: 1, 
            currentActiveColor: null, 
            winners: [], 
            drawStackCount: 0, 
            drawStackActive: false 
        };
        
        socket.join(lobbyId);
        socket.emit('lobbyCreated', lobbies[lobbyId]);
        console.log(`Lobby creado: ${lobbyName} por ${username} (ID: ${lobbyId})`);
    });

    // ---------------------------------------------------
    // Evento: Unirse a Lobby
    // ---------------------------------------------------
    socket.on('joinLobby', ({ lobbyId, username, password }) => {
        const lobby = lobbies[lobbyId];

        if (!lobby) {
            return socket.emit('lobbyError', 'Lobby no encontrado.');
        }

        if (lobby.status !== 'waiting') {
            return socket.emit('lobbyError', 'La partida ya ha comenzado.');
        }

        if (lobby.isPrivate && lobby.password !== password) {
            return socket.emit('lobbyError', 'Contraseña incorrecta.');
        }
        
        if (lobby.players.length >= 8) {
            return socket.emit('lobbyError', 'El lobby está lleno.');
        }

        // Asegurarse de que el usuario no esté ya en el lobby
        if (lobby.players.some(p => p.socketId === socket.id)) {
            return socket.emit('lobbyError', 'Ya estás en este lobby.');
        }

        // Añadir jugador al lobby
        lobby.players.push({ id: socket.id, username: username, socketId: socket.id, hand: [] });
        socket.join(lobbyId);
        
        socket.emit('lobbyJoined', lobby);
        io.to(lobbyId).emit('lobbyUpdate', lobby); // Notificar a todos los jugadores en el lobby
        
        console.log(`Usuario ${username} (${socket.id}) se unió al lobby ${lobbyId}`);
    });

    // ---------------------------------------------------
    // Evento: Listar Lobbies (Asegurado que esté presente)
    // ---------------------------------------------------
    socket.on('listLobbies', () => {
        const publicLobbies = Object.values(lobbies)
            .filter(lobby => !lobby.isPrivate && lobby.status === 'waiting')
            .map(lobby => ({
                id: lobby.id,
                name: lobby.name,
                playersCount: lobby.players.length,
                maxPlayers: 8
            }));
            
        socket.emit('lobbiesList', publicLobbies);
    });

    // ---------------------------------------------------
    // Evento: Iniciar Partida
    // ---------------------------------------------------
    socket.on('startGame', ({ lobbyId }) => {
        const lobby = lobbies[lobbyId];

        if (!lobby || lobby.hostId !== socket.id) {
            return socket.emit('lobbyError', 'Solo el host puede iniciar la partida.');
        }

        if (lobby.players.length < 2) {
            return socket.emit('lobbyError', 'Se necesitan al menos 2 jugadores para iniciar.');
        }

        // Configuración inicial del juego
        lobby.status = 'in_game';
        lobby.drawPile = createDeck();
        shuffleDeck(lobby.drawPile);
        
        dealCards(lobby);

        // Inicializar la pila de descarte con la primera carta (debe ser numerada)
        let firstCard = null;
        do {
            firstCard = drawCardFromDeck(lobby);
            if (firstCard.type === 'Wild' || firstCard.value === 'DrawTwo' || firstCard.value === 'Skip' || firstCard.value === 'Reverse') {
                // Si la carta inicial es de acción o comodín, la devolvemos al mazo y barajamos de nuevo.
                lobby.drawPile.unshift(firstCard);
                shuffleDeck(lobby.drawPile);
            }
        } while (firstCard.type !== 'Number');

        lobby.discardPile = [firstCard];
        lobby.currentActiveColor = firstCard.color;

        // Notificar a todos los jugadores
        io.to(lobbyId).emit('gameStarted', { lobby: lobby, firstCard: firstCard });
        
        // Enviar la mano inicial a cada jugador individualmente
        lobby.players.forEach(player => {
            io.to(player.socketId).emit('yourHand', player.hand);
        });
        
        console.log(`Partida iniciada en el lobby ${lobbyId}`);
    });

    // ---------------------------------------------------
    // Evento: Jugar una Carta
    // ---------------------------------------------------
     socket.on('playCard', ({ lobbyId, cardIndex }) => {
        const lobby = lobbies[lobbyId];
        
        if (!lobby || lobby.status !== 'in_game') {
            return socket.emit('lobbyError', 'No estás en una partida activa.');
        }

        const currentPlayerIndex = lobby.currentTurnIndex;
        const currentPlayer = lobby.players[currentPlayerIndex];

        if (currentPlayer.socketId !== socket.id) {
            return socket.emit('lobbyError', 'No es tu turno.');
        }

        const cardToPlay = currentPlayer.hand[cardIndex];
        const topDiscardCard = lobby.discardPile[lobby.discardPile.length - 1];

        if (!cardToPlay) {
            return socket.emit('lobbyError', 'Carta no válida o índice incorrecto.');
        }

        // Validar la jugada (considerando si hay una pila activa)
        if (!isValidPlay(cardToPlay, topDiscardCard, lobby.currentActiveColor, lobby.drawStackActive)) {
            // Si hay una pila activa y el jugador intenta jugar otra cosa que no sea un +2, la jugada es inválida
            if (lobby.drawStackActive) {
                return socket.emit('lobbyError', 'Debes jugar una carta +2 o robar las cartas acumuladas.');
            }
            // Jugada normal inválida (no coincide color/valor)
            return socket.emit('lobbyError', 'No puedes jugar esa carta. Debe coincidir con el color o el número/acción.');
        }

        // Mover la carta: de la mano del jugador a la pila de descarte
        currentPlayer.hand.splice(cardIndex, 1);
        lobby.discardPile.push(cardToPlay);
        
        let turnsToAdvance = 1;
        let action = 'play';

        // --- Lógica de Ganadores ---
        if (currentPlayer.hand.length === 0) {
            lobby.winners.push({
                username: currentPlayer.username,
                socketId: currentPlayer.socketId,
                rank: lobby.winners.length + 1
            });
            io.to(lobbyId).emit('winnerFound', {
                username: currentPlayer.username,
                rank: lobby.winners.length,
                lobbyState: lobby
            });

            lobby.players.splice(currentPlayerIndex, 1);

            const activePlayersCount = lobby.players.length;
            const winnersCount = lobby.winners.length;
            const totalPlayers = lobby.winners.length + lobby.players.length;

            if ((totalPlayers >= 4 && winnersCount >= 3) || (activePlayersCount <= 1)) {
                lobby.status = 'finished';
                io.to(lobbyId).emit('gameOver', { lobbyState: lobby });
                return;
            }

            if (lobby.currentTurnIndex >= lobby.players.length) {
                lobby.currentTurnIndex = 0;
            }
            
            io.to(lobbyId).emit('gameUpdate', {
                lobbyState: lobby,
                playedCard: cardToPlay,
                playerPlayed: currentPlayer.username,
                newTurnIndex: lobby.currentTurnIndex,
                action: 'play'
            });
            socket.emit('yourHand', currentPlayer.hand);
            return; 
        }
        
        // --- Lógica de cartas de Acción (Skip, DrawTwo, Reverse) ---
        
        if (cardToPlay.value === 'Skip') {
            turnsToAdvance = 2; // Salta al siguiente jugador
            action = 'skip';
        } else if (cardToPlay.value === 'DrawTwo') {
            // Lógica de apilamiento para +2
            lobby.drawStackCount += 2;
            lobby.drawStackActive = true;
            turnsToAdvance = 1; 
            action = 'drawTwo_played';
        } else if (cardToPlay.value === 'Reverse') { 
            // Revertir la dirección de juego
            lobby.direction *= -1;
            action = 'reverse';
            turnsToAdvance = 1;
            
            // Nota: En un juego de 2 jugadores, al revertir la dirección y avanzar 1 turno,
            // el turno vuelve automáticamente al jugador que lanzó la carta (efecto de Salto).
        } else if (cardToPlay.type === 'Wild') {
            // --- Lógica de cartas WILD: ---
            socket.emit('promptColor', { 
                lobbyId: lobbyId, 
                playedCardIndex: lobby.discardPile.length - 1 
            });
            
            socket.emit('yourHand', currentPlayer.hand);
            return; // Esperar a que elija el color antes de avanzar el turno.
        }

        // 5. Actualizar el color activo (si no es un WILD)
        if (cardToPlay.color !== 'Wild') {
            lobby.currentActiveColor = cardToPlay.color;
        }

        // 6. Lógica para el siguiente turno
        lobby.currentTurnIndex = (lobby.currentTurnIndex + (turnsToAdvance * lobby.direction)) % lobby.players.length;
        if (lobby.currentTurnIndex < 0) {
            lobby.currentTurnIndex += lobby.players.length;
        }

        // 7. Notificar a todos los jugadores de la actualización del juego
        io.to(lobbyId).emit('gameUpdate', {
            lobbyState: lobby,
            playedCard: cardToPlay,
            playerPlayed: currentPlayer.username,
            newTurnIndex: lobby.currentTurnIndex,
            action: action 
        });

        // 8. Enviar la mano actualizada solo al jugador que jugó
        socket.emit('yourHand', currentPlayer.hand);
    });

    // ---------------------------------------------------
    // Evento: Robar una Carta (ACTUALIZADO para manejar pilas +2)
    // ---------------------------------------------------
    socket.on('drawCard', ({ lobbyId }) => {
        const lobby = lobbies[lobbyId];
        
        // === FIX: Verificar si el lobby existe ANTES de acceder a sus propiedades ===
        if (!lobby) {
            console.log("Error: drawCard en lobby no existente:", lobbyId);
            return socket.emit('lobbyError', 'Lobby no encontrado o partida terminada.');
        }
        
        // Verificar si la partida está en curso
        if (lobby.status !== 'in_game') {
            return socket.emit('lobbyError', 'No estás en una partida activa.');
        }

        // Obtener el jugador actual (Ahora es seguro acceder a lobby.currentTurnIndex)
        const currentPlayerIndex = lobby.currentTurnIndex;
        const currentPlayer = lobby.players[currentPlayerIndex];

        if (currentPlayer.socketId !== socket.id) {
            return socket.emit('lobbyError', 'Acción no válida. No es tu turno.');
        }

        // --- Lógica de apilamiento (+2) ---
        if (lobby.drawStackActive) {
            // Si hay una pila activa, el jugador DEBE robar las cartas acumuladas Y pierde su turno (opción A y B).
            const cardsToDraw = lobby.drawStackCount;
            for (let i = 0; i < cardsToDraw; i++) {
                const drawnCard = drawCardFromDeck(lobby);
                currentPlayer.hand.push(drawnCard);
            }
            
            // Reiniciar el apilamiento
            lobby.drawStackCount = 0;
            lobby.drawStackActive = false;

            // Avanzar el turno (el jugador pierde su turno después de robar la penalización)
            lobby.currentTurnIndex = (lobby.currentTurnIndex + lobby.direction) % lobby.players.length;
            if (lobby.currentTurnIndex < 0) {
                lobby.currentTurnIndex += lobby.players.length;
            }

            // Notificar a todos
            io.to(lobbyId).emit('gameUpdate', {
                lobbyState: lobby,
                playerPlayed: currentPlayer.username,
                action: 'draw_penalty',
                cardsDrawn: cardsToDraw,
                newTurnIndex: lobby.currentTurnIndex
            });
            socket.emit('yourHand', currentPlayer.hand);
            return;
        }

        // --- Lógica normal de robar carta ---
        const drawnCard = drawCardFromDeck(lobby);
        currentPlayer.hand.push(drawnCard);

        // Notificar al jugador que robó su mano actualizada
        socket.emit('yourHand', currentPlayer.hand);

        // Notificar a los demás jugadores sobre la acción de robar
        io.to(lobbyId).emit('gameUpdate', {
            lobbyState: lobby,
            playedCard: null, 
            playerPlayed: currentPlayer.username,
            action: 'draw',
            newTurnIndex: lobby.currentTurnIndex 
        });
    });

    // ---------------------------------------------------
    // Evento: Pasar Turno
    // ---------------------------------------------------
     socket.on('passTurn', ({ lobbyId }) => {
        const lobby = lobbies[lobbyId];
        
        // --- VALIDACIÓN CRÍTICA (FIX) ---
        // 1. Verificar si el lobby existe. Si es undefined, salir.
        if (!lobby) {
            return socket.emit('lobbyError', 'Lobby no encontrado o partida terminada.');
        }

        // 2. Verificar si la partida está en juego.
        if (lobby.status !== 'in_game') {
            return socket.emit('lobbyError', 'No estás en una partida activa.');
        }
        // ---------------------------------

        // Ahora es seguro acceder a las propiedades de lobby
        const currentPlayerIndex = lobby.currentTurnIndex;
        const currentPlayer = lobby.players[currentPlayerIndex];

        // 3. Verificar si el socket del jugador coincide con el del turno actual
        if (currentPlayer.socketId !== socket.id) {
            return socket.emit('lobbyError', 'Acción no válida. No es tu turno.');
        }

        // Si hay una pila de robo activa, no se puede pasar turno sin robar o jugar un +2
        if (lobby.drawStackActive) {
            return socket.emit('lobbyError', 'No puedes pasar turno. Debes robar la penalización o jugar una carta +2.');
        }

        // Avanzar el turno
        lobby.currentTurnIndex = (lobby.currentTurnIndex + lobby.direction) % lobby.players.length;
        if (lobby.currentTurnIndex < 0) {
            lobby.currentTurnIndex += lobby.players.length;
        }

        // Notificar a todos los jugadores del cambio de turno
        io.to(lobbyId).emit('gameUpdate', {
            lobbyState: lobby,
            playedCard: null, 
            playerPlayed: currentPlayer.username,
            action: 'pass',
            newTurnIndex: lobby.currentTurnIndex
        });
    });

    // ---------------------------------------------------
    // Evento: Elegir Color para Carta WILD
    // ---------------------------------------------------
    socket.on('chooseColor', ({ lobbyId, color, cardIndex }) => {
        const lobby = lobbies[lobbyId];
        const currentPlayer = lobby.players[lobby.currentTurnIndex];

        if (currentPlayer.socketId !== socket.id) {
            return socket.emit('lobbyError', 'No es tu turno.');
        }

        // Actualizar el color activo del lobby
        lobby.currentActiveColor = color;

        // Avanzar el turno
        lobby.currentTurnIndex = (lobby.currentTurnIndex + lobby.direction) % lobby.players.length;
        if (lobby.currentTurnIndex < 0) {
            lobby.currentTurnIndex += lobby.players.length;
        }

        // Notificar a todos los jugadores del cambio de color y avance de turno
        io.to(lobbyId).emit('gameUpdate', {
            lobbyState: lobby,
            playedCard: lobby.discardPile[cardIndex], // La carta que se jugó
            playerPlayed: currentPlayer.username,
            newTurnIndex: lobby.currentTurnIndex,
            action: 'color_chosen'
        });
    });

    // ---------------------------------------------------
    // Evento: Desconexión
    // ---------------------------------------------------
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        
        // Lógica para manejar la desconexión de jugadores de lobbies
        for (const lobbyId in lobbies) {
            const lobby = lobbies[lobbyId];
            const playerIndex = lobby.players.findIndex(p => p.socketId === socket.id);

            if (playerIndex !== -1) {
                // Eliminar jugador de la lista
                lobby.players.splice(playerIndex, 1);
                
                console.log(`Usuario ${socket.id} abandonó el lobby ${lobbyId}. Jugadores restantes: ${lobby.players.length}`);

                // Si el lobby se queda sin jugadores, lo eliminamos
                if (lobby.players.length === 0) {
                    delete lobbies[lobbyId];
                    console.log(`Lobby ${lobbyId} eliminado.`);
                    return;
                }

                // Si el jugador desconectado era el host, asignamos un nuevo host
                if (lobby.hostId === socket.id && lobby.players.length > 0) {
                    lobby.hostId = lobby.players[0].socketId;
                    console.log(`Nuevo host del lobby ${lobbyId} es ${lobby.players[0].username}`);
                }

                // Si la partida está en curso y el jugador se desconectó en su turno
                if (lobby.status === 'in_game' && lobby.currentTurnIndex === playerIndex) {
                    // Si el jugador desconectado era el del turno, avanzamos el turno
                    if (lobby.currentTurnIndex >= lobby.players.length) {
                        lobby.currentTurnIndex = 0;
                    }
                } else if (lobby.status === 'in_game' && lobby.currentTurnIndex > playerIndex) {
                    // Ajustar el índice del turno si el jugador desconectado estaba antes en la lista
                    lobby.currentTurnIndex--;
                }

                // Notificar a los jugadores restantes de la actualización del lobby
                io.to(lobbyId).emit('lobbyUpdate', lobby);
                
                // Si la partida estaba en curso, emitir un gameUpdate para actualizar el estado del juego
                if (lobby.status === 'in_game') {
                    io.to(lobbyId).emit('gameUpdate', {
                        lobbyState: lobby,
                        action: 'player_disconnected',
                        playerPlayed: null, 
                        newTurnIndex: lobby.currentTurnIndex
                    });
                }
            }
        }
    });
     // Evento: Partida Terminada (Game Over)
        // ---------------------------------------------------
        socket.on('gameOver', (data) => {
            console.log("¡Partida Terminada!", data.lobbyState);
            displayGameMessage("¡Partida Terminada! Redirigiendo a la pantalla de lobbies...");

            // Usamos setTimeout para dar tiempo a los jugadores de ver el mensaje de fin de partida
            setTimeout(() => {
                returnToLobbyList();
            }, 5000); // Redirige después de 5 segundos
        });
});

// Iniciar el servidor
server.listen(3000, () => {
    console.log('Servidor escuchando en http://localhost:3000');
});