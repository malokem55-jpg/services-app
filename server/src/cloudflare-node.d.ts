// Ambient types for the Workers-only "cloudflare:node" module so that tsc and
// the editor understand the import. The real implementation is provided by the
// Cloudflare Workers runtime (enabled via the nodejs_compat flag).
declare module 'cloudflare:node' {
  export function httpServerHandler(options: { port: number }): {
    fetch: (request: Request) => Promise<Response>;
  };
}
