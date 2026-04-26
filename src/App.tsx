import { Navigate, Route, Routes } from 'react-router-dom'
import { Invader } from './pages/Invader'
import { Purchase } from './pages/Purchase'
import { Terms } from './pages/Terms'
import { Tokushoho } from './pages/Tokushoho'

export function App() {
  return (
    <Routes>
      <Route path='/' element={<Invader />} />
      <Route path='/purchage' element={<Purchase />} />
      <Route path='/purchase' element={<Navigate to='/purchage' replace />} />
      <Route path='/terms' element={<Terms />} />
      <Route path='/tokushoho' element={<Tokushoho />} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}
