import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

const publicExactPaths = new Set([
  "/",
  "/login",
  "/set-password",
  "/auth/callback",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublicPath(pathname: string) {
  if (publicExactPaths.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

function requiresAuth(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/recipes") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/import") ||
    pathname.startsWith("/trash") ||
    pathname.startsWith("/api/admin/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  if (!hasSupabaseEnv()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Missing Supabase environment variables." }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/login?error=env_missing", request.url));
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nextParam = encodeURIComponent(`${pathname}${search || ""}`);
  return NextResponse.redirect(new URL(`/login?next=${nextParam}`, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
