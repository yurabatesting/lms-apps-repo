import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [materiList, setMateriList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [userRole, setUserRole] = useState('siswa');
  const [activeTab, setActiveTab] = useState('materi'); 
  
  const [jsonFile, setJsonFile] = useState(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ loading: false, message: '', type: '' });

  const [historyData, setHistoryData] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // --- TAMBAHAN STATE UNTUK MANAJEMEN USER ---
  const [usersList, setUsersList] = useState([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'siswa' });
  const [userActionStatus, setUserActionStatus] = useState({ loading: false, message: '', type: '' });
  // -------------------------------------------

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
        const response = await fetch('/api/content/courses', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
          setMateriList(data.data || data || []);
        } else {
          if (response.status === 401 || response.status === 403) {
            handleLogout();
          }
        }
      } catch (err) {
        setError('Gagal mengambil data materi dari server.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMateri();
  }, [navigate]);

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/assessment/scores/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setHistoryData(data.data || []);
      }
    } catch (err) {
      console.error("Gagal menarik data riwayat", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // --- TAMBAHAN FUNGSI UNTUK MANAJEMEN USER ---
  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        // Backend mengembalikan array langsung, bukan di dalam properti 'data'
        setUsersList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Gagal menarik data pengguna", err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      setUserActionStatus({ loading: false, message: 'Username dan Password wajib diisi.', type: 'error' });
      return;
    }
    
    setUserActionStatus({ loading: true, message: 'Memproses...', type: 'info' });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      });
      const data = await response.json();
      
      if (response.ok) {
        setUserActionStatus({ loading: false, message: `User '${data.username}' berhasil dibuat!`, type: 'success' });
        setNewUser({ username: '', password: '', role: 'siswa' }); // Reset form
        fetchUsers(); // Segarkan tabel
      } else {
        setUserActionStatus({ loading: false, message: data.detail || 'Gagal membuat user.', type: 'error' });
      }
    } catch (err) {
      setUserActionStatus({ loading: false, message: 'Terjadi kesalahan jaringan.', type: 'error' });
    }
  };
  // --------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleFileChange = (e) => {
    setJsonFile(e.target.files[0]);
    setUploadStatus({ loading: false, message: '', type: '' });
  };

  const handleUpload = async () => {
    if (!quizTitle.trim() || !jsonFile) {
      setUploadStatus({ loading: false, message: 'Judul dan File JSON wajib diisi.', type: 'error' });
      return;
    }
    setUploadStatus({ loading: true, message: 'Memproses...', type: 'info' });
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const finalPayload = { title: quizTitle, questions: JSON.parse(e.target.result) };
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
          setUploadStatus({ loading: false, message: 'Soal berhasil diunggah!', type: 'success' });
          setJsonFile(null); setQuizTitle('');
        } else {
          setUploadStatus({ loading: false, message: result.detail || 'Gagal mengunggah.', type: 'error' });
        }
      } catch (error) {
        setUploadStatus({ loading: false, message: 'Format JSON tidak valid.', type: 'error' });
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
          <button onClick={handleLogout} className="text-red-500 font-medium hover:text-red-700 transition px-3 py-1 border border-red-500 rounded-lg">Logout</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 mt-6">
        {/* NAVIGASI TAB */}
        <div className="flex gap-6 border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('materi')} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'materi' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            📚 Materi Pembelajaran
          </button>
          
          {userRole === 'siswa' && (
            <button onClick={() => { setActiveTab('riwayat'); fetchHistory(); }} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'riwayat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              📈 Riwayat Nilai
            </button>
          )}
          
          {/* TAB BARU: MANAJEMEN USER (KHUSUS ADMIN) */}
          {userRole === 'admin' && (
            <button onClick={() => { setActiveTab('users'); fetchUsers(); }} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              👥 Manajemen User
            </button>
          )}

          {userRole === 'admin' && (
            <button onClick={() => setActiveTab('upload')} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              ➕ Tambah Soal
            </button>
          )}
        </div>

        {/* KONTEN TAB MATERI */}
        {activeTab === 'materi' && (
          <div>
            {isLoading && <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>}
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>}
            {!isLoading && !error && materiList.length === 0 && <div className="text-center py-20 text-gray-500 bg-white rounded-xl shadow-sm">Belum ada materi tersedia.</div>}
            {!isLoading && !error && materiList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {materiList.map((materi, index) => (
                  <div key={materi.id || index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{materi.title || "Materi Tanpa Judul"}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{materi.description || "Tidak ada deskripsi."}</p>
                    <div className="flex gap-2 mt-4">
                      <button className="flex-1 bg-blue-50 text-blue-600 font-semibold py-2 rounded-lg">Baca</button>
                      <a href="/assessment/" className="flex-1 text-center bg-green-50 text-green-600 font-semibold py-2 rounded-lg">Ujian</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KONTEN TAB RIWAYAT NILAI (GRAFIK) */}
        {activeTab === 'riwayat' && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Grafik Perkembangan Belajar</h2>
            <p className="text-gray-500 mb-8">Memantau riwayat skor ujian Anda dari waktu ke waktu.</p>
            
            {isHistoryLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div></div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-20 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                Anda belum pernah mengerjakan ujian. Ayo mulai berlatih!
              </div>
            ) : (
              <div className="h-96 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6b7280'}} tickMargin={15}/>
                    <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#6b7280'}}/>
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} labelStyle={{fontWeight: 'bold', color: '#374151', marginBottom: '4px'}}/>
                    <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} name="Skor" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* KONTEN TAB MANAJEMEN USER (ADMIN) */}
        {activeTab === 'users' && userRole === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Tambah User */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-1 h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Buat Pengguna Baru</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input type="text" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 focus:outline-none" placeholder="Masukkan username" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 focus:outline-none" placeholder="Buat sandi yang kuat" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role Akun</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 focus:outline-none">
                    <option value="siswa">Siswa</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={userActionStatus.loading} className={`w-full py-2.5 rounded-lg font-bold text-white transition ${userActionStatus.loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {userActionStatus.loading ? 'Menyimpan...' : 'Daftarkan Pengguna'}
                </button>
              </form>

              {userActionStatus.message && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-medium border ${userActionStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : userActionStatus.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {userActionStatus.message}
                </div>
              )}
            </div>

            {/* Tabel Daftar User */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Daftar Pengguna Sistem</h2>
              {isUsersLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div></div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                      <tr>
                        <th className="p-3 font-semibold w-16 text-center">ID</th>
                        <th className="p-3 font-semibold">Username</th>
                        <th className="p-3 font-semibold text-center">Tipe Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {usersList.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-500 text-center">#{user.id}</td>
                          <td className="p-3 font-medium text-gray-800">{user.username}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {user.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {usersList.length === 0 && <div className="p-6 text-center text-gray-500">Belum ada pengguna.</div>}
                </div>
              )}
            </div>
            
          </div>
        )}

        {/* KONTEN TAB UPLOAD ADMIN */}
        {activeTab === 'upload' && userRole === 'admin' && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Tambah Kumpulan Soal Baru</h2>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Judul Kumpulan Soal:</label>
              <input type="text" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} className="w-full border rounded-lg p-3 bg-gray-50" />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Pilih file JSON:</label>
              <input type="file" accept=".json" onChange={handleFileChange} className="w-full border rounded-lg p-2 bg-gray-50" />
            </div>
            <button onClick={handleUpload} disabled={uploadStatus.loading} className={`w-full py-3 rounded-lg font-bold text-white ${uploadStatus.loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {uploadStatus.loading ? 'Memproses...' : 'Upload & Simpan Soal'}
            </button>
            {uploadStatus.message && (
              <div className={`mt-6 p-4 rounded-lg font-medium border ${uploadStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {uploadStatus.message}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}