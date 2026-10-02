@echo off
cd /d "%~dp0"
py -3.11 --version >nul 2>&1
if errorlevel 1 (
 echo Install Python 3.11 from python.org first.
 pause
 exit /b 1
)
py -3.11 -m venv .venv
if errorlevel 1 goto failed
.venv\Scripts\python -m pip install --upgrade pip
if errorlevel 1 goto failed
.venv\Scripts\python -m pip install torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121
if errorlevel 1 goto failed
.venv\Scripts\python -m pip install demucs==4.0.1 "numpy<2" soundfile==0.13.1
if errorlevel 1 goto failed
.venv\Scripts\python -c "import torch; assert torch.cuda.is_available(), 'NVIDIA CUDA is unavailable'; print(torch.cuda.get_device_name(0))"
if errorlevel 1 goto failed
echo Installation finished. Run Start.cmd.
pause
exit /b 0
:failed
echo Installation failed. Save the error displayed above.
pause
exit /b 1
