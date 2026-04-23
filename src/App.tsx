import { Navigate, Route, Routes } from 'react-router-dom'
import { Purchase } from './pages/Purchase'
import { Terms } from './pages/Terms'
import { Tokushoho } from './pages/Tokushoho'

export function App() {
  return (
    <Routes>
      <Route path='/' element={<Purchase />} />
      <Route path='/purchase' element={<Navigate to='/' replace />} />
      <Route path='/terms' element={<Terms />} />
      <Route path='/tokushoho' element={<Tokushoho />} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}
