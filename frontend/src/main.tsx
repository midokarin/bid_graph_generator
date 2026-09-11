import React from 'react';
import { createRoot } from 'react-dom/client';
import { DiagramWorkspace as App } from './module';
import './standalone.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
