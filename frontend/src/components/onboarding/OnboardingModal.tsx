import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Play, ArrowRight } from "lucide-react";
import { onboardingSteps } from "./onboardingSteps";
import { OnboardingStep } from "./OnboardingStep";

const ONBOARDING_KEY = "BidFlow_onboarding_seen";

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) !== "true",
  );
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleTryDemo = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
    navigate("/demo");
  };

  const handleGetStarted = () => {
    completeOnboarding();
  };

  if (!isOpen) return null;

  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <div className="sb-onboarding-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="sb-onboarding-modal"
      >
        {/* Close Button */}
        <button
          className="sb-onboarding-close"
          onClick={completeOnboarding}
          aria-label="Skip onboarding"
        >
          <X size={16} />
        </button>

        {/* Step Content */}
        <div className="sb-onboarding-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <OnboardingStep
                step={onboardingSteps[currentStep]}
                isActive={true}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress Dots */}
        <div className="sb-onboarding-dots">
          {onboardingSteps.map((_, i) => (
            <button
              key={i}
              className={`sb-onboarding-dot ${i === currentStep ? "sb-onboarding-dot--active" : ""}`}
              onClick={() => setCurrentStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="sb-onboarding-nav">
          {currentStep > 0 ? (
            <button
              className="btn-ghost sb-onboarding-nav-btn"
              onClick={handlePrev}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <button
              className="btn-ghost sb-onboarding-nav-btn"
              onClick={completeOnboarding}
            >
              Skip
            </button>
          )}

          {isLastStep ? (
            <div className="sb-onboarding-actions">
              <button
                className="btn-secondary sb-onboarding-nav-btn"
                onClick={handleTryDemo}
              >
                <Play size={16} />
                Try Demo
              </button>
              <button
                className="btn-primary sb-onboarding-nav-btn"
                onClick={handleGetStarted}
              >
                Get Started
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button
              className="btn-primary sb-onboarding-nav-btn"
              onClick={handleNext}
            >
              Next
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
