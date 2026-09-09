import { NextRequest } from "next/server"
import { proxyToWorker } from "@/lib/worker-api-proxy"

const TARGET = "resume/parse"

export async function POST(request: NextRequest) {
  return proxyToWorker(request, TARGET)
}
