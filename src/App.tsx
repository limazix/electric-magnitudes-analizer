import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { BookOpen, History, Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
import Auth from './components/Auth';
import Header from './components/Header';
import Footer from './components/Footer';
import Hero from './components/Hero';
import FileUploader from './components/FileUploader';
import AnalysisDashboard from './components/AnalysisDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { AnalysisRecord } from './types';
import { runAnalyst, runEngineer, runReporter, runReviewer, runCritic, generateEmbedding } from './services/geminiService';
import { getRelevantRegulations, saveCriticEvaluation, getRelevantCriticEvaluations, seedDefaultRegulations } from './services/regulationsService';
import { generateHash, getCachedAnalysis, setCachedAnalysis } from './services/cacheService';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { getDocs, limit } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisRecord | null>(null);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    // Seed default regulations on startup
    seedDefaultRegulations();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const isAdminEmail = user.email === "blimacardoso@gmail.com";
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: isAdminEmail ? 'admin' : 'user',
            createdAt: serverTimestamp()
          });
        } else if (isAdminEmail && userSnap.data().role !== 'admin') {
          await updateDoc(userRef, { role: 'admin' });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'analyses'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const analyses = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };
      }) as AnalysisRecord[];
      
      setHistory(analyses);
      
      // If we don't have a current analysis selected, or if the current one is updated in the snapshot
      if (currentAnalysis) {
        const updated = analyses.find(a => a.id === currentAnalysis.id);
        if (updated) setCurrentAnalysis(updated);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'analyses');
    });

    return () => unsubscribe();
  }, [user, currentAnalysis?.id]);

  const getUserPreferences = async () => {
    if (!user) return "";
    try {
      const q = query(
        collection(db, 'user_preferences'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data().content).join("\n");
    } catch (err) {
      console.error("Error fetching preferences:", err);
      return "";
    }
  };

  const saveUserPreference = async (content: string) => {
    if (!user || !content.trim()) return;
    try {
      const embedding = await generateEmbedding(content);
      await addDoc(collection(db, 'user_preferences'), {
        userId: user.uid,
        content,
        embedding,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error saving preference:", err);
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!user) return;

    const path = 'analyses';
    try {
      setError(null);
      
      Papa.parse(file, {
        complete: async (results) => {
          const csvString = Papa.unparse(results.data);
          
          const analysisRef = await addDoc(collection(db, path), {
            userId: user.uid,
            status: 'processing',
            currentStep: 'analyst',
            progress: 10,
            fileName: file.name,
            csvData: csvString.substring(0, 50000),
            createdAt: serverTimestamp(),
            lastMessage: "Analista de Dados iniciando processamento..."
          });

          setCurrentAnalysis({
            id: analysisRef.id,
            userId: user.uid,
            status: 'processing',
            currentStep: 'analyst',
            progress: 10,
            fileName: file.name,
            csvData: csvString.substring(0, 50000),
            createdAt: new Date().toISOString(),
            lastMessage: "Analista de Dados iniciando processamento..."
          } as AnalysisRecord);

          try {
            const preferences = await getUserPreferences();
            const regulations = await getRelevantRegulations("PRODIST Módulo 8 qualidade energia anomalias tensao harmonicos");
            const lessonsLearned = await getRelevantCriticEvaluations("Análise inicial de dados CSV e conformidade normativa");

            // Check cache for this specific input combination
            const cacheKey = await generateHash(csvString + preferences + regulations + lessonsLearned);
            const cachedResults = await getCachedAnalysis(cacheKey);

            if (cachedResults && cachedResults.analystOutput && cachedResults.engineerOutput) {
              await updateDoc(doc(db, path, analysisRef.id), {
                status: 'waiting_user',
                currentStep: 'engineer',
                progress: 50,
                lastMessage: "Análise técnica recuperada do cache. Por favor, revise os achados.",
                results: cachedResults
              });
              return;
            }

            // Step 1: Analyst
            const analystOutput = await runAnalyst(csvString, preferences, regulations, lessonsLearned);
            await updateDoc(doc(db, path, analysisRef.id), {
              progress: 30,
              lastMessage: "Analista concluiu. Engenheiro Elétrico iniciando...",
              results: { analystOutput }
            });

            // Step 2: Engineer
            const engineerOutput = await runEngineer(analystOutput, preferences, regulations, undefined, lessonsLearned);
            
            // Save to cache after Step 2
            await setCachedAnalysis(cacheKey, { analystOutput, engineerOutput });

            await updateDoc(doc(db, path, analysisRef.id), {
              status: 'waiting_user',
              currentStep: 'engineer',
              progress: 50,
              lastMessage: "Análise técnica concluída. Por favor, revise os achados do Analista e do Engenheiro.",
              results: { analystOutput, engineerOutput }
            });

          } catch (err) {
            console.error("Erro no processamento:", err);
            await updateDoc(doc(db, path, analysisRef.id), {
              status: 'failed',
              error: "Falha no processamento automático da análise."
            });
          }
        },
        error: (err) => {
          setError("Erro ao ler o arquivo CSV.");
        }
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }, [user]);

  const handleProceed = async (feedback?: string) => {
    if (!currentAnalysis || !user) return;
    const path = 'analyses';
    const id = currentAnalysis.id;
    
    // Use local results to avoid desync with state updated by onSnapshot
    let currentResults = { ...currentAnalysis.results };

    try {
      const preferences = await getUserPreferences();
      const regulations = await getRelevantRegulations(feedback || "PRODIST Módulo 8 conformidade normas");
      const lessonsLearned = await getRelevantCriticEvaluations(feedback || "Consolidação de relatório e revisão técnica");

      if (currentAnalysis.currentStep === 'engineer') {
        if (feedback) await saveUserPreference(feedback);

        // Check cache for final report
        const finalCacheKey = await generateHash(
          (currentResults.analystOutput || "") + 
          (currentResults.engineerOutput || "") + 
          preferences + 
          (feedback || "") + 
          regulations + 
          lessonsLearned
        );
        const cachedFinalResults = await getCachedAnalysis(finalCacheKey);

        if (cachedFinalResults && cachedFinalResults.reviewerOutput && cachedFinalResults.criticOutput) {
          await updateDoc(doc(db, path, id), {
            status: 'completed',
            progress: 100,
            currentStep: 'done',
            lastMessage: "Relatório final recuperado do cache.",
            results: cachedFinalResults
          });
          return;
        }

        await updateDoc(doc(db, path, id), {
          status: 'processing',
          progress: 60,
          lastMessage: "Relator consolidando o relatório final..."
        });

        // Step 3: Reporter
        const reporterOutput = await runReporter(
          currentResults.analystOutput!,
          currentResults.engineerOutput!,
          preferences,
          feedback,
          lessonsLearned
        );
        currentResults.reporterOutput = reporterOutput;

        await updateDoc(doc(db, path, id), {
          progress: 75,
          lastMessage: "Revisor finalizando formatação e diagramas..."
        });

        // Step 4: Reviewer
        const reviewerResult = await runReviewer(reporterOutput, preferences, undefined, lessonsLearned);
        const reviewerOutput = reviewerResult.html;
        const markdownReport = reviewerResult.markdown;
        currentResults.reviewerOutput = reviewerOutput;
        currentResults.markdownReport = markdownReport;

        await updateDoc(doc(db, path, id), {
          progress: 85,
          currentStep: 'critic',
          lastMessage: "Crítico de Qualidade validando o relatório..."
        });

        // Step 5: Critic
        const criticOutput = await runCritic({ html: reviewerOutput, markdown: markdownReport });
        currentResults.criticOutput = criticOutput;
        
        // Save evaluation for RAG
        await saveCriticEvaluation(markdownReport, criticOutput.critique, criticOutput.score);

        // Save to cache after Step 5
        await setCachedAnalysis(finalCacheKey, currentResults);

        if (criticOutput.score <= 8) {
          // RESTRUCTURE LOOP
          await updateDoc(doc(db, path, id), {
            progress: 20,
            currentStep: 'analyst',
            lastMessage: `Crítico rejeitou o relatório (Score: ${criticOutput.score}). Reestruturando com base nas recomendações...`,
            results: currentResults
          });

          // Re-run with critic recommendations as feedback
          const criticFeedback = `RECOMENDAÇÕES DO CRÍTICO:\nAnalista: ${criticOutput.recommendations.analyst}\nEngenheiro: ${criticOutput.recommendations.engineer}\nRelator: ${criticOutput.recommendations.reporter}\nRevisor: ${criticOutput.recommendations.reviewer}`;
          
          // Re-run Analyst
          const newAnalystOutput = await runAnalyst(currentAnalysis.csvData!, preferences, regulations + "\n" + criticOutput.recommendations.analyst, lessonsLearned);
          currentResults.analystOutput = newAnalystOutput;
          await updateDoc(doc(db, path, id), { progress: 40, results: { ...currentResults } });

          // Re-run Engineer
          const newEngineerOutput = await runEngineer(newAnalystOutput, preferences, regulations + "\n" + criticOutput.recommendations.engineer, undefined, lessonsLearned);
          currentResults.engineerOutput = newEngineerOutput;
          await updateDoc(doc(db, path, id), { progress: 60, results: { ...currentResults } });

          // Re-run Reporter
          const newReporterOutput = await runReporter(newAnalystOutput, newEngineerOutput, preferences, criticFeedback, lessonsLearned);
          currentResults.reporterOutput = newReporterOutput;
          await updateDoc(doc(db, path, id), { progress: 80, results: { ...currentResults } });

          // Re-run Reviewer
          const newReviewerResult = await runReviewer(newReporterOutput, preferences, criticOutput.recommendations.reviewer, lessonsLearned);
          currentResults.reviewerOutput = newReviewerResult.html;
          currentResults.markdownReport = newReviewerResult.markdown;
          
          // Final check by Critic (one more time)
          const finalCriticOutput = await runCritic({ html: newReviewerResult.html, markdown: newReviewerResult.markdown });
          currentResults.criticOutput = finalCriticOutput;
          
          // Save final evaluation
          await saveCriticEvaluation(newReviewerResult.markdown, finalCriticOutput.critique, finalCriticOutput.score);

          await updateDoc(doc(db, path, id), {
            status: 'waiting_user',
            currentStep: 'reviewer',
            progress: 95,
            htmlReport: newReviewerResult.html,
            lastMessage: finalCriticOutput.score > 8 ? "Relatório reestruturado e aprovado pelo crítico!" : "Relatório reestruturado. O crítico ainda sugere melhorias, mas está pronto para sua revisão.",
            results: currentResults
          });
        } else {
          // Approved by Critic
          await updateDoc(doc(db, path, id), {
            status: 'waiting_user',
            currentStep: 'reviewer',
            progress: 95,
            htmlReport: reviewerOutput,
            lastMessage: "Relatório finalizado, revisado e aprovado pelo crítico de qualidade!",
            results: currentResults
          });
        }
      } else if (currentAnalysis.currentStep === 'reviewer') {
        if (feedback) await saveUserPreference(feedback);

        await updateDoc(doc(db, path, id), {
          status: 'processing',
          progress: 80,
          lastMessage: "Processando seu feedback e ajustando o relatório..."
        });

        // If feedback mentions "dados", "data", "analista", or "anomalia", re-run the Analyst
        const shouldRerunAnalyst = /dados|data|analista|anomalia|missing|faltando/i.test(feedback || "");
        
        if (shouldRerunAnalyst) {
          currentResults.analystOutput = await runAnalyst(currentAnalysis.csvData!, preferences, regulations, lessonsLearned);
        }

        if (shouldRerunAnalyst || /norma|lei|regra|aneel|enel/i.test(feedback || "")) {
          currentResults.engineerOutput = await runEngineer(currentResults.analystOutput!, preferences, regulations, feedback, lessonsLearned);
        }

        const reporterOutput = await runReporter(
          currentResults.analystOutput!,
          currentResults.engineerOutput!,
          preferences,
          feedback,
          lessonsLearned
        );
        currentResults.reporterOutput = reporterOutput;

        const reviewerResult = await runReviewer(reporterOutput, preferences, feedback, lessonsLearned);
        currentResults.reviewerOutput = reviewerResult.html;
        currentResults.markdownReport = reviewerResult.markdown;

        // Step 5: Critic (after user feedback adjustment)
        const criticOutput = await runCritic({ html: reviewerResult.html, markdown: reviewerResult.markdown });
        currentResults.criticOutput = criticOutput;
        
        await saveCriticEvaluation(reviewerResult.markdown, criticOutput.critique, criticOutput.score);

        await updateDoc(doc(db, path, id), {
          status: 'waiting_user',
          currentStep: 'reviewer',
          progress: 95,
          htmlReport: reviewerResult.html,
          lastMessage: "Relatório ajustado com seu feedback e validado pelo crítico.",
          results: currentResults
        });
      }
    } catch (err) {
      console.error("Erro ao prosseguir:", err);
      setError("Erro ao processar feedback.");
    }
  };

  const handleApprove = async () => {
    if (!currentAnalysis || !user) return;
    const path = 'analyses';
    const id = currentAnalysis.id;

    try {
      await updateDoc(doc(db, path, id), {
        status: 'completed',
        currentStep: 'done',
        progress: 100,
        userApproved: true,
        lastMessage: "Análise concluída e aprovada!",
        results: { 
          ...currentAnalysis.results, 
          reportContent: currentAnalysis.htmlReport,
          markdownReport: currentAnalysis.results?.markdownReport
        }
      });
    } catch (err) {
      setError("Erro ao aprovar relatório.");
    }
  };

  const handleDownloadReport = useCallback(() => {
    window.print();
  }, []);

  const handleDeleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'analyses', deletingId));
      if (currentAnalysis?.id === deletingId) {
        setCurrentAnalysis(null);
      }
      setDeletingId(null);
    } catch (err) {
      console.error("Erro ao excluir análise:", err);
      setError("Erro ao excluir análise.");
      setDeletingId(null);
    }
  };

  function handleFirestoreError(error: any, operationType: OperationType, path: string) {
    const errInfo = {
      error: error?.message || String(error),
      operationType,
      path,
      userId: auth.currentUser?.uid
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    setError(`Erro de permissão no banco de dados (${operationType}).`);
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        
        <div className="flex flex-grow">
          {/* Sidebar History */}
          <aside className="w-80 bg-white border-r border-gray-100 hidden lg:flex flex-col">
            <div className="p-6 border-b border-gray-50">
              <button
                onClick={() => {
                  setCurrentAnalysis(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Nova Análise
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-2">
              <div className="flex items-center gap-2 px-2 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <History className="w-4 h-4" />
                Histórico de Análises
              </div>
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setCurrentAnalysis(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setCurrentAnalysis(item);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "w-full text-left p-4 rounded-xl transition-all border group cursor-pointer outline-none focus:ring-2 focus:ring-blue-200",
                    currentAnalysis?.id === item.id 
                      ? "bg-blue-50 border-blue-100 shadow-sm" 
                      : "bg-white border-transparent hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn(
                        "text-sm font-bold truncate",
                        currentAnalysis?.id === item.id ? "text-blue-700" : "text-gray-900"
                      )}>
                        {item.fileName}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className={cn(
                      "shrink-0 p-1 rounded-full",
                      item.status === 'completed' ? "bg-green-100 text-green-600" :
                      item.status === 'processing' ? "bg-blue-100 text-blue-600" :
                      item.status === 'waiting_user' ? "bg-amber-100 text-amber-600" :
                      "bg-gray-100 text-gray-400"
                    )}>
                      {item.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> :
                       item.status === 'processing' ? <Clock className="w-3 h-3 animate-spin" /> :
                       <AlertCircle className="w-3 h-3" />}
                    </div>
                    <button
                      onClick={(e) => handleDeleteAnalysis(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Excluir análise"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="flex-grow overflow-y-auto">
            {!currentAnalysis && <Hero />}
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
              {!currentAnalysis && (
                <section className="space-y-8">
                  <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                      Inicie sua Análise
                    </h2>
                    <p className="text-gray-600 mt-4">
                      Faça o upload do arquivo CSV gerado pelo PowerNET PQ-600 G4 para começar o processo de avaliação técnica.
                    </p>
                  </div>
                  
                  <FileUploader 
                    onFileSelect={handleFileSelect} 
                    disabled={false} 
                  />
                  
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-2xl mx-auto p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-medium flex items-center gap-3"
                    >
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      {error}
                    </motion.div>
                  )}
                </section>
              )}

              <AnimatePresence mode="wait">
                {currentAnalysis && (
                  <motion.section
                    key={currentAnalysis.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -40 }}
                  >
                    <AnalysisDashboard 
                      analysis={currentAnalysis} 
                      onDownloadReport={handleDownloadReport}
                      onProceed={handleProceed}
                      onApprove={handleApprove}
                      onReset={() => setCurrentAnalysis(null)}
                    />
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>

        <Footer />

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deletingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-gray-100"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Excluir Análise?</h3>
                <p className="text-gray-500 text-center mb-8">
                  Esta ação não pode ser desfeita. Todos os dados desta análise serão removidos permanentemente.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingId(null)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
