import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Rangking() {
  const [scores, setScores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Cek apakah ada token di browser (menandakan user sedang login)
  const isAuthenticated = !!localStorage.getItem('token');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/assessment/scores');
        const data = await response.json();
        
        if (response.ok) {
          setScores(data.data || []);
        }
      } catch (error) {
        console.error("Gagal mengambil papan skor:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // Fungsi navigasi dinamis
  const handleNavClick = () => {
    if (isAuthenticated) {
      navigate('/dashboard'); // Jika sudah login, aman kembali ke dashboard
    } else {
      navigate('/login'); // Jika anonim, arahkan ke login
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-3xl w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 flex items-center gap-3">
            🏆 Papan Skor Global
          </h1>
          <button 
            onClick={handleNavClick}
            className="text-sm bg-white hover:bg-gray-100 text-gray-700 px-5 py-2 rounded-lg border shadow-sm transition font-medium"
          >
            {/* Teks tombol berubah otomatis sesuai status login */}
            {isAuthenticated ? '⬅ Kembali ke Dashboard' : 'Masuk untuk Ujian'}
          </button>
        </div>

        <p className="text-gray-500 mb-8 text-lg">Peringkat 20 besar pengerjaan kuis terbaik di seluruh sistem.</p>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : scores.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl shadow-sm border text-center text-gray-500">
            Belum ada data skor yang terekam. Jadilah yang pertama mengerjakan kuis!
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
                  <th className="p-4 font-bold text-center w-16">Peringkat</th>
                  <th className="p-4 font-bold">Peserta</th>
                  <th className="p-4 font-bold">Kuis</th>
                  <th className="p-4 font-bold text-center">Skor Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scores.map((s, index) => {
                  let badge = "";
                  if (index === 0) badge = "🥇";
                  else if (index === 1) badge = "🥈";
                  else if (index === 2) badge = "🥉";
                  else badge = `#${index + 1}`;

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-bold text-center text-lg">{badge}</td>
                      <td className="p-4 font-semibold text-gray-800">{s.username}</td>
                      <td className="p-4 text-gray-600 text-sm">{s.quiz_title}</td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${s.score >= 80 ? 'bg-green-100 text-green-700' : s.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {s.score.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}