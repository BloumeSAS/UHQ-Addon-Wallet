import { Routes, Route } from 'react-router-dom';
import { AddonProvider } from './context';
import MyBalance       from './pages/MyBalance';
import AdminBalances   from './pages/AdminBalances';
import DashboardWidget from './widgets/DashboardWidget';

/**
 * Routes :
 *   /                  → page utilisateur  (nav panel)
 *   /admin             → page admin        (nav panel)
 *   /widget/dashboard  → widget compact    (AddonPageBar sur Dashboard)
 */
export default function App() {
  return (
    <AddonProvider>
      <Routes>
        <Route path="/"                  element={<MyBalance />} />
        <Route path="/admin"             element={<AdminBalances />} />
        <Route path="/widget/dashboard"  element={<DashboardWidget />} />
      </Routes>
    </AddonProvider>
  );
}
