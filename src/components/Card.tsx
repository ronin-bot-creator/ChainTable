import React from "react";
import type { Card as CardType } from "../types/game";
import { getCardImageSrc } from "../utils/gameUtils";

interface CardProps {
  card: CardType;
  onClick?: () => void;
  onDoubleClick?: () => void;
  isSelected?: boolean;
  isPlayable?: boolean;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  card,
  onClick,
  onDoubleClick,
  isSelected = false,
  isPlayable = true,
  size = "md",
  showTooltip = false,
  className = "",
}) => {
  const imageSrc = getCardImageSrc(card);

  const sizeClasses = {
    sm: "w-12 h-16",
    md: "w-16 h-24",
    lg: "w-20 h-30",
  };

  const cardClasses = [
    "relative rounded-xl overflow-hidden shadow-lg transition-all duration-300 cursor-pointer border-2",
    sizeClasses[size],
    isSelected
      ? "ring-4 ring-blue-400 ring-opacity-75 transform -translate-y-3 scale-110 border-blue-400 shadow-2xl shadow-blue-400/50"
      : "border-transparent",
    isPlayable
      ? "hover:scale-110 hover:shadow-2xl hover:shadow-blue-500/30 hover:-translate-y-2"
      : "opacity-50 cursor-not-allowed",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    console.debug("Card.handleClick called", { card, isPlayable });
    if (isPlayable && onClick) {
      onClick();
    }
  };

  const handleDoubleClick = () => {
    if (isPlayable && onDoubleClick) {
      onDoubleClick();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    try {
      // Log the event target classes to detect overlays or disabled state
      const target = e.currentTarget as HTMLElement;
      console.debug("Card.pointerDown", {
        card,
        isPlayable,
        classList: target.className,
      });
    } catch (err) {
      console.debug("Card.pointerDown error", err);
    }
  };

  const getCardTitle = () => {
    if (card.type === "Wild") {
      return `Comodín ${card.value === "WildDrawFour" ? "+4" : ""}`;
    }

    let title = `${card.color} `;

    switch (card.value) {
      case "Skip":
        title += "Saltar";
        break;
      case "Reverse":
        title += "Reversa";
        break;
      case "DrawTwo":
        title += "+2";
        break;
      default:
        title += card.value;
    }

    return title;
  };

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      title={showTooltip ? getCardTitle() : undefined}
    >
      <img
        src={imageSrc}
        alt={getCardTitle()}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Indicador de carta jugable */}
      {isPlayable && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full opacity-70" />
      )}

      {/* Overlay para cartas no jugables */}
      {!isPlayable && (
        <div className="absolute inset-0 bg-gray-900 opacity-30" />
      )}
    </div>
  );
};

export default Card;
