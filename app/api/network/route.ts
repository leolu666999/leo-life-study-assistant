import { NextResponse } from "next/server";
import type { NetworkInterfaceInfo } from "node:os";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.DATA_BACKEND === "supabase") {
    return NextResponse.json({ port: "", ip: "", url: new URL(request.url).origin }, {
      headers: { "cache-control": "private, no-store" }
    });
  }
  const [{ default: os }, { defaultPort }] = await Promise.all([import("node:os"), import("@/lib/app-config")]);
  const interfaces = os.networkInterfaces();
  const addresses = Object.values(interfaces)
    .flat()
    .filter((address): address is NetworkInterfaceInfo => Boolean(address))
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address);

  const preferredIp =
    addresses.find((address) => address.startsWith("192.168.")) ??
    addresses.find((address) => address.startsWith("10.")) ??
    addresses.find((address) => address.startsWith("172.")) ??
    addresses[0] ??
    "";

  return NextResponse.json({
    port: defaultPort,
    ip: preferredIp,
    url: preferredIp ? `http://${preferredIp}:${defaultPort}` : ""
  });
}
