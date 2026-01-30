import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/utils/supabase/middleware";

// Define protected and auth paths
const protectedPaths = ["/admin", "/kurir"];
const authPaths = ["/login", "/register"];

// Helper to logout and redirect to login with error
function logoutAndRedirect(request: NextRequest, errorMessage: string) {
  const loginUrl = new URL("/login", request.url);

  loginUrl.searchParams.set("error", errorMessage);

  const response = NextResponse.redirect(loginUrl);

  // Clear all Supabase auth cookies
  response.cookies.set("sb-access-token", "", { maxAge: 0, path: "/" });
  response.cookies.set("sb-refresh-token", "", { maxAge: 0, path: "/" });

  // Clear all cookies that start with 'sb-' (Supabase session cookies)
  const allCookies = request.cookies.getAll();

  allCookies.forEach((cookie) => {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

  // Get user session
  const { supabase, user, supabaseResponse } = await updateSession(request);

  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path),
  );
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  // Case 1: Unauthenticated User accessing Protected Paths
  if (!user && isProtectedPath) {
    const redirectUrl = new URL("/login", request.url);

    redirectUrl.searchParams.set("redirectTo", pathname);

    return NextResponse.redirect(redirectUrl);
  }

  // Case 2 & 3: Authenticated User
  if (user) {
    // Get user role from auth_users table
    const { data: userData, error } = await supabase
      .from("auth_users")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = userData?.role || null;

    // Case 2: Authenticated User accessing Auth Paths (Login/Register)
    if (isAuthPath) {
      // Redirect to their respective dashboard based on role
      if (userRole === "super-admin" || userRole === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      } else if (userRole === "kurir") {
        return NextResponse.redirect(new URL("/kurir", request.url));
      } else {
        // Default redirect if role unknown
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // Case 3: Role Authorization for Protected Routes
    if (isProtectedPath) {
      // Protect /admin/users - only super-admin can access
      if (pathname.startsWith("/admin/users") && userRole !== "super-admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }

      // Check if accessing /admin/* but not admin or super-admin
      if (
        pathname.startsWith("/admin") &&
        userRole !== "admin" &&
        userRole !== "super-admin"
      ) {
        // Redirect kurir to their dashboard, others to unauthorized
        if (userRole === "kurir") {
          return NextResponse.redirect(new URL("/kurir", request.url));
        }

        return logoutAndRedirect(request, "access_denied");
      }

      // Check if accessing /kurir/* but not kurir
      if (pathname.startsWith("/kurir") && userRole !== "kurir") {
        // Redirect admin/super-admin to their dashboard, others to unauthorized
        if (userRole === "admin" || userRole === "super-admin") {
          return NextResponse.redirect(new URL("/admin", request.url));
        }

        return logoutAndRedirect(request, "access_denied");
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
