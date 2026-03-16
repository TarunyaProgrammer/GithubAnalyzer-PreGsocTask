# WebiU: GitHub Repository Intelligence Analyzer

**WebiU** is a production-grade ingestion and analytical engine designed to provide deep insights into GitHub repositories. It combines a high-performance sync pipeline with an intelligent analyzer to classify repositories by activity, complexity, and learning difficulty.

Built for the **C2SI GSoC 2026 Pre-Selection Task**, this project demonstrates a robust, scalable architecture using modern full-stack technologies.

![WebiU Preview](Preview.png)

---

## 🚀 Key Features

### 🧠 Intelligence Analyzer (Task 2)
- **Multi-Factor Scoring**: Custom algorithms for **Activity** (commit frequency, contributors, issues) and **Complexity** (language diversity, disk usage, topic richness).
- **Learning Difficulty**: Repositories are automatically classified as *Beginner*, *Intermediate*, or *Advanced*.
- **Direct Analysis**: Endpoint to analyze any public GitHub URL on-demand.

### 🛡️ Production-Grade Webhooks
- **Secure Ingestion**: HMAC-SHA256 signature verification protects against unauthorized payloads.
- **Event Deduplication**: Redis-backed idempotent processing using `x-github-delivery` IDs.
- **Asynchronous Pipeline**: Webhooks are instantly queued via BullMQ to handle high-concurrency event bursts.

### ⚡ High-Performance Architecture
- **2-Tier Caching (L1/L2)**: Stampede-resistant caching using local memory (Node-Cache) and distributed Redis.
- **Resilient Sync**: Background workers with exponential backoff and GitHub API rate-limit awareness.
- **Full-Text Search**: Optimized PostgreSQL GIN indexes for lightning-fast repository discovery.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | NestJS 11, TypeScript, Prisma ORM, BullMQ, Redis |
| **Frontend** | Angular 17, Material Design, Chart.js, RxJS |
| **Database** | PostgreSQL 15 |
| **DevOps** | Docker, Docker Compose, GitHub Actions |

---

## 🏗 System Architecture

```mermaid
graph TD
    GH[GitHub API / Webhooks] -->|Webhook| WC[Webhook Controller]
    WC -->|Deduplicate| RD[Redis]
    WC -->|Enqueue| BQ[BullMQ Queue]
    BQ -->|Process| SP[Sync Processor]
    SP -->|Analyze| AS[Analyzer Service]
    AS -->|Store| DB[(PostgreSQL)]
    DB -->|L2 Cache| RD
    FE[Angular Frontend] -->|API Call| BC[Backend Controller]
    BC -->|Serve| FE
```

---

## ⚙️ Getting Started

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/)
- [Node.js v20+](https://nodejs.org/)

### 1. Environment Setup
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql://webiu:webiu_local_password@localhost:5433/webiu
POSTGRES_PASSWORD=webiu_local_password

# Cache
REDIS_URL=redis://localhost:6379

# GitHub Integration
GITHUB_TOKEN=your_github_pat
GITHUB_ORG=c2siorg
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

### 2. Launch Services
```bash
# Start Database and Redis
docker compose up -d postgres redis

# Setup Database Schema and Seed Data
cd backend
npm install
npx prisma db push
npm run prisma:seed

# Start Applications
# Backend (Port 3000)
npm run start:dev

# Frontend (Port 4200)
cd ../frontend
npm install
npm start
```

---

> [!NOTE]
> **GitHub Organization Locking**: By default, the `GITHUB_ORG` in your `.env` prevents analyzing repositories outside of that organization. To analyze any public repository, ensure the backend logic in `GitHubService` is adjusted to parse owners dynamically.

## 📈 Analysis Methodology

The analyzer computes a **Combined Score** (40% Activity / 60% Complexity) to determine difficulty:

- **Beginner (< 35)**: Low maintenance frequency, straightforward codebase, usually 1-2 languages.
- **Intermediate (35-65)**: Steady development, diverse tech stack, moderate scale.
- **Advanced (> 65)**: High-velocity contributions, complex multi-language systems, large codebase.

Detailed formula specifications can be found in [docs/analyzer.md](docs/analyzer.md).

---

## 📄 Project Documentation

- [**Analyzer Specification**](docs/analyzer.md): Deep dive into scoring logic and sample reports.
- [**Task 1 PDF**](Pre%20GSoC%20Task1.pdf): Initial architecture design and research.
- [**Walkthrough**](.gemini/antigravity/brain/a098e98c-9959-48e8-87c7-85016b5a69c8/walkthrough.md): Comprehensive feature summary and verification steps.

---

## 🤝 Contributing
This repository is part of a Pre-GSoC evaluation. For inquiries or access, please reach out to the project maintainers at [C2SI](https://github.com/c2siorg).
