import { NextRequest } from "next/server"
import { proxyToWorker } from "@/lib/worker-api-proxy"

const TARGET = "resume/apply"

export async function POST(request: NextRequest) {
  return proxyToWorker(request, TARGET)
}
