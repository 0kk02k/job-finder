import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const token =
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('__Secure-authjs.session-token')

  const { pathname } = request.nextUrl

  // Redirect to login for page requests without a session
  // API routes handle their own auth (return 401 JSON)
  if (!pathname.startsWith('/api/') && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|login|register|_next|favicon.ico).*)'],
}
