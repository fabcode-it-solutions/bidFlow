import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useCofheClient } from "@cofhe/react";
import { getAddress } from "viem";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Eye,
  Gavel,
  LoaderCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { EmptyState } from "../components";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";
import { parseAuction, ZERO_ADDRESS } from "../utils/auction";
import { formatEth, shortAddr } from "../utils/format";
import { useCurrentTimestamp } from "../hooks/useCurrentTimestamp";

const CT_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

type RevealStage = "idle" | "loading" | "decrypting" | "publishing";

type RevealResult = {
  bid: bigint;
  winner: `0x${string}`;
};

export function RevealCenter() {
  const { address } = useAccount();
  const now = useCurrentTimestamp();

  const { data: auctionCounter, isLoading: isLoadingCounter } = useReadContract(
    {
      address: BidFlow_ADDRESS,
      abi: BidFlow_ABI,
      functionName: "auctionCounter",
    },
  );

  const totalAuctions = auctionCounter ? Number(auctionCounter) : 0;
  const auctionIds = useMemo(
    () => Array.from({ length: totalAuctions }, (_, i) => i),
    [totalAuctions],
  );

  return (
    <div className="sb-page-new">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sb-page-new__header"
      >
        <Eye size={24} className="icon-cipher" />
        <div>
          <h1 className="sb-page-new__title">Reveal Center</h1>
          <p className="sb-page-new__sub">
            Decrypt finalized winner handles and publish verified results
            on-chain
          </p>
        </div>
      </motion.div>

      {!address ? (
        <EmptyState
          icon={Wallet}
          title="Wallet not connected"
          description="Connect your wallet to decrypt finalized winner handles and publish the result."
        />
      ) : (
        <>
          <RevealForm />

          {isLoadingCounter ? (
            <div className="sb-table-empty">Loading...</div>
          ) : totalAuctions === 0 ? (
            <EmptyState
              icon={Gavel}
              title="No auctions yet"
              description="Auctions will appear here once they are finalized and ready for reveal."
            />
          ) : (
            <div className="sb-dashboard-table-card">
              <div className="sb-table-scroll">
                <table className="sb-dashboard-table">
                  <thead>
                    <tr>
                      <th>Auction</th>
                      <th>Phase</th>
                      <th>Bidders</th>
                      <th>Winner</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {auctionIds.map((id) => (
                      <RevealRow key={id} auctionId={id} now={now} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RevealForm() {
  const publicClient = usePublicClient();
  const cofheClient = useCofheClient();
  const [auctionIdInput, setAuctionIdInput] = useState("");
  const [bidCtHash, setBidCtHash] = useState("");
  const [winnerCtHash, setWinnerCtHash] = useState("");
  const [stage, setStage] = useState<RevealStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RevealResult | null>(null);

  const {
    data: hash,
    error: txError,
    isPending: isTxPending,
    writeContractAsync,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const parseAuctionId = useCallback(() => {
    const value = auctionIdInput.trim();
    if (!/^\d+$/.test(value))
      throw new Error("Enter a valid numeric auction ID.");
    return BigInt(value);
  }, [auctionIdInput]);

  const readCanonicalHandles = useCallback(
    async (auctionId: bigint) => {
      if (!publicClient) throw new Error("Blockchain client is not ready.");

      const [auction, canonicalBidCtHash, canonicalWinnerCtHash] =
        await Promise.all([
          publicClient.readContract({
            address: BidFlow_ADDRESS,
            abi: BidFlow_ABI,
            functionName: "auctions",
            args: [auctionId],
          }),
          publicClient.readContract({
            address: BidFlow_ADDRESS,
            abi: BidFlow_ABI,
            functionName: "getHighestBidCtHash",
            args: [auctionId],
          }),
          publicClient.readContract({
            address: BidFlow_ADDRESS,
            abi: BidFlow_ABI,
            functionName: "getHighestBidderCtHash",
            args: [auctionId],
          }),
        ]);

      const auctionData = parseAuction(auction as unknown[], Number(auctionId));
      if (!auctionData) throw new Error("Auction data could not be decoded.");
      if (!auctionData.finalized)
        throw new Error("Finalize this auction before revealing the winner.");
      if (auctionData.revealedWinner !== ZERO_ADDRESS)
        throw new Error("This auction winner is already revealed.");

      return {
        bid: canonicalBidCtHash as `0x${string}`,
        winner: canonicalWinnerCtHash as `0x${string}`,
      };
    },
    [publicClient],
  );

  const handleLoadHandles = useCallback(async () => {
    try {
      setStage("loading");
      setError(null);
      setResult(null);
      const auctionId = parseAuctionId();
      const handles = await readCanonicalHandles(auctionId);
      setBidCtHash(handles.bid);
      setWinnerCtHash(handles.winner);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load encrypted winner handles.",
      );
    } finally {
      setStage("idle");
    }
  }, [parseAuctionId, readCanonicalHandles]);

  const handleReveal = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      try {
        setError(null);
        setResult(null);
        const auctionId = parseAuctionId();
        const bidHandle = bidCtHash.trim();
        const winnerHandle = winnerCtHash.trim();

        if (
          !CT_HASH_PATTERN.test(bidHandle) ||
          !CT_HASH_PATTERN.test(winnerHandle)
        ) {
          throw new Error(
            "Both encrypted handles must be 32-byte 0x-prefixed ciphertext hashes.",
          );
        }
        if (!cofheClient) throw new Error("CoFHE client is not ready.");

        setStage("loading");
        const canonicalHandles = await readCanonicalHandles(auctionId);
        if (
          canonicalHandles.bid.toLowerCase() !== bidHandle.toLowerCase() ||
          canonicalHandles.winner.toLowerCase() !== winnerHandle.toLowerCase()
        ) {
          throw new Error(
            "Encrypted handles do not match the selected auction.",
          );
        }

        setStage("decrypting");
        const [bidResult, winnerResult] = await Promise.all([
          cofheClient.decryptForTx(bidHandle).withoutPermit().execute(),
          cofheClient.decryptForTx(winnerHandle).withoutPermit().execute(),
        ]);

        const winnerAddress = getAddress(
          `0x${winnerResult.decryptedValue.toString(16).padStart(40, "0")}`,
        );
        setResult({ bid: bidResult.decryptedValue, winner: winnerAddress });

        setStage("publishing");
        await writeContractAsync({
          address: BidFlow_ADDRESS,
          abi: BidFlow_ABI,
          functionName: "revealWinner",
          args: [
            auctionId,
            bidResult.ctHash,
            bidResult.decryptedValue,
            bidResult.signature,
            winnerResult.ctHash,
            winnerAddress,
            winnerResult.signature,
          ],
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to decrypt and publish the winner.",
        );
      } finally {
        setStage("idle");
      }
    },
    [
      bidCtHash,
      cofheClient,
      parseAuctionId,
      readCanonicalHandles,
      winnerCtHash,
      writeContractAsync,
    ],
  );

  useEffect(() => {
    if (hash) toast.loading("Publishing verified reveal...", { id: hash });
  }, [hash]);

  useEffect(() => {
    if (isConfirmed && hash)
      toast.success("Winner revealed on-chain.", { id: hash });
  }, [hash, isConfirmed]);

  useEffect(() => {
    if (!txError) return;
    const message = txError.message || "Reveal transaction failed.";
    toast.error(message);
  }, [txError]);

  const isBusy = stage !== "idle" || isTxPending || isConfirming;
  const actionLabel =
    stage === "loading"
      ? "Validating handles..."
      : stage === "decrypting"
        ? "Decrypting with Threshold Network..."
        : stage === "publishing" || isTxPending
          ? "Confirm in wallet..."
          : isConfirming
            ? "Publishing on-chain..."
            : "Decrypt & Reveal Winner";

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleReveal}
      className="sb-dashboard-table-card"
      style={{ padding: "1.25rem", marginBottom: "1.25rem" }}
    >
      <div className="sb-page-new__header" style={{ marginBottom: "1rem" }}>
        <ShieldCheck size={20} className="icon-cipher" />
        <div>
          <h2 className="sb-page-new__title" style={{ fontSize: "1.1rem" }}>
            Verified Reveal Transaction
          </h2>
          <p className="sb-page-new__sub">
            Load canonical handles or enter encrypted winner data, then decrypt
            and publish the signed result.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.85rem" }}>
        <div className="sb-form-field">
          <label className="sb-form-label" htmlFor="revealAuctionId">
            Auction ID
          </label>
          <input
            id="revealAuctionId"
            inputMode="numeric"
            value={auctionIdInput}
            onChange={(event) => setAuctionIdInput(event.target.value)}
            placeholder="0"
            className="sb-input sb-input--mono"
            disabled={isBusy}
          />
        </div>

        <div className="sb-form-field">
          <label className="sb-form-label" htmlFor="revealBidCtHash">
            Encrypted winning bid handle
          </label>
          <input
            id="revealBidCtHash"
            value={bidCtHash}
            onChange={(event) => setBidCtHash(event.target.value)}
            placeholder="0x..."
            className="sb-input sb-input--mono"
            disabled={isBusy}
          />
        </div>

        <div className="sb-form-field">
          <label className="sb-form-label" htmlFor="revealWinnerCtHash">
            Encrypted winner handle
          </label>
          <input
            id="revealWinnerCtHash"
            value={winnerCtHash}
            onChange={(event) => setWinnerCtHash(event.target.value)}
            placeholder="0x..."
            className="sb-input sb-input--mono"
            disabled={isBusy}
          />
        </div>

        {(error || txError) && (
          <div className="sb-detail-error" role="alert">
            <p>{error || txError?.message || "Reveal transaction failed."}</p>
          </div>
        )}

        {result && (
          <div className="sb-detail-green-box" aria-live="polite">
            <strong>Verified plaintext result</strong>
            <div>Winning bid: {formatEth(result.bid)} ETH</div>
            <div>
              Winner: <span className="sb-td--mono">{result.winner}</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLoadHandles}
            disabled={isBusy}
          >
            Load On-Chain Handles
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isBusy || !cofheClient}
          >
            {isBusy && <LoaderCircle size={16} className="spin" />}
            {actionLabel}
          </button>
        </div>
      </div>
    </motion.form>
  );
}

function RevealRow({ auctionId, now }: { auctionId: number; now: bigint }) {
  const { data: auction } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "auctions",
    args: [BigInt(auctionId)],
  });

  const { data: bidCount, isLoading: isLoadingBidCount } = useReadContract({
    address: BidFlow_ADDRESS,
    abi: BidFlow_ABI,
    functionName: "getBidderCount",
    args: [BigInt(auctionId)],
  });

  if (!auction)
    return (
      <tr className="sb-table-row--loading">
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
        <td>
          <span>&nbsp;</span>
        </td>
      </tr>
    );

  const data = parseAuction(auction as unknown[], auctionId);
  if (!data) return null;

  // Keep active auctions out of the reveal queue.
  if (data.biddingEnd > now && data.status === "ACTIVE") return null;

  const bidders = isLoadingBidCount ? undefined : Number(bidCount || 0);

  return (
    <tr>
      <td>
        <Link to={`/auction/${auctionId}`} className="sb-table-link">
          {data.title}
        </Link>
      </td>
      <td>
        <span
          className={`sb-badge ${data.status === "SETTLEMENT" ? "sb-badge--ended-warn" : "sb-badge--finalized"}`}
        >
          {data.status === "SETTLEMENT" ? "Reveal Needed" : "Settled"}
        </span>
      </td>
      <td>{bidders}</td>
      <td className="sb-td--mono sb-td--muted">
        {data.status === "FINALIZED" && data.revealedWinner
          ? shortAddr(data.revealedWinner)
          : "—"}
      </td>
      <td>
        <Link
          to={`/auction/${auctionId}`}
          className="sb-table-link"
          style={{ color: "var(--text-muted)" }}
          aria-label={`View auction ${data.title}`}
        >
          <ChevronRight size={16} />
        </Link>
      </td>
    </tr>
  );
}

export default RevealCenter;
