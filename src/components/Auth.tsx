import React from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";
import { LogIn, Zap } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

const Auth: React.FC = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    const toastId = toast.loading("Autenticando...");
    try {
      await signInWithPopup(auth, provider);
      toast.success("Login realizado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      toast.error("Erro ao realizar login.", { id: toastId });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden"
      >
        <div className="p-12 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg rotate-3">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
            Avaliador de Magnitudes Elétricas
          </h1>
          <p className="text-gray-600 mb-12 leading-relaxed">
            Sistema inteligente para análise de qualidade de energia baseado em normas da ANEEL.
          </p>
          
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <img 
              src="https://www.google.com/favicon.ico" 
              alt="Google" 
              className="w-5 h-5"
              referrerPolicy="no-referrer"
            />
            Entrar com Google
          </button>
          
          <p className="text-xs text-gray-400 mt-8">
            Ao entrar, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
