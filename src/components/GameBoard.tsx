import { useState } from "react";

// Importa algunas cartas de tu carpeta
import red7 from "@/assets/cards/red-7a.png";
import blueSkip from "@/assets/cards/blue-0a.png";

export default function GameBoard() {
  const [hand, setHand] = useState([red7, blueSkip]);

  const playCard = (index: number) => {
    const newHand = [...hand];
    newHand.splice(index, 1);
    setHand(newHand);
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4">Tu mano</h2>
      <div className="flex">
        {hand.map((card, i) => (
          // Render as a simple image preview here; the Card component expects a `card` object, not an image URL.
          <img key={i} src={card} alt={`card-${i}`} className="w-16 h-24 object-cover rounded-md shadow mr-2" draggable={false} onClick={() => playCard(i)} />
        ))}
      </div>
    </div>
  );
}
