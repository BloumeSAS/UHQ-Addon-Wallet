import { Routes, Route } from 'react-router-dom';
import { AddonProvider } from './context';
import MyBalance       from './pages/MyBalance';
import AdminBalances   from './pages/AdminBalances';
import DashboardWidget from './widgets/DashboardWidget';
import BalancesWidget  from './widgets/BalancesWidget';

/**
 * Routes :
 *   /                  → page utilisateur  (nav panel)
 *   /admin             → page admin        (nav panel)
 *   /widget/dashboard  → widget compact    (AddonPageBar sur Dashboard)
 *   /widget/balances   → widget table      (AddonPageBar sur SubUsers)
 */
export default function App() {
  return (
    <AddonProvider>
      <Routes>
        <Route path="/"                  element={<MyBalance />} />
        <Route path="/admin"             element={<AdminBalances />} />
        <Route path="/widget/dashboard"  element={<DashboardWidget />} />
        <Route path="/widget/balances"   element={<BalancesWidget />} />
      </Routes>
    </AddonProvider>
  );
}
