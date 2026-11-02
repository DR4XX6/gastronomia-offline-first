import HomePage from './pages/HomePage'
import { useEffect } from 'react'
import { initializeLocalDatabase } from './db/database'


function App() {
  
useEffect(() => {
  console.log('Iniciando base de datos local...')

  initializeLocalDatabase()
    .then((version) => {
      console.log('SQLite inicializado correctamente')
      console.log('Versión de SQLite:', version)
      console.log('Base de datos OPFS abierta')
    })
    .catch((error) => {
      console.error('❌ Error al inicializar SQLite:', error)
    })
}, [])

  return <HomePage />
}

export default App