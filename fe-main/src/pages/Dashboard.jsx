import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [materiList, setMateriList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [userRole, setUserRole] = useState('siswa');
  const [activeTab, setActiveTab] = useState('materi'); 
  
  // State untuk Kelola Soal
  const [jsonFile, setJsonFile] = useState(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [uploadCourseId, setUploadCourseId] = useState(''); // <--- STATE BARU
  const [uploadStatus, setUploadStatus] = useState({ loading: false, message: '', type: '' });

  // State untuk Riwayat
  const [historyData, setHistoryData] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // State untuk Manajemen User
  const [usersList, setUsersList] = useState([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'siswa' });
  const [userActionStatus, setUserActionStatus] = useState({ loading: false, message: '', type: '' });

  // --- TAMBAHAN STATE UNTUK KELOLA MATERI (PDF) ---
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [courseActionStatus, setCourseActionStatus] = useState({ loading: false, message: '', type: '' });
  
  const [pdfUpload, setPdfUpload] = useState({ course_id: '', title: '', file: null });
  const [pdfUploadStatus, setPdfUploadStatus] = useState({ loading: false, message: '', type: '' });
  // ------------------------------------------------

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

  const fetchMateri = async () => {
    setIsLoading(true);
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

  useEffect(() => {
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
      if (response.ok) setHistoryData(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setUsersList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    setUserActionStatus({ loading: true, message: 'Memproses...', type: 'info' });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await response.json();
      if (response.ok) {
        setUserActionStatus({ loading: false, message: `User '${data.username}' dibuat!`, type: 'success' });
        setNewUser({ username: '', password: '', role: 'siswa' });
        fetchUsers();
      } else {
        setUserActionStatus({ loading: false, message: data.detail || 'Gagal.', type: 'error' });
      }
    } catch (err) {
      setUserActionStatus({ loading: false, message: 'Error jaringan.', type: 'error' });
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Yakin hapus akun '${username}' beserta riwayat nilainya?`)) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/assessment/scores/user/${username}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      await fetch(`/api/leaderboard/scores/user/${username}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const response = await fetch(`/api/auth/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        alert('User terhapus.');
        fetchUsers();
      }
    } catch (err) {
      alert('Error jaringan.');
    }
  };

  // --- FUNGSI KELOLA MATERI (COURSE & PDF) ---
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.title) return;
    setCourseActionStatus({ loading: true, message: 'Memproses...', type: 'info' });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/content/courses', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse)
      });
      if (response.ok) {
        setCourseActionStatus({ loading: false, message: 'Course baru berhasil dibuat!', type: 'success' });
        setNewCourse({ title: '', description: '' });
        fetchMateri(); // Segarkan daftar course
      } else {
        setCourseActionStatus({ loading: false, message: 'Gagal membuat Course.', type: 'error' });
      }
    } catch (err) {
      setCourseActionStatus({ loading: false, message: 'Error jaringan.', type: 'error' });
    }
  };

  const handlePdfFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validasi 5 MB di frontend
      if (file.size > 5 * 1024 * 1024) {
        setPdfUploadStatus({ loading: false, message: 'Ukuran file melebihi batas 5 MB!', type: 'error' });
        e.target.value = ''; // Reset input file
        setPdfUpload({ ...pdfUpload, file: null });
        return;
      }
      setPdfUpload({ ...pdfUpload, file: file });
      setPdfUploadStatus({ loading: false, message: '', type: '' });
    }
  };

  const handleUploadPdf = async (e) => {
    e.preventDefault();
    if (!pdfUpload.course_id || !pdfUpload.title || !pdfUpload.file) {
      setPdfUploadStatus({ loading: false, message: 'Pilih Course, isi Judul PDF, dan pilih filenya.', type: 'error' });
      return;
    }

    setPdfUploadStatus({ loading: true, message: 'Mengunggah PDF...', type: 'info' });
    try {
      const token = localStorage.getItem('token');
      
      // Menggunakan FormData karena kita mengirim file (multipart/form-data)
      const formData = new FormData();
      formData.append('title', pdfUpload.title);
      formData.append('file', pdfUpload.file);
      
      const response = await fetch(`/api/content/courses/${pdfUpload.course_id}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // Hapus Content-Type agar browser mengatur boundary multipart secara otomatis
        body: formData
      });
      
      if (response.ok) {
        setPdfUploadStatus({ loading: false, message: 'PDF berhasil diunggah!', type: 'success' });
        setPdfUpload({ course_id: '', title: '', file: null });
        document.getElementById('pdfFileInput').value = ''; // Reset file input UI
        fetchMateri(); // Segarkan daftar untuk melihat PDF baru
      } else {
        setPdfUploadStatus({ loading: false, message: 'Gagal mengunggah PDF.', type: 'error' });
      }
    } catch (err) {
      setPdfUploadStatus({ loading: false, message: 'Error jaringan.', type: 'error' });
    }
  };
  // -------------------------------------------

  const handleUploadJson = async () => {
    if (!quizTitle.trim() || !jsonFile || !uploadCourseId) {
      setUploadStatus({ loading: false, message: 'Pilih Course, isi Judul, dan pilih File JSON.', type: 'error' });
      return;
    }
    setUploadStatus({ loading: true, message: 'Memproses...', type: 'info' });
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const finalPayload = { 
          title: quizTitle, 
          course_id: parseInt(uploadCourseId), // <--- TAMBAHAN BARU
          questions: JSON.parse(e.target.result) 
        };
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assessment/questions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPayload)
        });
        if (response.ok) {
          setUploadStatus({ loading: false, message: 'Soal berhasil diunggah!', type: 'success' });
          setJsonFile(null); setQuizTitle(''); setUploadCourseId('');
        } else {
          setUploadStatus({ loading: false, message: 'Gagal mengunggah.', type: 'error' });
        }
      } catch (error) {
        setUploadStatus({ loading: false, message: 'Format JSON tidak valid.', type: 'error' });
      }
    };
    reader.readAsText(jsonFile);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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
          <button onClick={() => { setActiveTab('materi'); fetchMateri(); }} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'materi' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            📚 Materi Pembelajaran
          </button>
          
          {userRole === 'siswa' && (
            <button onClick={() => { setActiveTab('riwayat'); fetchHistory(); }} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'riwayat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
              📈 Riwayat Nilai
            </button>
          )}
          
          {userRole === 'admin' && (
            <button onClick={() => { setActiveTab('users'); fetchUsers(); }} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
              👥 Manajemen User
            </button>
          )}

          {/* TAB BARU: KELOLA MATERI UNTUK ADMIN */}
          {userRole === 'admin' && (
            <button onClick={() => { setActiveTab('materi_admin'); fetchMateri(); }} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'materi_admin' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
              📁 Kelola Materi
            </button>
          )}

          {userRole === 'admin' && (
            <button onClick={() => setActiveTab('upload')} className={`pb-3 font-medium text-lg whitespace-nowrap ${activeTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
              📝 Kelola Soal
            </button>
          )}
        </div>

        {/* KONTEN TAB MATERI (TAMPILAN SISWA & ADMIN) */}
        {activeTab === 'materi' && (
          <div>
            {isLoading && <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>}
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>}
            {!isLoading && !error && materiList.length === 0 && <div className="text-center py-20 text-gray-500 bg-white rounded-xl shadow-sm">Belum ada materi tersedia.</div>}
            {!isLoading && !error && materiList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {materiList.map((materi, index) => (
                  <div key={materi.id || index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
                    <div className="flex-grow">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{materi.title || "Materi Tanpa Judul"}</h3>
                      <p className="text-gray-600 text-sm mb-4">{materi.description || "Tidak ada deskripsi."}</p>
                      
                      {/* TAMPILKAN DAFTAR PDF DI DALAM COURSE INI */}
                      {materi.materials && materi.materials.length > 0 ? (
                        <div className="mb-4 space-y-2">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Daftar File PDF:</h4>
                          {materi.materials.map((mat) => {
                            // AMBIL TOKEN DARI LOCAL STORAGE
                            const currentToken = localStorage.getItem('token');
                            
                            // TEMPELKAN TOKEN KE URL JIKA MERUPAKAN LINK DOWNLOAD INTERNAL
                            const fileUrl = mat.content.includes('/api/content/download') 
                              ? `${mat.content}?token=${currentToken}` 
                              : mat.content;

                            return (
                              <a 
                                key={mat.id} 
                                href={fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block p-2 bg-blue-50 text-blue-700 text-sm font-medium rounded hover:bg-blue-100 transition truncate border border-blue-100"
                              >
                                📄 {mat.title}
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                         <p className="text-sm text-gray-400 italic mb-4">Belum ada file PDF.</p>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-100">
                      <a href={`/assessment/?course_id=${materi.id}`} className="block text-center bg-green-50 text-green-700 font-bold py-2.5 rounded-lg hover:bg-green-100 transition-colors w-full">
                        Kerjakan Ujian
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KONTEN TAB KELOLA MATERI (ADMIN SAJA) */}
        {activeTab === 'materi_admin' && userRole === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Form Buat Course Baru */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Buat Mata Pelajaran (Course)</h2>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Judul Mata Pelajaran</label>
                  <input type="text" value={newCourse.title} onChange={(e) => setNewCourse({...newCourse, title: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 outline-none" placeholder="Contoh: Matematika Dasar" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat</label>
                  <textarea value={newCourse.description} onChange={(e) => setNewCourse({...newCourse, description: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 outline-none" rows="3" placeholder="Deskripsi mata pelajaran..."></textarea>
                </div>
                <button type="submit" disabled={courseActionStatus.loading} className={`w-full py-2.5 rounded-lg font-bold text-white transition ${courseActionStatus.loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  Buat Mata Pelajaran
                </button>
              </form>
              {courseActionStatus.message && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-medium border ${courseActionStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {courseActionStatus.message}
                </div>
              )}
            </div>

            {/* Form Unggah PDF */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. Unggah Materi PDF</h2>
              <form onSubmit={handleUploadPdf} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Mata Pelajaran Induk</label>
                  <select value={pdfUpload.course_id} onChange={(e) => setPdfUpload({...pdfUpload, course_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 outline-none" required>
                    <option value="">-- Pilih Mata Pelajaran --</option>
                    {materiList.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Judul Dokumen PDF</label>
                  <input type="text" value={pdfUpload.title} onChange={(e) => setPdfUpload({...pdfUpload, title: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 outline-none" placeholder="Contoh: Bab 1 - Aljabar" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File PDF (Maks. 5 MB)</label>
                  <input id="pdfFileInput" type="file" accept="application/pdf" onChange={handlePdfFileChange} className="w-full border rounded-lg p-2 bg-gray-50" required />
                </div>
                <button type="submit" disabled={pdfUploadStatus.loading} className={`w-full py-2.5 rounded-lg font-bold text-white transition ${pdfUploadStatus.loading ? 'bg-blue-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
                  {pdfUploadStatus.loading ? 'Mengunggah...' : 'Unggah PDF'}
                </button>
              </form>
              {pdfUploadStatus.message && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-medium border ${pdfUploadStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {pdfUploadStatus.message}
                </div>
              )}
            </div>

          </div>
        )}

        {/* KONTEN TAB LAINNYA TETAP SAMA */}
        {activeTab === 'riwayat' && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Grafik Perkembangan Belajar</h2>
            {isHistoryLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div></div>
            ) : (
              <div className="h-96 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6b7280'}} tickMargin={15}/>
                    <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#6b7280'}}/>
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                    <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && userRole === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-1 h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Buat Pengguna Baru</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <input type="text" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50" placeholder="Username" required />
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50" placeholder="Password" required />
                <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="w-full border rounded-lg p-2.5 bg-gray-50">
                  <option value="siswa">Siswa</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Daftarkan Pengguna</button>
              </form>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Daftar Pengguna Sistem</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                    <tr><th className="p-3">ID</th><th className="p-3">Username</th><th className="p-3">Role</th><th className="p-3">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {usersList.map((user) => (
                      <tr key={user.id}>
                        <td className="p-3 text-gray-500">#{user.id}</td>
                        <td className="p-3 font-medium text-gray-800">{user.username}</td>
                        <td className="p-3">{user.role}</td>
                        <td className="p-3"><button onClick={() => handleDeleteUser(user.id, user.username)} className="text-red-500 border border-red-500 hover:bg-red-600 hover:text-white px-3 py-1 rounded text-xs font-bold">HAPUS</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'upload' && userRole === 'admin' && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Tambah Kumpulan Soal Baru</h2>
            
            {/* TAMBAHAN BARU: Dropdown Pilih Course */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Untuk Mata Pelajaran (Course):</label>
              <select value={uploadCourseId} onChange={(e) => setUploadCourseId(e.target.value)} className="w-full border rounded-lg p-2.5 bg-gray-50 focus:border-blue-500 outline-none" required>
                <option value="">-- Pilih Mata Pelajaran --</option>
                {materiList.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Judul Kumpulan Soal:</label>
              <input type="text" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} className="w-full border rounded-lg p-3 bg-gray-50 focus:border-blue-500 outline-none" placeholder="Contoh: Kuis Bab 1" />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Pilih file JSON:</label>
              <input type="file" accept=".json" onChange={(e) => setJsonFile(e.target.files[0])} className="w-full border rounded-lg p-2 bg-gray-50" />
            </div>
            
            <button onClick={handleUploadJson} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">Upload & Simpan Soal</button>
            
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