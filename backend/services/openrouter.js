const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const DEFAULT_MODEL = 'anthropic/claude-3-5-sonnet-20241022';

/**
 * Robust JSON parser that handles markdown fences and embedded JSON
 */
function parseAIJson(text) {
  if (!text) return null;
  // Try direct parse
  try { return JSON.parse(text); } catch(e) {}
  // Strip markdown code fences
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch(e) {}
  // Extract first JSON object
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) { try { return JSON.parse(text.slice(start, end + 1)); } catch(e) {} }
  // Extract first JSON array
  const aStart = text.indexOf('['); const aEnd = text.lastIndexOf(']');
  if (aStart !== -1 && aEnd !== -1) { try { return JSON.parse(text.slice(aStart, aEnd + 1)); } catch(e) {} }
  return null;
}

/**
 * Query OpenRouter API
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} options - { temperature, maxTokens, model }
 */
async function queryOpenRouter(systemPrompt, userMessage, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const model = options.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const temperature = options.temperature !== undefined ? options.temperature : 0.3;
  const maxTokens = options.maxTokens || 4000;

  const requestBody = JSON.stringify({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
  });

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
        'X-Title': 'AI 3D Printing Optimizer',
      }
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'OpenRouter API error'));
          } else {
            const content = parsed.choices?.[0]?.message?.content || 'No response generated';
            resolve({
              content,
              model: parsed.model,
              usage: parsed.usage,
            });
          }
        } catch (e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

module.exports = { queryOpenRouter, parseAIJson, DEFAULT_MODEL };
