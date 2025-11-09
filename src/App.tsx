import { Routes, Route } from "react-router-dom";
import { SocketProvider } from "./contexts/SocketContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Lobbies from "./pages/Lobbies";
import Game from "./pages/Game";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { Analytics } from "@vercel/analytics/react";

function App() {
  return (
    <SocketProvider>
      <LanguageSwitcher />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/lobbies" element={<Lobbies />} />
        <Route path="/game/:lobbyId" element={<Game />} />
      </Routes>
      <Analytics />
    </SocketProvider>
  );
}

export default App;
