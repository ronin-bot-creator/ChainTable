import React from "react";
import Card from "./Card";
import type { Card as CardType } from "../types/game";
import { isValidPlay } from "../utils/gameUtils";

interface PlayerHandProps {
  cards: CardType[];
  currentCard: CardType | null;
  currentActiveColor: string | null;
  drawStackActive: boolean;
  isMyTurn: boolean;
  onCardPlay: (cardIndex: number) => void;
  className?: string;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  currentCard,
  currentActiveColor,
  drawStackActive,
  isMyTurn,
  onCardPlay,
  className = "",
}) => {
  const handleCardClick = (cardIndex: number) => {
    if (!isMyTurn) return;

    const card = cards[cardIndex];
    const canPlay = currentCard
      ? isValidPlay(card, currentCard, currentActiveColor, drawStackActive)
      : true;

    if (canPlay) {
      onCardPlay(cardIndex);
    }
  };

  return (
    <div className={`player-hand ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🃏</span>
          Tu mano <span className="text-blue-400">({cards.length})</span>
        </h3>

        {isMyTurn && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm rounded-full animate-pulse shadow-lg shadow-green-500/50">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span className="font-bold">Tu turno</span>
          </div>
        )}
      </div>

      {/* Cards container */}
      <div className="relative">
        {cards.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700">
            <div className="text-4xl mb-2">🎴</div>
            <p className="text-gray-400 text-lg">No tienes cartas</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 min-h-32 shadow-inner">
            {cards.map((card, index) => {
              const canPlay =
                isMyTurn && currentCard
                  ? isValidPlay(
                      card,
                      currentCard,
                      currentActiveColor,
                      drawStackActive
                    )
                  : false;

              return (
                <Card
                  key={`${card.color}-${card.value}-${
                    card.variant || "default"
                  }-${index}`}
                  card={card}
                  onClick={() => handleCardClick(index)}
                  isPlayable={canPlay}
                  size="md"
                  showTooltip={true}
                  className="hover:z-10"
                />
              );
            })}
          </div>
        )}

        {/* UNO indicator */}
        {cards.length === 1 && (
          <div className="absolute -top-4 -right-4 bg-gradient-to-r from-red-500 to-orange-600 text-white px-6 py-2 rounded-full text-lg font-bold animate-bounce shadow-2xl shadow-red-500/50 border-2 border-white">
            ¡UNO!
          </div>
        )}

        {/* No playable cards message */}
        {isMyTurn &&
          cards.length > 0 &&
          currentCard &&
          !cards.some((card) =>
            isValidPlay(card, currentCard, currentActiveColor, drawStackActive)
          ) && (
            <div className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center rounded-2xl">
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-xl text-center shadow-2xl border-2 border-red-400">
                <p className="font-bold text-lg">No tienes cartas jugables</p>
                <p className="text-sm mt-1 text-red-100">
                  Debes robar una carta
                </p>
              </div>
            </div>
          )}
      </div>

      {/* Hand statistics */}
      <div className="mt-3 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/30 rounded-full border border-blue-700/30">
          <span className="text-blue-400">🔢</span>
          <span className="text-gray-300 font-semibold">
            Números: {cards.filter((c) => c.type === "Number").length}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-900/30 rounded-full border border-orange-700/30">
          <span className="text-orange-400">⚡</span>
          <span className="text-gray-300 font-semibold">
            Acciones: {cards.filter((c) => c.type === "Action").length}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-purple-900/30 rounded-full border border-purple-700/30">
          <span className="text-purple-400">🌟</span>
          <span className="text-gray-300 font-semibold">
            Comodines: {cards.filter((c) => c.type === "Wild").length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlayerHand;
