import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShoppingCart } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = isLogin ? await signIn(email, password) : await signUp(email, password);
      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <ShoppingCart size={32} className="text-emerald-400" />
            <h1 className="text-3xl font-bold text-white">
              <span className="text-emerald-400">Kiosco</span>POS
            </h1>
          </div>
          <p className="text-slate-400 text-sm">Sistema de Punto de Venta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-800 text-center mb-6">
            {isLogin ? 'Iniciar Sesion' : 'Crear Cuenta'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Contrasena</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition-colors"
            >
              {loading ? 'Procesando...' : isLogin ? 'Ingresar' : 'Crear Cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {isLogin ? 'No tiene cuenta? Registrate' : 'Ya tiene cuenta? Inicie sesion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
