import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { AllLogsPage } from './pages/AllLogsPage'
import { AssetDetailPage } from './pages/AssetDetailPage'
import { AssetsPage } from './pages/AssetsPage'
import { RootLayout } from './layouts/RootLayout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

function LegacyAssetLogsRedirect() {
  const { assetId } = useParams<{ assetId: string }>()
  if (!assetId) return <Navigate to="/assets" replace />
  return <Navigate to={`/assets/${assetId}`} replace />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'logs', element: <AllLogsPage /> },
      { path: 'assets', element: <AssetsPage /> },
      { path: 'assets/:assetId', element: <AssetDetailPage /> },
      { path: 'assets/:assetId/logs', element: <LegacyAssetLogsRedirect /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
