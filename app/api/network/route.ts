import os from "node:os";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const port = 3011;

export async function GET() {
  const interfaces = os.networkInterfaces();
  const addresses = Object.values(interfaces)
    .flat()
    .filter((address): address is os.NetworkInterfaceInfo => Boolean(address))
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address);

  const preferredIp =
    addresses.find((address) => address.startsWith("192.168.")) ??
    addresses.find((address) => address.startsWith("10.")) ??
    addresses.find((address) => address.startsWith("172.")) ??
    addresses[0] ??
    "";

  return NextResponse.json({
    port,
    ip: preferredIp,
    url: preferredIp ? `http://${preferredIp}:${port}` : ""
  });
}
