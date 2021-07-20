const hre = require('hardhat');
// scripts/create-box.js
const { deployments, getNamedAccounts, ethers } = require('hardhat');

async function main() {
    throw new Error('ALREADY UPGRADED');
    const { deployer } = await getNamedAccounts();

    await deployments.execute(
        'EditionsRegistry',
        { from: deployer, log: true },
        'postUpgrade',
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
