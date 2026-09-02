# BurryAI — Software Engineer (SDE) Interview Preparation Guide

### Target: Playpower Labs — Technical & Project Interview

---

## Table of Contents

1. [Project Overview & 60-Second Elevator Pitch](#1-project-overview--60-second-elevator-pitch)
2. [Simplified System Architecture](#2-simplified-system-architecture)
3. [Codebase Deep Dive: Critical Files & Functions](#3-codebase-deep-dive-critical-files--functions)
4. [AI & LLM Pipeline (How it Actually Works)](#4-ai--llm-pipeline-how-it-actually-works)
5. [Database Schema, APIs & Data Flow](#5-database-schema-apis--data-flow)
6. [Deployment, CI/CD & Production Infrastructure](#6-deployment-cicd--production-infrastructure)
7. [Security & Threat Defense (What to Say)](#7-security--threat-defense-what-to-say)
8. [Implementation Reality Matrix (Implemented vs. Planned vs. Improvement)](#8-implementation-reality-matrix)
9. [Playpower Labs Expected Interview Questions (Easy, Medium, Deep)](#9-playpower-labs-expected-interview-questions)

---

# 1. Project Overview & 60-Second Elevator Pitch

### What BurryAI Does

BurryAI is a personal finance copilot designed specifically for college students and early-career earners. It tracks income, expenses, and student loans, runs mathematical financial health analytics, and uses an orchestrated AI agent pipeline to deliver concrete, personalized action plans (spending cuts, loan repayment optimization, and verified live earning opportunities).

### The Problem It Solves

Traditional budgeting applications (like Mint, YNAB, or basic expense trackers) are **passive visualization dashboards**:

- They show charts of historical spending, but place the burden of mathematical financial analysis on the user.
- Students and young earners often have low financial literacy, struggling with debt interest calculations and budget surplus allocation.
- Generic LLMs (like ChatGPT) hallucinate financial numbers and lack access to user accounting data.

**BurryAI solves this** by combining **deterministic accounting formulas** (exact math in TypeScript/SQL) with an **agentic AI pipeline** (context injection, tool execution, live job search, and multi-model routing) to give grounded, actionable advice.

### Core Features (Actually Implemented in Code)

1. **Overview Dashboard & Health Score:** Live metrics calculating Total Income, Expenses, Loan Commitments, Debt-to-Income (DTI) Ratio, Expense Ratio, and a weighted 0–100 Financial Health Score.
2. **AI Financial Advisor:** Multi-turn conversational copilot with thread persistence in SQLite, tool telemetry badges, and source citations.
3. **Cost Cutter:** Analyzes spending against the 50/30/20 rule and generates interactive, checkable step-by-step savings milestones stored in the database.
4. **Income & Job Opportunities Aggregator:** Live job, internship, and gig discovery searching direct employer boards (Lever, Greenhouse, Ashby), community boards (Reddit `/r/forhire`), and campus listings, ranked by match against user skills and location.
5. **AI Resume Parser:** Extracts skills, education, and career bio from uploaded resumes (PDF/Word) using AI to automatically populate the user profile.
6. **Financial Timeline:** Chronological schedule merging upcoming student loan due dates and recurring expenses.
7. **Guest Mode:** LocalStorage-based demo mode allowing users to explore the application before signing up.

---

### ⏱️ Your 60-Second Interview Pitch

> _"BurryAI is an AI-powered financial advisor copilot built for students and early-career professionals._
>
> _I built it because existing budgeting tools are just passive dashboards—they show you where your money went, but don't tell you what to do next. BurryAI combines real expense and loan tracking with deterministic financial formulas and an agentic AI pipeline._
>
> _Architecturally, the frontend is built with Next.js 14 and React, deployed to Cloudflare via OpenNext. The backend is a lightweight Hono API running on Cloudflare Workers at the edge, using Cloudflare D1—which is SQLite at the edge—for persistent storage._
>
> _For the AI, instead of sending raw queries to a generic chatbot, I built an agentic pipeline: it identifies user intent, pulls live financial numbers from SQL, runs deterministic calculation tools, searches internal knowledge and live web opportunities, and routes between specialized Cloudflare Workers AI models (like GLM-4.7 Flash for speed and QwQ-32B for financial reasoning)._
>
> _The entire system is deployed live on Cloudflare's serverless edge with automated GitHub Actions CI/CD."_

---

# 2. Simplified System Architecture

```
[Browser Client (React 18 / Next.js 14)]
                │
                │ 1. API Call (e.g. /api/expenses or /api/agent/advice)
                ▼
[Next.js Server Proxy (lib/worker-api-proxy.ts)]
                │
                │ 2. Edge Fetch with HttpOnly Cookie / Bearer JWT
                ▼
+─────────────────────────────────────────────────────────────────────────+
│                    Cloudflare Worker API (Hono)                         │
│                                                                         │
│  [RequestContext] ──► [RateLimiter] ──► [RequireAuth Middleware]        │
│                                                   │                     │
│                                                   ▼                     │
│                                         [Hono Route Handlers]           │
│                                                   │                     │
│                 ┌─────────────────────────────────┴───────────────┐     │
│                 ▼                                                 ▼     │
│       [Analytics Service]                               [AI Agent Pipe] │
│     (Health Score, DTI Math)                       (graph.ts & router)  │
│                 │                                                 │     │
+─────────────────┼─────────────────────────────────────────────────┼─────+
                  │                                                 │
                  ▼                                                 ▼
       +────────────────────+                           +────────────────────────+
       │   Cloudflare D1    │                           │  Workers AI / Web API  │
       │ (SQLite at Edge)   │                           │ - QwQ-32B / GLM Flash  │
       │ Users, Expenses,   │                           │ - Serper / Tavily Jobs │
       │ Loans, Threads     │                           │ - Vectorize Embeddings │
       +────────────────────+                           +────────────────────────+
```

### Communication Flow:

1. **Frontend $\to$ Backend Proxy:** Browser calls Next.js `/api/*` route handlers. `lib/worker-api-proxy.ts` forwards the request to the Cloudflare Worker URL, relaying auth headers and preserving cookies.
2. **Backend $\to$ Database:** The Worker executes prepared SQL statements against Cloudflare D1 over Cloudflare's internal edge network fabric.
3. **Backend $\to$ AI Models:** The Worker invokes Cloudflare Workers AI bindings directly in-process via `c.env.AI.run(model, input)`, avoiding external network latency.

### Why This Stack Was Chosen:

- **Next.js 14:** Component-based UI with App Router and server-side route proxies.
- **Hono Framework:** Ultra-lightweight TypeScript web framework designed specifically for edge runtimes (V8 isolates), offering sub-millisecond route dispatching.
- **Cloudflare Workers:** Serverless edge execution with **< 5ms cold starts** (compared to 500ms+ on traditional AWS Lambda).
- **Cloudflare D1:** SQLite at the edge. Gives full relational ACID transactions and SQL indexing without the cost or connection-pooling issues of external Postgres/MySQL.

---

# 3. Codebase Deep Dive: Critical Files & Functions

When an interviewer asks you to walk through your code, focus on these 6 core files:

### 1. `burryai-worker/src/index.ts` (Backend Entrypoint & Middleware)

- **What it does:** Configures CORS, sets up request latency timing, mounts rate limiting, and registers all API routes.
- **Key Code Structure:**

  ```typescript
  const app = new Hono<AppEnv>();
  app.use("*", cors({ origin: allowedOrigins, credentials: true }));
  app.use("*", requestContext);

  // Rate limiting & Route mounting
  app.use("/auth/*", authRateLimit);
  app.route("/auth", authRoutes);
  app.route("/api/auth", authRoutes); // Dual route aliasing for proxy compatibility
  app.route("/expenses", expensesRoutes);
  app.route("/agent", agentRoutes);
  ```

### 2. `burryai-worker/src/auth/jwt.ts` & `middleware/auth.ts` (Edge Authentication)

- **What it does:** Generates and cryptographically verifies stateless JWT session tokens.
- **Why `jose` instead of `jsonwebtoken`?** Node's `jsonwebtoken` relies on C++ cryptographic bindings not present in edge V8 isolates. `jose` uses universal Web Crypto APIs (`crypto.subtle`), ensuring zero cold starts and native edge compatibility.
- **Key Function:** `verifySessionToken(token, secret)`: Extracts the `userId` from the token `sub` claim and sets `c.set("userId", payload.sub)`.

### 3. `burryai-worker/src/services/analytics.ts` (Deterministic Financial Math)

- **What it does:** Single source of truth for all accounting formulas. Computes totals, expense ratios, debt-to-income ratios, and the Financial Health Score.
- **Key Function:** `calculateFinancialHealthScore()`:
  ```typescript
  const expenseScore = (1 - Math.min(expenseRatio, 1)) * 40; // 40% weight
  const debtScore = (1 - Math.min(debtRatio, 1)) * 35; // 35% weight
  const savingsScore = clamp((savingsRatio + 1) * 12.5, 0, 25); // 25% weight
  return Math.round(clamp(expenseScore + debtScore + savingsScore, 0, 100));
  ```
- **Interview Key Point:** Math is executed deterministically in TypeScript so numbers are 100% consistent across page reloads and never hallucinated by an LLM.

### 4. `burryai-worker/src/agent/graph.ts` (AI Agent Orchestration)

- **What it does:** Coordinates the multi-step agent pipeline:
  1. `detectIntent()` $\to$ Classifies query into `budgeting`, `debt`, `savings`, `income`, or `general`.
  2. `buildAgentContext()` $\to$ Fetches user profile, monthly income, current month expenses, and loans from D1.
  3. `selectToolsByIntent()` & `runSelectedTools()` $\to$ Executes domain tools (e.g., `costCutter`, `loanOptimizer`).
  4. `retrieveKnowledgeContext()` $\to$ Queries Vectorize / lexical knowledge base.
  5. `searchWebForIncomeIdeas()` $\to$ Queries Serper/Tavily if user asks for earning/job advice.
  6. `generateAgentResponse()` $\to$ Injects all context into the prompt and invokes the model router.

### 5. `burryai-worker/src/agent/model-router.ts` (Task-Based Model Routing)

- **What it does:** Inspects user query with regex heuristics to select the most efficient model:
  - **Reasoning Queries:** ($\ge 2$ keywords like _calculate, apr, debt, budget, formula, loan, %_) $\to$ Routes to `@cf/qwen/qwq-32b`.
  - **Conversational Queries:** $\to$ Routes to `@cf/zai-org/glm-4.7-flash` for high throughput and low latency.
  - **Fallback:** If primary model fails $\to$ Falls back to `@cf/meta/llama-3-8b-instruct`.
  - **Fail-safe:** If all AI models fail $\to$ `buildFallbackResponse()` compiles a rule-based advice report directly from tool outputs.

### 6. `lib/worker-api-proxy.ts` (Next.js Server Proxy)

- **What it does:** Reverse-proxies `/api/*` calls from Next.js to the Worker backend.
- **Why it matters:** Captures `Set-Cookie` headers via `getSetCookie()`, handles cookie relaying to the browser, prevents CORS issues in local development, and simplifies production networking.

---

# 4. AI & LLM Pipeline (How it Actually Works)

```
[User Message: "How can I pay off my $5,000 student loan faster?"]
                          │
                          ▼
1. Detect Intent ────────► Identified as: "debt"
                          │
                          ▼
2. Build Context ────────► Fetches D1 Data: Income ($3k), Expenses ($1.8k), Loan ($5k @ 6.5% APR)
                          │
                          ▼
3. Run Tools ────────────► "loanOptimizer" computes accelerated payoff & interest savings
                          │
                          ▼
4. Knowledge & RAG ──────► Retrieves student loan payoff strategies from Vectorize / Knowledge Base
                          │
                          ▼
5. Model Router ─────────► Mathematical keywords detected ──► Selected: QwQ-32B Reasoning Model
                          │
                          ▼
6. Generate Response ────► Prompt = System Prompt + History + User Data + Tool Output JSON + Snippets
                          │
                          ▼
7. Fallback Layer ───────► If model fails ──► Deterministic rule-based advice summary returned
```

---

### Core AI Concepts for the SDE Interview:

#### Q: What is an AI Agent and how is it different from a normal chatbot?

> **Answer:** _"A standard chatbot is a single-turn text predictor: you give it a prompt, and it predicts the next words based only on its training weights. An **AI Agent**, like the one in BurryAI, is an orchestrated system that can understand intent, fetch live user data from a database, execute deterministic tools (like loan payoff calculators), search external knowledge or the web, and synthesize all verified information into an actionable response."_

#### Q: Why do you calculate numbers deterministically instead of asking the LLM?

> **Answer:** _"LLMs are probabilistic language models, not calculators. They frequently make arithmetic mistakes, especially with percentages, compounding interest, or summing large transaction lists. In BurryAI, we compute all numbers in TypeScript and SQL first, and then give the exact numbers to the LLM to explain and format. This eliminates mathematical hallucinations."_

#### Q: What is RAG (Retrieval-Augmented Generation)?

> **Answer:** _"RAG is a technique where we retrieve relevant external documents from a database and inject them into the LLM's prompt context before it generates an answer. It grounds the LLM in private, accurate, and up-to-date facts without needing to retrain or fine-tune the model."_

#### Q: What are Embeddings and Vector Search?

> **Answer:** _"An embedding model converts a piece of text into a high-dimensional array of numbers (a vector) that captures its semantic meaning. Vector search compares the user's query vector against stored document vectors using cosine similarity to retrieve the most semantically relevant text chunks."_

#### Q: How does Model Routing work in your codebase?

> **Answer:** _"Instead of sending every request to an expensive reasoning model, `model-router.ts` analyzes the prompt. If the prompt contains calculations, budget formulas, or loan terms, it routes to `@cf/qwen/qwq-32b`. For standard greetings or explanations, it routes to `@cf/zai-org/glm-4.7-flash`. This reduces latency and compute cost while maintaining high quality."_

---

# 5. Database Schema, APIs & Data Flow

### Cloudflare D1 Relational Schema (SQLite)

- **`users`:** `id` (UUID PK), `email` (Unique), `password_hash`, timestamps.
- **`user_profiles`:** `user_id` (PK/FK), `full_name`, `country`, `student_status`, `university`, `profession`, `skills_json`, `city`, `preferred_work_mode`, `resume_summary`.
- **`financial_profiles`:** `user_id` (PK/FK), `monthly_income`, `currency`, `savings_goal`, `risk_tolerance`.
- **`expenses`:** `id` (PK), `user_id` (FK), `amount`, `category`, `description`, `date`.
- **`loans`:** `id` (PK), `user_id` (FK), `loan_name`, `principal_amount`, `interest_rate`, `minimum_payment`, `remaining_balance`, `due_date`.
- **`advisor_threads` & `advisor_messages`:** Multi-turn chat persistence with `meta_json` (used tools, citations, RAG metadata).
- **`cost_cutter_plans` & `cost_cutter_plan_steps`:** Interactive savings milestones with `is_completed` boolean flags.
- **`ai_logs`:** Audit log storing query, response, and model used.

### Key API Endpoints

| Endpoint                       |     Method     | Purpose                                                    |
| :----------------------------- | :------------: | :--------------------------------------------------------- |
| `/auth/signup` & `/auth/login` |     `POST`     | User registration & authentication; issues JWT cookie      |
| `/expenses`                    | `GET` / `POST` | Fetch user expenses / Create a new expense                 |
| `/loans`                       | `GET` / `POST` | Fetch loans / Create loan record                           |
| `/dashboard/financial-score`   |     `GET`      | Returns health score (0–100) and letter grade              |
| `/dashboard/charts`            |     `GET`      | Returns pre-aggregated monthly trend data for Recharts     |
| `/agent/advice`                |     `POST`     | Runs the agentic pipeline and returns structured AI advice |
| `/agent/chats/:id/messages`    |     `POST`     | Multi-turn conversational chat within a thread             |
| `/opportunities/search`        |     `POST`     | Queries Serper/Tavily for live job/gig listings            |
| `/resume/parse`                |     `POST`     | AI extraction of skills and experience from resume text    |

---

# 6. Deployment, CI/CD & Production Infrastructure

### Where Everything Runs:

- **Frontend:** Next.js 14 deployed to **Cloudflare Workers** using `@opennextjs/cloudflare` (`wrangler.frontend.jsonc`).
- **Backend API:** Hono REST API running on **Cloudflare Workers** (`burryai-worker/wrangler.jsonc`).
- **Database:** **Cloudflare D1** distributed SQLite database (`burryai-db`).
- **Vector DB:** **Cloudflare Vectorize** index (`financial-data`).
- **AI Inference:** **Cloudflare Workers AI** (serverless edge GPUs running GLM-4.7, QwQ-32B, and Llama-3-8B).

### CI/CD Pipeline (`.github/workflows/deploy-cloudflare.yml`):

1. **Trigger:** Automatically runs on every `git push` to `main`.
2. **Automated Testing:** Executes the Vitest test suite (`npm test --prefix burryai-worker`).
3. **Database Migrations:** Applies pending D1 migrations remotely (`npx wrangler d1 migrations apply burryai-db --remote`).
4. **Secret Sync:** Injects `JWT_SECRET`, `SERPER_API_KEY`, and `TAVILY_API_KEY` into Worker secrets.
5. **Worker Deploy:** Deploys the backend API via `wrangler deploy`.
6. **Frontend Deploy:** Builds and deploys the Next.js app via OpenNext to Cloudflare.

---

# 7. Security & Threat Defense (What to Say)

If the interviewer asks: _"How did you secure your application?"_ — highlight these 6 points:

1. **Stateless JWT with HttpOnly Cookies:** Tokens are signed using `jose` with `HS256` and stored in `HttpOnly`, `Secure`, `SameSite` cookies. This protects against **XSS token theft** (JavaScript cannot access the cookie).
2. **Password Security:** Passwords are hashed using `bcryptjs` with 12 salt rounds before database insertion.
3. **SQL Injection Prevention:** 100% of D1 database queries use **parameterized prepared statements** (`db.prepare("SELECT ... WHERE user_id = ?1").bind(userId)`). There is zero raw string interpolation in SQL.
4. **Multi-Tenant User Data Isolation:** Every single read and mutation query enforces `WHERE user_id = ?`. For example:
   ```sql
   DELETE FROM expenses WHERE id = ?1 AND user_id = ?2;
   ```
   Even if an attacker guesses another user's expense UUID, zero rows are affected and the API returns `404 Not Found`.
5. **Input Validation:** Every endpoint validates request payloads against strict **Zod schemas** before any business logic executes.
6. **Prompt Injection Mitigation:** System instructions and user inputs are strictly separated using role parameters (`{ role: "system" }` vs `{ role: "user" }`). User message length is capped at 4,000 characters.

---

# 8. Implementation Reality Matrix

Be completely honest about what is live vs. what is planned:

| Feature                                 |       Status        | Explanation for Interviewer                                                                  |
| :-------------------------------------- | :-----------------: | :------------------------------------------------------------------------------------------- |
| **Next.js + Hono Worker API**           |    `IMPLEMENTED`    | Live in production on Cloudflare edge.                                                       |
| **D1 SQL Database & Migrations**        |    `IMPLEMENTED`    | 5 migration files, full relational tables, triggers, and indexes.                            |
| **Deterministic Analytics Service**     |    `IMPLEMENTED`    | Live health score, expense ratio, and DTI formulas.                                          |
| **Multi-Model Routing (Workers AI)**    |    `IMPLEMENTED`    | Real routing between GLM-4.7-Flash, QwQ-32B, and Llama 3.                                    |
| **Live Job Aggregator (Serper/Tavily)** |    `IMPLEMENTED`    | Real web scraping and skill-matching engine.                                                 |
| **AI Resume Parser**                    |    `IMPLEMENTED`    | AI extraction from resume text into profile fields.                                          |
| **In-Memory Rate Limiting**             | `PRESENT BUT BASIC` | Works per edge isolate; in high-scale production would use Cloudflare WAF or Upstash Redis.  |
| **Vectorize RAG**                       | `PRESENT BUT BASIC` | Code is implemented; toggled via config flag with lexical fallback.                          |
| **Bank Account Sync (Plaid API)**       |    `IMPROVEMENT`    | Currently manual expense entry; Plaid API sync is a planned feature.                         |
| **LLM Token Streaming (SSE)**           |    `IMPROVEMENT`    | Currently single POST response; token streaming via Server-Sent Events is a planned upgrade. |

---

# 9. Playpower Labs Expected Interview Questions

### 🟢 Easy / Warm-Up Questions

1. **"Tell me about BurryAI and why you built it."**  
   _(Use your 60-second pitch from Section 1)._
2. **"What technologies did you use and why?"**  
   _(Next.js 14, Hono on Cloudflare Workers, Cloudflare D1 SQLite, Workers AI, Tailwind CSS)._
3. **"How does authentication work in your app?"**  
   _(Stateless JWTs signed with `jose`, stored in HttpOnly cookies, verified in Hono middleware)._

### 🟡 Medium / Core Engineering Questions

4. **"Walk me through the request lifecycle when a user asks the AI advisor a question."**  
   _(UI $\to$ Next.js Proxy $\to$ Worker Auth $\to$ Intent Detection $\to$ SQL Context Fetch $\to$ Tool Execution $\to$ Model Router $\to$ Workers AI $\to$ Database Log $\to$ UI)._
5. **"Why did you calculate financial health scores in code instead of asking the LLM?"**  
   _(LLMs are probabilistic and hallucinate math; deterministic code guarantees 100% accuracy and consistency)._
6. **"Why did you choose Cloudflare D1 instead of MongoDB or PostgreSQL?"**  
   _(D1 is SQLite co-located on Cloudflare's edge network with the Worker, eliminating cross-cloud database connection latency and connection pooling overhead)._
7. **"How does the model router work?"**  
   _(Regex heuristics classify query complexity: math/debt keywords route to QwQ-32B reasoning, while general chat routes to GLM-4.7 Flash)._

### 🔴 Deep / Technical Trade-Off Questions

8. **"What happens if the Cloudflare Workers AI service goes down?"**  
   _(The system catches the exception and executes `buildFallbackResponse()`, generating a deterministic, rule-based advice report directly from SQL tool calculations so the user never sees a broken screen)._
9. **"How do you ensure User A cannot access User B's expenses?"**  
   _(JWT extracts verified `userId` in auth middleware; all SQL queries enforce `WHERE user_id = ?` scoping)._
10. **"What was the hardest technical challenge you faced while building this?"**  
    _(Handling edge compatibility: replacing Node-specific libraries with edge-native Web Crypto standards like `jose`, and building `worker-api-proxy.ts` to properly relay `Set-Cookie` headers across Next.js and Cloudflare Workers)._
11. **"If you had another month to work on this, what would you improve?"**  
    _(Implement Server-Sent Events (SSE) for streaming LLM tokens to drop perceived latency, integrate Plaid for automatic bank syncing, and use Upstash Redis for distributed rate limiting)._
