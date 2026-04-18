import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from './layouts/RootLayout'
import { AssetLogsPage } from './pages/AssetLogsPage'
import { AssetsPage } from './pages/AssetsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'assets', element: <AssetsPage /> },
      { path: 'assets/:assetId/logs', element: <AssetLogsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
