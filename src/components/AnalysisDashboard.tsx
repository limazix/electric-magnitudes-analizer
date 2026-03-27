import React, { useMemo, useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, Circle, Clock, AlertTriangle, FileText, Printer, Send, MessageSquare, ThumbsUp, Share2, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { AnalysisRecord } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { PowerQualityChart } from "./PowerQualityChart";
import { toast } from "sonner";

interface Props {
  analysis: AnalysisRecord;
  onDownloadReport?: () => void;
  onProceed?: (feedback?: string) => void;
  onApprove?: () => void;
  onReset?: () => void;
}

const STEPS = [
  { id: "analyst", label: "Analista de Dados Sênior", description: "Pré-processamento e identificação de anomalias" },
  { id: "engineer", label: "Engenheiro Elétrico Sênior", description: "Avaliação normativa (ANEEL/ENEL)" },
  { id: "reporter", label: "Relator", description: "Consolidação de achados e estruturação do relatório" },
  { id: "reviewer", label: "Revisor", description: "Formatação final e revisão gramatical" },
  { id: "critic", label: "Crítico de Qualidade", description: "Validação final e garantia de excelência" }
];

const AnalysisDashboard: React.FC<Props> = ({ analysis, onDownloadReport, onProceed, onApprove, onReset }) => {
  const [feedback, setFeedback] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportLink, setExportLink] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        handleExportToGoogleDrive();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleExportToGoogleDrive = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Exportando para o Google Drive...");
    try {
      // Get the report content - either the preview or the final completed one
      const reportHtml = analysis.status === 'completed' 
        ? (analysis.results?.reportContent || analysis.htmlReport)
        : analysis.htmlReport;

      if (!reportHtml) {
        toast.error("Relatório não encontrado para exportação.", { id: toastId });
        setIsExporting(false);
        return;
      }

      const response = await fetch("/api/export/google-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: reportHtml,
          markdown: analysis.results?.markdownReport,
          chartData: chartData,
          title: `Relatório de Qualidade de Energia - ${analysis.fileName} - ${new Date().toLocaleDateString()}`
        })
      });

      if (response.status === 401) {
        // Need to authenticate
        toast.info("Autenticação necessária com o Google.", { id: toastId });
        const authResponse = await fetch("/api/auth/google/url");
        const authData = await authResponse.json();
        if (authData.error) {
          toast.error(authData.error, { id: toastId });
          setIsExporting(false);
          return;
        }
        window.open(authData.url, "google_auth", "width=600,height=700");
        setIsExporting(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Falha ao exportar");
      }

      const data = await response.json();
      setExportLink(data.webViewLink);
      toast.success("Relatório exportado com sucesso!", { id: toastId });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(`Erro ao exportar: ${error.message}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!analysis.results?.markdownReport) return;
    const blob = new Blob([analysis.results.markdownReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatório_${analysis.fileName.split('.')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    // Add a temporary class to body to help with print styles
    document.body.classList.add('is-printing');
    
    // Use a larger timeout to ensure charts and layout are fully rendered for print
    setTimeout(() => {
      window.print();
      // Remove the class after a delay to allow the print dialog to finish
      setTimeout(() => {
        document.body.classList.remove('is-printing');
        setIsPrinting(false);
      }, 1000);
    }, 1500);
  };
  const currentStepIndex = useMemo(() => {
    return STEPS.findIndex(s => s.id === analysis.currentStep);
  }, [analysis.currentStep]);

  const isWaiting = analysis.status === 'waiting_user';
  const isProcessing = analysis.status === 'processing';

  const chartData = useMemo(() => {
    const analystOutput = analysis.results?.analystOutput || "";
    let jsonStr = "";
    const jsonMatch = analystOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1];
    } else {
      const firstBrace = analystOutput.indexOf('{');
      const lastBrace = analystOutput.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = analystOutput.substring(firstBrace, lastBrace + 1);
      }
    }

    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        return parsed;
      } catch (e) {
        console.error("Failed to parse chart data", e);
      }
    }
    return null;
  }, [analysis.results?.analystOutput]);

  const cleanOutput = (text: string) => {
    return text.replace(/```json\s*[\s\S]*?\s*```/g, "").trim();
  };

  const cleanAnalystOutput = useMemo(() => {
    return cleanOutput(analysis.results?.analystOutput || "");
  }, [analysis.results?.analystOutput]);

  const cleanEngineerOutput = useMemo(() => {
    return cleanOutput(analysis.results?.engineerOutput || "");
  }, [analysis.results?.engineerOutput]);

  const renderMarkdown = (content: string, title?: string, icon?: React.ReactNode) => {
    return (
      <div className="space-y-4">
        {title && (
          <h4 className="font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
            {icon}
            {title}
          </h4>
        )}
        <div className="prose prose-sm max-w-none prose-headings:text-blue-900 prose-headings:font-bold prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-blue-800">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const codeContent = String(children).replace(/\n$/, '');
                
                if (!inline && match && match[1] === 'mermaid') {
                  const encoded = btoa(unescape(encodeURIComponent(codeContent)));
                  const imageUrl = `https://mermaid.ink/img/${encoded}`;
                  return (
                    <div className="my-6 flex flex-col items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <img 
                        src={imageUrl} 
                        alt="Diagrama Mermaid" 
                        className="max-w-full h-auto"
                        referrerPolicy="no-referrer"
                      />
                      <p className="text-[10px] text-gray-400 mt-2 italic">Diagrama gerado automaticamente</p>
                    </div>
                  );
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  const renderReportContent = (html: string) => {
    let cleanedHtml = html.replace(/```json\s*[\s\S]*?\s*```/g, "").trim();

    cleanedHtml = cleanedHtml.replace(/```mermaid\s*([\s\S]*?)\s*```/g, (match, code) => {
      const encoded = btoa(unescape(encodeURIComponent(code.trim())));
      const imageUrl = `https://mermaid.ink/img/${encoded}`;
      return `
        <div class="mermaid-container" style="margin: 2rem 0; text-align: center; background: white; padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #f3f4f6; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <img src="${imageUrl}" alt="Diagrama Mermaid" style="width: 600px; max-width: 100%; height: auto;" referrerpolicy="no-referrer" />
          <p style="font-size: 10px; color: #9ca3af; margin-top: 0.75rem; font-style: italic;">Diagrama gerado automaticamente</p>
        </div>
      `;
    });

    // Replace Mermaid placeholders with images
    const mermaidRegex = /<div class="mermaid-diagram">([\s\S]*?)<\/div>/g;
    let match;
    const mermaidReplacements: { fullMatch: string, code: string }[] = [];
    while ((match = mermaidRegex.exec(cleanedHtml)) !== null) {
      mermaidReplacements.push({ fullMatch: match[0], code: match[1].trim() });
    }

    mermaidReplacements.forEach(mr => {
      if (mr.code && !mr.code.includes('{{')) {
        const encodedCode = btoa(mr.code);
        const mermaidUrl = `https://mermaid.ink/img/${encodedCode}`;
        const imgTag = `<div class="mermaid-container my-8 text-center">
          <img src="${mermaidUrl}" alt="Diagrama Mermaid" class="mx-auto max-w-full h-auto shadow-md rounded-lg" referrerPolicy="no-referrer" />
        </div>`;
        cleanedHtml = cleanedHtml.replace(mr.fullMatch, imgTag);
      }
    });

    const chartPlaceholders = [
      { id: 'freq-amplitude-chart', key: 'freqAmplitude', title: 'Amplitude de Frequência (Hz)', type: 'line' },
      { id: 'volt-fn-chart', key: 'voltFN', title: 'Tensão Fase-Neutro (V)', type: 'line' },
      { id: 'volt-ff-chart', key: 'voltFF', title: 'Tensão Fase-Fase (V)', type: 'line' },
      { id: 'unbalance-chart', key: 'unbalanceData', title: 'Desequilíbrio de Tensão (DRC/DRP %)', type: 'line' },
      { id: 'fluctuation-chart', key: 'fluctuationData', title: 'Flutuação de Tensão (Pst/Plt)', type: 'line' },
      { id: 'curr-rms-chart', key: 'currRMS', title: 'Corrente RMS (A)', type: 'line' },
      { id: 'curr-peak-chart', key: 'currPeak', title: 'Corrente de Pico (A)', type: 'line' },
      { id: 'volt-harmonics-chart', key: 'voltHarmonics', title: 'Harmônicos de Tensão (%)', type: 'harmonics' },
      { id: 'curr-harmonics-chart', key: 'currHarmonics', title: 'Harmônicos de Corrente (%)', type: 'harmonics' },
      { id: 'power-comparison-chart', key: 'powerComparison', title: 'Comparativo de Potências (kW/kVAR/kVA)', type: 'line' },
      { id: 'pf-chart', key: 'pfData', title: 'Fator de Potência', type: 'line' },
      { id: 'consumption-chart', key: 'consumptionData', title: 'Consumo de Energia (kWh)', type: 'line' },
      { id: 'itic-chart', key: 'iticData', title: 'Curva ITIC (Segurança do Sistema)', type: 'scatter' }
    ];

    let parts: (string | React.ReactNode)[] = [cleanedHtml];

    const replacePlaceholder = (placeholderId: string, component: React.ReactNode) => {
      const placeholder = `<div id="${placeholderId}" class="chart-wrapper"></div>`;
      const placeholderAlt = `<div id="${placeholderId}"></div>`;
      
      const newParts: (string | React.ReactNode)[] = [];
      parts.forEach(part => {
        if (typeof part === 'string') {
          let currentPart = part;
          const target = currentPart.includes(placeholder) ? placeholder : (currentPart.includes(placeholderAlt) ? placeholderAlt : null);
          
          if (target) {
            const splitParts = currentPart.split(target);
            splitParts.forEach((subPart, index) => {
              newParts.push(subPart);
              if (index < splitParts.length - 1) {
                newParts.push(component);
              }
            });
          } else {
            newParts.push(part);
          }
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    };

    chartPlaceholders.forEach(cp => {
      if (chartData?.[cp.key]) {
        replacePlaceholder(cp.id, (
          <div key={cp.id} className="my-8">
            <PowerQualityChart 
              data={cp.type === 'line' ? chartData[cp.key] : undefined} 
              harmonics={cp.type === 'harmonics' ? chartData[cp.key] : undefined}
              scatterData={cp.type === 'scatter' ? chartData[cp.key] : undefined}
              title={cp.title} 
            />
          </div>
        ));
      }
    });

    return (
      <div className="report-content max-w-none">
        {parts.map((part, i) => (
          typeof part === 'string' ? <div key={i} dangerouslySetInnerHTML={{ __html: part }} /> : part
        ))}
      </div>
    );
  };

  const renderUnbalanceTable = () => {
    if (!chartData?.unbalanceData || !Array.isArray(chartData.unbalanceData) || chartData.unbalanceData.length === 0) {
      return null;
    }

    return (
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Dados de Desequilíbrio de Tensão (DRC/DRP)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Detalhamento temporal dos indicadores de desequilíbrio resistivo e de fase.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-gray-600 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold border-b">Horário</th>
                <th className="px-6 py-4 font-bold border-b">DRC (%)</th>
                <th className="px-6 py-4 font-bold border-b">DRP (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chartData.unbalanceData.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.time}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{typeof row.drc === 'number' ? row.drc.toFixed(2) : row.drc}%</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{typeof row.drp === 'number' ? row.drp.toFixed(2) : row.drp}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Status da Análise</h2>
            <p className="text-gray-500 mt-1">
              Arquivo: <span className="font-medium text-gray-700">{analysis.fileName}</span>
            </p>
          </div>
          <div className={cn(
            "px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2",
            analysis.status === 'completed' ? "bg-green-50 text-green-700" :
            analysis.status === 'processing' ? "bg-blue-50 text-blue-700" :
            analysis.status === 'waiting_user' ? "bg-amber-50 text-amber-700" :
            analysis.status === 'failed' ? "bg-red-50 text-red-700" :
            "bg-gray-50 text-gray-700"
          )}>
            {analysis.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
             analysis.status === 'processing' ? <Clock className="w-4 h-4 animate-spin" /> :
             analysis.status === 'waiting_user' ? <MessageSquare className="w-4 h-4" /> :
             analysis.status === 'failed' ? <AlertTriangle className="w-4 h-4" /> :
             <Circle className="w-4 h-4" />}
            {analysis.status === 'completed' ? "Concluído" :
             analysis.status === 'processing' ? "Processando..." :
             analysis.status === 'waiting_user' ? "Aguardando seu feedback" :
             analysis.status === 'failed' ? "Falha na Análise" :
             "Pendente"}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-12">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${analysis.progress}%` }}
            className={cn(
              "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
              analysis.status === 'failed' ? "bg-red-500" : "bg-blue-600"
            )}
          />
        </div>

        {/* Error Message */}
        {analysis.status === 'failed' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-12 p-6 bg-red-50 border border-red-100 rounded-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-red-800 font-bold">
              <AlertTriangle className="w-6 h-6" />
              Ocorreu um erro durante o processamento
            </div>
            <div className="text-red-700 text-sm leading-relaxed">
              {analysis.error || "Não foi possível obter detalhes sobre o erro. Por favor, tente novamente mais tarde ou entre em contato com o suporte."}
            </div>
            <div className="pt-4 border-t border-red-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-red-500 font-medium uppercase tracking-wider mb-2">Logs Técnicos</p>
                <pre className="bg-red-100/50 p-4 rounded-xl text-[10px] font-mono text-red-800 overflow-x-auto whitespace-pre-wrap max-w-md">
                  {JSON.stringify({
                    id: analysis.id,
                    step: analysis.currentStep,
                    progress: analysis.progress,
                    timestamp: analysis.createdAt,
                    lastMessage: analysis.lastMessage
                  }, null, 2)}
                </pre>
              </div>
              {onReset && (
                <button
                  onClick={onReset}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Tentar Novamente
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Critic Feedback */}
        {analysis.results?.criticOutput && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "mb-12 p-6 rounded-2xl border flex flex-col md:flex-row gap-6 items-center md:items-start",
              analysis.results.criticOutput.score > 8 
                ? "bg-green-50 border-green-100" 
                : "bg-amber-50 border-amber-100"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-full flex flex-col items-center justify-center shrink-0 shadow-inner",
              analysis.results.criticOutput.score > 8 
                ? "bg-green-100 text-green-700" 
                : "bg-amber-100 text-amber-700"
            )}>
              <span className="text-2xl font-black leading-none">{analysis.results.criticOutput.score}</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">Score</span>
            </div>
            <div className="flex-grow space-y-2 text-center md:text-left">
              <h4 className={cn(
                "font-bold text-lg",
                analysis.results.criticOutput.score > 8 ? "text-green-800" : "text-amber-800"
              )}>
                Avaliação do Crítico de Qualidade
              </h4>
              <p className={cn(
                "text-sm leading-relaxed",
                analysis.results.criticOutput.score > 8 ? "text-green-700" : "text-amber-700"
              )}>
                {analysis.results.criticOutput.critique}
              </p>
              {!analysis.results.criticOutput.isApproved && (
                <div className="pt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                  <span className="px-2 py-1 bg-amber-200/50 text-amber-800 rounded text-[10px] font-bold uppercase">Reestruturação Automática Realizada</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex || analysis.status === 'completed';
            const isActive = index === currentStepIndex && (analysis.status === 'processing' || analysis.status === 'waiting_user' || analysis.status === 'failed');
            const isFailed = index === currentStepIndex && analysis.status === 'failed';
            
            return (
              <div
                key={step.id}
                className={cn(
                  "p-5 rounded-xl border transition-all duration-300",
                  isCompleted ? "bg-green-50/50 border-green-100" :
                  isFailed ? "bg-red-50/50 border-red-200 shadow-sm" :
                  isActive ? "bg-blue-50/50 border-blue-200 shadow-sm" :
                  "bg-gray-50/50 border-gray-100 opacity-60"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    isCompleted ? "bg-green-100 text-green-600" :
                    isFailed ? "bg-red-100 text-red-600" :
                    isActive ? "bg-blue-100 text-blue-600" :
                    "bg-gray-200 text-gray-400"
                  )}>
                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> :
                     isFailed ? <AlertTriangle className="w-6 h-6" /> :
                     isActive ? (analysis.status === 'waiting_user' ? <MessageSquare className="w-6 h-6" /> : <Clock className="w-6 h-6 animate-spin" />) :
                     <Circle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{step.label}</h3>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Unbalance Data Table */}
        {renderUnbalanceTable()}

        {/* Hidden Print Container - Always present to avoid "no document" errors */}
        <div 
          id="final-report"
          className="print-only-container w-full p-8 bg-white"
          aria-hidden="true"
        >
          <div className="mb-8 text-center border-b pb-8">
            <h1 className="text-4xl font-bold text-gray-900">Relatório de Qualidade de Energia</h1>
            <p className="text-gray-500 mt-2">Gerado automaticamente em {new Date().toLocaleDateString('pt-BR')}</p>
            <p className="text-gray-500 italic">Arquivo: {analysis.fileName}</p>
          </div>
          {analysis.results?.reportContent ? (
            renderReportContent(analysis.results.reportContent)
          ) : (
            <div className="p-12 text-center text-gray-400 italic">
              Aguardando conclusão da análise para gerar o relatório completo.
            </div>
          )}
        </div>

        {/* Interaction Area - Show for Engineer or Reviewer */}
        <AnimatePresence>
          {isWaiting && (analysis.currentStep === 'engineer' || analysis.currentStep === 'reviewer') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 space-y-6"
            >
              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                <div className="flex items-center gap-3 text-amber-800 font-bold">
                  <MessageSquare className="w-5 h-5" />
                  {analysis.currentStep === 'engineer' ? 'Feedback da Análise Técnica' : 'Ajustes Finais'}
                </div>
                <p className="text-sm text-amber-700">
                  {analysis.currentStep === 'engineer' 
                    ? 'Revise os achados técnicos acima. Se houver algo a ajustar ou complementar antes da geração do relatório final, descreva abaixo.'
                    : 'O relatório está pronto para revisão final. Se desejar algum ajuste no texto ou na estrutura, descreva abaixo.'}
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={analysis.currentStep === 'engineer' ? "Ex: Foque mais nos harmônicos de 5ª ordem..." : "Ex: Adicione uma conclusão sobre o fator de potência..."}
                    className="flex-grow px-4 py-2 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => {
                      onProceed?.(feedback);
                      setFeedback("");
                    }}
                    className="px-6 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center gap-2 shrink-0 shadow-md active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    {analysis.currentStep === 'engineer' ? 'Prosseguir' : 'Solicitar Ajustes'}
                  </button>
                </div>
              </div>

              {/* Show findings at Engineer step */}
              {analysis.currentStep === 'engineer' && (
                <div className="grid grid-cols-1 gap-6">
                  <div className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    {renderMarkdown(
                      cleanAnalystOutput, 
                      "Achados do Analista de Dados", 
                      <FileText className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    {renderMarkdown(
                      cleanEngineerOutput, 
                      "Avaliação do Engenheiro Elétrico", 
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* HTML Preview */}
        {analysis.htmlReport && !analysis.userApproved && analysis.status === 'waiting_user' && analysis.currentStep === 'reviewer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Prévia do Relatório</h3>
              <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest">
                HTML
              </div>
            </div>
            <div 
              id="printable-report"
              className="p-12 bg-white rounded-2xl border border-gray-200 shadow-inner overflow-auto max-h-[700px]"
            >
              {renderReportContent(analysis.htmlReport)}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={onApprove}
                disabled={!analysis.results?.criticOutput || analysis.results.criticOutput.score <= 8}
                className={cn(
                  "flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                  analysis.results?.criticOutput && analysis.results.criticOutput.score > 8 
                    ? "bg-green-600 text-white hover:bg-green-700" 
                    : "bg-gray-400 text-white"
                )}
              >
                <ThumbsUp className="w-5 h-5" />
                {!analysis.results?.criticOutput 
                  ? "Aguardando Avaliação do Crítico"
                  : analysis.results.criticOutput.score <= 8 
                    ? "Aguardando Melhoria de Qualidade (Score <= 8)" 
                    : "Aprovar e Finalizar"}
              </button>
            </div>
          </motion.div>
        )}

        {analysis.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 flex flex-col items-center gap-6 p-8 bg-blue-50 rounded-2xl border border-blue-100"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">Relatório Pronto!</h3>
              <p className="text-gray-600 mt-2">
                A análise foi concluída com sucesso. Você já pode imprimir o relatório técnico ou salvar como PDF.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={handleExportToGoogleDrive}
                disabled={isExporting}
                className={cn(
                  "flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed",
                  isExporting ? "bg-gray-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Exportando para Google Docs...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Exportar para Google Docs
                  </>
                )}
              </button>

              {exportLink && (
                <a
                  href={exportLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  <ExternalLink className="w-5 h-5" />
                  Abrir no Google Docs
                </a>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AnalysisDashboard;
