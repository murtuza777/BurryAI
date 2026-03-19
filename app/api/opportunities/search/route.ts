import { NextRequest } from "next/server"
import { proxyToWorker } from "@/lib/worker-api-proxy"

const TARGET = "opportunities/search"

export async function POST(request: NextRequest) {
  return proxyToWorker(request, TARGET)
}
