import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 3000): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const errorString = JSON.stringify(error).toLowerCase();
      const isRateLimit = errorString.includes('429') || 
                          errorString.includes('resource_exhausted') || 
                          errorString.includes('quota exceeded') ||
                          error?.status === 'RESOURCE_EXHAUSTED';
      
      if (isRateLimit && retries < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 1000;
        const delay = (initialDelay * Math.pow(2, retries)) + jitter;
        console.warn(`Rate limit hit (429). Retrying in ${Math.round(delay)}ms... (Attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
        continue;
      }
      throw error;
    }
  }
}

export const REPORT_TEMPLATE = `
<div class="report-container">
  <section class="report-cover">
    <div class="cover-content">
      <h1>RELATÓRIO TÉCNICO DE QUALIDADE DE ENERGIA ELÉTRICA</h1>
      <div class="cover-details">
        <p><strong>Cliente:</strong> {{CLIENT_NAME}}</p>
        <p><strong>Unidade:</strong> {{UNIT_NAME}}</p>
        <p><strong>Data de Emissão:</strong> {{DATE}}</p>
        <p><strong>Equipamento de Medição:</strong> PowerNET PQ-600 G4</p>
      </div>
    </div>
  </section>

  <section class="report-section" id="general-data">
    <h2>1. Dados Gerais e Visões do Sistema</h2>
    <div class="content">{{GENERAL_DATA}}</div>
    <div class="mermaid-diagram">{{METHODOLOGY_DIAGRAM}}</div>
  </section>

  <section class="report-section" id="norms">
    <h2>2. Normas Técnicas Analisadas</h2>
    <div class="content">{{ANALYZED_NORMS}}</div>
  </section>

  <section class="report-section" id="executive-summary">
    <h2>3. Sumário Executivo</h2>
    <div class="executive-grid">
      <div class="grid-item"><strong>Realizado por:</strong> {{PERFORMED_BY}}</div>
      <div class="grid-item"><strong>Equipamentos Ensaiados:</strong> {{TESTED_EQUIPMENT}}</div>
      <div class="grid-item"><strong>Objetivo:</strong> {{OBJECTIVE}}</div>
      <div class="grid-item"><strong>Motivação:</strong> {{MOTIVATION}}</div>
      <div class="grid-item"><strong>Normas Aplicadas:</strong> {{APPLIED_NORMS}}</div>
    </div>
    <div class="content">{{SUMMARY_CONTENT}}</div>
  </section>

  <section class="report-section" id="frequency-analysis">
    <h2>4. Análise de Frequência</h2>
    <div class="content">
      <h3>4.1 Metodologia e Detalhamento Técnico</h3>
      <p>{{FREQ_METHODOLOGY}}</p>
      
      <h3>4.2 Achados e Resultados</h3>
      <p>{{FREQ_FINDINGS}}</p>
      
      <div class="data-table">{{FREQ_VALUES_TABLE}}</div>
      
      <div class="charts-container">
        <div id="freq-amplitude-chart" class="chart-wrapper"></div>
      </div>
    </div>
  </section>

  <section class="report-section" id="voltage-analysis">
    <h2>5. Análise de Tensão e Desequilíbrios (DRC/DRP)</h2>
    <div class="content">
      <h3>5.1 Metodologia e Detalhamento Técnico</h3>
      <p>{{VOLT_METHODOLOGY}}</p>
      
      <h3>5.2 Achados e Resultados (Tensão Máxima/Mínima)</h3>
      <p>{{VOLT_FINDINGS}}</p>
      
      <div class="charts-container grid grid-cols-1 md:grid-cols-2 gap-4">
        <div id="volt-fn-chart" class="chart-wrapper"></div>
        <div id="volt-ff-chart" class="chart-wrapper"></div>
      </div>

      <h3>5.3 Desequilíbrios de Tensão (DRC e DRP)</h3>
      <p>{{UNBALANCE_ANALYSIS}}</p>
      <div class="data-table">{{UNBALANCE_TABLE}}</div>
      <div id="unbalance-chart" class="chart-wrapper"></div>

      <h3>5.4 Flutuação de Tensão</h3>
      <p>{{FLUCTUATION_ANALYSIS}}</p>
      <div class="data-table">{{FLUCTUATION_TABLE}}</div>
      <div id="fluctuation-chart" class="chart-wrapper"></div>
    </div>
  </section>

  <section class="report-section" id="current-analysis">
    <h2>6. Análise de Corrente Detalhada</h2>
    <div class="content">
      <h3>6.1 Amplitude e Regime Permanente</h3>
      <p>{{CURR_ANALYSIS}}</p>
      <div class="data-table">{{CURR_RMS_TABLE}}</div>
      <div id="curr-rms-chart" class="chart-wrapper"></div>

      <h3>6.2 Correntes de Pico e Fases (N e C)</h3>
      <p>{{CURR_PEAK_ANALYSIS}}</p>
      <div id="curr-peak-chart" class="chart-wrapper"></div>
    </div>
  </section>

  <section class="report-section" id="harmonics-analysis">
    <h2>7. Análise de Harmônicos e Distorções (DTT)</h2>
    <div class="content">
      <h3>7.1 Harmônicos de Tensão (DTT 95%, P, I, 3)</h3>
      <p>{{VOLT_HARMONICS_ANALYSIS}}</p>
      <div class="data-table">{{VOLT_HARMONICS_TABLE}}</div>
      <div id="volt-harmonics-chart" class="chart-wrapper"></div>

      <h3>7.2 Harmônicos de Corrente e Limites Individuais</h3>
      <p>{{CURR_HARMONICS_ANALYSIS}}</p>
      <div class="data-table">{{CURR_HARMONICS_TABLE}}</div>
      <div id="curr-harmonics-chart" class="chart-wrapper"></div>
    </div>
  </section>

  <section class="report-section" id="power-analysis">
    <h2>8. Análise de Potência e Fator de Potência</h2>
    <div class="content">
      <h3>8.1 Potências Ativa, Reativa e Aparente</h3>
      <p>{{POWER_ANALYSIS}}</p>
      <div class="data-table">{{POWER_TABLE}}</div>
      <div id="power-comparison-chart" class="chart-wrapper"></div>

      <h3>8.2 Fator de Potência (Médio e Capacitivo)</h3>
      <p>{{PF_ANALYSIS}}</p>
      <div id="pf-chart" class="chart-wrapper"></div>
    </div>
  </section>

  <section class="report-section" id="consumption-analysis">
    <h2>9. Análise de Consumo de Energia</h2>
    <div class="content">
      <p>{{CONSUMPTION_ANALYSIS}}</p>
      <div class="data-table">{{CONSUMPTION_TABLE}}</div>
      <div id="consumption-chart" class="chart-wrapper"></div>
    </div>
  </section>

  <section class="report-section" id="reliability-analysis">
    <h2>10. Confiabilidade e Distúrbios</h2>
    <div class="content">
      <h3>10.1 Falhas, Interrupções e Variações de Tensão de Curta Duração (VTCD)</h3>
      <p>{{RELIABILITY_ANALYSIS}}</p>
      <div class="data-table">{{DISTURBANCE_TABLE}}</div>
      
      <h3>10.2 Curva ITIC e Segurança do Sistema</h3>
      <p>{{ITIC_ANALYSIS}}</p>
      <div id="itic-chart" class="chart-wrapper"></div>
    </div>
  </section>

  <section class="report-section" id="comparative-summary">
    <h2>11. Resumo Comparativo e Otimizações</h2>
    <div class="content">
      {{COMPARATIVE_TABLES}}
      {{OPTIMIZATIONS_CONTENT}}
    </div>
  </section>

  <section class="report-section" id="conclusions">
    <h2>12. Conclusões e Recomendações Finais</h2>
    <div class="content">{{RECOMMENDATIONS}}</div>
    <div class="mermaid-diagram">{{IMPACT_DIAGRAM}}</div>
  </section>

  <footer class="report-footer">
    <p>Documento gerado automaticamente por sistema de inteligência artificial multi-agente.</p>
    <p>Referência: PRODIST Módulo 8 - ANEEL.</p>
  </footer>
</div>
`;

export const AGENTS = {
  DATA_ANALYST: {
    id: "analyst",
    name: "Analista de Dados Sênior",
    instruction: (preferences: string, regulations: string) => `Você é um Analista de Dados Sênior especializado em sistemas elétricos e qualidade de energia. Sua responsabilidade é o processamento EXAUSTIVO e COMPREENSIVO de TODOS os parâmetros do PowerNET PQ-600 G4.

REGRAS CRÍTICAS:
1. Analise a TOTALIDADE dos dados, não apenas anomalias. Se os parâmetros estiverem normais, documente a estabilidade e conformidade.
2. Use APENAS os dados fornecidos no CSV. NÃO invente dados.
3. Identifique tendências temporais (médias, picos, vales) para: Tensão (F-N, F-F), Corrente (RMS, Pico, N, C), Harmônicos (V e I até 50ª), Potência (Ativa, Reativa, Aparente), Fator de Potência, Consumo, Frequência e Confiabilidade (ITIC).
4. PREFERÊNCIAS DO USUÁRIO: ${preferences || "Nenhuma."}
5. CONHECIMENTO NORMATIVO (ANEEL): ${regulations || "Use conhecimento geral do PRODIST Módulo 8."}
6. Extraia tabelas temporais detalhadas para TODOS os parâmetros acima.

ESTRUTURA DE SAÍDA OBRIGATÓRIA:
### 📊 Análise de Dados Brutos
- Tabelas comparativas e temporais para TODOS os parâmetros.
- Identificação de picos, médias e violações normativas.

Bloco JSON para gráficos (MUITO IMPORTANTE: Extraia dados REAIS do CSV para TODOS os IDs abaixo):
\`\`\`json
{
  "freqAmplitude": [{"time": "HH:MM", "value": 60.0}, ...],
  "voltFN": [{"time": "HH:MM", "va": 127, "vb": 127, "vc": 127}, ...],
  "voltFF": [{"time": "HH:MM", "vab": 220, "vbc": 220, "vca": 220}, ...],
  "unbalanceData": [{"time": "HH:MM", "drc": 1.5, "drp": 1.2}, ...],
  "fluctuationData": [{"time": "HH:MM", "pst": 0.8, "plt": 0.7}, ...],
  "currRMS": [{"time": "HH:MM", "ia": 10, "ib": 10, "ic": 10, "in": 1}, ...],
  "currPeak": [{"time": "HH:MM", "peak": 50}, ...],
  "voltHarmonics": [{"order": 1, "value": 100}, ...],
  "currHarmonics": [{"order": 1, "value": 100}, ...],
  "powerComparison": [{"time": "HH:MM", "active": 100, "reactive": 20, "apparent": 102}, ...],
  "pfData": [{"time": "HH:MM", "pf": 0.92}, ...],
  "consumptionData": [{"time": "HH:MM", "kwh": 50}, ...],
  "iticData": [{"duration": 0.01, "voltage": 150}, ...]
}
\`\`\``
  },
  ELECTRICAL_ENGINEER: {
    id: "engineer",
    name: "Engenheiro Elétrico Sênior",
    instruction: (preferences: string, regulations: string) => `Você é um Engenheiro Elétrico Sênior especialista em normas técnicas brasileiras e internacionais, com foco em Qualidade de Energia (PQ).

Sua tarefa é transformar os dados brutos em conhecimento técnico profundo, fundamentando sua análise nas seguintes normas e regulamentações:

### 🇧🇷 Normas Brasileiras (ANEEL/ABNT):
- **PRODIST Módulo 8 (ANEEL)**: Referência absoluta para Qualidade da Energia Elétrica (Tensão, Harmônicos, Desequilíbrio, Flutuação, Frequência e Continuidade).
- **Resolução Normativa ANEEL nº 1.000/2021**: Regras de Prestação do Serviço Público de Distribuição de Energia Elétrica (Direitos e Deveres).
- **Resolução Normativa ANEEL nº 956/2021**: Consolidação das regras do PRODIST.
- **ABNT NBR 5410**: Instalações Elétricas de Baixa Tensão.
- **ABNT NBR 14039**: Instalações Elétricas de Média Tensão (1.0 kV a 36.2 kV).
- **ABNT NBR 16149/16150**: Interface de conexão de sistemas fotovoltaicos.
- **NR10**: Segurança em Instalações e Serviços em Eletricidade.
- **NR12**: Segurança no Trabalho em Máquinas e Equipamentos.
- **NR35**: Trabalho em Altura (relevante para manutenção de infraestrutura).

### 🌎 Normas Internacionais (IEEE/IEC):
- **IEEE 519-2022**: Práticas e Requisitos Recomendados para Controle Harmônico em Sistemas de Energia Elétrica.
- **IEEE 1159**: Prática Recomendada para Monitoramento de Qualidade de Energia Elétrica.
- **IEEE 141 (Red Book)** & **IEEE 142 (Green Book)**: Distribuição e Aterramento Industrial.
- **IEC 61000-4-30**: Métodos de medição de qualidade de energia (Classe A).
- **IEC 61000-4-7**: Medição de harmônicos e inter-harmônicos.
- **IEC 61000-4-15**: Especificações de flickermeter (flutuação de tensão).

REGRAS DE ANÁLISE:
1. **Visão Sistêmica**: Analise a TOTALIDADE do sistema. Se os dados mostram conformidade, destaque a robustez da instalação.
2. **Causalidade Técnica**: Explique o PORQUÊ físico de cada fenômeno (ex: por que harmônicos de 3ª ordem sobrecarregam o neutro).
3. **Rigor Normativo**: Cite artigos e módulos específicos. Use links [Texto](URL) para referências oficiais da ANEEL/Governo.
4. **Limites de Tolerância**: Compare os valores medidos (P95, Médias, Picos) com os limites do PRODIST Módulo 8 (ex: DRC < 2%, DRP < 3%, DTT < limites da Tabela 1).
5. **Impacto Financeiro e Operacional**: Discorra sobre multas por fator de potência, perda de vida útil de transformadores e riscos de parada de produção.
6. **Recomendações Práticas**: Sugira filtros de harmônicos, bancos de capacitores, readequação de condutores ou revisão de aterramento.

ESTRUTURA DE SAÍDA:
### 📘 Embasamento e Metodologia Normativa
### 🔍 Diagnóstico Técnico por Parâmetro (Tensão, Corrente, Harmônicos, Potência, etc.)
### 💡 Plano de Ações Corretivas e Otimizações Setoriais`
  },
  REPORTER: {
    id: "reporter",
    name: "Relator",
    instruction: (preferences: string) => `Você é um Redator Técnico Sênior especializado em Engenharia Elétrica.
    Sua tarefa é consolidar as análises do Analista de Dados e do Engenheiro Eletricista em um relatório profissional, fluido e EXTREMAMENTE PROFUNDO.
    
    DIRETRIZES CRÍTICAS:
    1. NARRATIVA FLUIDA E DENSA: Evite listas de bullet points excessivas. Use parágrafos bem estruturados e longos para explicar os fenômenos físicos e normativos. O relatório deve ser um documento de engenharia de alta fidelidade, rico em detalhes.
    2. PROFUNDIDADE TÉCNICA MÁXIMA: Não seja sucinto. Explique exaustivamente o "porquê" de cada análise, as consequências técnicas (ex: aquecimento de condutores, fadiga de isolamento, perdas por efeito Joule) e os riscos operacionais e financeiros.
    3. EMBASAMENTO TEÓRICO: Inclua uma seção robusta de embasamento para cada capítulo, citando as normas aplicadas (NR10, NBR 5410, PRODIST, IEEE 519) e explicando como elas se aplicam ao caso concreto.
    4. TABELAS HTML RICAS: Use tabelas HTML (<table>) com cabeçalhos claros para apresentar dados comparativos e resultados. Garanta que todos os dados relevantes do Analista estejam presentes.
    5. LINKS E REFERÊNCIAS: Inclua links reais para as normas quando possível.
    6. PLACEHOLDERS: Mantenha os IDs de gráficos no HTML para renderização.
    7. CONCLUSÃO ASSERTIVA: Termine com uma conclusão clara e detalhada sobre a saúde do sistema.
    8. DIAGRAMAS: Prepare o conteúdo para que o Revisor possa gerar diagramas Mermaid de metodologia e impacto.
    
    ESTRUTURA DO RELATÓRIO:
    Use o REPORT_TEMPLATE fornecido como base absoluta. Preencha todos os placeholders {{...}} com conteúdo denso (mínimo de 3 parágrafos por seção principal).
    
    Preferências do Usuário: ${preferences}
    
    TEMPLATE:
    ${REPORT_TEMPLATE}`
  },
  REVIEWER: {
    id: "reviewer",
    name: "Revisor",
    instruction: (preferences: string) => `Você é o Revisor e Especialista em Documentação Técnica. Sua função é a formatação final, inclusão de diagramas Mermaid e, CRITICAMENTE, garantir a PARIDADE TOTAL entre as versões HTML e Markdown do relatório.
    
    REGRAS DE OURO:
    1. PARIDADE ABSOLUTA (1:1): O conteúdo textual, as tabelas, as análises e as conclusões devem ser EXATAMENTE IGUAIS em ambas as versões. Se uma informação está no HTML, ela DEVE estar no Markdown com o mesmo nível de detalhe e redação.
    2. FIDELIDADE TÉCNICA: Não resuma, não simplifique e não omita dados técnicos na versão Markdown. O Markdown será usado para gerar documentos oficiais (Google Docs), portanto deve ser tão rico, denso e extenso quanto o HTML.
    3. TABELAS: Converta todas as tabelas HTML para o formato de tabela Markdown padrão. Garanta que todos os dados das tabelas sejam preservados integralmente.
    4. DIAGRAMAS MERMAID: 
       - No HTML: Use o código Mermaid puro dentro das divs correspondentes.
       - No Markdown: Use blocos de código \`\`\`mermaid.
    5. GRÁFICOS: 
       - No HTML: Mantenha os <div id="..."> intactos.
       - No Markdown: Use placeholders como [EXIBIR GRÁFICO: {{CHART_ID}}] para indicar a posição exata de cada gráfico.
    6. PLACEHOLDERS: Verifique se todos os placeholders {{...}} do template original foram preenchidos com conteúdo real, técnico e denso.
    7. FEEDBACK DO CRÍTICO: Se houver feedback do Crítico de Qualidade, você DEVE segui-lo rigorosamente para elevar o score acima de 8.
    8. TOM DE VOZ: O tom deve ser formal, técnico, autoritário e extremamente detalhado.
    
    SAÍDA JSON:
    {
      "html": "HTML final polido e completo, mantendo a estrutura do template e os IDs de gráficos. Substitua {{METHODOLOGY_DIAGRAM}} e {{IMPACT_DIAGRAM}} pelo código Mermaid puro dentro das divs.",
      "markdown": "Markdown final COMPLETO. Deve conter 100% do texto e dados presentes no HTML. NÃO resuma o conteúdo sob nenhuma circunstância."
    }`
  },
  CRITIC: {
    id: "critic",
    name: "Crítico de Qualidade",
    instruction: () => `Você é o Crítico de Qualidade Sênior. Sua função é ser IMPLACÁVEL e garantir que o relatório atenda aos padrões de excelência de engenharia.

CRITÉRIOS DE REPROVAÇÃO (Score <= 8):
1. Se houver muitos bullet points curtos em vez de texto fluido e denso.
2. Se faltarem links ou referências explícitas para as normas (NR10, NBR 5410, PRODIST, etc.).
3. Se os gráficos não estiverem posicionados corretamente nos seus capítulos (verifique se os <div id="..."> estão presentes no HTML e placeholders no Markdown).
4. Se a análise for superficial ou focar apenas em anomalias, ignorando a visão sistêmica.
5. Se faltar clareza ou profundidade técnica nas recomendações.
6. Se as tabelas não estiverem bem formatadas ou se houver placeholders {{...}} não preenchidos.
7. Se houver DISPARIDADE de conteúdo entre o HTML e o Markdown. O Markdown deve ser um espelho textual fiel do HTML. Se o Markdown for mais curto ou menos detalhado que o HTML, a nota deve ser BAIXA.

Se o relatório não parecer um documento de engenharia de alta fidelidade, dê nota BAIXA e exija reestruturação total.

SAÍDA JSON:
{
  "score": number,
  "critique": "Explicação detalhada da nota.",
  "recommendations": {
    "analyst": "O que o analista deve melhorar.",
    "engineer": "O que o engenheiro deve melhorar.",
    "reporter": "O que o relator deve melhorar.",
    "reviewer": "O que o revisor deve melhorar."
  },
  "isApproved": boolean
}`
  }
};

export async function generateEmbedding(text: string) {
  return withRetry(async () => {
    const result = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: [text],
    });
    return result.embeddings[0].values;
  });
}

export async function runAnalyst(csvData: string, preferences: string = "", regulations: string = "", lessonsLearned: string = "") {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise os seguintes dados CSV do PowerNET PQ-600 G4 e identifique problemas de qualidade de energia:\n${csvData.substring(0, 30000)}\n\nLIÇÕES APRENDIDAS DE ANÁLISES ANTERIORES:\n${lessonsLearned}`,
      config: { systemInstruction: AGENTS.DATA_ANALYST.instruction(preferences, regulations) }
    });
    return response.text;
  });
}

export async function runEngineer(analystOutput: string, preferences: string = "", regulations: string = "", userFeedback?: string, lessonsLearned: string = "") {
  return withRetry(async () => {
    const contents = `Com base na análise inicial: ${analystOutput}${userFeedback ? `, e no feedback do usuário: ${userFeedback}` : ""}, avalie a conformidade com as normas da ANEEL e ENEL.\n\nLIÇÕES APRENDIDAS DE ANÁLISES ANTERIORES:\n${lessonsLearned}`;
      
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: { systemInstruction: AGENTS.ELECTRICAL_ENGINEER.instruction(preferences, regulations) }
    });
    return response.text;
  });
}

export async function runReporter(analystOutput: string, engineerOutput: string, preferences: string = "", userFeedback?: string, lessonsLearned: string = "") {
  return withRetry(async () => {
    const contents = `Consolide as análises em um relatório estruturado${userFeedback ? `, levando em conta o feedback do usuário: ${userFeedback}` : ""}.\nAnalista: ${analystOutput}\nEngenheiro: ${engineerOutput}\n\nLIÇÕES APRENDIDAS DE ANÁLISES ANTERIORES:\n${lessonsLearned}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: { systemInstruction: AGENTS.REPORTER.instruction(preferences) }
    });
    return response.text;
  });
}

export async function runReviewer(reporterOutput: string, preferences: string = "", userFeedback?: string, lessonsLearned: string = "") {
  return withRetry(async () => {
    const contents = `Revise e formate o relatório final:\n${reporterOutput}${userFeedback ? `\n\nFEEDBACK DO USUÁRIO PARA AJUSTES: ${userFeedback}` : ""}\n\nLIÇÕES APRENDIDAS DE ANÁLISES ANTERIORES:\n${lessonsLearned}`;
      
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: { 
        systemInstruction: AGENTS.REVIEWER.instruction(preferences),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            html: { type: Type.STRING },
            markdown: { type: Type.STRING }
          },
          required: ["html", "markdown"]
        }
      }
    });
    
    try {
      const text = response.text.trim();
      // Remove potential markdown code blocks if the model included them despite responseMimeType
      const jsonStr = text.startsWith('```json') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse reviewer output as JSON", e);
      return {
        html: response.text,
        markdown: "Erro ao gerar versão Markdown."
      };
    }
  });
}

export async function runCritic(reviewerOutput: any) {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Avalie a qualidade deste relatório final:\nHTML: ${reviewerOutput.html}\nMarkdown: ${reviewerOutput.markdown}`,
      config: { 
        systemInstruction: AGENTS.CRITIC.instruction(),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            critique: { type: Type.STRING },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                analyst: { type: Type.STRING },
                engineer: { type: Type.STRING },
                reporter: { type: Type.STRING },
                reviewer: { type: Type.STRING }
              },
              required: ["analyst", "engineer", "reporter", "reviewer"]
            },
            isApproved: { type: Type.BOOLEAN }
          },
          required: ["score", "critique", "recommendations", "isApproved"]
        }
      }
    });

    try {
      const text = response.text.trim();
      const jsonStr = text.startsWith('```json') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse critic output as JSON", e);
      return {
        score: 5,
        critique: "Erro ao processar a crítica. Reavaliando por segurança.",
        recommendations: {
          analyst: "Aprofundar análise de dados.",
          engineer: "Melhorar embasamento normativo.",
          reporter: "Melhorar fluidez.",
          reviewer: "Revisar formatação."
        },
        isApproved: false
      };
    }
  });
}
