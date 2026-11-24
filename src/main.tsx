import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {errorLogger} from './utils/errorLogger.ts';

errorLogger.install();

createRoot(document.getElementById('root')!).render(<App />);
