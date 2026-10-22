@echo off
chcp 65001 > nul
echo ========================================================
echo   ALPHA SOLUCOES CONDOMINIAIS - ATUALIZADOR AUTOMATICO
echo ========================================================
echo.
echo [1/3] Compilando e blindando o sistema...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] A compilacao falhou! Verifique os erros acima.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Sincronizando com o GitHub...
git add -A
git commit -m "deploy: atualizacao automatica do sistema"
git push origin master

echo.
echo [3/3] Publicando na Vercel (Producao)...
call npx vercel --prod --yes

echo.
echo ========================================================
echo   ATUALIZACAO CONCLUIDA COM SUCESSO!
echo   Acesse: https://app.alphaadmsc.com.br
echo ========================================================
echo.
pause
