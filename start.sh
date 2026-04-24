#!/bin/bash

# ============================================================
# AI 3D Printing Optimizer - Startup Script
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${PURPLE}=================================================${NC}"
echo -e "${PURPLE}   AI 3D Printing Optimizer - Starting Up${NC}"
echo -e "${PURPLE}=================================================${NC}"
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo -e "${GREEN}[OK]${NC} Environment variables loaded"
else
    echo -e "${RED}[ERROR]${NC} .env file not found!"
    exit 1
fi

BACKEND_PORT=${BACKEND_PORT:-4000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# ============================================================
# Clean up used ports
# ============================================================
echo -e "\n${YELLOW}[STEP 1]${NC} Cleaning up used ports..."

cleanup_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "  ${YELLOW}Killing processes on port $port: $pids${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    echo -e "  ${GREEN}Port $port is free${NC}"
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

# ============================================================
# Check PostgreSQL
# ============================================================
echo -e "\n${YELLOW}[STEP 2]${NC} Checking PostgreSQL..."

if command -v pg_isready &> /dev/null; then
    if pg_isready -q 2>/dev/null; then
        echo -e "  ${GREEN}PostgreSQL is running${NC}"
    else
        echo -e "  ${YELLOW}Starting PostgreSQL...${NC}"
        if command -v brew &> /dev/null; then
            brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
        fi
        sleep 2
    fi
else
    echo -e "  ${YELLOW}pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# ============================================================
# Create database and user
# ============================================================
echo -e "\n${YELLOW}[STEP 3]${NC} Setting up database..."

DB_NAME="printing_optimizer"
DB_USER="printer_admin"
DB_PASS="printer_pass_2024"

# Create user if not exists
psql -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1 || \
    psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || \
    echo -e "  ${YELLOW}User might already exist or using different auth${NC}"

# Create database if not exists
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1 || \
    psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
    echo -e "  ${YELLOW}Database might already exist${NC}"

# Grant privileges
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
psql -U postgres -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
psql -U postgres -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" 2>/dev/null || true

echo -e "  ${GREEN}Database setup complete${NC}"

# ============================================================
# Install dependencies
# ============================================================
echo -e "\n${YELLOW}[STEP 4]${NC} Installing dependencies..."

echo -e "  ${CYAN}Installing backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>&1 | tail -1

echo -e "  ${CYAN}Installing frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
npm install --silent 2>&1 | tail -1

cd "$PROJECT_DIR"
echo -e "  ${GREEN}Dependencies installed${NC}"

# ============================================================
# Seed database
# ============================================================
echo -e "\n${YELLOW}[STEP 5]${NC} Seeding database with sample data..."

cd "$PROJECT_DIR/backend"
node seed.js
echo -e "  ${GREEN}Database seeded with 15 items per feature (150+ total records)${NC}"

# ============================================================
# Start services with hot reload
# ============================================================
echo -e "\n${YELLOW}[STEP 6]${NC} Starting services with hot reload..."

cd "$PROJECT_DIR"

# Start backend with nodemon for hot reload
echo -e "  ${CYAN}Starting backend on port $BACKEND_PORT (with nodemon hot reload)...${NC}"
cd "$PROJECT_DIR/backend"
npx nodemon server.js &
BACKEND_PID=$!

# Start frontend with Vite dev server (built-in hot reload)
echo -e "  ${CYAN}Starting frontend on port $FRONTEND_PORT (with Vite HMR)...${NC}"
cd "$PROJECT_DIR/frontend"
npx vite --port $FRONTEND_PORT --host &
FRONTEND_PID=$!

cd "$PROJECT_DIR"

# Wait for services to start
sleep 3

echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}   AI 3D Printing Optimizer is RUNNING!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "  ${CYAN}Backend:${NC}   http://localhost:$BACKEND_PORT"
echo -e "  ${CYAN}API Health:${NC} http://localhost:$BACKEND_PORT/api/health"
echo ""
echo -e "  ${YELLOW}Login:${NC} Use 'Auto-Fill Demo Credentials' button"
echo -e "  ${YELLOW}Email:${NC} $DEFAULT_EMAIL"
echo -e "  ${YELLOW}Password:${NC} $DEFAULT_PASSWORD"
echo ""
echo -e "  ${PURPLE}Hot Reload:${NC} Backend (nodemon) + Frontend (Vite HMR)"
echo -e "  ${PURPLE}Press Ctrl+C to stop all services${NC}"
echo ""

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    cleanup_port $BACKEND_PORT
    cleanup_port $FRONTEND_PORT
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for background processes
wait
