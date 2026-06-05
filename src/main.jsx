import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Initialize theme from localStorage or system preference before React mounts
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const theme = savedTheme || (prefersDark ? 'dark' : 'light');
if (theme === 'dark') document.documentElement.classList.add('dark');
else document.documentElement.classList.remove('dark');

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
