import type { Card } from '../types/game';

// Mapeo de cartas a imágenes (basado en tu estructura de carpeta /cards/)
export function getCardImageSrc(card: Card): string {
  // Build a manifest of all card image URLs using Vite's import.meta.glob
  // The keys will be relative paths like '../assets/cards/red-4a.png'
  const images: Record<string, string> = import.meta.glob('../assets/cards/*.png', { eager: true, as: 'url' }) as Record<string, string>;

  const color = (card.color || '').toLowerCase();
  const valueRaw = String(card.value || '').toLowerCase();
  const variant = (card.variant || 'a').toLowerCase();

  // Helper to try possible filenames and return the resolved URL if found
  const tryFiles = (candidates: string[]) => {
    for (const name of candidates) {
      const rel = `../assets/cards/${name}`;
      if (images[rel]) return images[rel];
    }
    return undefined;
  };

  // Number cards: "red-4a.png" or "blue-7b.png"
  if (card.type === 'Number') {
    const file = `${color}-${valueRaw}${variant}.png`;
    return tryFiles([file]) ?? (images['../assets/cards/back.png'] || '') ;
  }

  // Action cards: DrawTwo -> colorplus-a.png, Skip -> colorskip-a.png, Reverse -> colorreverse-a.png
  if (card.type === 'Action') {
    if (valueRaw === 'drawtwo' || valueRaw === 'drawtwo'.toLowerCase()) {
      const file = `${color}plus-${variant}.png`;
      return tryFiles([file]) ?? (images['../assets/cards/back.png'] || '');
    }
    if (valueRaw === 'skip') {
      const file = `${color}skip-${variant}.png`;
      return tryFiles([file]) ?? (images['../assets/cards/back.png'] || '');
    }
    if (valueRaw === 'reverse') {
      const file = `${color}reverse-${variant}.png`;
      return tryFiles([file]) ?? (images['../assets/cards/back.png'] || '');
    }
  }

  // Wild cards
  if (card.type === 'Wild') {
    if (valueRaw === 'wild') {
      const file = `wild-${variant}.png`;
      return tryFiles([file]) ?? (images['../assets/cards/back.png'] || '');
    }
    if (valueRaw === 'wilddrawfour' || valueRaw === 'wilddraw4' || valueRaw === '+4') {
      // The deck asset seems to be named "+4.png"
      return images['../assets/cards/+4.png'] || (images['../assets/cards/back.png'] || '');
    }
  }

  // Default fallback
  return images['../assets/cards/back.png'] || '';
}

// Validar si una carta puede jugarse
export function isValidPlay(
  cardToPlay: Card,
  topDiscardCard: Card,
  currentActiveColor: string | null,
  drawStackActive: boolean
): boolean {
  // Wild cards siempre se pueden jugar (excepto si hay stack activo)
  if (cardToPlay.color === 'Wild' && !drawStackActive) {
    return true;
  }

  // Si hay stack de +2/+4 activo, solo se pueden jugar +2/+4
  if (drawStackActive) {
    if (cardToPlay.value === 'DrawTwo' && topDiscardCard.value === 'DrawTwo') {
      return true;
    }
    if (cardToPlay.value === 'WildDrawFour' && topDiscardCard.value === 'WildDrawFour') {
      return true;
    }
    return false;
  }

  // Coincidir color o valor
  const colorMatch = cardToPlay.color === currentActiveColor;
  const valueMatch = cardToPlay.value === topDiscardCard.value;
  
  return colorMatch || valueMatch;
}

// Crear baraja completa (basado en tu lógica)
export function createDeck(): Card[] {
  const deck: Card[] = [];
  const colors: Array<'Red' | 'Blue' | 'Green' | 'Yellow'> = ['Red', 'Blue', 'Green', 'Yellow'];
  const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const actions = ['Skip', 'Reverse', 'DrawTwo'];

  // Números por color
  colors.forEach((color) => {
    // Cero: solo a/b (no duplicados)
    deck.push({ 
      id: `${color}-0-a`, 
      color, 
      value: '0', 
      type: 'Number', 
      variant: 'a' 
    });
    deck.push({ 
      id: `${color}-0-b`, 
      color, 
      value: '0', 
      type: 'Number', 
      variant: 'b' 
    });

    // 1-9: dos de cada (a/b)
    numbers.slice(1).forEach((num) => {
      deck.push({ 
        id: `${color}-${num}-a`, 
        color, 
        value: num, 
        type: 'Number', 
        variant: 'a' 
      });
      deck.push({ 
        id: `${color}-${num}-b`, 
        color, 
        value: num, 
        type: 'Number', 
        variant: 'b' 
      });
    });

    // Acciones: dos de cada (a/b)
    actions.forEach((action) => {
      deck.push({ 
        id: `${color}-${action}-a`, 
        color, 
        value: action, 
        type: 'Action', 
        variant: 'a' 
      });
      deck.push({ 
        id: `${color}-${action}-b`, 
        color, 
        value: action, 
        type: 'Action', 
        variant: 'b' 
      });
    });
  });

  // Wild cards: 4 diseños diferentes
  const wildVariants: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
  wildVariants.forEach((variant) => {
    deck.push({ 
      id: `wild-${variant}`, 
      color: 'Wild', 
      value: 'Wild', 
      type: 'Wild', 
      variant 
    });
  });

  // Wild Draw Four: 4 cartas iguales
  for (let i = 0; i < 4; i++) {
    deck.push({ 
      id: `wilddrawfour-${i}`, 
      color: 'Wild', 
      value: 'WildDrawFour', 
      type: 'Wild' 
    });
  }

  return deck;
}

// Barajar cartas (Fisher-Yates)
export function shuffleDeck(deck: Card[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Obtener color para display
export function getCardDisplayColor(card: Card, activeColor?: string): string {
  if (card.color === 'Wild' && activeColor) {
    return activeColor;
  }
  return card.color;
}

// Obtener emoji para ranking
export function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈'; 
    case 3: return '🥉';
    default: return `${rank}°`;
  }
}

// Obtener nombre del ranking
export function getRankName(rank: number): string {
  switch (rank) {
    case 1: return 'ORO';
    case 2: return 'PLATA';
    case 3: return 'BRONCE';
    default: return `${rank}° LUGAR`;
  }
}