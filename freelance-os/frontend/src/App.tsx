import './index.css'
import { useEffect, useState } from 'react'

interface HealthStatus {
  status: string
  timestamp: string
  uptime: number
  version: string
  services: {
    database: string
    redis: string
  }
}

function App() {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHealthData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Erreur connexion API:', err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">
          🚀 FreelanceOS
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          {loading ? 'Vérification des services...' : 'Tous les services sont opérationnels !'}
        </p>
        
        {healthData && (
          <div className="mb-4 text-sm text-muted-foreground">
            <p>Serveur actif depuis: {Math.round(healthData.uptime)}s</p>
            <p>Version: {healthData.version}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="bg-card p-4 rounded-lg border">
            <h3 className={`font-semibold ${healthData?.services?.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
              {healthData?.services?.database === 'connected' ? '✅' : '❌'} Backend
            </h3>
            <p className="text-sm text-muted-foreground">Node.js + Fastify</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="font-semibold text-green-600">✅ Frontend</h3>
            <p className="text-sm text-muted-foreground">React + Vite</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <h3 className={`font-semibold ${healthData?.services?.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
              {healthData?.services?.database === 'connected' ? '✅' : '❌'} Database
            </h3>
            <p className="text-sm text-muted-foreground">PostgreSQL + Prisma</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <h3 className={`font-semibold ${healthData?.services?.redis === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
              {healthData?.services?.redis === 'connected' ? '✅' : '❌'} Cache
            </h3>
            <p className="text-sm text-muted-foreground">Redis</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-8">
          Prêt pour la Phase 2 : Authentification
        </p>
      </div>
    </div>
  )
}

export default App