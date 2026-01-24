import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health')
        const data = await res.json()
        setHealth(data)
      } catch (err) {
        setHealth({ error: err.message })
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Backend Health</h2>
        {loading ? (
          <p>Loading...</p>
        ) : health?.error ? (
          <p style={{ color: 'red' }}>Error: {health.error}</p>
        ) : (
          <pre style={{ background: '#222', color: '#0f0', padding: 12 }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
      </div>
    </>
  )
}

export default App
