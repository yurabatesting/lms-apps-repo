import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';

function AssessmentHome() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'quiz' | 'result'
  
  const [quizSets, setQuizSets] = useState([]);
  const [activeQuizIndex, setActiveQuizIndex] = useState(null);
  
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState({ percentage: 0, correct: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    } 
    setIsAuthenticated(true);

    // --- TAMBAHAN BARU: Membaca course_id dari URL Query Parameters ---
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('course_id');

    // UBAH BARIS INI: Tambahkan courseId di sebelahnya
    fetchQuizSetsFromDB(token, courseId);
  }, []);

  const fetchQuizSetsFromDB = async (token, courseId) => {
    try {
      // Gunakan URL Path Parameter jika courseId tersedia
      let url = '/api/assessment/questions';
      if (courseId) {
        url = `/api/assessment/questions/course/${courseId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setQuizSets(result.data || []);
      }
    } catch (error) {
      console.error("Gagal mengambil data kuis:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = (index) => {
    setAnswers({});
    setActiveQuizIndex(index);
    setView('quiz');
    window.scrollTo(0, 0);
  };

  const handleAnswerSelect = (questionId, option) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  // --- FUNGSI SUBMIT DIPERBARUI UNTUK PENGIRIMAN GANDA ---
  const handleSubmit = async () => {
    const activeQuiz = quizSets[activeQuizIndex];
    const activeQuestions = activeQuiz.questions;
    
    if (Object.keys(answers).length < activeQuestions.length) {
      const confirmSubmit = window.confirm("Anda belum menjawab semua soal. Yakin ingin mengumpulkan sekarang?");
      if (!confirmSubmit) return; 
    }

    let correctCount = 0;
    activeQuestions.forEach(q => {
      if (answers[q.id] === q.answer) correctCount++;
    });
    
    const calculatedScore = (correctCount / activeQuestions.length) * 100;
    
    setScore({
      percentage: calculatedScore,
      correct: correctCount
    });

    try {
      const token = localStorage.getItem('token');
      
      // Ekstrak username dari token JWT untuk dikirim ke Redis
      const getUsernameFromToken = (t) => {
        try { return JSON.parse(atob(t.split('.')[1])).sub; } 
        catch (e) { return "Anonymous"; }
      };
      const currentUsername = getUsernameFromToken(token);

      // 1. Request ke PostgreSQL (Arsip Permanen)
      const postToPostgres = fetch('/api/assessment/scores', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quiz_title: activeQuiz.title || `Kumpulan Soal #${activeQuiz.id}`,
          score: calculatedScore,
          correct_count: correctCount,
          total_questions: activeQuestions.length
        })
      });

      // 2. Request ke Redis (Leaderboard Live)
      const postToRedis = fetch('/api/leaderboard/scores', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: currentUsername,
          score: Math.round(calculatedScore),
          quiz_title: activeQuiz.title || `Kumpulan Soal #${activeQuiz.id}` // <-- TAMBAHKAN BARIS INI
        })
      });

      // Eksekusi kedua request secara paralel (bersamaan) agar lebih cepat
      await Promise.all([postToPostgres, postToRedis]);

    } catch (error) {
      console.error("Gagal menyimpan skor:", error);
    }

    setView('result');
    window.scrollTo(0, 0);
  };

  if (!isAuthenticated || isLoading) return <div className="min-h-screen bg-[#111827] flex justify-center items-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>;

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-[#111827] text-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">📚 Gudang Soal & Latihan</h1>
            <button onClick={() => window.location.href = '/dashboard'} className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded border border-gray-600 transition">
              Kembali ke Dashboard
            </button>
          </div>
          
          <h2 className="text-2xl font-semibold mb-2">Daftar Kumpulan Soal</h2>
          <p className="text-gray-400 mb-8">Pilih salah satu judul kumpulan soal di bawah ini untuk mulai berlatih:</p>

          {quizSets.length === 0 ? (
            <div className="p-6 bg-gray-800 rounded-lg text-center text-gray-400 border border-gray-700">
              Belum ada soal yang tersedia. Admin harus mengunggah soal terlebih dahulu melalui Dashboard.
            </div>
          ) : (
            <div className="space-y-4">
              {quizSets.map((quiz, index) => (
                <div key={quiz.id} className="flex justify-between items-center p-6 border border-gray-800 bg-gray-900 hover:bg-gray-800 transition rounded-lg">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 text-white">📁 {quiz.title || `Kumpulan Soal #${quiz.id}`}</h3>
                    <p className="text-sm text-gray-500 mt-1">Berisi {quiz.questions?.length || 0} soal</p>
                  </div>
                  <button onClick={() => handleStartQuiz(index)} disabled={!quiz.questions || quiz.questions.length === 0} className="px-6 py-2 rounded-lg border border-gray-500 font-medium transition hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed">
                    Mulai Latihan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'quiz') {
    const activeQuiz = quizSets[activeQuizIndex];
    const activeQuestions = activeQuiz.questions;

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setView('list')} className="mb-6 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700">
            ⬅ Kembali ke Daftar Kumpulan Soal
          </button>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{activeQuiz.title}</h1>
          <p className="text-gray-600 mb-8">Total soal: {activeQuestions.length}</p>

          <div className="space-y-8">
            {activeQuestions.map((q, index) => {
              const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]");
              return (
                <div key={q.id} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-4 text-lg">Soal {index + 1} <span className="text-gray-500 text-sm font-normal">[{q.topic}]</span></h3>
                  <p className="text-gray-700 mb-6 text-lg" dangerouslySetInnerHTML={{ __html: q.question }} />
                  <div className="space-y-3">
                    {options.map((opt, i) => (
                      <label key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition border border-transparent hover:border-gray-200">
                        <input type="radio" name={`question-${q.id}`} value={opt} checked={answers[q.id] === opt} onChange={() => handleAnswerSelect(q.id, opt)} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                        <span className="text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <button onClick={handleSubmit} className="px-8 py-3 rounded-xl font-bold text-white transition bg-green-600 hover:bg-green-700 shadow-lg">
              Kumpulkan & Lihat Hasil
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'result') {
    const activeQuiz = quizSets[activeQuizIndex];
    const activeQuestions = activeQuiz.questions;

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setView('list')} className="mb-6 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700">
            ⬅ Kembali ke Daftar Kumpulan Soal
          </button>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">🎉 Hasil: {activeQuiz.title}</h1>
          
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-sm mb-1 font-medium">Skor Akhir</p>
              <p className="text-4xl font-bold text-gray-800">{score.percentage.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-gray-500 text-sm mb-1 font-medium">Jawaban Benar</p>
              <p className="text-4xl font-bold text-gray-800">{score.correct} dari {activeQuestions.length}</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">🔍 Review Detail Jawaban Anda:</h2>
          
          <div className="space-y-8">
            {activeQuestions.map((q, index) => {
              const userAnswer = answers[q.id];
              const isCorrect = userAnswer === q.answer;

              return (
                <div key={q.id} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-gray-800 text-lg mb-4">
                    <span className="font-bold">Soal {index + 1}:</span> <span dangerouslySetInnerHTML={{ __html: q.question }} />
                  </p>
                  <div className={`p-4 rounded-lg mb-3 font-medium ${isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    Jawaban Anda: {userAnswer || "(Tidak dijawab)"} {isCorrect ? ' (Benar ✔️)' : ' (Salah ❌)'}
                  </div>
                  {!isCorrect && (
                    <div className="p-4 rounded-lg mb-3 font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">
                      Jawaban yang benar: {q.answer}
                    </div>
                  )}
                  <div className="p-4 rounded-lg bg-blue-50 text-blue-800 border border-blue-100 mt-4 leading-relaxed">
                    <b>Pembahasan:</b> {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}

function App() {
  return (
    <BrowserRouter basename="/assessment">
      <Routes>
        <Route path="/" element={<AssessmentHome />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;