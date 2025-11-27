#!/bin/bash

echo "========================================"
echo "    CRIPTODAMUS - STARTUP SCRIPT"
echo "========================================"
echo ""

echo "[1/4] Instalando dependencias del frontend..."
npm install

echo ""
echo "[2/4] Instalando dependencias del backend..."
cd backend
npm install
cd ..

echo ""
echo "[3/4] Creando archivo .env del backend si no existe..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "Archivo backend/.env creado. Por favor configura tus credenciales."
fi

echo ""
echo "[4/4] Iniciando servicios..."
echo ""
echo "========================================"
echo "    SERVICIOS DISPONIBLES:"
echo "========================================"
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001"
echo "Health:   http://localhost:3001/health"
echo ""
echo "========================================"
echo ""

# Función para matar procesos al salir
cleanup() {
    echo ""
    echo "Deteniendo servicios..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

# Iniciar backend
echo "Iniciando backend..."
cd backend && npm run dev &
BACKEND_PID=$!
cd ..

sleep 3

# Iniciar frontend
echo "Iniciando frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "    SISTEMA INICIADO CORRECTAMENTE"
echo "========================================"
echo ""
echo "Presiona Ctrl+C para detener los servicios..."

# Esperar
wait