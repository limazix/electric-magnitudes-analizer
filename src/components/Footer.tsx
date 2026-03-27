import React from "react";
import { Zap, Heart } from "lucide-react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">AME</span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500 font-medium">
            <a href="#" className="hover:text-blue-600 transition-colors">Sobre o Sistema</a>
            <a 
              href="https://www.gov.br/aneel/pt-br/centrais-de-conteudos/prodist/modulo-8-qualidade-da-energia-eletrica" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              Normas ANEEL
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">Manual PQ-600 G4</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Suporte</a>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-widest">
            <span>Desenvolvido com</span>
            <Heart className="w-3 h-3 text-red-500 fill-current" />
            <span>para o Setor Elétrico</span>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-50 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          <p>© 2026 Avaliador de Magnitudes Elétricas. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-gray-600 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Termos</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
