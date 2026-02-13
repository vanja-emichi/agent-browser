#!/bin/bash
# deploy.sh - Deploy agent-browser to Agent Zero
# Usage: ./deploy.sh [A0_ROOT]
#
# 1. Installs agent-browser CLI from this fork (npm)
# 2. Copies A0 integration files (agent profile, prompts, extension)
#
# Default A0_ROOT: /a0 (inside container)
# For host deployment, pass the A0 root path.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
A0_ROOT="${1:-/a0}"

echo "Deploying agent-browser to Agent Zero..."
echo " Source: $SCRIPT_DIR"
echo " Target: $A0_ROOT"
echo ""

# Step 1: Install CLI from fork
echo "Installing agent-browser CLI..."
npm install -g "${SCRIPT_DIR}" 2>&1 | tail -3
echo " ✓ CLI installed: $(agent-browser --version 2>/dev/null || echo 'version check skipped')"

# Step 2: Copy agent profile
echo ""
echo "Deploying A0 integration files..."

# Browser agent profile
mkdir -p "${A0_ROOT}/agents/browser/prompts"
mkdir -p "${A0_ROOT}/agents/browser/extensions/agent_init"

cp "${SCRIPT_DIR}/agents/browser/agent.json" "${A0_ROOT}/agents/browser/agent.json"
cp "${SCRIPT_DIR}/agents/browser/_context.md" "${A0_ROOT}/agents/browser/_context.md"
cp "${SCRIPT_DIR}/agents/browser/prompts/agent.system.main.role.md" "${A0_ROOT}/agents/browser/prompts/agent.system.main.role.md"
cp "${SCRIPT_DIR}/agents/browser/extensions/agent_init/_10_use_browser_model.py" "${A0_ROOT}/agents/browser/extensions/agent_init/_10_use_browser_model.py"
echo " ✓ Browser agent profile deployed"

# Prompts
cp "${SCRIPT_DIR}/prompts/agent.system.tool.browser.md" "${A0_ROOT}/prompts/agent.system.tool.browser.md"
cp "${SCRIPT_DIR}/prompts/browser_agent.system.md" "${A0_ROOT}/prompts/browser_agent.system.md"
echo " ✓ Browser prompts deployed"



# Vision tool
mkdir -p "${A0_ROOT}/python/tools"
cp "${SCRIPT_DIR}/python/tools/vision_load.py" "${A0_ROOT}/python/tools/vision_load.py"
echo "  ✓ Vision load tool deployed"

cp "${SCRIPT_DIR}/prompts/agent.system.tools_vision.md" "${A0_ROOT}/prompts/agent.system.tools_vision.md"
echo "  ✓ Vision prompt deployed"
echo ""
echo "Done. Agent-browser deployed to ${A0_ROOT}"
echo ""
echo "Files deployed:"
echo " ${A0_ROOT}/agents/browser/ (agent profile + extensions)"
echo " ${A0_ROOT}/prompts/ (tool + system prompts)"
echo " /usr/local/lib/node_modules/agent-browser/ (CLI)"
