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

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { error: 'Muitas requisições. Tente novamente em 1 hora.' }
});
app.use('/api/', limiter);

// ── STREAMING endpoint ─────────────────────────────────────
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

  // SSE headers para streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullText = '';

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const token = chunk.delta.text;
        fullText += token;

        // Não transmite tokens do bloco SCORE_DATA
        if (!fullText.includes('<!--SCORE_DATA')) {
          res.write(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`);
        }
      }
    }

    // Parse score
    const scoreMatch = fullText.match(/<!--SCORE_DATA\s*([\s\S]*?)-->/);
    let scoreData = null;
    if (scoreMatch) {
      try { scoreData = JSON.parse(scoreMatch[1].trim()); }
      catch (e) { console.error('Score parse error:', e); }
    }

    const visibleText = fullText.replace(/<!--SCORE_DATA[\s\S]*?-->/, '').trim();

    // Envia evento final com score
    res.write(`data: ${JSON.stringify({ type: 'done', fullText: visibleText, scoreData })}\n\n`);

    // Webhook
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
            conversa_resumo: messages.filter(m => m.role === 'user').map(m => m.content).join(' | ').slice(0, 500)
          })
        });
      } catch (e) { console.error('Webhook error:', e.message); }
    }

  } catch (err) {
    console.error('Claude API error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Erro ao conectar com a IA.' })}\n\n`);
  }

  res.end();
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Letíc[IA] · daCosta[IA] rodando em http://localhost:${PORT}\n`);
});
