import { Routes, Route } from "react-router-dom";
import { SocketProvider } from "./contexts/SocketContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Lobbies from "./pages/Lobbies";
import Game from "./pages/Game";

function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/lobbies" element={<Lobbies />} />
        <Route path="/game/:lobbyId" element={<Game />} />
      </Routes>
    </SocketProvider>
  );
}

export default App;
