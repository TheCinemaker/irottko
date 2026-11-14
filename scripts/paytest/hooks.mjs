const MOCK = new URL('./mock-barion.mjs', import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === './barion.js' && ctx.parentURL?.endsWith('/lib/fulfill.js')) return { url: MOCK, shortCircuit: true };
  return next(spec, ctx);
}
