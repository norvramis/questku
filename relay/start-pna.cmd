@echo off
rem Questku - enable Chrome Private Network Access for the relay.
rem Double-click this; when the UAC prompt appears choose Yes, then press Enter to finish.
rem Writes the Chrome policy once, then restart Chrome.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%~dp0enable-pna.ps1'"
pause