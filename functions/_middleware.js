/**
 * Cloudflare Pages Middleware
 * Handles SPA routing for wedding and haflah invitations
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Let static files pass through
  if (
    path.startsWith('/js/') ||
    path.startsWith('/css/') ||
    path.includes('.') ||  // has file extension
    path === '/'
  ) {
    return next();
  }

  // /admin or /admin/ → serve admin.html
  if (path === '/admin' || path === '/admin/') {
    return env.ASSETS.fetch(new URL('/admin.html', request.url));
  }

  // /haflah/:slug → serve haflah.html
  if (path.startsWith('/haflah/') || path === '/haflah') {
    return env.ASSETS.fetch(new URL('/haflah.html', request.url));
  }

  // /:slug (anything else) → serve index.html (wedding invitation)
  return env.ASSETS.fetch(new URL('/index.html', request.url));
}
