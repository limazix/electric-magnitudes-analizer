import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { google } from "googleapis";
import { marked } from "marked";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import axios from "axios";
import * as cheerio from "cheerio";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// Load Firebase Config
let adminDb: admin.firestore.Firestore;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

  // Initialize Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  adminDb = admin.firestore(firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Daily Update Task: Scrape ANEEL for new regulations
async function syncANEELRegulations() {
  if (!adminDb) {
    console.warn("Skipping ANEEL sync: Firebase Admin not initialized.");
    return;
  }
  console.log("Starting ANEEL sync task...");
  try {
    const url = "https://www.aneel.gov.br/noticias"; 
    const response = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const $ = cheerio.load(response.data);
    const newsItems: { title: string; link: string; date: string }[] = [];
    
    // Updated selectors for ANEEL news
    $(".noticia-item, .news-item, .view-content .item-list li").each((i, el) => {
      const title = $(el).find("h3, .titulo, a").first().text().trim();
      const link = $(el).find("a").first().attr("href");
      const date = $(el).find(".data, .date, .submitted").text().trim();
      
      if (title && link && title.length > 10) {
        newsItems.push({ 
          title, 
          link: link.startsWith("http") ? link : `https://www.aneel.gov.br${link}`,
          date 
        });
      }
    });

    console.log(`Found ${newsItems.length} potential updates.`);
    
    for (const item of newsItems.slice(0, 5)) { // Limit to top 5 for demo
      const docId = Buffer.from(item.link).toString('base64').replace(/[/+=]/g, '');
      const docRef = adminDb.collection('pending_regulations').doc(docId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.log(`Adding new pending regulation: ${item.title}`);
        await docRef.set({
          title: item.title,
          link: item.link,
          date: item.date,
          content: `Resumo da notícia: ${item.title}. Acesse para mais detalhes: ${item.link}`, // Placeholder content
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // Update last sync status
    await adminDb.collection('system').doc('status').set({
      lastSync: admin.firestore.FieldValue.serverTimestamp(),
      status: 'success'
    }, { merge: true });
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Error syncing ANEEL regulations: ${error.message}`);
      if (error.response?.status === 403) {
        console.warn("ANEEL blocked the request (403). This is likely Cloudflare protection.");
      }
    } else {
      console.error("Error syncing ANEEL regulations:", error);
    }

    // Update last sync status with error
    await adminDb.collection('system').doc('status').set({
      lastSyncAttempt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error)
    }, { merge: true });
  }
}

// Schedule: Every day at 00:00
cron.schedule("0 0 * * *", () => {
  if (adminDb) syncANEELRegulations();
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/api/auth/google/callback`
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth URL
  app.get("/api/auth/google/url", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: "Google OAuth não configurado. Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos segredos do AI Studio." 
      });
    }
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      prompt: "consent"
    });
    res.json({ url });
  });

  // Google OAuth Callback
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      res.cookie("google_tokens", JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticação concluída. Esta janela fechará automaticamente.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google Auth Error:", error);
      res.status(500).send("Erro na autenticação com o Google.");
    }
  });

  // Export to Google Drive
  app.post("/api/export/google-doc", async (req, res) => {
    const { html, markdown, title, chartData } = req.body;
    const tokensStr = req.cookies.google_tokens;

    if (!tokensStr) {
      return res.status(401).json({ error: "Não autenticado com o Google" });
    }

    try {
      const tokens = JSON.parse(tokensStr);
      oauth2Client.setCredentials(tokens);

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      
      // Use HTML as the primary source since it's what the user sees and approves
      // but we'll apply the same image replacements logic
      let exportContent = html || "";

      if (!exportContent && markdown) {
        // Fallback to markdown if HTML is missing
        exportContent = await marked.parse(markdown);
      }

      // 1. Replace Mermaid code blocks in HTML with images
      exportContent = exportContent.replace(/```mermaid\s*([\s\S]*?)\s*```/g, (match, code) => {
        try {
          const encoded = Buffer.from(code.trim()).toString('base64');
          const imageUrl = `https://mermaid.ink/img/${encoded}`;
          return `
            <div style="margin: 20px 0; text-align: center;">
              <img src="${imageUrl}" alt="Diagrama Mermaid" style="width: 600px; height: auto; max-width: 100%;" />
              <p style="font-size: 10px; color: #9ca3af; margin-top: 5px; font-style: italic;">Diagrama gerado automaticamente</p>
            </div>
          `;
        } catch (e) {
          return match;
        }
      });

      // Also handle Mermaid diagrams inside divs (as specified in REVIEWER instruction)
      exportContent = exportContent.replace(/<div class="mermaid-diagram">([\s\S]*?)<\/div>/g, (match, code) => {
        try {
          const encoded = Buffer.from(code.trim()).toString('base64');
          const imageUrl = `https://mermaid.ink/img/${encoded}`;
          return `
            <div style="margin: 20px 0; text-align: center;">
              <img src="${imageUrl}" alt="Diagrama Mermaid" style="width: 600px; height: auto; max-width: 100%;" />
              <p style="font-size: 10px; color: #9ca3af; margin-top: 5px; font-style: italic;">Diagrama gerado automaticamente</p>
            </div>
          `;
        } catch (e) {
          return match;
        }
      });

      // 2. Replace chart placeholders with QuickChart images if data is available
      if (chartData) {
        const downsample = (data: any[], maxPoints: number = 100) => {
          if (!data || data.length <= maxPoints) return data;
          const step = Math.ceil(data.length / maxPoints);
          const result = [];
          for (let i = 0; i < data.length; i += step) {
            result.push(data[i]);
          }
          return result;
        };

        const generateQuickChartUrl = (config: any) => {
          const configStr = JSON.stringify(config);
          // QuickChart has a limit on URL length. If it's too long, it might fail.
          return `https://quickchart.io/chart?c=${encodeURIComponent(configStr)}&w=600&h=300`;
        };

        const chartConfigs = [
          { id: 'freq-amplitude-chart', key: 'freqAmplitude', title: 'Amplitude de Frequência (Hz)', type: 'line', yLabel: 'Hz' },
          { id: 'volt-fn-chart', key: 'voltFN', title: 'Tensão Fase-Neutro (V)', type: 'line', yLabel: 'V', multi: ['va', 'vb', 'vc'] },
          { id: 'volt-ff-chart', key: 'voltFF', title: 'Tensão Fase-Fase (V)', type: 'line', yLabel: 'V', multi: ['vab', 'vbc', 'vca'] },
          { id: 'unbalance-chart', key: 'unbalanceData', title: 'Desequilíbrio de Tensão (%)', type: 'line', yLabel: '%', multi: ['drc', 'drp'] },
          { id: 'fluctuation-chart', key: 'fluctuationData', title: 'Flutuação de Tensão', type: 'line', yLabel: 'Pst/Plt', multi: ['pst', 'plt'] },
          { id: 'curr-rms-chart', key: 'currRMS', title: 'Corrente RMS (A)', type: 'line', yLabel: 'A', multi: ['ia', 'ib', 'ic', 'in'] },
          { id: 'curr-peak-chart', key: 'currPeak', title: 'Corrente de Pico (A)', type: 'line', yLabel: 'A', xKey: 'time', yKey: 'peak' },
          { id: 'volt-harmonics-chart', key: 'voltHarmonics', title: 'Harmônicos de Tensão', type: 'bar', xLabel: 'Ordem', yLabel: '%', xKey: 'order', yKey: 'value' },
          { id: 'curr-harmonics-chart', key: 'currHarmonics', title: 'Harmônicos de Corrente', type: 'bar', xLabel: 'Ordem', yLabel: '%', xKey: 'order', yKey: 'value' },
          { id: 'power-comparison-chart', key: 'powerComparison', title: 'Comparativo de Potências', type: 'line', yLabel: 'kW/kVAR/kVA', multi: ['active', 'reactive', 'apparent'] },
          { id: 'pf-chart', key: 'pfData', title: 'Fator de Potência', type: 'line', yLabel: 'FP', xKey: 'time', yKey: 'pf' },
          { id: 'consumption-chart', key: 'consumptionData', title: 'Consumo de Energia (kWh)', type: 'bar', yLabel: 'kWh', xKey: 'time', yKey: 'kwh' },
          { id: 'itic-chart', key: 'iticData', title: 'Curva ITIC', type: 'scatter', xLabel: 'Duração (s)', yLabel: 'Tensão (%)', xKey: 'duration', yKey: 'voltage' }
        ];

        for (const config of chartConfigs) {
          let data = chartData[config.key];
          if (data && data.length > 0) {
            // Downsample to keep URL length manageable for Google Docs converter
            data = downsample(data, 100);

            let qcConfig: any = {
              type: config.type,
              data: {
                datasets: []
              },
              options: {
                title: { display: true, text: config.title },
                scales: {
                  xAxes: [{ scaleLabel: { display: !!config.xLabel, labelString: config.xLabel || '' } }],
                  yAxes: [{ scaleLabel: { display: !!config.yLabel, labelString: config.yLabel || '' } }]
                }
              }
            };

            if (config.type === 'line' || config.type === 'bar') {
              qcConfig.data.labels = data.map((d: any) => d.time || d.name || d[config.xKey || ''] || '');
              
              if (config.multi) {
                const colors = ['rgb(54, 162, 235)', 'rgb(255, 99, 132)', 'rgb(75, 192, 192)', 'rgb(255, 159, 64)', 'rgb(153, 102, 255)'];
                config.multi.forEach((key, i) => {
                  qcConfig.data.datasets.push({
                    label: key.toUpperCase(),
                    data: data.map((d: any) => d[key]),
                    borderColor: colors[i % colors.length],
                    backgroundColor: colors[i % colors.length],
                    fill: false
                  });
                });
              } else {
                qcConfig.data.datasets.push({
                  label: config.yLabel || config.title,
                  data: data.map((d: any) => d.value || d[config.yKey || 'value']),
                  borderColor: 'rgb(54, 162, 235)',
                  backgroundColor: 'rgba(54, 162, 235, 0.2)',
                  fill: config.type === 'line'
                });
              }
            } else if (config.type === 'scatter') {
              qcConfig.data.datasets.push({
                label: config.title,
                data: data.map((d: any) => ({ x: d[config.xKey || 'x'], y: d[config.yKey || 'y'] })),
                backgroundColor: 'rgba(75, 192, 192, 0.5)'
              });
            }

            const url = generateQuickChartUrl(qcConfig);
            const imgTag = `<div style="text-align:center; margin: 20px 0;"><img src="${url}" width="600" /><p style="font-size:10px; color:#666;">${config.title}</p></div>`;
            
            // Replace HTML-style placeholders
            const placeholderRegex = new RegExp(`<div id="${config.id}"[^>]*><\/div>`, 'g');
            exportContent = exportContent.replace(placeholderRegex, imgTag);
            
            // Also replace any {{CHART_ID}} style placeholders
            const mdPlaceholder = new RegExp(`{{${config.id.toUpperCase().replace(/-/g, '_')}}}`, 'g');
            exportContent = exportContent.replace(mdPlaceholder, imgTag);
          }
        }
      }

      // 3. Replace any remaining placeholders
      exportContent = exportContent.replace(/{{METHODOLOGY_DIAGRAM}}/g, '');
      exportContent = exportContent.replace(/{{IMPACT_DIAGRAM}}/g, '');

      // 4. Add basic styling for the conversion
      exportContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
              h2 { color: #2c5282; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
              h3 { color: #2b6cb0; }
              p { margin-bottom: 15px; text-align: justify; }
              ul, ol { margin-bottom: 15px; }
              li { margin-bottom: 5px; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
              th { background-color: #f7fafc; color: #2d3748; }
              .report-cover { text-align: center; margin-bottom: 50px; padding: 40px; background-color: #f8fafc; border: 1px solid #e2e8f0; }
              .report-section { margin-bottom: 40px; }
            </style>
          </head>
          <body>
            ${exportContent}
          </body>
        </html>
      `;

      const response = await drive.files.create({
        requestBody: {
          name: title || "Relatório de Qualidade de Energia",
          mimeType: "application/vnd.google-apps.document"
        },
        media: {
          mimeType: "text/html",
          body: exportContent
        }
      });

      res.json({ 
        success: true, 
        fileId: response.data.id,
        webViewLink: `https://docs.google.com/document/d/${response.data.id}/edit`
      });
    } catch (error: any) {
      console.error("Google Drive Export Error Details:", {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        errors: error.response?.data?.error?.errors || error.errors,
        data: error.response?.data
      });
      
      const errorMessage = error.response?.data?.error?.message || error.message || "Erro desconhecido";
      res.status(500).json({ 
        error: "Erro ao exportar para o Google Drive.", 
        details: errorMessage 
      });
    }
  });
  // Agent Orchestration Endpoint
  app.post("/api/analyze", async (req, res) => {
    const { data, analysisId, userId } = req.body;
    // In a real app, we'd start a background job or use a queue.
    // For this demo, we'll simulate the agent chain.
    res.json({ message: "Analysis started", analysisId });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Run sync once on startup after server is listening
    if (adminDb) {
      syncANEELRegulations().catch(err => console.error("Initial sync failed:", err));
    }
  });
}

startServer();
