@echo off
chcp 65001 >nul
title MOZA Live OS
cd /d "%~dp0.."

rem  Chay MOZA Live OS (SPEC.md F-01).
rem  --nen : chay tu dong luc mo may (Task Scheduler / thu muc Startup), khong mo trinh duyet.
rem  Phan mem bi tat ngang (loi, hoac End task trong Task Manager) thi tu chay lai sau 3 giay.
rem  Muon dung han: dong cua so nay.

set "NEN="
if /i "%~1"=="--nen" set "NEN=1"

echo.
echo   MOZA Live OS — dang khoi dong...
echo   Thu muc: %cd%
echo.

rem ---- 1. Node.js 26 tro len ----
where node >nul 2>nul
if errorlevel 1 goto khongCoNode
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 26 ? 0 : 1)"
if errorlevel 1 goto nodeCu

rem ---- 2. Thu vien: thieu hoac chua khop package.json thi cai lai ----
call npm ls --depth=0 >nul 2>nul
if errorlevel 1 (
  echo   Cai thu vien, doi mot chut...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 goto caiHong
  echo.
)

rem ---- 3. Tao .env neu chua co ----
if not exist ".env" copy ".env.example" ".env" >nul

rem ---- 4. Mo trinh duyet mot lan (khong mo khi tu chay luc mo may) ----
if not defined NEN start "" /min cmd /c "timeout /t 4 /nobreak >nul & start "" http://127.0.0.1:5173"

echo   Dia chi: http://127.0.0.1:5173
echo   DUNG DONG CUA SO NAY trong luc dang dung phan mem.
echo.

rem ---- 5. Chay, bi tat ngang thi tu chay lai ----
:chay
node server/index.js
set "MA=%errorlevel%"
rem Ma 0: tu dung (Ctrl + C). Ma 3: loi nguoi dung phai xu ly (vd cong dang bi giu) — khong chay lai.
if "%MA%"=="0" goto daDung
if "%MA%"=="3" goto dungHan
echo.
echo   Phan mem vua bi tat (ma %MA%). Tu chay lai sau 3 giay... Muon dung han thi dong cua so nay.
echo.
rem ping thay cho timeout: timeout loi ngay khi khong co cua so nhap (tu chay luc mo may).
ping -n 4 127.0.0.1 >nul
goto chay

:daDung
echo.
echo   Phan mem da dung.
if not defined NEN pause
exit /b 0

:dungHan
echo.
echo   ================================================
echo   Phan mem khong chay duoc. Doc dong chu phia tren de biet cach xu ly.
echo   ================================================
if not defined NEN pause
exit /b 3

rem ================= cac truong hop hong =================

:khongCoNode
echo   [!] May nay chua cai Node.js.
echo.
echo       Vao https://nodejs.org tai ban 26 tro len, cai xong bam dup file nay lan nua.
echo.
if not defined NEN pause
exit /b 1

:nodeCu
echo   [!] May dang co Node.js cu hon ban 26.
echo.
echo       Vao https://nodejs.org tai ban 26 tro len, cai de len ban cu,
echo       roi bam dup file nay lan nua.
echo.
if not defined NEN pause
exit /b 1

:caiHong
echo.
echo   [!] Cai thu vien that bai.
echo       Thuong la do mang. Kiem tra mang roi chay lai file nay.
echo.
if not defined NEN pause
exit /b 1
