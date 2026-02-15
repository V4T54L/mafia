import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { Landing } from './pages/Landing'
import { Join } from './pages/Join'
import { Lobby } from './pages/Lobby'
import { Game } from './pages/Game'

function App() {
  return (
    <BrowserRouter>
      <WebSocketProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game/:code" element={<Game />} />
        </Routes>
      </WebSocketProvider>
    </BrowserRouter>
  )
}

export default App
