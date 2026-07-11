import "server-only";
import { NextResponse } from "next/server";
import {
  AdminConfigurationError,
  AdminForbiddenError,
  AuthenticationRequiredError
} from "@/lib/auth/admin";

export function adminRouteError(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof AdminForbiddenError) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (error instanceof AdminConfigurationError) {
    return NextResponse.json({ error: "Admin access is not configured" }, { status: 500 });
  }
  console.error("Admin API error", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "Admin request failed" }, { status: 500 });
}
