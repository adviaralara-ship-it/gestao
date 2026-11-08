// api/_middleware/rateLimit.js
// Rate Limiter em memória por janela deslizante para Serverless Functions (Vercel)

const ipRateMap = new Map();

// Limpeza periódica de entradas expiradas a cada 5 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of ipRateMap.entries()) {
    if (now > record.resetTime) {
      ipRateMap.delete(key);
    }
  }
}

/**
 * Extrai o IP real do cliente considerando proxies e Cloudflare
 */
export function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',');
    return ips[0].trim();
  }
  return req.headers['x-real-ip'] || 
         req.headers['cf-connecting-ip'] || 
         req.socket?.remoteAddress || 
         '127.0.0.1';
}

/**
 * Middleware de Rate Limiting
 * 
 * @param {object} req - Objeto de requisição
 * @param {object} res - Objeto de resposta
 * @param {object} [options] - Opções de configuração
 * @param {number} [options.limit=30] - Quantidade máxima de requisições por janela
 * @param {number} [options.windowMs=60000] - Duração da janela em ms (padrão: 1 minuto)
 * @param {string} [options.prefix=''] - Prefixo para diferenciar rotas (ex: 'auth', 'whatsapp')
 * @returns {boolean} true se a requisição foi bloqueada (429 enviado), false se liberada
 */
export function applyRateLimit(req, res, options = {}) {
  cleanupExpiredEntries();

  const limit = options.limit || 30;
  const windowMs = options.windowMs || 60 * 1000;
  const prefix = options.prefix || 'global';

  const clientIp = getClientIp(req);
  const key = `${prefix}:${clientIp}`;
  const now = Date.now();

  let record = ipRateMap.get(key);

  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs
    };
    ipRateMap.set(key, record);
  } else {
    record.count += 1;
  }

  const remaining = Math.max(0, limit - record.count);
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

  // Cabeçalhos padrão de Rate Limit
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (record.count > limit) {
    res.setHeader('Retry-After', resetSeconds);
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Limite de tentativas excedido. Por favor, aguarde ${resetSeconds} segundo(s) antes de tentar novamente.`,
      retryAfterSeconds: resetSeconds
    });
    return true; // Bloqueado
  }

  return false; // Permitido
}

export default applyRateLimit;
