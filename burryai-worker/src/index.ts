import { Hono } from "hono"
import { cors } from "hono/cors"
import agentRoutes from "./routes/agent"
import authRoutes from "./routes/auth"
import dashboardRoutes from "./routes/dashboard"
import expensesRoutes from "./routes/expenses"
import financialSummaryRoutes from "./routes/financial-summary"
import loansRoutes from "./routes/loans"
import { handleAppError } from "./middleware/error-handler"
import { requestContext, getMetricsSnapshot } from "./middleware/request-context"
import { createRateLimit } from "./middleware/rate-limit"
import profileRoutes from "./routes/profile"
import opportunitiesRoutes from "./routes/opportunities"
import resumeRoutes from "./routes/resume"
import type { AppEnv } from "./types"

const app = new Hono<AppEnv>()
const allowedOrigins = new Set([
  "https://burryai-web.mdmurtuzaali777.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
])

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return "https://burryai-web.mdmurtuzaali777.workers.dev"
      }
      return allowedOrigins.has(origin)
        ? origin
        : "https://burryai-web.mdmurtuzaali777.workers.dev"
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400
  })
)
app.use("*", requestContext)

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "BurryAI API",
    status: "running"
  })
})

app.get("/metrics", (c) => {
  return c.json({
    ok: true,
    counters: getMetricsSnapshot()
  })
})

const authRateLimit = createRateLimit({ limit: 20, windowMs: 60 * 1000 })
const agentRateLimit = createRateLimit({ limit: 12, windowMs: 60 * 1000 })

app.use("/auth/*", authRateLimit)
app.use("/api/auth/*", authRateLimit)
app.route("/auth", authRoutes)
app.route("/api/auth", authRoutes)
app.route("/expenses", expensesRoutes)
app.route("/api/expenses", expensesRoutes)
app.route("/loans", loansRoutes)
app.route("/api/loans", loansRoutes)
app.route("/profile", profileRoutes)
app.route("/api/profile", profileRoutes)
app.route("/user/profile", profileRoutes)
app.route("/api/user/profile", profileRoutes)
app.route("/financial-summary", financialSummaryRoutes)
app.route("/api/financial-summary", financialSummaryRoutes)
app.route("/dashboard", dashboardRoutes)
app.route("/api/dashboard", dashboardRoutes)
app.use("/opportunities/*", agentRateLimit)
app.use("/api/opportunities/*", agentRateLimit)
app.route("/opportunities", opportunitiesRoutes)
app.route("/api/opportunities", opportunitiesRoutes)
app.use("/resume/*", agentRateLimit)
app.use("/api/resume/*", agentRateLimit)
app.route("/resume", resumeRoutes)
app.route("/api/resume", resumeRoutes)
app.use("/agent/*", agentRateLimit)
app.use("/api/agent/*", agentRateLimit)
app.route("/agent", agentRoutes)
app.route("/api/agent", agentRoutes)
app.onError(handleAppError)

export default app
