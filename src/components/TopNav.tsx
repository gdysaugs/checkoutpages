import { NavLink } from 'react-router-dom'

export function TopNav() {
  return (
    <header className='top-nav top-nav--guest'>
      <div className='top-nav__brand'>
        <NavLink className='top-nav__title' to='/'>
          SparkHeart Checkout
        </NavLink>
      </div>

      <div className='top-nav__links'>
        <NavLink className={({ isActive }) => `top-nav__link${isActive ? ' is-active' : ''}`} to='/'>
          購入トップ
        </NavLink>
        <NavLink className={({ isActive }) => `top-nav__link${isActive ? ' is-active' : ''}`} to='/terms'>
          利用規約
        </NavLink>
        <NavLink className={({ isActive }) => `top-nav__link${isActive ? ' is-active' : ''}`} to='/tokushoho'>
          特商法
        </NavLink>
      </div>
    </header>
  )
}
