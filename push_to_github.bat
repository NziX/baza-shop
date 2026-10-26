@echo off
title Push Baza Shop to GitHub
echo ========================================================
echo           PUSHING BAZA SHOP TO GITHUB
echo           Repository: https://github.com/NziX/baza-shop
echo ========================================================
echo.

set "PATH=C:\Users\HP\MinGit2\cmd;C:\Users\HP\MinGit\cmd;%PATH%"
cd /d "C:\Users\HP\.gemini\antigravity\scratch\baza_shop"

git push -u origin main

echo.
echo ========================================================
echo Complete! Press any key to exit.
pause
