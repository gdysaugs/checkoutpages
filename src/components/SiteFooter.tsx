import { NavLink } from 'react-router-dom'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__links">
        <NavLink className="site-footer__link" to="/terms">
          利用規約
        </NavLink>
        <NavLink className="site-footer__link" to="/tokushoho">
          特商法
        </NavLink>
      </div>
    </footer>
  )
}
