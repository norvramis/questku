@echo off
rem Questku Relay - double-click to start (minimized). Keep the taskbar window while the script runs.
start "" powershell -NoProfile -WindowStyle Minimized -ExecutionPolicy Bypass -File "%~dp0relay.ps1"