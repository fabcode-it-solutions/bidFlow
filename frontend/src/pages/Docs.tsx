import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  Shield,
  Lock,
  Eye,
  Wallet,
  ArrowRight,
  ExternalLink,
  Code,
  FileText,
} from "lucide-react";

const SECTIONS = [
  {
    icon: Shield,
    title: "How BidFlow Works",
    content: `BidFlow is a sealed-bid auction protocol built on Fully Homomorphic Encryption (FHE).
    Unlike traditional auctions where bids are visible to everyone, BidFlow keeps all bid amounts
    encrypted on-chain — even the smart contract itself cannot read them. Only the final winner is
    revealed after settlement.`,
  },
  {
    icon: Lock,
    title: "Encrypted Bids",
    content: `When you place a bid, your bid amount is encrypted in your browser using Fhenix CoFHE
    before being submitted to the blockchain. The contract uses FHE operations (CMUX) to compare
    encrypted bids without ever decrypting them. This means no one — not the seller, not other
    bidders, not even the contract — can see your bid amount during the auction.`,
  },
  {
    icon: Eye,
    title: "Settlement & Reveal",
    content: `After the bidding period ends, the seller finalizes the auction. This makes the winner's
    identity and bid amount publicly decryptable via the Threshold Network. Anyone can then call
    revealWinner() to publish the decrypted results on-chain. Losing bids are never revealed.`,
  },
  {
    icon: Wallet,
    title: "ETH Deposits & Refunds",
    content: `To place a bid, you submit an encrypted bid plus a separate public escrow bond. Keeping
    the bond independent prevents transaction value from revealing the encrypted bid. If you win,
    the seller receives your bond. If you lose, you can claim a full refund after settlement.`,
  },
  {
    icon: Code,
    title: "Smart Contract",
    content: `BidFlow is deployed on Arbitrum Sepolia testnet. The contract uses the @fhenixprotocol/cofhe-contracts
    library for FHE operations. All encrypted state is managed through euint64 (encrypted uint64) and
    eaddress (encrypted address) types.`,
  },
  {
    icon: FileText,
    title: "For Developers",
    content: `The codebase is open source. The contract is written in Solidity with Hardhat. The frontend
    uses React, Vite, TypeScript, wagmi, and RainbowKit. FHE operations are handled by the CoFHE SDK.
    Contributions are welcome.`,
  },
];

export function Docs() {
  return (
    <div className="sb-docs">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sb-docs__header"
      >
        <div className="sb-docs__kicker">
          <BookOpen size={14} />
          <span>Documentation</span>
        </div>
        <h1 className="sb-docs__title">BidFlow Protocol</h1>
        <p className="sb-docs__subtitle">
          Public asset. Private bids. Verifiable settlement.
          <br />
          Confidential sealed-bid auctions powered by Fully Homomorphic
          Encryption on Arbitrum.
        </p>
      </motion.div>

      <div className="sb-docs__grid">
        {SECTIONS.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="sb-docs__card"
            >
              <div className="sb-docs__card-icon">
                <Icon size={20} />
              </div>
              <h2 className="sb-docs__card-title">{section.title}</h2>
              <p className="sb-docs__card-content">{section.content}</p>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="sb-docs__cta"
      >
        <h2>Ready to try?</h2>
        <p>
          Create your first sealed-bid auction or explore active auctions on the
          platform.
        </p>
        <div className="sb-docs__cta-actions">
          <Link to="/create" className="btn-primary">
            Create Auction <ArrowRight size={16} />
          </Link>
          <Link to="/auctions" className="btn-secondary">
            Explore Auctions
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="sb-docs__links"
      >
        <a
          href="https://github.com/nohypelabs/BidFlow"
          target="_blank"
          rel="noopener noreferrer"
          className="sb-docs__link"
        >
          <Code size={16} />
          <span>GitHub Repository</span>
          <ExternalLink size={12} />
        </a>
        <a
          href="https://x.com/nohypelabs"
          target="_blank"
          rel="noopener noreferrer"
          className="sb-docs__link"
        >
          <span>Follow on X</span>
          <ExternalLink size={12} />
        </a>
        <a
          href="https://t.me/nohypelabs"
          target="_blank"
          rel="noopener noreferrer"
          className="sb-docs__link"
        >
          <span>Join Telegram</span>
          <ExternalLink size={12} />
        </a>
      </motion.div>
    </div>
  );
}

export default Docs;
