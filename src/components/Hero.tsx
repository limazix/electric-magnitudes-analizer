import React from "react";
import { Zap, FileText, CheckCircle2, ShieldCheck, Share2 } from "lucide-react";
import { motion } from "motion/react";

const Hero: React.FC = () => {
  return (
    <section className="relative bg-white pt-24 pb-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              Conformidade ANEEL
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
              Análise Inteligente de <span className="text-blue-600">Qualidade de Energia</span>
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
              Avalie magnitudes elétricas com precisão técnica. Nosso sistema utiliza agentes de IA para interpretar dados do PowerNET PQ-600 G4 e gerar relatórios em conformidade com as normas vigentes.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-bold text-gray-700">Normas ANEEL</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-bold text-gray-700">Relatórios PDF</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Share2 className="w-6 h-6 text-amber-600" />
                </div>
                <span className="text-sm font-bold text-gray-700">Google Drive</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-blue-600/10 blur-3xl rounded-full" />
            <div className="relative bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 rotate-2">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold text-gray-900">Monitoramento Ativo</span>
                  </div>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${30 + i * 20}%` }}
                        transition={{ delay: i * 0.2 }}
                        className="h-full bg-blue-600/20 rounded-full"
                      />
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-widest">
                  <span>PowerNET PQ-600 G4</span>
                  <span>v4.0.1</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
