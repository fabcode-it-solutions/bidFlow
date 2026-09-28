import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useCofheClient } from "@cofhe/react";
import { Encryptable } from "@cofhe/sdk";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, Wallet } from "lucide-react";
import { BidFlow_ADDRESS, BidFlow_ABI } from "../constants/contracts";

type CreateAuctionTemplateState = {
  title?: string;
  description?: string;
  category?: string;
  duration?: string;
  reservePrice?: string;
};

const CATEGORIES = [
  "Digital Art",
  "Collectibles",
  "Photography",
  "Music",
  "Domain Names",
  "Software",
  "Real Estate",
  "Procurement",
  "Other",
] as const;

const STEP_LABELS: Record<string, string> = {
  initTfhe: "Initializing FHE engine...",
  fetchKeys: "Fetching encryption keys...",
  pack: "Packing encrypted bid...",
  prove: "Generating zero-knowledge proof...",
  verify: "Verifying proof...",
};

const STEP_PROGRESS: Record<string, number> = {
  initTfhe: 10,
  fetchKeys: 30,
  pack: 50,
  prove: 75,
  verify: 95,
};

const FEE_BUFFER_PERCENT = 120n;

export function CreateAuction() {
  const navigate = useNavigate();
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletBalance, isLoading: isBalanceLoading } = useBalance({
    address,
    query: { enabled: !!address },
  });
  const templateState = (location.state || {}) as CreateAuctionTemplateState;
  const [title, setTitle] = useState(templateState.title || "");
  const [description, setDescription] = useState(
    templateState.description || "",
  );
  const [category, setCategory] = useState(templateState.category || "");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [reservePrice, setReservePrice] = useState(
    templateState.reservePrice || "",
  );
  const [durationHours, setDurationHours] = useState(
    templateState.duration || "24",
  );
  const [error, setError] = useState<string | null>(null);

  const client = useCofheClient();
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptStep, setEncryptStep] = useState<string>("");

  const {
    data: hash,
    isPending: isTxPending,
    writeContract,
    error: txError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (hash) toast.loading("Creating auction...", { id: hash });
  }, [hash]);

  useEffect(() => {
    if (isConfirmed && hash) {
      toast.success("Auction created successfully!", { id: hash });
      const timer = window.setTimeout(() => navigate("/"), 2000);
      return () => window.clearTimeout(timer);
    }
  }, [hash, isConfirmed, navigate]);

  useEffect(() => {
    if (txError) {
      console.error("[CreateAuction] TX error:", txError);
      toast.error(
        (txError as Error & { shortMessage?: string }).shortMessage ||
          txError.message ||
          "Transaction failed",
      );
    }
  }, [txError]);

  const isLoading = isEncrypting || isTxPending || isConfirming;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // For MVP, use a data URL for preview. In production, upload to IPFS.
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter an auction title");
      return;
    }
    if (!category) {
      setError("Please select a category");
      return;
    }

    const duration = parseInt(durationHours);
    if (isNaN(duration) || duration < 1 || duration > 720) {
      setError("Duration must be between 1 and 720 hours");
      return;
    }

    const minBid = parseFloat(reservePrice);
    if (isNaN(minBid) || minBid <= 0) {
      setError("Reserve price must be greater than 0 ETH");
      return;
    }

    try {
      if (!client) {
        setError(
          "Encryption client not initialized. Please wait for CoFHE to load.",
        );
        return;
      }

      setIsEncrypting(true);
      setEncryptStep("initTfhe");
      const builder = client.encryptInputs([
        Encryptable.uint64(BigInt(Math.round(minBid * 1e18))),
      ]);
      builder.onStep((step, ctx) => {
        if (ctx?.isStart) setEncryptStep(step);
      });
      const encryptedResults = await builder.execute();
      setIsEncrypting(false);
      setEncryptStep("");

      const encrypted = encryptedResults[0];
      const inEuint64 = {
        ctHash: encrypted.ctHash,
        securityZone: encrypted.securityZone,
        utype: encrypted.utype,
        signature: encrypted.signature,
      };
      const fees = await publicClient?.estimateFeesPerGas();
      const bufferedFees =
        fees?.maxFeePerGas !== undefined &&
        fees.maxPriorityFeePerGas !== undefined
          ? {
              maxFeePerGas: (fees.maxFeePerGas * FEE_BUFFER_PERCENT) / 100n,
              maxPriorityFeePerGas:
                (fees.maxPriorityFeePerGas * FEE_BUFFER_PERCENT) / 100n,
            }
          : {};

      writeContract({
        address: BidFlow_ADDRESS,
        abi: BidFlow_ABI,
        functionName: "createAuction",
        args: [title.trim(), BigInt(duration * 3600), inEuint64],
        ...bufferedFees,
      });
    } catch (err) {
      setIsEncrypting(false);
      setEncryptStep("");
      setError(err instanceof Error ? err.message : "Failed to encrypt bid");
    }
  };

  const progressPercent =
    isEncrypting && encryptStep
      ? STEP_PROGRESS[encryptStep] || 5
      : isTxPending
        ? 98
        : 50;

  const loadingText =
    isEncrypting && encryptStep
      ? STEP_LABELS[encryptStep] || encryptStep
      : isEncrypting
        ? "Encrypting..."
        : "Waiting for confirmation...";
  const hasNoGasBalance = isConnected && walletBalance?.value === 0n;
  const balanceLabel = !isConnected
    ? "Connect wallet"
    : isBalanceLoading
      ? "Loading..."
      : walletBalance
        ? `${(Number(walletBalance.formatted) || 0).toFixed(4)} ${walletBalance.symbol}`
        : "Unavailable";

  return (
    <div className="sb-create-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sb-create-title-block"
      >
        <h1 className="sb-create-title">Create Sealed Auction</h1>
        <p className="sb-create-subtitle">
          Review the auction details, encrypt the reserve price locally, then
          deploy to Arbitrum Sepolia.
        </p>
      </motion.div>

      <div className="sb-create-layout">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card sb-create-form-card"
        >
          <form onSubmit={handleSubmit}>
            {/* Asset Image */}
            <FormField label="Asset Image">
              <div className="sb-create-image-upload">
                {imagePreview ? (
                  <div className="sb-create-image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button
                      type="button"
                      className="sb-create-image-remove"
                      onClick={() => {
                        setImagePreview(null);
                        setImageURI("");
                      }}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="sb-create-image-dropzone">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={isLoading}
                    />
                    <span>Click to upload or drag image</span>
                  </label>
                )}
              </div>
            </FormField>

            <FormField label="Title" htmlFor="title">
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Rare NFT Collection"
                className="sb-input"
                disabled={isLoading}
              />
            </FormField>

            <FormField label="Description" htmlFor="description">
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your auction item..."
                rows={3}
                className="sb-input sb-input--textarea"
                disabled={isLoading}
              />
            </FormField>

            <FormField label="Category" htmlFor="category">
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="sb-input"
                disabled={isLoading}
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="sb-create-field-grid">
              <FormField label="Reserve Price (ETH)" htmlFor="reservePrice">
                <input
                  type="number"
                  id="reservePrice"
                  value={reservePrice}
                  onChange={(e) => setReservePrice(e.target.value)}
                  placeholder="0.1"
                  step="0.0001"
                  min="0.0001"
                  className="sb-input sb-input--mono"
                  disabled={isLoading}
                />
                <p className="sb-form-helper">
                  Encrypted eligibility threshold used only in FHE comparisons.
                  Never stored or emitted as plaintext.
                </p>
              </FormField>

              <FormField label="Duration (hours)" htmlFor="duration">
                <input
                  type="number"
                  id="duration"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  min="1"
                  max="720"
                  placeholder="24"
                  className="sb-input sb-input--mono"
                  disabled={isLoading}
                />
              </FormField>
            </div>

            {error && (
              <div className="sb-create-error" role="alert">
                <Lock size={20} />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !client}
              className="btn-primary sb-create-submit"
            >
              {isLoading ? (
                <span className="sb-create-loading">
                  <span className="sb-create-loading-text">
                    {loadingText}
                    {isEncrypting && encryptStep && (
                      <span className="encrypt-dots" />
                    )}
                  </span>
                  <span
                    className="sb-create-progress-bar"
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Encryption progress"
                  >
                    <span
                      className="sb-create-progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </span>
                </span>
              ) : (
                "Encrypt & Deploy Auction"
              )}
            </button>
          </form>
        </motion.div>

        <aside
          className="sb-create-summary"
          aria-label="Auction deployment summary"
        >
          <div className="sb-create-summary__eyebrow">Deployment Preview</div>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Asset"
              className="sb-create-summary__image"
            />
          )}
          <h2>{title.trim() || "Untitled auction"}</h2>
          {category && (
            <span className="sb-create-summary__category">{category}</span>
          )}
          <dl>
            <div>
              <dt>Reserve price</dt>
              <dd>{reservePrice || "0.1"} ETH</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{durationHours || "24"}h</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Arbitrum Sepolia</dd>
            </div>
            <div>
              <dt>Wallet balance</dt>
              <dd>{balanceLabel}</dd>
            </div>
          </dl>
          <div className="sb-create-summary__badges">
            <span className="sb-badge sb-badge--active">Public Asset</span>
            <span className="sb-badge sb-badge--ended-warn">
              Encrypted Reserve
            </span>
            <span className="sb-badge sb-badge--finalized">Sealed Bids</span>
            <span className="sb-badge sb-badge--active">Verified Result</span>
          </div>
          {hasNoGasBalance && (
            <div className="sb-create-warning">
              <Wallet size={18} />
              <p>
                Your connected wallet has no ETH on Arbitrum Sepolia for gas.
              </p>
            </div>
          )}
          <div className="sb-create-info">
            <Lock size={20} />
            <p>
              Reserve price encryption happens in-browser before the transaction
              is submitted.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sb-form-field">
      <label className="sb-form-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default CreateAuction;
