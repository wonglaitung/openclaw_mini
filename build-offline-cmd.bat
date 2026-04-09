@echo off
echo ========================================
echo OpenClaw Offline Build Script (Windows CMD)
echo ========================================
echo.

REM Set environment variables
set OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0
set OPENCLAW_BUILD_PROFILE=offline
set OPENCLAW_A2UI_SKIP_MISSING=1

echo [Config] Build parameters set:
echo   OPENCLAW_INCLUDE_OPTIONAL_BUNDLED=0
echo   OPENCLAW_BUILD_PROFILE=offline
echo   OPENCLAW_A2UI_SKIP_MISSING=1
echo.

REM Clean old build artifacts
echo [Clean] Removing old build artifacts...
if exist dist (
    rd /s /q dist
    echo   Deleted dist directory
)
echo.

REM Skip A2UI bundle (offline build)
echo [Skip] A2UI bundle (offline build mode)
echo.

REM Run build steps
echo ========================================
echo Starting build...
echo ========================================
echo.

call pnpm ui:build

echo [1/10] Running tsdown-build...
node scripts\tsdown-build.mjs
if %errorlevel% neq 0 (
    echo.
    echo ERROR: tsdown-build failed
    exit /b 1
)
echo   Done
echo.

echo [2/10] Running runtime-postbuild...
node scripts\runtime-postbuild.mjs
if %errorlevel% neq 0 (
    echo.
    echo ERROR: runtime-postbuild failed
    exit /b 1
)
echo   Done
echo.

echo [3/10] Building plugin SDK type definitions...
pnpm build:plugin-sdk:dts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: build:plugin-sdk:dts failed
    exit /b 1
)
echo   Done
echo.

echo [4/10] Writing plugin SDK entry type definitions...
node --import tsx scripts\write-plugin-sdk-entry-dts.ts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: write-plugin-sdk-entry-dts failed
    exit /b 1
)
echo   Done
echo.

echo [5/10] Copying canvas A2UI...
node --import tsx scripts\canvas-a2ui-copy.ts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: canvas-a2ui-copy failed
    exit /b 1
)
echo   Done
echo.

echo [6/10] Copying hook metadata...
node --import tsx scripts\copy-hook-metadata.ts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: copy-hook-metadata failed
    exit /b 1
)
echo   Done
echo.

echo [7/10] Copying export HTML templates...
node --import tsx scripts\copy-export-html-templates.ts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: copy-export-html-templates failed
    exit /b 1
)
echo   Done
echo.

echo [8/10] Writing build info...
node --import tsx scripts\write-build-info.ts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: write-build-info failed
    exit /b 1
)
echo   Done
echo.

echo [9/10] Writing CLI startup metadata...
node --import tsx scripts\write-cli-startup-metadata.ts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: write-cli-startup-metadata failed
    exit /b 1
)
echo   Done
echo.

echo [10/10] Writing CLI compatibility info...
node --import tsx scripts\write-cli-compat.ts
if %errorlevel% neq 0 (
    echo.
    echo ERROR: write-cli-compat failed
    exit /b 1
)
echo   Done
echo.

echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Build output location: dist\
echo.
echo Offline version features:
echo   - No messaging channels included
echo   - No optional plugins included
echo   - Minimal dependencies
echo   - Suitable for bank offline deployment
echo.
