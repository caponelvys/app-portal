@echo off
:: App Controller Agent — Windows Installer
:: Run as Administrator

echo [install] Creating agent directory...
mkdir "C:\AppController" 2>nul
copy agent.py "C:\AppController\agent.py"
copy requirements.txt "C:\AppController\requirements.txt"

echo [install] Installing Python dependencies...
pip install -r "C:\AppController\requirements.txt" --quiet

echo [install] Registering as a Windows scheduled task...
schtasks /create /tn "AppControllerAgent" /tr "python C:\AppController\agent.py" /sc onlogon /ru SYSTEM /rl HIGHEST /f

echo [install] Starting agent...
schtasks /run /tn "AppControllerAgent"

echo [install] Done! Agent is running.
pause
