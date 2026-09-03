let downUntil = 0;

export function shouldTryGemini() {
  return Date.now() >= downUntil;
}

export function reportGeminiSuccess() {
  downUntil = 0;
}

export function reportGeminiFailure(error: unknown) {
  const msg = String(error instanceof Error ? error.message : error);
  const quota = /429|RESOURCE_EXHAUSTED|quota|rate|too many/i.test(msg);
  downUntil = Date.now() + (quota ? 120_000 : 20_000);
}
