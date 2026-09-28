import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Gift,
  Diamond,
  Clock,
  ShieldCheck,
  ArrowRight,
  PlayCircle,
} from "lucide-react";

const DEMO_TEMPLATES = [
  {
    id: "launch",
    title: "Launch Auction",
    description:
      "Celebrate the launch of BidFlow with this special demo auction",
    durationHours: 48,
    minBid: 0.1,
    icon: <Gift className="w-6 h-6" />,
  },
  {
    id: "nft",
    title: "NFT Bundle",
    description: "A curated collection of rare digital art pieces",
    durationHours: 2,
    minBid: 0.05,
    icon: <Diamond className="w-6 h-6" />,
  },
  {
    id: "early",
    title: "Early Bird",
    description: "Exclusive early access auction for demo participants",
    durationHours: 24,
    minBid: 0.01,
    icon: <Clock className="w-6 h-6" />,
  },
];

export function Demo() {
  const navigate = useNavigate();
  const featuredTemplate = useMemo(() => DEMO_TEMPLATES[0], []);

  const handleUseTemplate = (template: (typeof DEMO_TEMPLATES)[0]) => {
    navigate("/create", {
      state: {
        title: template.title,
        description: template.description,
        duration: template.durationHours.toString(),
        reservePrice: template.minBid.toString(),
      },
    });
  };

  return (
    <div className="sb-demo-page">
      {/* Header */}
      <div className="sb-demo-header">
        <div className="sb-demo-badge">Demo Mode</div>

        <h1 className="sb-demo-title">
          <span>Try </span>
          <span className="sb-demo-title--gradient">BidFlow</span>
        </h1>

        <p className="sb-demo-subtitle">
          Walk through the full sealed-auction flow with judge-ready templates,
          real form validation, and the same encryption path used in production.
        </p>

        <div className="sb-demo-highlights" aria-label="Demo flow highlights">
          <span>
            <ShieldCheck size={14} /> Real CoFHE encrypt flow
          </span>
          <span>
            <Clock size={14} /> 2 minute setup
          </span>
          <span>
            <PlayCircle size={14} /> Guided templates
          </span>
        </div>

        <button
          onClick={() => handleUseTemplate(featuredTemplate)}
          className="btn-primary sb-demo-cta"
        >
          Start Guided Demo
          <ArrowRight size={16} />
        </button>

        <div className="sb-demo-divider" />
      </div>

      {/* Templates */}
      <div className="sb-demo-templates">
        <div className="sb-demo-templates-header">
          <h2 className="sb-demo-templates-title">Quick Start Templates</h2>
          <p className="sb-demo-templates-sub">
            Pick a scenario, review the prefilled auction, then deploy with your
            connected wallet
          </p>
        </div>

        <div className="sb-demo-grid">
          {DEMO_TEMPLATES.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
              className="glass-card-hover sb-template-card"
            >
              {/* Icon + Meta */}
              <div className="sb-template-card__top">
                <div className="sb-template-card__icon">{template.icon}</div>
                <div className="sb-template-card__meta">
                  <span>
                    <Clock size={12} /> {template.durationHours}h
                  </span>
                  <span className="sb-template-card__min">
                    Reserve: {template.minBid} ETH
                  </span>
                </div>
              </div>

              {/* Text */}
              <h3 className="sb-template-card__title">{template.title}</h3>
              <p className="sb-template-card__desc">{template.description}</p>

              {/* Use Button */}
              <button
                onClick={() => handleUseTemplate(template)}
                className="sb-template-card__btn"
              >
                Use Template →
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Demo;
