import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_MODEL_NAME = 'gemini-4-hydrogen';
const FALLBACK_MODEL_NAME = 'gemini-3.1-flash-lite';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientGeminiError(err: unknown): boolean {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; code?: number })?.status ??
    (err as { status?: number; code?: number })?.code;
  return (
    status === 503 ||
    status === 429 ||
    rawMessage.includes('"code":503') ||
    rawMessage.includes('UNAVAILABLE') ||
    rawMessage.includes('high demand') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.includes('429')
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 1
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isTransientGeminiError(err)) {
        const baseDelay = 600 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(baseDelay + jitter);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('PRIMARY_TIMEOUT'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function generateWithFallback<T>(
  runForModel: (modelName: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  try {
    const result = await withTimeout(runForModel(PRIMARY_MODEL_NAME), 7000);
    return { result, modelUsed: PRIMARY_MODEL_NAME };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'PRIMARY_TIMEOUT' || isTransientGeminiError(err)) {
      const result = await generateWithRetry(() => runForModel(FALLBACK_MODEL_NAME), 1);
      return { result, modelUsed: FALLBACK_MODEL_NAME };
    }
    throw err;
  }
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('403')
  ) {
    return {
      status: 403,
      message:
        'Gemini API key is missing or unauthorized. Please check your key in Settings > Secrets.',
    };
  }
  if (
    rawMessage.includes('"code":503') ||
    rawMessage.includes('UNAVAILABLE') ||
    rawMessage.includes('high demand')
  ) {
    return {
      status: 503,
      message:
        'The Gemini model is temporarily experiencing high demand. Automatic retries failed—please click Retry in a moment.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      status: 429,
      message:
        'Gemini API rate limit or quota reached. Please wait a moment and try again.',
    };
  }
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 500,
      message: 'GEMINI_API_KEY is not set. Please configure it in Settings > Secrets.',
    };
  }

  // Unwrap JSON-formatted SDK error strings so raw JSON is not shown to users
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return {
        status: 500,
        message: parsed.error.message,
      };
    }
  } catch {
    // Not a JSON error string
  }

  return {
    status: 500,
    message: rawMessage || 'Unexpected error communicating with Gemini API.',
  };
}

interface SubtextAnalysisPayload {
  detected_tone: string;
  aggression_score: number;
  core_goal: string;
  trigger_phrases: string[];
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Step 1/2: Hidden Analysis Call (Communication Psychologist)
  app.post('/api/chain/analyze', async (req: Request, res: Response) => {
    try {
      const { draft, relationship } = req.body as { draft?: string; relationship?: string };

      if (!draft || typeof draft !== 'string' || !draft.trim()) {
        res.status(400).json({ error: 'Please enter a draft message before analysing.' });
        return;
      }

      const safeRelationship =
        typeof relationship === 'string' && relationship.trim() ? relationship.trim() : 'Coworker';
      const trimmedDraft = draft.trim();

      const systemInstruction = [
        'You are an expert communication psychologist and interpersonal conflict analyst.',
        'Analyze the emotional subtext, interpersonal friction, and unspoken constructive objective behind the user\'s unfiltered draft message, taking into account the specific recipient relationship.',
        'Return ONLY valid JSON matching the schema:',
        '- detected_tone: strictly 2 to 3 words capturing the emotional tone (e.g., "Passive-Aggressive Frustration", "Defensive & Impatient", "Anxious Urgency").',
        '- aggression_score: an integer from 1 (calm, collaborative) to 10 (hostile, accusatory, bridge-burning).',
        '- core_goal: a single clear sentence describing what the sender actually wants to achieve constructively.',
        '- trigger_phrases: an array of exact short words or phrases lifted verbatim from the draft that sound harsh, accusatory, sarcastic, or unclear.',
      ].join(' ');

      const userPrompt = [
        `Recipient Relationship: ${safeRelationship}`,
        '',
        'Original Unfiltered Draft:',
        `"""\n${trimmedDraft}\n"""`,
      ].join('\n');

      const ai = getGeminiClient();
      const { result: response, modelUsed } = await generateWithFallback((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            ...(modelName === PRIMARY_MODEL_NAME
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detected_tone: {
                  type: Type.STRING,
                  description: '2-3 word label describing the detected emotional tone.',
                },
                aggression_score: {
                  type: Type.INTEGER,
                  description: 'Integer score from 1 (calm) to 10 (hostile).',
                },
                core_goal: {
                  type: Type.STRING,
                  description: 'One sentence describing what the sender actually wants.',
                },
                trigger_phrases: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Exact words or phrases from the draft that sound harsh or unclear.',
                },
              },
              required: ['detected_tone', 'aggression_score', 'core_goal', 'trigger_phrases'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as SubtextAnalysisPayload;

      const normalizedAnalysis: SubtextAnalysisPayload = {
        detected_tone: String(parsed.detected_tone || 'Guarded & Tense').trim(),
        aggression_score: Math.min(10, Math.max(1, Math.round(Number(parsed.aggression_score) || 5))),
        core_goal: String(parsed.core_goal || '').trim(),
        trigger_phrases: Array.isArray(parsed.trigger_phrases)
          ? parsed.trigger_phrases.map((p) => String(p).trim()).filter(Boolean)
          : [],
      };

      const formattedRawJson = JSON.stringify(normalizedAnalysis, null, 2);

      res.json({
        analysis: normalizedAnalysis,
        rawJsonOutput: formattedRawJson,
        step1Meta: {
          model: modelUsed,
          systemInstruction,
          userPrompt,
        },
      });
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      res.status(status).json({ error: message });
    }
  });

  // Step 2/2: Tailored Rewrite Generation Call (Uses Original Draft + Step 1 JSON Insights)
  app.post('/api/chain/rewrite', async (req: Request, res: Response) => {
    try {
      const { draft, relationship, analysis } = req.body as {
        draft?: string;
        relationship?: string;
        analysis?: SubtextAnalysisPayload;
      };

      if (!draft || typeof draft !== 'string' || !draft.trim()) {
        res.status(400).json({ error: 'Original draft is required for Step 2.' });
        return;
      }

      if (!analysis || !analysis.core_goal) {
        res.status(400).json({ error: 'Step 1 analysis insights are required for Step 2.' });
        return;
      }

      const safeRelationship =
        typeof relationship === 'string' && relationship.trim() ? relationship.trim() : 'Coworker';
      const trimmedDraft = draft.trim();
      const step1JsonString = JSON.stringify(analysis, null, 2);

      const systemInstruction = [
        'You are an executive communication coach.',
        'You will receive an original unfiltered draft, the recipient relationship, and a structured psychological diagnosis JSON from Step 1.',
        'Your task is to write three distinct, ready-to-send rewrites that achieve the sender\'s core_goal for the given recipient relationship while strictly avoiding ALL trigger_phrases identified in Step 1.',
        'The three styles must be in this exact order:',
        '1. "Diplomatic & Warm" — empathetic, relationship-preserving, collaborative.',
        '2. "Firm & Professional" — clear boundaries, poised accountability, zero hostility.',
        '3. "Direct & Concise" — brief, respectful, action-oriented, easy to scan.',
        'For each rewrite, also provide a brief 1-2 sentence explanation (why_it_works) noting how specific phrasing shifts address the Step 1 subtext.',
      ].join(' ');

      const userPrompt = [
        `Recipient Relationship: ${safeRelationship}`,
        '',
        'Original Draft:',
        `"""\n${trimmedDraft}\n"""`,
        '',
        'Step 1 Subtext Diagnosis (JSON):',
        step1JsonString,
        '',
        'Instructions:',
        `1. Achieve this core goal: "${analysis.core_goal}"`,
        `2. Do NOT use any of these trigger phrases (or close hostile variants): ${
          analysis.trigger_phrases.length > 0
            ? analysis.trigger_phrases.map((p) => `"${p}"`).join(', ')
            : 'None flagged'
        }`,
        '3. Generate exactly three rewrites: "Diplomatic & Warm", "Firm & Professional", and "Direct & Concise".',
      ].join('\n');

      const ai = getGeminiClient();
      const { result: response, modelUsed } = await generateWithFallback((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            ...(modelName === PRIMARY_MODEL_NAME
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                rewrites: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      style: {
                        type: Type.STRING,
                        description:
                          'Must be one of: "Diplomatic & Warm", "Firm & Professional", or "Direct & Concise".',
                      },
                      message: {
                        type: Type.STRING,
                        description: 'The complete ready-to-send rewritten message.',
                      },
                      why_it_works: {
                        type: Type.STRING,
                        description: 'Brief 1-2 sentence note explaining why the phrasing changes work.',
                      },
                    },
                    required: ['style', 'message', 'why_it_works'],
                  },
                },
              },
              required: ['rewrites'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        rewrites?: Array<{ style?: string; message?: string; why_it_works?: string }>;
      };

      const expectedStyles = [
        'Diplomatic & Warm',
        'Firm & Professional',
        'Direct & Concise',
      ] as const;

      const rawRewrites = Array.isArray(parsed.rewrites) ? parsed.rewrites : [];
      const normalizedRewrites = expectedStyles.map((expectedStyle, index) => {
        const match =
          rawRewrites.find((r) => r.style?.toLowerCase() === expectedStyle.toLowerCase()) ||
          rawRewrites[index];
        return {
          style: expectedStyle,
          message: String(match?.message || '').trim(),
          why_it_works: String(match?.why_it_works || '').trim(),
        };
      });

      res.json({
        rewrites: normalizedRewrites,
        exactPromptSent: {
          model: modelUsed,
          systemInstruction,
          userPrompt,
        },
      });
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      res.status(status).json({ error: message });
    }
  });

  // Ensure unmatched /api/* routes always return JSON rather than SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global JSON error handler for Express routes (e.g. malformed JSON body)
  app.use((err: unknown, req: Request, res: Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      const { status, message } = extractErrorDetails(err);
      res.status(status).json({ error: message });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const isPreviewCloudEnv =
      process.env.DISABLE_HMR === 'true' ||
      Boolean(process.env.K_SERVICE || process.env.APP_URL);

    // When viewed through a remote Cloud Run / AI Studio preview proxy where HMR
    // WebSockets are disabled, serve a lightweight spec-compatible Vite client
    // shim without WebSocket connections so CSS/modules load with zero console errors.
    app.get('/@vite/client', (req: Request, res: Response, next: express.NextFunction) => {
      const hostHeader = (req.headers.host || '').split(':')[0].toLowerCase();
      const isLocalhost = hostHeader === 'localhost' || hostHeader === '127.0.0.1';

      if (!isPreviewCloudEnv && isLocalhost) {
        next();
        return;
      }

      res.type('application/javascript; charset=utf-8').send(`
const sheetsMap = new Map();

export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}

export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}

export class ErrorOverlay {}
`);
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isPreviewCloudEnv
          ? false
          : {
              server: httpServer,
              port: PORT,
            },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ToneCraft server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
