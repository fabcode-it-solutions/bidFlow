export interface OnboardingStep {
  title: string;
  description: string;
  visualType: "public-auction" | "encrypted-bids" | "settlement";
}

export const onboardingSteps: OnboardingStep[] = [
  {
    title: "Public Auctions Are Vulnerable",
    description:
      "Visible bids allow bots to snipe, front-run, and manipulate auction outcomes.",
    visualType: "public-auction",
  },
  {
    title: "BidFlow Encrypts Every Bid",
    description:
      "Bids stay private while the auction is active. Nobody can read them before settlement.",
    visualType: "encrypted-bids",
  },
  {
    title: "Only the Winner Is Revealed",
    description:
      "After the auction ends, BidFlow verifies the result and settles fairly on-chain.",
    visualType: "settlement",
  },
];
