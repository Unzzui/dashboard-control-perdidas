#!/bin/bash

# Script para iniciar el Dashboard de Control de Pérdidas

echo "🚀 Iniciando Dashboard de Control de Pérdidas..."

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Backend
echo -e "${BLUE}Iniciando Backend...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo "Creando entorno virtual..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Frontend
echo -e "${BLUE}Iniciando Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✅ Dashboard iniciado!${NC}"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Presiona Ctrl+C para detener ambos servicios"

# Wait for both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
