@echo off
echo ========================================
echo     CRIPTODAMUS - STARTUP SCRIPT
echo ========================================
echo.

echo [1/4] Instalando dependencias del frontend...
call npm install

echo.
echo [2/4] Instalando dependencias del backend...
cd backend
call npm install
cd ..

echo.
echo [3/4] Creando archivo .env del backend si no existe...
if not exist backend\.env (
    copy backend\.env.example backend\.env
    echo Archivo backend\.env creado. Por favor configura tus credenciales.
)

echo.
echo [4/4] Iniciando servicios...
echo.
echo ========================================
echo     SERVICIOS DISPONIBLES:
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001
echo Health:   http://localhost:3001/health
echo.
echo ========================================
echo.

echo Iniciando backend...
start cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak > nul

echo Iniciando frontend...
start cmd /k "npm run dev"

echo.
echo ========================================
echo     SISTEMA INICIADO CORRECTAMENTE
echo ========================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul