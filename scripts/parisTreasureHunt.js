const hre = require('hardhat');
// scripts/create-box.js
const { deployments, getNamedAccounts, ethers } = require('hardhat');

async function main() {
    throw new Error('ALREADY DEPLOYED MAINNET');
    if (!process.env.HUNT_RECIPIENT) {
        console.error(
            'Run the command with: HUNT_RECIPIENT=0xaddress npx hardhat run scripts/safeMintForArtists.js --network yourNetwork',
        );

        return;
    }

    // wallkanda bdx hunt: HUNT_RECIPIENT=0x5C3D384Fef0ed7468a09bFf44168E87d4B891610 npx hardhat run scripts/safeMintForArtists.js --network mainnet',
    const { deployer } = await getNamedAccounts();

    allData = [
        // list of artists
        [
            '0xaBE58BFff9a6E584b40A9Fff39fd9DE673B148cf',
            '0x8723fd4739fA5FaeeDd7c87ba8C6beaed880b001',
            '0x1B9643211f96ea07c4724C7934574dD22c8b1a91',
            '0xCc84741e831Ef140659Ac11Ed527f714D7897b0E',
            '0x4219222cbe315ce9475237BbE3eB715970985130',
            '0xdbc919cdA52d362D7429eBF096568fBCA5E299cF',
            '0x43Ce97Ed8278170E33679d9a66B468Ce5Cb4Ad58',
            '0xdbA51153aE9200A42b147949016c20306e2bB466',
            '0xEAC82B807Bd44D4fC0cf5859923067b7cA57D2B0',
            '0xCcB6c6820898d2411EF229A9A6defbfBAEE7c231',
            '0xd4bdFa453A1caD972b0b9674851a4ca23C2E5cE9',
            '0x88FcA805B4f011872982e17327312C659fEA6dff',
            '0x58B834F590bc4998A66BD77Ef4f8A12ce9b8928e',
        ],
        // list of amounts
        [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        // list of royalties
        [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500],
        // recipient
        process.env.HUNT_RECIPIENT,
        [],
    ];

    await deployments.execute(
        'EditionsRegistry',
        { from: deployer, log: true },
        'safeMintBatchForArtistsAndTransfer',
        ...allData,
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
