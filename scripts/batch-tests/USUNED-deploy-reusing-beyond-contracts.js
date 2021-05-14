const hre = require('hardhat');
// scripts/create-box.js
const { ethers, upgrades } = require('hardhat');

const {
    constants, // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

function expectEvent(receipt, event) {
    const found = (receipt.events || []).find((log) => log.event === event);

    if (!found) {
        throw new Error(`Event ${event} not found`);
    }

    return found;
}

async function main() {
    let saleContract;
    let transferProxy;
    let editionsRegistry;

    // We get the contract to deploy
    const SimpleSale = await ethers.getContractFactory('SimpleSale');
    const TransferProxy = await ethers.getContractFactory('TransferProxy');
    const EditionsRegistry = await ethers.getContractFactory(
        'EditionsRegistry',
    );

    // Deploy transferProxy, this will set caller as the Owner
    transferProxy = await upgrades.deployProxy(TransferProxy, []);
    await transferProxy.deployed();

    console.log('TransferProxy: ', transferProxy.address);

    // deploy SimpleSale contract
    saleContract = await upgrades.deployProxy(SimpleSale, [
        process.env.SERVICE_FEE_BENEFICIARY,
        transferProxy.address,
        process.env.BUYER_FEE,
    ]);

    await saleContract.deployed();
    console.log('SimpleSale:', saleContract.address);

    // deploy Editions Registry contract
    editionsRegistry = await upgrades.deployProxy(EditionsRegistry, [
        process.env.EDITIONS_URI,
        process.env.MINTER_ADDRESS,
        process.env.CONTRACT_URI,
        process.env.OPENSEA_REGISTRY,
    ]);
    console.log('editionsRegistry:', editionsRegistry.address);

    // add contract as operators on the TransferProxy
    await transferProxy.grantRole(
        await transferProxy.OPERATOR_ROLE(),
        saleContract.address,
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
