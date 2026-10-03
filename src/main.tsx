import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ShellChromeProvider } from './components/ShellChrome.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShellChromeProvider>
      <App />
    </ShellChromeProvider>
  </StrictMode>,
);

