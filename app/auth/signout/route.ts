import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Signing out is a POST (from <SignOutButton>), so a link or prefetch can't sign anyone out.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 turns the POST into a GET of the login page.
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
