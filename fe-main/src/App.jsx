import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rangking from './pages/Ranking'; // <-- 1. IMPORT HALAMAN BARU DI SINI

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Jika user mengakses root URL, langsung arahkan ke halaman Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Rute Halaman */}
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* <-- 2. TAMBAHKAN RUTE RANGKING DI SINI --> */}
        {/* Kita buat dua rute agar URL dengan atau tanpa garis miring di akhir tetap bisa diakses */}
        <Route path="/rangking" element={<Rangking />} />
        <Route path="/rangking/" element={<Rangking />} />
        <Route path="/ranking" element={<Rangking />} />
        <Route path="/ranking/" element={<Rangking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;