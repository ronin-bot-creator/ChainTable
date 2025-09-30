import React, { useEffect } from 'react';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { useSocket } from '../hooks/useSocket';
import { getUserSession } from '../utils/userSession';
import Card from '../components/Card';
import PlayerHand from '../components/PlayerHand';
import ColorPicker from '../components/ColorPicker';

const Game: React.FC = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  const session = getUserSession();

  // Verificar autenticación y lobbyId
  useEffect(() => {
    if (!session) {
      navigate('/auth');
      return;
    }
    if (!lobbyId) {
      navigate('/lobbies');
      return;
    }
  }, [session, lobbyId, navigate]);

  const {
    gameState,
    playerHand,
    isMyTurn,
    currentPlayer,
    isGameFinished,
    startGame,
    playCard,
    drawCard,
    passTurn,
    chooseWildColor,
    isLoading,
    error,
    showColorPicker,
    winners,
    gameMessage,
    leaveGame,
  } = useGame(lobbyId || '');
  const { cancelLobby } = useSocket();

  if (!lobbyId || !session) {
    return null; // Se redirigirá en useEffect
  }

  // Lobby en espera - mostrar si NO HAY gameState (lobby) o si está waiting
  if (!gameState || gameState?.status === 'waiting') {
    // Si no hay gameState, mostrar loading
    if (!gameState) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-700 to-blue-800 p-4 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800">Cargando lobby...</h2>
            <p className="text-gray-600 mt-2">Conectando al servidor</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-700 to-blue-800 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Lobby: {gameState.name}
            </h1>

            {/* Jugadores */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">
                Jugadores ({gameState.players.length})
              </h2>
              <div className="space-y-2">
                {gameState.players.map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between p-3 bg-gray-100 rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{player.username}</span>
                      {player.isHost && (
                        <span title="Creador del lobby" className="ml-2">👑</span>
                      )}
                      {player.id === session?.id && (
                        <span className="ml-2 text-sm text-blue-600">(Tú)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {player.walletAddress.slice(0, 8)}...{player.walletAddress.slice(-6)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controles */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={startGame}
                disabled={isLoading || gameState.players.length < 2 || session?.id !== gameState.hostId}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {session?.id !== gameState.hostId ? 'Solo el creador puede iniciar' : (isLoading ? 'Iniciando...' : 'Iniciar Partida')}
              </button>
              
              {session?.id === gameState.hostId && gameState.status === 'waiting' && (
                <CancelLobbyButton lobbyId={gameState.id} cancelLobby={cancelLobby} />
              )}

              <button
                onClick={leaveGame}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Salir del Lobby
              </button>
            </div>

            {gameState.players.length < 2 && (
              <p className="text-center text-gray-600 mt-4">
                Se necesita al menos 2 jugadores para iniciar
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Juego terminado
  if (isGameFinished) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-700 to-pink-800 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">
              🎉 ¡Partida Terminada!
            </h1>

            {/* Podium */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Resultados</h2>
              <div className="space-y-3">
                {winners.map((winner, index) => (
                  <div
                    key={winner.socketId}
                    className={`flex items-center justify-center p-4 rounded-lg ${
                      index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' :
                      index === 1 ? 'bg-gray-100 border-2 border-gray-400' :
                      index === 2 ? 'bg-orange-100 border-2 border-orange-400' :
                      'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <span className="text-2xl mr-3">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                    </span>
                    <div>
                      <div className="font-semibold">
                        {winner.username} {winner.socketId === session.id && '(Tú)'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {index + 1}° lugar
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={leaveGame}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg"
            >
              Volver a Lobbies
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Juego en progreso
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 to-blue-800 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header del juego */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">
            UNO - {gameState?.name}
          </h1>
          
          <div className="flex items-center gap-4">
            {currentPlayer && (
              <div className="text-white">
                Turno de: <span className="font-semibold">{currentPlayer}</span>
              </div>
            )}
            
            <button
              onClick={leaveGame}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Mensaje del juego */}
        {gameMessage && (
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg mb-4 text-center animate-fade-in">
            {gameMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {/* Area principal del juego */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Otros jugadores (lado izquierdo) */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-4">Otros Jugadores</h3>
              <div className="space-y-3">
                {gameState?.players
                  .filter(player => player.socketId !== session?.id)
                  .map((player) => (
                    <div
                      key={player.socketId}
                      className={`p-3 rounded-lg ${
                        gameState.players[gameState.currentTurnIndex]?.socketId === player.socketId
                          ? 'bg-green-600'
                          : 'bg-gray-700'
                      }`}
                    >
                      <div className="text-white font-medium">{player.username}</div>
                      <div className="text-sm text-gray-300">
                        {player.cardCount} cartas
                      </div>
                      {player.cardCount === 1 && (
                        <div className="text-xs text-red-400 font-bold">¡UNO!</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Centro del juego */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <h3 className="text-white font-semibold mb-4">Mesa de Juego</h3>
              
              {/* Carta actual y mazo */}
              <div className="flex justify-center items-center gap-8 mb-6">
                {/* Mazo */}
                <div className="text-center">
                  <div className="w-20 h-32 bg-blue-900 rounded-lg border-2 border-blue-700 flex items-center justify-center mb-2">
                    <span className="text-white font-bold">UNO</span>
                  </div>
                  <button
                    onClick={drawCard}
                    disabled={!isMyTurn || isLoading}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Robar
                  </button>
                </div>

                {/* Carta actual */}
                <div className="text-center">
                  {gameState?.discardPile && gameState.discardPile.length > 0 && (
                    <Card
                      card={gameState.discardPile[gameState.discardPile.length - 1]}
                      size="lg"
                      isPlayable={false}
                      showTooltip={true}
                    />
                  )}
                  {gameState?.currentActiveColor && (
                    <div className="mt-2 text-sm text-white">
                      Color activo: <span className="font-bold">{gameState.currentActiveColor}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Controles adicionales */}
              {isMyTurn && (
                <div className="flex justify-center gap-4">
                  <button
                    onClick={passTurn}
                    disabled={isLoading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Pasar Turno
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas del juego */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-4">Estadísticas</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div>Cartas en mazo: {gameState?.drawPile?.length || 0}</div>
                <div>Dirección: {gameState?.direction === 1 ? '→' : '←'}</div>
                {gameState?.drawStackCount && gameState.drawStackCount > 0 && (
                  <div className="text-red-400">
                    Stack +{gameState.drawStackCount}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mano del jugador */}
        <div className="mt-6">
          <PlayerHand
            cards={playerHand}
            currentCard={gameState?.discardPile && gameState.discardPile.length > 0 
              ? gameState.discardPile[gameState.discardPile.length - 1] 
              : null}
            currentActiveColor={gameState?.currentActiveColor || null}
            drawStackActive={(gameState?.drawStackCount || 0) > 0}
            isMyTurn={isMyTurn}
            onCardPlay={playCard}
          />
        </div>

        {/* Selector de color */}
        <ColorPicker
          isVisible={showColorPicker}
          onColorSelect={chooseWildColor}
        />
      </div>
    </div>
  );
};

// Small inline component to handle cancel confirmation and pending state
const CancelLobbyButton: React.FC<{ lobbyId: string; cancelLobby: (lobbyId: string) => Promise<void> }> = ({ lobbyId, cancelLobby }) => {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    const ok = window.confirm('¿Estás seguro que querés cancelar el lobby? Esto expulsará a todos los jugadores.');
    if (!ok) return;
    setIsCancelling(true);
    try {
      await cancelLobby(lobbyId);
    } catch (err) {
      console.error('Error cancelando lobby:', err);
      alert('No se pudo cancelar el lobby: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={isCancelling}
      className={`px-6 py-2 ${isCancelling ? 'bg-red-400' : 'bg-red-600'} text-white rounded-lg hover:bg-red-700 disabled:opacity-50`}
    >
      {isCancelling ? 'Cancelando...' : 'Cancelar Lobby'}
    </button>
  );
};

export default Game;
