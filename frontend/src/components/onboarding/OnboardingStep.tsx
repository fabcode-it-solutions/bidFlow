import { Eye, Lock, ShieldCheck } from 'lucide-react';
import type { OnboardingStep as OnboardingStepType } from './onboardingSteps';

interface OnboardingStepProps {
  step: OnboardingStepType;
  isActive: boolean;
}

export function OnboardingStep({ step, isActive }: OnboardingStepProps) {
  return (
    <div className={`sb-onboarding-step ${isActive ? 'sb-onboarding-step--active' : ''}`}>
      <div className="sb-onboarding-step__visual">
        {step.visualType === 'public-auction' && <PublicAuctionVisual />}
        {step.visualType === 'encrypted-bids' && <EncryptedBidsVisual />}
        {step.visualType === 'settlement' && <SettlementVisual />}
      </div>
      <h2 className="sb-onboarding-step__title">{step.title}</h2>
      <p className="sb-onboarding-step__desc">{step.description}</p>
    </div>
  );
}

function PublicAuctionVisual() {
  return (
    <div className="sb-onboarding-visual sb-onboarding-visual--public">
      <div className="sb-onboarding-visual__row">
        <span className="sb-onboarding-visual__bid sb-onboarding-visual__bid--public">
          <Eye size={12} />
          1.2 ETH
        </span>
        <span className="sb-onboarding-visual__label">visible</span>
      </div>
      <div className="sb-onboarding-visual__row">
        <span className="sb-onboarding-visual__bid sb-onboarding-visual__bid--public">
          <Eye size={12} />
          1.5 ETH
        </span>
        <span className="sb-onboarding-visual__label">visible</span>
      </div>
      <div className="sb-onboarding-visual__row sb-onboarding-visual__row--bot">
        <span className="sb-onboarding-visual__bot">🤖 Bot sees all bids</span>
      </div>
    </div>
  );
}

function EncryptedBidsVisual() {
  return (
    <div className="sb-onboarding-visual sb-onboarding-visual--encrypted">
      <div className="sb-onboarding-visual__row">
        <span className="sb-onboarding-visual__bid sb-onboarding-visual__bid--encrypted">
          <Lock size={12} />
          ██████
        </span>
      </div>
      <div className="sb-onboarding-visual__row">
        <span className="sb-onboarding-visual__bid sb-onboarding-visual__bid--encrypted">
          <Lock size={12} />
          ██████
        </span>
      </div>
      <div className="sb-onboarding-visual__row">
        <span className="sb-onboarding-visual__bid sb-onboarding-visual__bid--encrypted">
          <Lock size={12} />
          ██████
        </span>
      </div>
    </div>
  );
}

function SettlementVisual() {
  return (
    <div className="sb-onboarding-visual sb-onboarding-visual--settlement">
      <div className="sb-onboarding-visual__flow">
        <div className="sb-onboarding-visual__flow-step">
          <span className="sb-onboarding-visual__flow-icon">🏁</span>
          <span>Auction Ends</span>
        </div>
        <div className="sb-onboarding-visual__flow-arrow">↓</div>
        <div className="sb-onboarding-visual__flow-step">
          <ShieldCheck size={16} className="sb-onboarding-visual__flow-icon--accent" />
          <span>Winner Verified</span>
        </div>
        <div className="sb-onboarding-visual__flow-arrow">↓</div>
        <div className="sb-onboarding-visual__flow-step">
          <span className="sb-onboarding-visual__flow-icon">✅</span>
          <span>Fair Settlement</span>
        </div>
      </div>
    </div>
  );
}
