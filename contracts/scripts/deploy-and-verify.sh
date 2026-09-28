#!/bin/bash
# BidFlow Deployment Script for Arbitrum Sepolia
# Run this after funding the deployer wallet.

set -e

DEPLOYER="0xEF9BCCA0cb6E61a5563386cdE0539AeC3a1F8017"
REQUIRED_ETH="0.01"

echo "=== BidFlow Deployment ==="
echo "Deployer: $DEPLOYER"
echo ""

# Check balance
BALANCE=$(CHECK_ADDRESS="$DEPLOYER" npx hardhat run scripts/check-balance.ts --network arbitrumSepolia --no-compile 2>/dev/null | tail -1)

echo "Balance: $BALANCE ETH"
echo ""

# Check if balance is sufficient
HAS_FUNDS=$(node -e "console.log(parseFloat('$BALANCE') >= 0.005 ? 'yes' : 'no')")
if [ "$HAS_FUNDS" = "no" ]; then
  echo "ERROR: Deployer needs at least 0.005 ETH on Arbitrum Sepolia."
  echo ""
  echo "Fund this address: $DEPLOYER"
  echo ""
  echo "Faucets (open in browser):"
  echo "  - https://faucet.quicknode.com/arbitrum/sepolia"
  echo "  - https://faucets.chain.link/arbitrum-sepolia"
  echo ""
  echo "After funding, re-run this script."
  exit 1
fi

echo "Deploying BidFlow..."
npx hardhat run scripts/deploy.ts --network arbitrumSepolia

# Get deployed address
DEPLOYED=$(cat deployments/arbitrumSepolia.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).address)")
echo ""
echo "Deployed at: $DEPLOYED"

# Verify on Arbiscan via Etherscan API
if [ -n "$ETHERSCAN_API_KEY" ]; then
  echo ""
  echo "Verifying on Arbiscan..."
  npx hardhat verify --network arbitrumSepolia "$DEPLOYED" || echo "Verification failed (may need manual verification)"
else
  echo ""
  echo "Skipping verification (no ETHERSCAN_API_KEY set)."
  echo "To verify: npx hardhat verify --network arbitrumSepolia $DEPLOYED"
fi

echo ""
echo "=== Done ==="
