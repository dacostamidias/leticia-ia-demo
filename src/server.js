import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './prompt.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// ── Rate limiting ──────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 60,
  message: { error: 'Muitas requisições. Tente novamente em 1 hora.' }
});
app.use('/api/', limiter);

// ── Chat endpoint ──────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, agentName, companyName, sector } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array obrigatório' });
  }

  const systemPrompt = buildSystemPrompt(
    agentName   || 'Letícia',
    companyName || 'nossa empresa',
    sector      || 'geral'
  );

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    const rawText = response.content[0]?.text || '';

    // Parse hidden score data
    const scoreMatch = rawText.match(/<!--SCORE_DATA\s*([\s\S]*?)-->/);
    let scoreData = null;
    if (scoreMatch) {
      try { scoreData = JSON.parse(scoreMatch[1].trim()); }
      catch (e) { console.error('Score parse error:', e); }
    }

    const visibleText = rawText.replace(/<!--SCORE_DATA[\s\S]*?-->/, '').trim();

    // ── Webhook de saída ───────────────────────────────────
    // Se um WEBHOOK_URL estiver configurado no .env e o score foi gerado,
    // dispara o briefing para Make, n8n, Zapier, etc.
    if (scoreData && process.env.WEBHOOK_URL) {
      try {
        await fetch(process.env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            agente: agentName || 'Letícia',
            empresa: companyName || 'daCosta[IA]',
            setor: sector || 'geral',
            score: scoreData.score,
            routing: scoreData.routing,
            dimensoes: scoreData.dimensions,
            briefing: scoreData.briefing,
            conversa_resumo: messages
              .filter(m => m.role === 'user')
              .map(m => m.content)
              .join(' | ')
              .slice(0, 500)
          })
        });
      } catch (webhookErr) {
        // Webhook falha silenciosamente — não interrompe a resposta ao usuário
        console.error('Webhook error:', webhookErr.message);
      }
    }

    res.json({ message: visibleText, scoreData });

  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: 'Erro ao conectar com a IA. Tente novamente.' });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Letíc[IA] · daCosta[IA] rodando em http://localhost:${PORT}\n`);
  console.log(`  Webhook: ${process.env.WEBHOOK_URL || 'não configurado (opcional)'}\n`);
});
