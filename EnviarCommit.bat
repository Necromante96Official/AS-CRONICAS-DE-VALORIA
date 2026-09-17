@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Enviar Commit - AS-CRONICAS-DE-VALORIA
color 0B

REM =========================================================
REM  Repositorio destino (edite aqui se mudar de projeto):
REM =========================================================
set "REPO_NAME=AS-CRONICAS-DE-VALORIA"
set "REPO_HTTPS=https://github.com/Necromante96Official/AS-CRONICAS-DE-VALORIA.git"
set "REPO_SSH=git@github.com:Necromante96Official/AS-CRONICAS-DE-VALORIA.git"
set "REPO_WEB=https://github.com/Necromante96Official/AS-CRONICAS-DE-VALORIA"
set "GIT_USER=Necromante96Official"
set "GIT_EMAIL=canalnecromante96@gmail.com"
set "DEFAULT_MSG=visuais: casas, inimigos e objetos inconfundiveis + alvo so nos vivos"

echo.
echo  ===============================================
echo   Enviar Commit para !REPO_NAME!
echo   !GIT_USER! ^<!GIT_EMAIL!^>
echo   !REPO_WEB!
echo   (SSH: !REPO_SSH!)
echo  ===============================================
echo.

REM --- Verifica se git esta instalado ---
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Git nao encontrado no PATH.
    echo Instale o Git for Windows e tente novamente.
    echo.
    pause
    exit /b 1
)

REM --- Verifica se eh repositorio git ---
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo Inicializando repositorio git...
    git init
    if errorlevel 1 (
        echo [ERRO] Falha ao inicializar repositorio.
        pause
        exit /b 1
    )
    git branch -M main
)

REM --- Configura remote: usa HTTPS por padrao (variaveis no topo) ---
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adicionando remote origin HTTPS...
    git remote add origin "!REPO_HTTPS!"
) else (
    for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do set "CURRENT_URL=%%u"
    echo Remote atual: !CURRENT_URL!
    if not "!CURRENT_URL!"=="!REPO_HTTPS!" (
        if not "!CURRENT_URL!"=="!REPO_SSH!" (
            echo Padronizando para o repositorio correto via HTTPS...
            git remote set-url origin "!REPO_HTTPS!"
        ) else (
            echo Remote SSH do repositorio correto - mantido.
        )
    ) else (
        echo Remote correto - mantido.
    )
)
echo Remote configurado:
git remote -v | findstr origin
echo.

git status --short
echo.

REM --- Mensagem do commit: usa COMMIT_VALORIA.txt como padrao se existir ---
set "FILE_MSG="
if exist "%~dp0COMMIT_VALORIA.txt" (
    for /f "usebackq delims=" %%m in ("%~dp0COMMIT_VALORIA.txt") do (
        if not defined FILE_MSG set "FILE_MSG=%%m"
    )
)
if defined FILE_MSG (
    echo Mensagem padrao - 1a linha de COMMIT_VALORIA.txt:
    echo "!FILE_MSG!"
    echo.
)
set "msg="
set /p "msg=Digite a mensagem do commit (ENTER para usar a padrao): "
if not defined msg (
    if defined FILE_MSG (set "msg=!FILE_MSG!") else (set "msg=!DEFAULT_MSG!")
)
echo.
echo Mensagem: "!msg!"
echo.
choice /C SN /M "Deseja enviar este commit? S/N"
if errorlevel 2 (
    echo Cancelado.
    pause
    exit /b 0
)

echo.
echo --- Adicionando arquivos (respeita .gitignore) ---
git add -A
if errorlevel 1 (
    echo [AVISO] git add retornou erro, continuando...
)
echo.

echo --- Verificando alteracoes staged ---
git diff --cached --quiet
if errorlevel 1 (
    echo Alteracoes staged detectadas - criando commit...
    goto DO_COMMIT
) else (
    echo Nenhuma alteracao staged para commitar.
    echo Verificando commits pendentes para envio...
    set "AHEAD=0"
    for /f %%c in ('git rev-list --count HEAD --not --remotes 2^>nul') do set "AHEAD=%%c"
    if not defined AHEAD set "AHEAD=0"
    echo Commits pendentes: !AHEAD!
    if not "!AHEAD!"=="0" (
        echo Existem !AHEAD! commits locais pendentes - indo direto para o push.
        goto PUSH
    )
    REM Verifica se remoto tem algum branch
    git rev-parse --verify origin/main >nul 2>&1
    if not errorlevel 1 (
        echo Nenhuma alteracao e nenhum commit pendente.
        echo.
        choice /C SN /M "Criar commit vazio com esta mensagem? S/N"
        if errorlevel 2 (
            echo Cancele e faca alguma alteracao antes de commitar.
            pause
            exit /b 0
        )
        echo Criando commit vazio...
        git -c user.name="!GIT_USER!" -c user.email="!GIT_EMAIL!" commit --allow-empty -m "!msg!"
        if errorlevel 1 (
            echo Erro no commit vazio.
            pause
            exit /b 1
        )
        goto PUSH
    )
    git rev-parse --verify origin/master >nul 2>&1
    if not errorlevel 1 (
        echo Nenhuma alteracao e nenhum commit pendente.
        echo.
        choice /C SN /M "Criar commit vazio com esta mensagem? S/N"
        if errorlevel 2 (
            echo Cancele e faca alguma alteracao antes de commitar.
            pause
            exit /b 0
        )
        echo Criando commit vazio...
        git -c user.name="!GIT_USER!" -c user.email="!GIT_EMAIL!" commit --allow-empty -m "!msg!"
        if errorlevel 1 (
            echo Erro no commit vazio.
            pause
            exit /b 1
        )
        goto PUSH
    )
    echo Repositorio remoto ainda vazio e nada para commitar.
    echo Criando commit vazio inicial...
    git -c user.name="!GIT_USER!" -c user.email="!GIT_EMAIL!" commit --allow-empty -m "!msg!"
    if errorlevel 1 (
        echo Erro no commit.
        pause
        exit /b 1
    )
    goto PUSH
)

:DO_COMMIT
echo --- Criando commit ---
git -c user.name="!GIT_USER!" -c user.email="!GIT_EMAIL!" commit -m "!msg!"
if errorlevel 1 (
    echo Erro no commit.
    echo Dica: verifique com git status.
    pause
    exit /b 1
)
echo.

:PUSH
REM --- Detecta branch atual e faz push ---
set "BRANCH="
for /f "delims=" %%b in ('git branch --show-current 2^>nul') do set "BRANCH=%%b"
if not defined BRANCH (
    for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
)
if not defined BRANCH set "BRANCH=main"
if "!BRANCH!"=="HEAD" set "BRANCH=main"
echo --- Enviando para origin/!BRANCH! ---
echo Tentando via HTTPS...
git push -u origin !BRANCH!
if errorlevel 1 (
    echo.
    echo Falha no push via HTTPS.
    echo Tentando via SSH como fallback...
    git remote set-url origin "!REPO_SSH!"
    echo Novo remote: !REPO_SSH!
    echo.
    git push -u origin !BRANCH!
    if errorlevel 1 (
        echo Erro ao enviar mesmo via SSH.
        echo Verifique: 1 - repositorio existe em !REPO_WEB!
        echo           2 - voce esta logado no Git Credential Manager / tem PAT valido para HTTPS
        echo           3 - ou chave SSH configurada para SSH
        echo Restaurando remote para HTTPS...
        git remote set-url origin "!REPO_HTTPS!"
        pause
        exit /b 1
    )
    echo Push via SSH funcionou.
    echo Deseja manter SSH? S para manter, N para voltar ao HTTPS
    choice /C SN /M "Manter SSH? S/N"
    if errorlevel 2 (
        git remote set-url origin "!REPO_HTTPS!"
        echo Remote restaurado para HTTPS.
    )
) else (
    echo Push via HTTPS funcionou.
)
echo.
echo  Commit "!msg!" enviado com sucesso!
echo  !REPO_WEB!
echo.
pause
endlocal
exit /b 0
