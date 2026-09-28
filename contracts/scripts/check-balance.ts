import hre from "hardhat";

async function main() {
  const address = process.env.CHECK_ADDRESS || "0xEF9BCCA0cb6E61a5563386cdE0539AeC3a1F8017";
  const bal = await hre.ethers.provider.getBalance(address);
  console.log(hre.ethers.formatEther(bal));
}

main();
