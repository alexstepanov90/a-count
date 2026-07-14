import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setCurrency } from './db'
import Logo from './Logo'
import Welcome from './Welcome'
import './styles.css'

import Dashboard from './pages/Dashboard'
import Counterparties from './pages/Counterparties'
import Items from './pages/Items'
import Documents from './pages/Documents'
import DocumentEditor from './pages/DocumentEditor'
import Reconciliation from './pages/Reconciliation'
import Bank from './pages/Bank'
import Finance from './pages/Finance'
import SettingsPage from './pages/Settings'

function App() {
  const cCount = useLiveQuery(() => db.counterparties.count(), []) ?? 0
  const dCount = useLiveQuery(() => db.docs.count(), []) ?? 0
  const settings = useLiveQuery(() => db.settings.toCollection().first(), [])
  const [, force] = React.useReducer(x => x + 1, 0)

  React.useEffect(() => {
    if (settings) setCurrency(settings.currencySymbol, settings.currencyCode)
  }, [settings?.currencySymbol, settings?.currencyCode])

  if (settings === undefined) return null // база ещё открывается
  if (!settings?.agreementAcceptedAt) {
    return <Welcome onDone={() => force()} />
  }
  setCurrency(settings.currencySymbol, settings.currencyCode)

  return (
    <HashRouter>
      <div className="layout">
        <aside className="sidebar no-print">
          <div className="brand">
            <Logo variant="light" height={44} />
          </div>
          <nav className="nav">
            <NavLink to="/" end>Главная</NavLink>
            <NavLink to="/docs">Документы <span className="count">{dCount}</span></NavLink>
            <NavLink to="/counterparties">Контрагенты <span className="count">{cCount}</span></NavLink>
            <NavLink to="/items">Товары и склад</NavLink>
            <NavLink to="/bank">Банк и оплаты</NavLink>
            <NavLink to="/finance">Финансы</NavLink>
            <NavLink to="/recon">Акт сверки</NavLink>
            <NavLink to="/settings">Мои реквизиты</NavLink>
          </nav>
          <div className="foot">Данные хранятся только на этом устройстве</div>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/docs" element={<Documents />} />
            <Route path="/docs/new" element={<DocumentEditor />} />
            <Route path="/docs/:id" element={<DocumentEditor />} />
            <Route path="/counterparties" element={<Counterparties />} />
            <Route path="/items" element={<Items />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/recon" element={<Reconciliation />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
