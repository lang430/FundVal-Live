#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}>>> Starting FundVal Live System...${NC}"

# Create logs directory
mkdir -p logs

# 1. Check Prerequisites
if ! command -v uv &> /dev/null; then
    echo -e "${RED}Error: 'uv' is not installed. Please install it first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: 'npm' is not installed. Please install Node.js.${NC}"
    exit 1
fi

# 2. Start Backend
echo -e "${BLUE}>>> [1/2] Initializing Backend...${NC}"
cd backend || exit
uv sync > /dev/null 2>&1
# Start with nohup and redirect to root logs folder
nohup uv run uvicorn app.main:app --port 21345 --host 0.0.0.0 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
cd ..

# 3. Start Frontend
echo -e "${BLUE}>>> [2/2] Initializing Frontend...${NC}"
cd frontend || exit
if [ ! -d "node_modules" ]; then
    npm install > /dev/null 2>&1
fi
# Start with nohup and redirect to root logs folder
nohup npm run dev -- --host > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
cd ..

# 4. Final Validation
echo -e "${GREEN}>>> Waiting for initialization...${NC}"
sleep 4

echo -e "------------------------------------------------"
if ps -p $(cat backend.pid) > /dev/null; then
    echo -e "${GREEN}✔ Backend  : RUNNING (Port 21345)${NC}"
else
    echo -e "${RED}✘ Backend  : FAILED (Check logs/backend.log)${NC}"
fi

if ps -p $(cat frontend.pid) > /dev/null; then
    echo -e "${GREEN}✔ Frontend : RUNNING (Port 5173)${NC}"
    echo -e "${GREEN}>>> Access : http://localhost:5173${NC}"
else
    echo -e "${RED}✘ Frontend : FAILED (Check logs/frontend.log)${NC}"
fi
echo -e "------------------------------------------------"
echo -e "${BLUE}View logs with: tail -f logs/backend.log${NC}"