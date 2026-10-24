import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [materiList, setMateriList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [userRole, setUserRole] = useState('siswa');
  const [activeTab, setActiveTab] = useState('materi'); 
  
  const [jsonFile, setJsonFile] = useState(null);
  const [quizTitle, setQuizTitle] = useState(''); // TAMBAHAN: State untuk judul soal
  const [uploadStatus, setUploadStatus] = useState({ loading: false, message: '', type: '' });

  const navigate = useNavigate();

  const getRoleFromToken = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload).role || 'siswa';
    } catch (e) {
      return 'siswa';
    }
  };

  useEffect(() => {
    const fetchMateri = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/login');
        return;
      }

      const role = getRoleFromToken(token);
      setUserRole(role);

      try {
        const response = await fetch('/api/content/courses', { // Menggunakan /courses (sudah diperbaiki)
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            navigate('/login');
            return;
          }
          throw new Error(data.detail || 'Gagal mengambil data materi.');
        }

        let rawData = data.data || data;
        if (!Array.isArray(rawData)) {
          rawData = [];
        }
        setMateriList(rawData);
        
      } catch (err) {
        console.error(err);
        setMateriList([]); 
        setError('Gagal mengambil data materi dari server.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMateri();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleFileChange = (e) => {
    setJsonFile(e.target.files[0]);
    setUploadStatus({ loading: false, message: '', type: '' });
  };

  const handleUpload = async () => {
    // Validasi input judul
    if (!quizTitle.trim()) {
      setUploadStatus({ loading: false, message: 'Judul kumpulan soal wajib diisi.', type: 'error' });
      return;
    }

    if (!jsonFile) {
      setUploadStatus({ loading: false, message: 'Pilih file JSON terlebih dahulu.', type: 'error' });
      return;
    }

    setUploadStatus({ loading: true, message: 'Sedang membaca file...', type: 'info' });
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const jsonPayload = JSON.parse(e.target.result);
        
        // Membungkus judul dan array soal ke dalam satu objek sesuai schema backend baru
        const finalPayload = {
          title: quizTitle,
          questions: jsonPayload
        };

        setUploadStatus({ loading: true, message: 'Mengirim data ke server...', type: 'info' });

        const token = localStorage.getItem('token');
        
        const response = await fetch('/api/assessment/questions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(finalPayload)
        });

        const result = await response.json();

        if (response.ok) {
          setUploadStatus({ loading: false, message: result.message || 'Soal berhasil diunggah!', type: 'success' });
          setJsonFile(null); 
          setQuizTitle(''); // Reset judul setelah berhasil
        } else {
          setUploadStatus({ loading: false, message: result.detail || 'Gagal mengunggah soal.', type: 'error' });
        }
      } catch (error) {
        setUploadStatus({ loading: false, message: 'Format file JSON tidak valid. Pastikan formatnya adalah Array of Objects.', type: 'error' });
      }
    };

    reader.readAsText(jsonFile);
  };

  return (
    <div className="min-h-screen bg-gray-100">
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

      <main className="max-w-6xl mx-auto p-6 mt-6">
        <div className="flex gap-6 border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('materi')}
            className={`pb-3 font-medium text-lg transition-colors ${activeTab === 'materi' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            📚 Materi Pembelajaran
          </button>
          
          {userRole === 'admin' && (
            <button 
              onClick={() => setActiveTab('upload')}
              className={`pb-3 font-medium text-lg transition-colors ${activeTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ➕ Tambah Soal (Upload JSON)
            </button>
          )}
        </div>

        {activeTab === 'materi' && (
          <div>
            {isLoading && (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">{error}</div>}

            {!isLoading && !error && materiList.length === 0 && (
              <div className="text-center py-20 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
                Belum ada materi yang tersedia saat ini.
              </div>
            )}

            {!isLoading && !error && materiList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {materiList.map((materi, index) => (
                  <div key={materi.id || index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
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
          </div>
        )}

        {activeTab === 'upload' && userRole === 'admin' && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Tambah Kumpulan Soal Baru</h2>
            
            {/* TAMBAHAN: Input Judul Kumpulan Soal */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Judul Kumpulan Soal:</label>
              <input 
                type="text" 
                placeholder="Contoh: UTS Grammar 2026"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="w-full text-gray-700 border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500 bg-gray-50"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Pilih file JSON:</label>
              <input 
                type="file" 
                accept=".json"
                onChange={handleFileChange}
                className="w-full text-gray-700 border border-gray-300 rounded-lg p-2 focus:outline-none focus:border-blue-500 bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-sm text-gray-500 mt-2">Pastikan format JSON sesuai dengan template standar (Array of Objects).</p>
            </div>

            <button 
              onClick={handleUpload}
              disabled={uploadStatus.loading}
              className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${uploadStatus.loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {uploadStatus.loading ? 'Memproses...' : 'Upload & Simpan Soal'}
            </button>

            {uploadStatus.message && (
              <div className={`mt-6 p-4 rounded-lg font-medium border ${uploadStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : uploadStatus.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {uploadStatus.message}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}