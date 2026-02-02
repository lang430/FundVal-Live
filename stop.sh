#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}>>> Stopping FundVal Live System...${NC}"

# Kill Backend
if [ -f "backend.pid" ]; then
    PID=$(cat backend.pid)
    if ps -p $PID > /dev/null; then
        kill $PID
        echo -e "Backend (PID: $PID) stopped."
    else
        echo -e "${RED}Backend process $PID not found.${NC}"
    fi
    rm backend.pid
else
    echo "No backend PID file found."
fi

# Kill Frontend
if [ -f "frontend.pid" ]; then
    PID=$(cat frontend.pid)
    if ps -p $PID > /dev/null; then
        kill $PID
        echo -e "Frontend (PID: $PID) stopped."
    else
        echo -e "${RED}Frontend process $PID not found.${NC}"
    fi
    rm frontend.pid
else
    echo "No frontend PID file found."
fi

# Cleanup heavy processes just in case (optional, safe for dev env)
# pkill -f "uvicorn app.main:app"
# pkill -f "vite"

echo -e "${GREEN}>>> All services stopped.${NC}"
