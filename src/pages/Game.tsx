import React, { useEffect } from "react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { useSocket } from "../hooks/useSocket";
import { getUserSession } from "../utils/userSession";
import Card from "../components/Card";
import PlayerHand from "../components/PlayerHand";
import ColorPicker from "../components/ColorPicker";
import { useTranslation } from 'react-i18next'

const Game: React.FC = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  const session = getUserSession();
  const { t } = useTranslation()

  // Verificar autenticación y lobbyId
  useEffect(() => {
    if (!session) {
      navigate("/auth");
      return;
    }
    if (!lobbyId) {
      navigate("/lobbies");
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
    cancelLobbyOnChain,
    isLoading,
    error,
    showColorPicker,
    winners,
    gameMessage,
    prizeDistributionTx,
    leaveGame,
    // autoDistributePrizes manejado internamente por useGame
  } = useGame(lobbyId || "");
  const { cancelLobby } = useSocket();

  // AUTO-DISTRIBUTION: Manejado ÚNICAMENTE desde el evento del servidor
  // 'game:distributePrizes' en useGame.ts para evitar llamadas duplicadas

  // Debug: Log prize distribution TX state
  React.useEffect(() => {
    if (prizeDistributionTx) {
      console.log(
        "🎉 [Game.tsx] prizeDistributionTx disponible:",
        prizeDistributionTx
      );
    }
  }, [prizeDistributionTx]);

  if (!lobbyId || !session) {
    return null; // Se redirigirá en useEffect
  }

  // Lobby en espera - mostrar si NO HAY gameState (lobby) o si está waiting
  if (!gameState || gameState?.status === "waiting") {
    // Si no hay gameState, mostrar loading
    if (!gameState) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-4 flex items-center justify-center relative overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
              style={{ animationDelay: "1s" }}
            ></div>
          </div>

          <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-12 text-center border border-gray-200">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {t('game_loading')}
            </h2>
            <p className="text-gray-600">{t('game_connecting')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950 to-blue-950 p-4 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1.5s" }}
          ></div>
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-8 border border-gray-200">
            {/* Header con nombre del lobby */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🃏</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  {`Lobby: ${gameState.name}`}
                </h1>
              </div>

              {/* Mostrar costo de entrada si es lobby pago */}
              {gameState.type === "pago" && gameState.onchain && (
                <div className="mt-4 inline-flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 text-yellow-900 px-6 py-3 rounded-xl shadow-lg">
                  <span className="text-2xl">💰</span>
                  <div>
                    <div className="text-xs font-medium text-yellow-700 mb-1">
                      {t('game_entry_cost')}
                    </div>
                    <span className="font-bold text-lg">
                      {(() => {
                        try {
                          const weiValue =
                            gameState.entryCost ||
                            gameState.onchain?.entryFee ||
                            "0";
                          const ethValue = parseFloat(weiValue) / 1e18;
                          return `${ethValue} ${
                            gameState.onchain?.token || "ETH"
                          }`;
                        } catch {
                          return "N/A";
                        }
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Jugadores */}
              <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-800">{t('game_players')}</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-green-200 to-blue-200"></div>
                <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-4 py-1 rounded-full font-bold text-sm">
                  {gameState.players.length}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gameState.players.map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-200 hover:border-green-400 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-sm">
                          {player.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">
                            {player.username.slice(0, 5)}...
                            {player.username.slice(-5)}
                          </span>
                          {player.isHost && (
                            <span
                              title="Creador del lobby"
                              className="text-yellow-500 text-lg"
                            >
                              👑
                            </span>
                          )}
                          {player.id === session?.id && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-semibold">
                              {t('you_label')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {player.walletAddress.slice(0, 5)}...
                          {player.walletAddress.slice(-5)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controles */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={startGame}
                disabled={
                  isLoading ||
                  gameState.players.length < 2 ||
                  session?.id !== gameState.hostId
                }
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:transform-none"
              >
                {session?.id !== gameState.hostId
                  ? t('game_start_only_host')
                  : isLoading
                  ? t('game_starting')
                  : t('game_start')}
              </button>

              {session?.id === gameState.hostId &&
                gameState.status === "waiting" && (
                  <CancelLobbyButton
                    lobbyId={gameState.id}
                    cancelLobbyOnChain={cancelLobbyOnChain}
                    cancelLobby={cancelLobby}
                    isOnchainLobby={gameState.type === "pago"}
                  />
                )}

              <button
                onClick={leaveGame}
                className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {t('game_leave')}
              </button>
            </div>

            {gameState.players.length < 2 && (
              <div className="mt-6 flex items-center justify-center gap-3 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                <span className="text-2xl">⏳</span>
                <p className="text-yellow-800 font-medium">
                  {t('game_need_two', { count: 2 })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Juego terminado
  if (isGameFinished) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-pink-950 to-indigo-950 p-4 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-10 text-center border border-gray-200">
            {/* Header con confetti effect */}
            <div className="mb-8">
              <div className="inline-block mb-4 animate-bounce">
                <div className="text-6xl">🎉</div>
              </div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent mb-2">
                {t('game_finished')}
              </h1>
              <div className="h-1 w-24 bg-gradient-to-r from-purple-400 to-pink-400 mx-auto rounded-full"></div>
            </div>

            {/* Mensaje del sistema (incluye info de premios) */}
            {gameMessage && (
              <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 shadow-lg animate-fade-in">
                <p className="text-blue-900 font-semibold text-lg">
                  {gameMessage}
                </p>
              </div>
            )}

            {/* Podium mejorado */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                {t('game_results')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {winners.map((winner, index) => (
                  <div
                    key={winner.socketId}
                    className={`relative p-6 rounded-2xl border-4 transform transition-all hover:scale-105 ${
                      index === 0
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-500 shadow-2xl shadow-yellow-500/50"
                        : index === 1
                        ? "bg-gradient-to-br from-gray-300 to-gray-500 border-gray-400 shadow-xl"
                        : index === 2
                        ? "bg-gradient-to-br from-orange-400 to-orange-600 border-orange-500 shadow-lg"
                        : "bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300"
                    }`}
                  >
                    {/* Medal */}
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                      <span className="text-5xl">
                        {index === 0
                          ? "🥇"
                          : index === 1
                          ? "🥈"
                          : index === 2
                          ? "🥉"
                          : "🏅"}
                      </span>
                    </div>

                    <div className="pt-8">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="font-bold text-xl text-white drop-shadow-lg">
                          {index + 1}°
                        </span>
                        <span className="text-white font-extrabold text-lg">
                          {winner.username.slice(0, 5)}...
                          {winner.username.slice(-5)}
                        </span>
                        {winner.socketId === session.id && (
                          <span className="px-3 py-1 bg-white/30 backdrop-blur-sm text-white text-xs rounded-full font-bold border-2 border-white/50">
                            {t('you_label')}
                          </span>
                        )}
                      </div>
                      <div className="text-white/90 text-sm font-semibold">
                        Lugar {index === 0 ? "🏆" : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TX de distribución de premios */}
            {prizeDistributionTx && (
              <div className="mb-8 bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 text-white p-8 rounded-2xl shadow-2xl border-4 border-green-400 animate-fade-in">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <span className="text-5xl animate-pulse">🎉</span>
                    <h3 className="font-bold text-3xl">
                      {t('game_prizes_distributed')}
                    </h3>
                  </div>
                  <p className="text-green-100 font-medium text-lg mb-2">
                    Transacción confirmada en blockchain
                  </p>
                </div>
                <div className="bg-black/30 backdrop-blur-sm px-4 py-3 rounded-xl font-mono text-xs break-all mb-4 text-center border border-white/20">
                  {prizeDistributionTx.hash}
                </div>
                <a
                  href={prizeDistributionTx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-white text-green-700 px-8 py-4 rounded-xl font-bold hover:bg-green-50 transition-all shadow-lg hover:shadow-xl text-center transform hover:scale-105"
                >
                  {t('game_view_tx')}
                </a>
              </div>
            )}

            <button
              onClick={leaveGame}
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              {t('back_to_lobbies')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Juego en progreso
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1.5s" }}
        ></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header del juego mejorado */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-gradient-to-r from-emerald-900/50 to-green-900/50 backdrop-blur-sm rounded-2xl p-6 border border-emerald-700/30 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🃏</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {gameState?.name}
              </h1>
              <p className="text-emerald-200 text-sm">{t('game_in_progress')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentPlayer && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="font-semibold">{t('turn_label')} {currentPlayer}</span>
              </div>
            )}

            <button
              onClick={leaveGame}
              className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {t('game_leave')}
            </button>
          </div>
        </div>

        {/* Mensaje del juego */}
        {gameMessage && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-xl mb-6 text-center animate-fade-in shadow-lg border border-blue-400">
            <p className="font-bold text-lg">{gameMessage}</p>
          </div>
        )}

        {/* TX de distribución de premios */}
        {prizeDistributionTx && (
          <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 text-white px-8 py-6 rounded-2xl mb-6 shadow-2xl border-4 border-green-400 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl animate-pulse">🎉</span>
                  <h3 className="font-bold text-2xl">¡Premios Distribuidos!</h3>
                </div>
                <p className="text-green-100 font-medium mb-3">
                  Transacción confirmada en blockchain
                </p>
                <div className="bg-black/30 backdrop-blur-sm px-4 py-3 rounded-xl font-mono text-xs break-all border border-white/20">
                  {prizeDistributionTx.hash}
                </div>
              </div>
              <a
                href={prizeDistributionTx.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-green-700 px-6 py-3 rounded-xl font-bold hover:bg-green-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 transform hover:scale-105"
              >
                {t('game_view_tx')}
              </a>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-xl mb-6 text-center shadow-lg border-2 border-red-400 animate-fade-in">
            <p className="font-bold text-lg">❌ {error}</p>
          </div>
        )}

        {/* Area principal del juego */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Otros jugadores (lado izquierdo) */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-700">
              <h3 className="text-white font-bold mb-4 text-lg flex items-center gap-2">
                <span>👥</span> {t('other_players')}
              </h3>
              <div className="space-y-3">
                {gameState?.players
                  .filter((player) => player.socketId !== session?.id)
                  .map((player) => (
                    <div
                      key={player.socketId}
                      className={`p-4 rounded-xl transition-all duration-300 ${
                        gameState.players[gameState.currentTurnIndex]
                          ?.socketId === player.socketId
                          ? "bg-gradient-to-br from-green-600 to-emerald-600 shadow-lg shadow-green-500/50 scale-105 border-2 border-green-400"
                          : "bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                            gameState.players[gameState.currentTurnIndex]
                              ?.socketId === player.socketId
                              ? "bg-white/20"
                              : "bg-slate-600"
                          }`}
                        >
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-bold">
                            {player.username.slice(0, 5)}...
                            {player.username.slice(-5)}
                          </div>
                          <div className="text-sm flex items-center gap-1">
                            <span className="text-yellow-400 font-bold">
                              🃏
                            </span>
                            <span className="text-gray-300 font-semibold">
                              {player.cardCount} cartas
                            </span>
                          </div>
                        </div>
                      </div>
                      {player.cardCount === 1 && (
                        <div className="mt-2 text-center">
                          <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                            ¡UNO!
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Centro del juego */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-center shadow-2xl border border-slate-700">
              <h3 className="text-white font-bold mb-6 text-xl flex items-center justify-center gap-2">
                <span>🎲</span> {t('game_table')}
              </h3>

              {/* Carta actual y mazo */}
              <div className="flex justify-center items-start gap-12 mb-8">
                {/* Mazo */}
                <div className="text-center flex flex-col items-center">
                  <div className="w-36 h-52 rounded-xl border-4 border-blue-600 overflow-hidden mb-3 shadow-xl transform hover:scale-105 transition-transform cursor-pointer bg-white">
                    <img 
                      src={`/cartamazo.png?v=${Date.now()}`}
                      alt="Mazo de cartas" 
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <button
                    onClick={drawCard}
                    disabled={!isMyTurn || isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed shadow-lg transition-all duration-300 transform hover:scale-105 disabled:transform-none"
                  >
                    {isMyTurn ? t('draw_card') : t('waiting')}
                  </button>
                </div>

                {/* Carta actual */}
                <div className="text-center flex flex-col items-center">
                  {gameState?.discardPile &&
                    gameState.discardPile.length > 0 && (
                      <div className="transform hover:scale-110 transition-transform duration-300 mb-3">
                        <Card
                          card={
                            gameState.discardPile[
                              gameState.discardPile.length - 1
                            ]
                          }
                          size="2xl"
                          isPlayable={false}
                          showTooltip={true}
                        />
                      </div>
                    )}
                  {gameState?.currentActiveColor && (
                    <div 
                      className={`px-4 py-2 rounded-lg inline-flex items-center gap-2 border-2 shadow-md ${
                        gameState.currentActiveColor === 'red' 
                          ? 'bg-red-600 border-red-700'
                          : gameState.currentActiveColor === 'yellow'
                          ? 'bg-yellow-500 border-yellow-600'
                          : gameState.currentActiveColor === 'green'
                          ? 'bg-green-600 border-green-700'
                          : gameState.currentActiveColor === 'blue'
                          ? 'bg-blue-600 border-blue-700'
                          : 'bg-purple-600 border-purple-700'
                      }`}
                    >
                      <span className="text-xs text-white font-semibold">{t('color_active')}</span>
                      <span className="font-bold text-sm text-white uppercase">
                        {gameState.currentActiveColor}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Controles adicionales */}
              {isMyTurn && (
                <div className="flex justify-center gap-4 animate-fade-in">
                  <button
                    onClick={passTurn}
                    disabled={isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-xl hover:from-yellow-600 hover:to-orange-700 disabled:opacity-50 font-bold shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    {t('pass_turn')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas del juego */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-700">
              <h3 className="text-white font-bold mb-5 text-lg flex items-center gap-2">
                <span>📊</span> {t('stats_title')}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-900/50 to-blue-950/50 rounded-xl border border-blue-700">
                  <span className="text-blue-200 font-semibold">{t('cards_in_deck')}</span>
                  <span className="text-white font-bold text-lg">
                    {gameState?.drawPile?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-900/50 to-purple-950/50 rounded-xl border border-purple-700">
                  <span className="text-purple-200 font-semibold">{t('direction_label')}</span>
                  <span className="text-white font-bold text-xl">
                    {gameState?.direction === 1 ? "→" : "←"}
                  </span>
                </div>
                {gameState?.drawStackCount && gameState.drawStackCount > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-900/50 to-orange-950/50 rounded-xl border border-red-700 animate-pulse">
                    <span className="text-red-200 font-semibold">⚡ Stack</span>
                    <span className="text-red-400 font-bold text-xl">
                      +{gameState.drawStackCount}
                    </span>
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
            currentCard={
              gameState?.discardPile && gameState.discardPile.length > 0
                ? gameState.discardPile[gameState.discardPile.length - 1]
                : null
            }
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
const CancelLobbyButton: React.FC<{
  lobbyId: string;
  cancelLobby: (lobbyId: string) => Promise<void>;
  cancelLobbyOnChain: () => Promise<void>;
  isOnchainLobby: boolean;
}> = ({ lobbyId, cancelLobby, cancelLobbyOnChain, isOnchainLobby }) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const { t } = useTranslation()

  const handleCancel = async () => {
    const confirmMessage = isOnchainLobby 
      ? `${t('cancel_lobby')} - ${t('cancel_lobby_confirm')}\n\n⚠️ Este lobby tiene entrada pagada. Se devolverán los fondos a todos los jugadores.`
      : `${t('cancel_lobby')} - ${t('cancel_lobby_confirm')}`;
      
    const ok = window.confirm(confirmMessage);
    if (!ok) return;
    
    setIsCancelling(true);
    try {
      if (isOnchainLobby) {
        // Lobby con entrada pagada - cancelar on-chain (incluye refund)
        await cancelLobbyOnChain();
      } else {
        // Lobby gratuito - solo cancelar en el servidor
        await cancelLobby(lobbyId);
      }
    } catch (err) {
      console.error("Error cancelando lobby:", err);
      alert(
        t('cancel_lobby') + ': ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={isCancelling}
      className={`px-6 py-3 font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:transform-none ${
        isCancelling
          ? "bg-red-500 text-white"
          : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
      }`}
    >
      {isCancelling ? t('canceling') : t('cancel_lobby')}
    </button>
  );
};

export default Game;
