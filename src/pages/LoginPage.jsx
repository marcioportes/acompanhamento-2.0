import { useState } from 'react';
import { LineChart, Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(email, password);
      // Se sucesso, o redirecionamento acontece pelo AuthContext/App.jsx
    } catch (err) {
      // Captura o erro (ex: "Acesso não autorizado") e exibe no Modal
      console.error("Erro capturado no Login:", err.message);
      setErrorModal({ show: true, message: err.message });
      setIsLoading(false);
    }
  };

  const closeErrorModal = () => {
    setErrorModal({ show: false, message: '' });
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* --- MODAL DE ERRO (POP-UP) --- */}
      {errorModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Acesso Negado</h3>
                <p className="text-slate-400 text-sm">{errorModal.message}</p>
              </div>

              <button 
                onClick={closeErrorModal}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-slate-700"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LADO ESQUERDO (FORM) --- */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <LineChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white tracking-tight">Acompanhamento</h1>
              <p className="text-sm text-slate-500 font-medium">2.0 Trading Journal</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-white mb-2">Login</h2>
            <p className="text-slate-400">Entre com suas credenciais de acesso.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="seu@email.com" 
                  className="w-full pl-12 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all" 
                  required 
                />
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-slate-400 mb-2">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="w-full pl-12 pr-12 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all" 
                  required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-800/50 text-center">
            <p className="text-xs text-slate-600">Esqueceu a senha? Contate seu mentor.</p>
          </div>
        </div>
      </div>

      {/* --- LADO DIREITO (DECORAÇÃO) --- */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-slate-900 to-slate-900" />
          <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/10 via-slate-900 to-slate-900" />
        </div>
        
        <div className="relative text-center p-12 max-w-lg z-10">
          <div className="mb-8 inline-flex p-4 rounded-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
            <LineChart className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="text-4xl font-display font-bold text-white mb-4 leading-tight">
            Domine sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Alta Performance</span>
          </h3>
          <p className="text-lg text-slate-400 mb-12 leading-relaxed">
            O ambiente definitivo para registrar, analisar e evoluir seus trades com precisão profissional.
          </p>
          
          <div className="grid grid-cols-3 gap-8 border-t border-slate-800 pt-8">
            <div>
              <p className="text-2xl font-bold text-white mb-1">100%</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Foco</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white mb-1">24/7</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Análise</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white mb-1">Pro</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Mindset</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;