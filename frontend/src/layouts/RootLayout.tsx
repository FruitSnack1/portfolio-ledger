import { Link, Outlet } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'

export function RootLayout() {
  return (
    <div className="layout">
      <header className="topbar">
        <Link to="/" className="brand">
          Portfolio Ledger
        </Link>
        <div className="topbar-right">
          <ThemeToggle />
          <nav className="nav">
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
