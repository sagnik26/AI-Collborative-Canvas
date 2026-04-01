import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, PenTool, Sparkles } from 'lucide-react';
import styles from './AppLayout.module.css';

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="Primary">
        <div className={styles.productIconWrap} aria-label="Product">
          <div className={styles.productIcon} aria-hidden="true">
            <Sparkles size={18} />
          </div>
        </div>
        <div className={styles.navGroup}>
          <NavLink
            to="/design"
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
            aria-label="Design"
            title="Design"
          >
            <span className={styles.navIcon} aria-hidden="true">
              <PenTool size={20} />
            </span>
            <span className={styles.srOnly}>Design</span>
          </NavLink>
          <NavLink
            to="/canvas"
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
            aria-label="Canvas"
            title="Canvas"
          >
            <span className={styles.navIcon} aria-hidden="true">
              <LayoutDashboard size={20} />
            </span>
            <span className={styles.srOnly}>Canvas</span>
          </NavLink>
        </div>
      </nav>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}

