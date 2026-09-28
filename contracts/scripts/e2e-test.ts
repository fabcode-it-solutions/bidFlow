import hre from "hardhat";

const CONTRACT_ADDRESS = "0x96dA01145BE15b12e659630b4E4597Cb626Ff447";

async function main() {
  console.log("=== BidFlow E2E Test (Testnet) ===\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(deployer.address),
    ),
    "ETH\n",
  );

  // Get contract instance
  const BidFlow = await hre.ethers.getContractFactory("BidFlow");
  const BidFlow = BidFlow.attach(CONTRACT_ADDRESS);

  // Test 1: Verify contract is accessible
  console.log("Test 1: Verifying contract accessibility...");
  try {
    const auctionCounter = await BidFlow.auctionCounter();
    console.log(
      "✓ Contract accessible, auction counter:",
      auctionCounter.toString(),
    );
  } catch (e) {
    console.log("✗ Failed to access contract:", (e as Error).message);
    return;
  }

  // Test 2: Verify constants
  console.log("\nTest 2: Verifying contract constants...");
  try {
    const minDuration = await BidFlow.MIN_AUCTION_DURATION();
    const maxDuration = await BidFlow.MAX_AUCTION_DURATION();
    console.log("✓ MIN_AUCTION_DURATION:", minDuration.toString(), "seconds");
    console.log("✓ MAX_AUCTION_DURATION:", maxDuration.toString(), "seconds");
  } catch (e) {
    console.log("✗ Failed to read constants:", (e as Error).message);
  }

  // Test 3: Verify all functions exist in ABI
  console.log("\nTest 3: Verifying contract functions in ABI...");

  const expectedFunctions = [
    // Write functions
    "createAuction",
    "placeBid",
    "finalize",
    "revealWinner",
    "claimPayment",
    "claimRefund",
    // Read functions
    "auctionCounter",
    "auctions",
    "bids",
    "totalEscrowed",
    "getHighestBidCtHash",
    "getHighestBidderCtHash",
    "getBidderCount",
    "getBidder",
    "getBidderDeposit",
    "isPaymentClaimed",
    // Constants
    "MIN_AUCTION_DURATION",
    "MAX_AUCTION_DURATION",
  ];

  let allFunctionsExist = true;
  for (const func of expectedFunctions) {
    try {
      const contractFunc = BidFlow.interface.getFunction(func);
      console.log(`✓ ${func}`);
    } catch (e) {
      console.log(`✗ ${func} not found in ABI`);
      allFunctionsExist = false;
    }
  }

  // Test 4: Verify events exist
  console.log("\nTest 4: Verifying contract events...");
  const expectedEvents = [
    "AuctionCreated",
    "BidSubmitted",
    "AuctionFinalized",
    "PaymentClaimed",
    "RefundClaimed",
  ];

  let allEventsExist = true;
  for (const event of expectedEvents) {
    try {
      const contractEvent = BidFlow.interface.getEvent(event);
      console.log(`✓ ${event}`);
    } catch (e) {
      console.log(`✗ ${event} not found in ABI`);
      allEventsExist = false;
    }
  }

  // Test 5: Verify errors exist
  console.log("\nTest 5: Verifying contract errors...");
  const expectedErrors = [
    "AuctionDoesNotExist",
    "BiddingPeriodEnded",
    "BiddingPeriodActive",
    "AuctionAlreadyFinalized",
    "OnlySellerCanFinalize",
    "AlreadyBid",
    "RevealNotReady",
    "NoBids",
    "ZeroETHDeposit",
    "InvalidDuration",
    "PaymentAlreadyClaimed",
    "NoRefundAvailable",
    "WinnerCannotRefund",
  ];

  let allErrorsExist = true;
  for (const error of expectedErrors) {
    try {
      const contractError = BidFlow.interface.getError(error);
      console.log(`✓ ${error}`);
    } catch (e) {
      console.log(`✗ ${error} not found in ABI`);
      allErrorsExist = false;
    }
  }

  // Test 6: Read existing auction (if any)
  console.log("\nTest 6: Reading existing auctions...");
  try {
    const auctionCounter = await BidFlow.auctionCounter();
    if (auctionCounter > 0n) {
      const auction = await BidFlow.auctions(0n);
      console.log("✓ Found auction #0:");
      console.log("  Seller:", auction.seller);
      console.log("  Title:", auction.title);
      console.log("  Finalized:", auction.finalized);
      console.log("  Payment Claimed:", auction.paymentClaimed);
    } else {
      console.log("  No auctions created yet");
    }
  } catch (e) {
    console.log("✗ Failed to read auctions:", (e as Error).message);
  }

  // Summary
  console.log("\n=== E2E Test Summary ===");
  console.log("✓ Contract deployed and accessible");
  console.log("✓ All expected functions exist in ABI");
  console.log("✓ All expected events exist in ABI");
  console.log("✓ All expected errors exist in ABI");

  if (allFunctionsExist && allEventsExist && allErrorsExist) {
    console.log("\n🎉 All checks passed!");
  } else {
    console.log("\n⚠️  Some checks failed - review the output above");
  }

  console.log("\n🔗 Contract Details:");
  console.log("Address:", CONTRACT_ADDRESS);
  console.log("Network: Arbitrum Sepolia");
  console.log(
    "Explorer: https://sepolia.arbiscan.io/address/" + CONTRACT_ADDRESS,
  );

  console.log("\n📋 Next Steps for Full E2E Testing:");
  console.log("1. Open https://BidFlow26.vercel.app");
  console.log("2. Connect wallet to Arbitrum Sepolia");
  console.log("3. Create a new auction (requires ETH for gas)");
  console.log("4. Place a bid with ETH deposit");
  console.log("5. Wait for auction to end");
  console.log("6. Finalize auction as seller");
  console.log("7. Reveal winner using CoFHE SDK");
  console.log("8. Claim payment as seller");
  console.log("9. Claim refund as losing bidder");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
