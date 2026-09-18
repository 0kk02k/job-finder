import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Öffentliche Seiten — ohne Session erreichbar (Footer-Grundsatz: Rechtsseiten
// kennen keine Anmeldung). Authentifizierte Nutzer sehen sie mit voller Nav.
const PUBLIC_PAGES = ['/so-funktionierts', '/impressum', '/datenschutz']
// Auth-Seiten — ohne Session erreichbar, MIT Session dorthin unnötig:
// eingeloggte Nutzer landen auf dem Dashboard statt vor verschlossener Tür.
const AUTH_PAGES = ['/login', '/register']

export function proxy(request: NextRequest) {
  const token =
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('__Secure-authjs.session-token')

  const { pathname } = request.nextUrl

  // API routes handle their own auth (return 401 JSON)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (token && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!token && !PUBLIC_PAGES.includes(pathname) && !AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // login/register laufen jetzt durch den Proxy (Umleitung eingeloggter
  // Nutzer) — alles andere wie gehabt
  matcher: ['/((?!api/auth|_next|favicon.ico).*)'],
}
