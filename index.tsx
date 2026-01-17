
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

//console.log("VITE_API_KEY=", import.meta.env.VITE_API_KEY);
//console.log("MODE=", import.meta.env.MODE);
//console.log("PROD=", import.meta.env.PROD);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
