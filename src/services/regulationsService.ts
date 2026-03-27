import { db } from "../firebase";
import { collection, query, getDocs, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { generateEmbedding } from "./geminiService";

export interface Regulation {
  id?: string;
  title: string;
  content: string;
  module?: string;
  embedding: number[];
  sourceUrl?: string;
  createdAt: any;
}

export async function getRelevantRegulations(queryText: string): Promise<string> {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const snapshot = await getDocs(collection(db, 'regulations'));
    
    const regulations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Regulation));

    // Simple cosine similarity (manual for now since Firestore doesn't support vector search natively without extensions)
    const scored = regulations.map(reg => {
      const score = dotProduct(queryEmbedding, reg.embedding);
      return { ...reg, score };
    });

    const topResults = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return topResults.map(r => `[${r.title}]: ${r.content}`).join("\n\n");
  } catch (err) {
    console.error("Error fetching regulations:", err);
    return "";
  }
}

export async function seedDefaultRegulations() {
  const defaultRegs = [
    {
      title: "PRODIST Módulo 8 - Tensão em Regime Permanente",
      module: "8.1",
      content: "Define os limites de variação de tensão em regime permanente. Para sistemas de 127V, a tensão é considerada adequada entre 117V e 133V. Fora desses limites, a tensão é classificada como precária ou crítica, sujeita a compensações financeiras aos consumidores.",
      sourceUrl: "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-de-distribuicao-prodist"
    },
    {
      title: "PRODIST Módulo 8 - Harmônicos",
      module: "8.2",
      content: "Estabelece limites para Distorção Harmônica Total (DTT) de tensão. Para sistemas até 1kV, o limite de DTT é de 10%. Limites individuais para harmônicos ímpares não múltiplos de 3 (5ª, 7ª, 11ª...) são mais rigorosos devido ao impacto em motores e transformadores.",
      sourceUrl: "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-de-distribuicao-prodist"
    },
    {
      title: "Resolução Normativa ANEEL nº 1.000/2021",
      module: "Geral",
      content: "Consolida as principais regras de prestação do serviço público de distribuição de energia elétrica. Define responsabilidades sobre danos em equipamentos elétricos causados por distúrbios na rede e regras para faturamento de energia reativa excedente (Fator de Potência < 0,92).",
      sourceUrl: "https://www.in.gov.br/en/web/dou/-/resolucao-normativa-aneel-n-1.000-de-7-de-dezembro-de-2021-365345342"
    },
    {
      title: "IEEE 519-2022 - Limites de Corrente Harmônica",
      module: "Internacional",
      content: "Define limites para a distorção de corrente harmônica que um consumidor pode injetar na rede, baseados na relação entre a corrente de curto-circuito e a corrente de carga (ISC/IL). O objetivo é evitar que a distorção de um cliente afete a qualidade da tensão para outros.",
      sourceUrl: "https://standards.ieee.org/ieee/519/7313/"
    },
    {
      title: "ABNT NBR 5410 - Dimensionamento de Condutores",
      module: "Instalações",
      content: "Prescreve que o dimensionamento de condutores deve considerar a presença de harmônicos, especialmente a 3ª ordem, que se soma no condutor neutro. Em circuitos com alta carga não-linear, o neutro pode exigir seção superior à das fases.",
      sourceUrl: "https://www.abnt.org.br/"
    },
    {
      title: "PRODIST Módulo 8 - Desequilíbrio de Tensão",
      module: "8.3",
      content: "Define os limites para o Fator de Desequilíbrio de Tensão (FD%). O limite estabelecido é de 2% para pontos de conexão em tensão inferior a 2,3 kV. Desequilíbrios excessivos causam aquecimento adicional em motores de indução e perda de eficiência.",
      sourceUrl: "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-de-distribuicao-prodist"
    },
    {
      title: "PRODIST Módulo 8 - Flutuação de Tensão (Flicker)",
      module: "8.4",
      content: "Regulamenta os níveis de flutuação de tensão através dos indicadores Pst (curta duração) e Plt (longa duração). O limite global para Pst é 1,0 e para Plt é 0,8. Flutuações acima desses níveis causam o efeito 'flicker' (cintilação) em lâmpadas e podem afetar equipamentos sensíveis.",
      sourceUrl: "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-de-distribuicao-prodist"
    },
    {
      title: "PRODIST Módulo 8 - Fator de Potência",
      module: "8.5",
      content: "Estabelece o limite mínimo de 0,92 para o fator de potência. Valores abaixo deste limite sujeitam o consumidor a cobranças por excedente reativo. A análise deve distinguir entre reativo indutivo (excesso de motores) e capacitivo (excesso de bancos de capacitores em vazio).",
      sourceUrl: "https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-de-distribuicao-prodist"
    },
    {
      title: "NR 10 - Segurança em Instalações e Serviços em Eletricidade",
      module: "Segurança",
      content: "Estabelece os requisitos e condições mínimas objetivando a implementação de medidas de controle e sistemas preventivos, de forma a garantir a segurança e a saúde dos trabalhadores que, direta ou indiretamente, interajam em instalações elétricas e serviços com eletricidade.",
      sourceUrl: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/normas-regulamentadoras-vigentes/norma-regulamentadora-n-10-nr-10"
    }
  ];

  try {
    const snapshot = await getDocs(collection(db, 'regulations'));
    if (snapshot.empty) {
      console.log("Seeding default regulations...");
      for (const reg of defaultRegs) {
        const embedding = await generateEmbedding(reg.title + ": " + reg.content);
        await addDoc(collection(db, 'regulations'), {
          ...reg,
          embedding,
          createdAt: serverTimestamp()
        });
      }
      console.log("Seeding complete.");
    }
  } catch (err) {
    console.error("Error seeding regulations:", err);
  }
}

export async function saveCriticEvaluation(reportContext: string, critique: string, score: number) {
  try {
    const embedding = await generateEmbedding(critique + "\n" + reportContext.substring(0, 1000));
    await addDoc(collection(db, 'critic_evaluations'), {
      reportContext: reportContext.substring(0, 2000),
      critique,
      score,
      embedding,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Error saving critic evaluation:", err);
  }
}

export async function getRelevantCriticEvaluations(queryText: string): Promise<string> {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const snapshot = await getDocs(collection(db, 'critic_evaluations'));
    
    const evaluations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));

    if (evaluations.length === 0) return "";

    const scored = evaluations.map(evalu => {
      const score = dotProduct(queryEmbedding, evalu.embedding);
      return { ...evalu, score };
    });

    const topResults = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return topResults.map(r => `[Score: ${r.score}]: ${r.critique}`).join("\n\n");
  } catch (err) {
    console.error("Error fetching critic evaluations:", err);
    return "";
  }
}

function dotProduct(a: number[], b: number[]) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
