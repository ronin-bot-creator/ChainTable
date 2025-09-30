import React from 'react';
import Card from './Card';
import type { Card as CardType } from '../types/game';
import { isValidPlay } from '../utils/gameUtils';

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
  className = '',
}) => {
  const handleCardClick = (cardIndex: number) => {
    if (!isMyTurn) return;
    
    const card = cards[cardIndex];
    const canPlay = currentCard ? isValidPlay(card, currentCard, currentActiveColor, drawStackActive) : true;
    
    if (canPlay) {
      onCardPlay(cardIndex);
    }
  };

  return (
    <div className={`player-hand ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">
          Tu mano ({cards.length} cartas)
        </h3>
        
        {isMyTurn && (
          <div className="px-3 py-1 bg-green-500 text-white text-sm rounded-full animate-pulse">
            Tu turno
          </div>
        )}
      </div>

      {/* Cards container */}
      <div className="relative">
        {cards.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No tienes cartas
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-4 bg-gray-800 rounded-lg min-h-32">
            {cards.map((card, index) => {
              const canPlay = isMyTurn && currentCard ? isValidPlay(card, currentCard, currentActiveColor, drawStackActive) : false;
              
              return (
                <Card
                  key={`${card.color}-${card.value}-${card.variant || 'default'}-${index}`}
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
          <div className="absolute -top-2 -right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-bounce">
            ¡UNO!
          </div>
        )}
        
        {/* No playable cards message */}
        {isMyTurn && cards.length > 0 && currentCard && 
         !cards.some(card => isValidPlay(card, currentCard, currentActiveColor, drawStackActive)) && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="bg-red-600 text-white px-4 py-2 rounded-lg text-center">
              <p className="font-semibold">No tienes cartas jugables</p>
              <p className="text-sm">Debes robar una carta</p>
            </div>
          </div>
        )}
      </div>

      {/* Hand statistics */}
      <div className="mt-2 text-xs text-gray-400 flex gap-4">
        <span>Números: {cards.filter(c => c.type === 'Number').length}</span>
        <span>Acciones: {cards.filter(c => c.type === 'Action').length}</span>
        <span>Comodines: {cards.filter(c => c.type === 'Wild').length}</span>
      </div>
    </div>
  );
};

export default PlayerHand;