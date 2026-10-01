import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './styles/game-frame.css'
import './styles/hud.css'
import './styles/board.css'
import './styles/game-footer.css'
import './styles/phase.css'
import './styles/feedback.css'
import './styles/animations.css'
import './styles/motion.css'
import './styles/responsive.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
