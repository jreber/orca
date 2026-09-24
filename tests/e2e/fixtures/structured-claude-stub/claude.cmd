@echo off
set "CLAUDE_STUB_ENTRY=%~f0"
node "%~dp0claude-stub.cjs" %*
