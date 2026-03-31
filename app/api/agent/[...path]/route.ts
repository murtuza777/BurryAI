import { NextRequest } from "next/server"
import { proxyToWorker } from "@/lib/worker-api-proxy"

type RouteContext = {
  params: {
    path: string[]
  }
}

function buildPath(path: string[]): string {
  return `agent/${path.join("/")}`
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToWorker(request, buildPath(context.params.path))
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToWorker(request, buildPath(context.params.path))
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToWorker(request, buildPath(context.params.path))
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToWorker(request, buildPath(context.params.path))
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyToWorker(request, buildPath(context.params.path))
}
