import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [materiList, setMateriList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fungsi untuk menarik data dari Content Service
    const fetchMateri = async () => {
      // 1. Ambil token dari brankas browser
      const token = localStorage.getItem('token');
      
      // Jika tidak ada token (belum login), tendang ke halaman login
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        // 2. Minta data ke API Gateway (yang akan diteruskan ke Content Service)
        // Sesuaikan URL ini jika rute di Content Service Anda berbeda (misal: /api/content/materi)
        const response = await fetch('/api/content/courses', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`, // <-- INI KUNCI UTAMANYA: Mengirim token ke backend
            'Content-Type': 'application/json'
          }
        });

        // 3. Jika token kadaluarsa atau tidak valid
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        const data = await response.json();
        
        // 4. Simpan data ke state React (menyesuaikan format respons FastAPI)
        // Biasanya FastAPI mengembalikan list langsung, atau dibungkus dalam key 'data'
        setMateriList(data.data || data || []);
        
      } catch (err) {
        setError('Gagal mengambil data materi dari server.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMateri();
  }, [navigate]);

  // Fungsi untuk Keluar (Logout)
  const handleLogout = () => {
    localStorage.removeItem('token'); // Hapus kunci JWT
    navigate('/login'); // Arahkan kembali ke login
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar Minimalis */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">LMS Dashboard</h1>
        <div className="flex gap-4 items-center">
          <a href="/rangking/" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Papan Skor</a>
          <button 
            onClick={handleLogout}
            className="text-red-500 font-medium hover:text-red-700 transition-colors px-3 py-1 border border-red-500 rounded-lg hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Konten Utama */}
      <main className="max-w-6xl mx-auto p-6 mt-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Materi Pembelajaran</h2>
        
        {/* State: Sedang Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* State: Error */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
            {error}
          </div>
        )}

        {/* State: Data Kosong */}
        {!isLoading && !error && materiList.length === 0 && (
          <div className="text-center py-20 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
            Belum ada materi yang tersedia saat ini.
          </div>
        )}

        {/* State: Menampilkan Data Asli */}
        {!isLoading && !error && materiList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materiList.map((materi, index) => (
              <div key={materi.id || index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                {/* Asumsi kolom di tabel Content Anda adalah 'title/judul' dan 'description/deskripsi' */}
                <h3 className="text-lg font-bold text-gray-800 mb-2">{materi.title || materi.judul || "Materi Tanpa Judul"}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {materi.description || materi.deskripsi || "Tidak ada deskripsi."}
                </p>
                
                <div className="flex gap-2 mt-4">
                  <button className="flex-1 bg-blue-50 text-blue-600 font-semibold py-2 rounded-lg hover:bg-blue-100 transition-colors">Baca</button>
                  <a href="/assessment/" className="flex-1 text-center bg-green-50 text-green-600 font-semibold py-2 rounded-lg hover:bg-green-100 transition-colors">Ujian</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}