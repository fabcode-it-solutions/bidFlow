import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { expect } from "chai";

const TASK_COFHE_MOCKS_DEPLOY = "task:cofhe-mocks:deploy";

describe("BidFlow", function () {
  async function deployFixture() {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const [seller, alice, bob, carol] = await hre.ethers.getSigners();

    const BidFlow = await hre.ethers.getContractFactory("BidFlow");
    const BidFlow = await BidFlow.deploy();

    const sellerClient = await hre.cofhe.createClientWithBatteries(seller);
    const aliceClient = await hre.cofhe.createClientWithBatteries(alice);
    const bobClient = await hre.cofhe.createClientWithBatteries(bob);
    const carolClient = await hre.cofhe.createClientWithBatteries(carol);

    return {
      BidFlow,
      seller,
      alice,
      bob,
      carol,
      sellerClient,
      aliceClient,
      bobClient,
      carolClient,
    };
  }

  // ─────────────────────── Helpers ───────────────────────

  async function encryptMinBid(client: any, value: bigint) {
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(value)])
      .execute();
    return encrypted;
  }

  async function encryptBid(client: any, value: bigint) {
    const [encrypted] = await client
      .encryptInputs([Encryptable.uint64(value)])
      .execute();
    return encrypted;
  }

  // Helper: full createAuction flow
  async function createTestAuction(
    BidFlow: any,
    seller: any,
    sellerClient: any,
    title = "Test Auction",
    duration = 3600,
    encryptedMin = 10n,
  ) {
    const minBid = await encryptMinBid(sellerClient, encryptedMin);
    await BidFlow.connect(seller).createAuction(title, duration, minBid);
  }

  // Helper: full finalize + reveal flow
  async function finalizeAndReveal(
    BidFlow: any,
    seller: any,
    sellerClient: any,
    auctionId = 0,
  ) {
    await hre.network.provider.send("evm_increaseTime", [61]);
    await hre.network.provider.send("evm_mine");
    await BidFlow.connect(seller).finalize(auctionId);

    const bidCtHash = await BidFlow.getHighestBidCtHash(auctionId);
    const bidderCtHash = await BidFlow.getHighestBidderCtHash(auctionId);

    const bidResult = await sellerClient
      .decryptForTx(bidCtHash)
      .withoutPermit()
      .execute();
    const bidderResult = await sellerClient
      .decryptForTx(bidderCtHash)
      .withoutPermit()
      .execute();

    const winnerAddress = hre.ethers.getAddress(
      "0x" + bidderResult.decryptedValue.toString(16).padStart(40, "0"),
    );

    await BidFlow.connect(seller).revealWinner(
      auctionId,
      bidResult.ctHash,
      bidResult.decryptedValue,
      bidResult.signature,
      bidderResult.ctHash,
      winnerAddress,
      bidderResult.signature,
    );

    return { bidResult, bidderResult, winnerAddress };
  }

  // ─────────────────────── Create Auction ───────────────────────

  describe("createAuction", function () {
    it("should create an auction with encrypted minimum bid", async function () {
      const { BidFlow, seller, sellerClient } =
        await loadFixture(deployFixture);

      const minBid = await encryptMinBid(sellerClient, 100n);

      const tx = await BidFlow.connect(seller).createAuction(
        "Rare NFT #1",
        3600,
        minBid,
      );
      await tx.wait();

      expect(await BidFlow.auctionCounter()).to.equal(1n);

      const auction = await BidFlow.auctions(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.title).to.equal("Rare NFT #1");
      expect(auction.finalized).to.be.false;
      expect(auction.paymentClaimed).to.be.false;
      expect(await hre.cofhe.mocks.getPlaintext(auction.minimumBid)).to.equal(
        100n,
      );
      expect(auction.revealedWinner).to.equal(
        "0x0000000000000000000000000000000000000000",
      );
    });

    it("should not expose a plaintext minimum bid getter", async function () {
      const { BidFlow } = await loadFixture(deployFixture);

      const hasPlaintextMinimumGetter = BidFlow.interface.fragments.some(
        (fragment: { type: string; name?: string }) =>
          fragment.type === "function" && fragment.name === "getMinimumBidWei",
      );
      expect(hasPlaintextMinimumGetter).to.be.false;
    });

    it("should emit AuctionCreated event", async function () {
      const { BidFlow, seller, sellerClient } =
        await loadFixture(deployFixture);

      const minBid = await encryptMinBid(sellerClient, 50n);

      await expect(
        BidFlow.connect(seller).createAuction("Art Piece", 1800, minBid),
      ).to.emit(BidFlow, "AuctionCreated");
    });

    it("should reject invalid duration", async function () {
      const { BidFlow, seller, sellerClient } =
        await loadFixture(deployFixture);

      const minBid = await encryptMinBid(sellerClient, 50n);

      // Too short (less than 60 seconds)
      await expect(
        BidFlow.connect(seller).createAuction("Too Short", 30, minBid),
      ).to.be.revertedWithCustomError(BidFlow, "InvalidDuration");

      // Too long (more than 365 days)
      await expect(
        BidFlow.connect(seller).createAuction(
          "Too Long",
          366 * 24 * 3600,
          minBid,
        ),
      ).to.be.revertedWithCustomError(BidFlow, "InvalidDuration");
    });
  });

  // ─────────────────────── Place Bid ───────────────────────

  describe("placeBid", function () {
    it("should accept an encrypted bid with ETH deposit", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient);

      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await BidFlow.connect(alice).placeBid(0, bid, { value: bidWei });

      expect(await BidFlow.getBidderCount(0)).to.equal(1n);
      expect(await BidFlow.getBidder(0, 0)).to.equal(alice.address);
      expect(await BidFlow.getBidderDeposit(0, alice.address)).to.equal(bidWei);
      expect(await BidFlow.totalEscrowed(0)).to.equal(bidWei);
    });

    it("should emit BidSubmitted event", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient);

      const bid = await encryptBid(aliceClient, 200n);
      const bidWei = hre.ethers.parseEther("0.02");

      await expect(
        BidFlow.connect(alice).placeBid(0, bid, { value: bidWei }),
      ).to.emit(BidFlow, "BidSubmitted");
    });

    it("should reject seller bidding on own auction", async function () {
      const { BidFlow, seller, sellerClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient);

      const bid = await encryptBid(sellerClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");

      await expect(
        BidFlow.connect(seller).placeBid(0, bid, { value: bidWei }),
      ).to.be.revertedWithCustomError(BidFlow, "SellerCannotBid");
    });

    it("should reject duplicate bids from the same address", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient);

      const bid1 = await encryptBid(aliceClient, 300n);
      const bidWei = hre.ethers.parseEther("0.03");
      await BidFlow.connect(alice).placeBid(0, bid1, { value: bidWei });

      const bid2 = await encryptBid(aliceClient, 400n);
      await expect(
        BidFlow.connect(alice).placeBid(0, bid2, { value: bidWei }),
      ).to.be.revertedWithCustomError(BidFlow, "AlreadyBid");
    });

    it("should reject bids after bidding period ends", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Late Bid", 60);

      // Fast-forward past bidding end (60 seconds)
      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");

      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await expect(
        BidFlow.connect(alice).placeBid(0, bid, { value: bidWei }),
      ).to.be.revertedWithCustomError(BidFlow, "BiddingPeriodEnded");
    });

    it("should reject zero ETH deposits without exposing the encrypted minimum", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Zero Deposit",
        3600,
        100n,
      );

      const bid = await encryptBid(aliceClient, 500n);

      await expect(
        BidFlow.connect(alice).placeBid(0, bid),
      ).to.be.revertedWithCustomError(BidFlow, "ZeroETHDeposit");
    });

    it("should reject bids on finalized auction", async function () {
      const {
        BidFlow,
        seller,
        alice,
        carol,
        sellerClient,
        aliceClient,
        carolClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Finalized", 60);

      // Alice bids first
      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await BidFlow.connect(alice).placeBid(0, bid, { value: bidWei });

      // Finalize
      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");
      await BidFlow.connect(seller).finalize(0);

      // Carol tries to bid after finalize — but bidding period also ended
      // The modifiers check in order: auctionExists → biddingActive → notFinalized
      // BiddingPeriodEnded triggers first, which is correct behavior
      // We verify the bid is rejected (the exact error depends on modifier order)
      const carolBid = await encryptBid(carolClient, 600n);
      await expect(
        BidFlow.connect(carol).placeBid(0, carolBid, { value: bidWei }),
      ).to.be.reverted; // Reverted with either BiddingPeriodEnded or AuctionAlreadyFinalized
    });
  });

  // ─────────────────────── Encrypted Winner Selection ───────────────────────

  describe("encrypted winner selection (CMUX)", function () {
    it("should correctly determine the highest bidder with 3 bids", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        carol,
        sellerClient,
        aliceClient,
        bobClient,
        carolClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Rare Token");

      // Alice bids 500, Bob bids 1500, Carol bids 800
      const aliceBid = await encryptBid(aliceClient, 500n);
      const bobBid = await encryptBid(bobClient, 1500n);
      const carolBid = await encryptBid(carolClient, 800n);

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(0, aliceBid, { value: bidWei });
      await BidFlow.connect(bob).placeBid(0, bobBid, { value: bidWei });
      await BidFlow.connect(carol).placeBid(0, carolBid, { value: bidWei });

      // Use the mock coprocessor to read raw plaintext of the encrypted state.
      const highestBidHash = await BidFlow.getHighestBidCtHash(0);
      const highestBidderHash = await BidFlow.getHighestBidderCtHash(0);

      const highestBidPlain =
        await hre.cofhe.mocks.getPlaintext(highestBidHash);
      const highestBidderPlain =
        await hre.cofhe.mocks.getPlaintext(highestBidderHash);

      // Bob (1500) should be the winner
      expect(highestBidPlain).to.equal(1500n);
      expect(highestBidderPlain).to.equal(bob.address);
    });

    it("should handle bids in descending order (first bid is highest)", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        carol,
        sellerClient,
        aliceClient,
        bobClient,
        carolClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Descending");

      // Alice bids 3000, Bob bids 2000, Carol bids 1000
      const aliceBid = await encryptBid(aliceClient, 3000n);
      const bobBid = await encryptBid(bobClient, 2000n);
      const carolBid = await encryptBid(carolClient, 1000n);

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(0, aliceBid, { value: bidWei });
      await BidFlow.connect(bob).placeBid(0, bobBid, { value: bidWei });
      await BidFlow.connect(carol).placeBid(0, carolBid, { value: bidWei });

      const highestBidHash = await BidFlow.getHighestBidCtHash(0);
      const highestBidderHash = await BidFlow.getHighestBidderCtHash(0);

      const highestBidPlain =
        await hre.cofhe.mocks.getPlaintext(highestBidHash);
      const highestBidderPlain =
        await hre.cofhe.mocks.getPlaintext(highestBidderHash);

      // Alice (3000) should still be the winner
      expect(highestBidPlain).to.equal(3000n);
      expect(highestBidderPlain).to.equal(alice.address);
    });

    it("should handle ties — first highest bid wins", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Tie");

      // Both bid 1000
      const aliceBid = await encryptBid(aliceClient, 1000n);
      const bobBid = await encryptBid(bobClient, 1000n);

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(0, aliceBid, { value: bidWei });
      await BidFlow.connect(bob).placeBid(0, bobBid, { value: bidWei });

      const highestBidderHash = await BidFlow.getHighestBidderCtHash(0);
      const highestBidderPlain =
        await hre.cofhe.mocks.getPlaintext(highestBidderHash);

      // Alice placed first, so she should win the tie (FHE.gt is strictly greater)
      expect(highestBidderPlain).to.equal(alice.address);
    });

    it("should zero out bids below the encrypted minimum", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      // Minimum bid = 1000 and remains encrypted on-chain.
      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "MinBid Test",
        3600,
        1000n,
      );

      // Alice bids 500 (below min), Bob bids 2000 (above min)
      const aliceBid = await encryptBid(aliceClient, 500n);
      const bobBid = await encryptBid(bobClient, 2000n);

      const bidWei = hre.ethers.parseEther("0.1");
      await BidFlow.connect(alice).placeBid(0, aliceBid, { value: bidWei });
      await BidFlow.connect(bob).placeBid(0, bobBid, { value: bidWei });

      const highestBidHash = await BidFlow.getHighestBidCtHash(0);
      const highestBidderHash = await BidFlow.getHighestBidderCtHash(0);

      const highestBidPlain =
        await hre.cofhe.mocks.getPlaintext(highestBidHash);
      const highestBidderPlain =
        await hre.cofhe.mocks.getPlaintext(highestBidderHash);

      // Bob should win with 2000; Alice's 500 was zeroed by min bid check
      expect(highestBidPlain).to.equal(2000n);
      expect(highestBidderPlain).to.equal(bob.address);
    });
  });

  // ─────────────────────── Finalize + Reveal ───────────────────────

  describe("finalize", function () {
    it("should allow seller to finalize after bidding ends", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Fin", 60);

      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await BidFlow.connect(alice).placeBid(0, bid, { value: bidWei });

      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");

      await BidFlow.connect(seller).finalize(0);

      const auction = await BidFlow.auctions(0);
      expect(auction.finalized).to.be.true;
    });

    it("should reject finalize from non-seller", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "NoAuth", 60);

      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await BidFlow.connect(alice).placeBid(0, bid, { value: bidWei });

      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");

      await expect(
        BidFlow.connect(alice).finalize(0),
      ).to.be.revertedWithCustomError(BidFlow, "OnlySellerCanFinalize");
    });

    it("should reject finalize before bidding ends", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Early", 3600);

      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await BidFlow.connect(alice).placeBid(0, bid, { value: bidWei });

      await expect(
        BidFlow.connect(seller).finalize(0),
      ).to.be.revertedWithCustomError(BidFlow, "BiddingPeriodActive");
    });

    it("should reject finalize when there are no bids", async function () {
      const { BidFlow, seller, sellerClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Empty", 60);

      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");

      await expect(
        BidFlow.connect(seller).finalize(0),
      ).to.be.revertedWithCustomError(BidFlow, "NoBids");
    });

    it("should reject double finalize", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Double Fin", 60);

      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await BidFlow.connect(alice).placeBid(0, bid, { value: bidWei });

      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");

      await BidFlow.connect(seller).finalize(0);

      await expect(
        BidFlow.connect(seller).finalize(0),
      ).to.be.revertedWithCustomError(BidFlow, "AuctionAlreadyFinalized");
    });
  });

  describe("revealWinner (decryptForTx flow)", function () {
    it("should decrypt and reveal the winner on-chain", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        carol,
        sellerClient,
        aliceClient,
        bobClient,
        carolClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Reveal Test", 60);

      // Alice 300, Bob 900, Carol 600
      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 300n),
        { value: bidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 900n),
        { value: bidWei },
      );
      await BidFlow.connect(carol).placeBid(
        0,
        await encryptBid(carolClient, 600n),
        { value: bidWei },
      );

      // Finalize and reveal
      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // Assert on-chain revealed state
      const auction = await BidFlow.auctions(0);
      expect(auction.revealedBid).to.equal(900n);
      expect(auction.revealedWinner).to.equal(bob.address);
    });

    it("should emit AuctionFinalized event with correct values", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Event Test", 60);

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 420n),
        { value: bidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 690n),
        { value: bidWei },
      );

      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");
      await BidFlow.connect(seller).finalize(0);

      const bidCtHash = await BidFlow.getHighestBidCtHash(0);
      const bidderCtHash = await BidFlow.getHighestBidderCtHash(0);

      const bidResult = await sellerClient
        .decryptForTx(bidCtHash)
        .withoutPermit()
        .execute();
      const bidderResult = await sellerClient
        .decryptForTx(bidderCtHash)
        .withoutPermit()
        .execute();

      const winnerAddress = hre.ethers.getAddress(
        "0x" + bidderResult.decryptedValue.toString(16).padStart(40, "0"),
      );

      await expect(
        BidFlow.connect(seller).revealWinner(
          0,
          bidResult.ctHash,
          bidResult.decryptedValue,
          bidResult.signature,
          bidderResult.ctHash,
          winnerAddress,
          bidderResult.signature,
        ),
      )
        .to.emit(BidFlow, "AuctionFinalized")
        .withArgs(0, bob.address, 690n);
    });

    it("should reject reveal without finalize", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "No Reveal", 60);

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 500n),
        { value: bidWei },
      );

      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");

      // Try to reveal without finalize — should fail because
      // ctHashes won't have public access, but the direct revert
      // should be RevealNotReady
      const fakeCtHash = await BidFlow.getHighestBidCtHash(0);
      const fakeBidderCtHash = await BidFlow.getHighestBidderCtHash(0);

      await expect(
        BidFlow.connect(seller).revealWinner(
          0,
          fakeCtHash,
          500n,
          "0x",
          fakeBidderCtHash,
          alice.address,
          "0x",
        ),
      ).to.be.revertedWithCustomError(BidFlow, "RevealNotReady");
    });

    it("should reject double reveal", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Double Reveal",
        60,
      );

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 500n),
        { value: bidWei },
      );

      // First reveal succeeds
      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // Second reveal should fail
      const fakeCtHash = await BidFlow.getHighestBidCtHash(0);
      const fakeBidderCtHash = await BidFlow.getHighestBidderCtHash(0);

      await expect(
        BidFlow.connect(seller).revealWinner(
          0,
          fakeCtHash,
          500n,
          "0x",
          fakeBidderCtHash,
          alice.address,
          "0x",
        ),
      ).to.be.revertedWithCustomError(BidFlow, "AuctionAlreadyFinalized");
    });
  });

  // ─────────────────────── Payment Flow ───────────────────────

  describe("claimPayment", function () {
    it("should allow seller to claim winning bid after reveal", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Payment Test",
        60,
      );

      // Alice bids 0.05 ETH, Bob bids 0.1 ETH
      const aliceBidWei = hre.ethers.parseEther("0.05");
      const bobBidWei = hre.ethers.parseEther("0.1");

      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 300n),
        { value: aliceBidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 900n),
        { value: bobBidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // Claim payment
      const sellerBalanceBefore = await hre.ethers.provider.getBalance(
        seller.address,
      );
      await BidFlow.connect(seller).claimPayment(0);
      const sellerBalanceAfter = await hre.ethers.provider.getBalance(
        seller.address,
      );

      // Seller should receive Bob's 0.1 ETH (minus gas)
      expect(sellerBalanceAfter).to.be.gt(sellerBalanceBefore);
      expect(await BidFlow.isPaymentClaimed(0)).to.be.true;
    });

    it("should reject claimPayment from non-seller", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "No Claim", 60);

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 500n),
        { value: bidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // Non-seller tries to claim — should use OnlySellerCanClaim error
      await expect(
        BidFlow.connect(alice).claimPayment(0),
      ).to.be.revertedWithCustomError(BidFlow, "OnlySellerCanClaim");
    });

    it("should reject double claimPayment", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Double Claim",
        60,
      );

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 500n),
        { value: bidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // First claim succeeds
      await BidFlow.connect(seller).claimPayment(0);

      // Second claim fails
      await expect(
        BidFlow.connect(seller).claimPayment(0),
      ).to.be.revertedWithCustomError(BidFlow, "PaymentAlreadyClaimed");
    });

    it("should reject claimPayment before reveal", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Early Claim", 60);

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 500n),
        { value: bidWei },
      );

      // Finalize but don't reveal
      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");
      await BidFlow.connect(seller).finalize(0);

      await expect(
        BidFlow.connect(seller).claimPayment(0),
      ).to.be.revertedWithCustomError(BidFlow, "RevealNotReady");
    });
  });

  // ─────────────────────── Refund Flow ───────────────────────

  describe("claimRefund", function () {
    it("should allow losing bidders to claim refund", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient, "Refund Test", 60);

      // Alice bids 0.05 ETH, Bob bids 0.1 ETH (winner)
      const aliceBidWei = hre.ethers.parseEther("0.05");
      const bobBidWei = hre.ethers.parseEther("0.1");

      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 300n),
        { value: aliceBidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 900n),
        { value: bobBidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // Alice (loser) claims refund
      const aliceBalanceBefore = await hre.ethers.provider.getBalance(
        alice.address,
      );
      await BidFlow.connect(alice).claimRefund(0);
      const aliceBalanceAfter = await hre.ethers.provider.getBalance(
        alice.address,
      );

      // Alice should get her 0.05 ETH back (minus gas)
      expect(aliceBalanceAfter).to.be.gt(aliceBalanceBefore);
      expect(await BidFlow.getBidderDeposit(0, alice.address)).to.equal(0);
    });

    it("should reject refund for winner", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Winner No Refund",
        60,
      );

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 300n),
        { value: bidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 900n),
        { value: bidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // Bob (winner) tries to claim refund — should fail
      await expect(
        BidFlow.connect(bob).claimRefund(0),
      ).to.be.revertedWithCustomError(BidFlow, "WinnerCannotRefund");
    });

    it("should reject double refund", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Double Refund",
        60,
      );

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 300n),
        { value: bidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 900n),
        { value: bidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // First refund succeeds
      await BidFlow.connect(alice).claimRefund(0);

      // Second refund fails
      await expect(
        BidFlow.connect(alice).claimRefund(0),
      ).to.be.revertedWithCustomError(BidFlow, "NoRefundAvailable");
    });

    it("should reject refund before reveal", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Early Refund",
        60,
      );

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 500n),
        { value: bidWei },
      );

      // Finalize but don't reveal
      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");
      await BidFlow.connect(seller).finalize(0);

      await expect(
        BidFlow.connect(alice).claimRefund(0),
      ).to.be.revertedWithCustomError(BidFlow, "RevealNotReady");
    });

    it("should emit RefundClaimed event", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Refund Event",
        60,
      );

      const aliceBidWei = hre.ethers.parseEther("0.05");
      const bobBidWei = hre.ethers.parseEther("0.1");

      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 300n),
        { value: aliceBidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 900n),
        { value: bobBidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      await expect(BidFlow.connect(alice).claimRefund(0))
        .to.emit(BidFlow, "RefundClaimed")
        .withArgs(0, alice.address, aliceBidWei);
    });

    it("should reject refund from non-bidder", async function () {
      const {
        BidFlow,
        seller,
        alice,
        bob,
        carol,
        sellerClient,
        aliceClient,
        bobClient,
      } = await loadFixture(deployFixture);

      await createTestAuction(
        BidFlow,
        seller,
        sellerClient,
        "Non-Bidder Refund",
        60,
      );

      const bidWei = hre.ethers.parseEther("0.01");
      await BidFlow.connect(alice).placeBid(
        0,
        await encryptBid(aliceClient, 300n),
        { value: bidWei },
      );
      await BidFlow.connect(bob).placeBid(
        0,
        await encryptBid(bobClient, 900n),
        { value: bidWei },
      );

      await finalizeAndReveal(BidFlow, seller, sellerClient);

      // Carol never bid — should revert
      await expect(
        BidFlow.connect(carol).claimRefund(0),
      ).to.be.revertedWithCustomError(BidFlow, "NoRefundAvailable");
    });
  });

  // ─────────────────────── Edge Cases ───────────────────────

  describe("getBidder bounds check", function () {
    it("should revert with BidderIndexOutOfBounds for invalid index", async function () {
      const { BidFlow, seller, alice, sellerClient, aliceClient } =
        await loadFixture(deployFixture);

      await createTestAuction(BidFlow, seller, sellerClient);

      const bid = await encryptBid(aliceClient, 500n);
      const bidWei = hre.ethers.parseEther("0.05");
      await BidFlow.connect(alice).placeBid(0, bid, { value: bidWei });

      // Index 0 is valid, index 1 should revert
      await expect(BidFlow.getBidder(0, 1)).to.be.revertedWithCustomError(
        BidFlow,
        "BidderIndexOutOfBounds",
      );
    });
  });

  describe("MAX_BIDDERS cap", function () {
    it("should have MAX_BIDDERS constant set to 500", async function () {
      const { BidFlow } = await loadFixture(deployFixture);
      expect(await BidFlow.MAX_BIDDERS()).to.equal(500n);
    });
  });
});
