import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
