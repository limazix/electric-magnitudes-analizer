import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { LogOut, Zap, User, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

const Header: React.FC = () => {
  const user = auth.currentUser;
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Monitor browser online status
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão restabelecida!");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Você está offline. Verifique sua conexão.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial state
    setIsOnline(window.navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success("Logout realizado com sucesso.");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error("Erro ao realizar logout.");
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">AME</h1>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
              Avaliador de Magnitudes Elétricas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <AnimatePresence>
            {!isOnline && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-100"
              >
                <WifiOff className="w-3 h-3" />
                Offline
              </motion.div>
            )}
            {isOnline && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-100 hidden sm:flex"
              >
                <Wifi className="w-3 h-3" />
                Online
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 pr-4 sm:pr-6 border-r border-gray-100">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-gray-900">{user?.displayName}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
          
          <button
            onClick={handleLogout}
            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
            title="Sair"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
