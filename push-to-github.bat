@echo off
title Push FoodCycle AI to GitHub
set "PATH=%~dp0..\tools\mingit\cmd;%~dp0..\tools\mingit\bin;%PATH%"
echo ====================================================
echo FoodCycle AI - Push to GitHub Utility
echo ====================================================
echo.
echo Make sure you have created an empty repository on GitHub first!
echo (e.g. https://github.com/your-username/foodcycle-ai.git)
echo.
set /p REPO_URL="Enter your GitHub Repository URL: "

if "%REPO_URL%"=="" (
    echo Error: Repository URL cannot be empty!
    pause
    exit /b 1
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
echo Pushing code to GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================================
    echo SUCCESS! Code pushed to GitHub!
    echo Now open https://dashboard.render.com to deploy to Render!
    echo ====================================================
) else (
    echo.
    echo Push encountered an issue. Check your URL or credentials and try again.
)
pause
