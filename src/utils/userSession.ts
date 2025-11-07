// Utilidad para manejar sesión de usuario EVM
// Rehydrate from localStorage so session survives page reloads
let userSession: { id: string; username: string; walletAddress: string } | null = null;
try {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('userSession') : null;
  if (raw) {
    userSession = JSON.parse(raw);
  }
} catch (e) {
  // ignore parse errors
  userSession = null;
}

// Crear sesión EVM con dirección de wallet como username
export function createUserSession(walletAddress: string): { id: string; username: string; walletAddress: string } {
  if (!walletAddress) {
    throw new Error('La dirección de wallet es requerida');
  }
  // Persistencia de userId
  let uniqueId = localStorage.getItem('userId');
  if (!uniqueId) {
    uniqueId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('userId', uniqueId);
  }
  userSession = {
    id: uniqueId,
    username: walletAddress, // La dirección ES el username
    walletAddress: walletAddress
  };
  try {
    localStorage.setItem('userSession', JSON.stringify(userSession));
  } catch (e) {}
  console.log(`👤 Sesión EVM creada: ${walletAddress} (${uniqueId})`);
  return userSession;
}

// Obtener sesión actual (no crear una nueva automáticamente para EVM-only)
export function getUserSession(): { id: string; username: string; walletAddress: string } | null {
  // If in-memory session is missing, attempt to rehydrate from localStorage
  if (!userSession) {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('userSession') : null;
      if (raw) {
        userSession = JSON.parse(raw);
      }
    } catch (e) {
      userSession = null;
    }
  }
  return userSession;
}

// Limpiar sesión actual
export function clearUserSession(): void {
  userSession = null;
  try {
    localStorage.removeItem('userSession');
  } catch (e) {}
}

// Funciones de conveniencia
export const getUserId = () => getUserSession()?.id || '';
export const getUserName = () => getUserSession()?.username || '';
export const getWalletAddress = () => getUserSession()?.walletAddress || '';