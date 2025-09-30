const assert = require('assert');
const { LobbyManager } = require('../lobbyManager');

(async () => {
  const mgr = new LobbyManager();

  // Create lobby and two players
  const res = mgr.createLobby({ name: 't', type: 'publico' }, 'host1', 'hostuser', 'wallet', 'socket1');
  assert(res.success, 'createLobby should succeed');
  const lobbyId = res.lobby.id;

  const joinRes = mgr.joinLobby(lobbyId, 'p2', 'user2', 'wallet2', 'socket2');
  assert(joinRes.success, 'join should succeed');

  // schedule disconnect grace for both with small ms
  let expelled = [];
  mgr.handleDisconnectGrace(lobbyId, 'host1', () => { expelled.push('host1'); }, 200);
  mgr.handleDisconnectGrace(lobbyId, 'p2', () => { expelled.push('p2'); }, 200);

  // Ensure timeouts exist
  assert(mgr.disconnectTimeouts.has('host1'));
  assert(mgr.disconnectTimeouts.has('p2'));

  // Now cleanup the lobby immediately
  const cleaned = mgr.cleanupLobby(lobbyId);
  assert(cleaned, 'cleanupLobby should return true');

  // After cleanup, lobbies should not have the lobby
  assert(!mgr.lobbies.has(lobbyId), 'lobby should be deleted');
  assert(!mgr.playerLobbyMap.has('host1'), 'host mapping removed');
  assert(!mgr.playerLobbyMap.has('p2'), 'player mapping removed');

  // And any pending timeouts should be cleared
  assert(!mgr.disconnectTimeouts.has('host1'), 'timeout cleared for host');
  assert(!mgr.disconnectTimeouts.has('p2'), 'timeout cleared for p2');

  // Wait 300ms to ensure any scheduled callbacks would have run if not cleared
  await new Promise(r => setTimeout(r, 300));

  assert(expelled.length === 0, 'no expel callbacks should have fired after cleanup');

  console.log('PASS: cleanupLobby cleared timeouts and removed mappings');
  process.exit(0);
})();
