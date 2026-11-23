import { AppLayout } from '../components/layout/AppLayout.tsx'
import { DashboardPage } from '../pages/DashboardPage.tsx'

export function App() {
  return (
    <AppLayout sectionTitle="Dashboard">
      <DashboardPage />
    </AppLayout>
  )
}
