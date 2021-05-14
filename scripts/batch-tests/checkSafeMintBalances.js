const hre = require('hardhat');
// scripts/create-box.js
const { deployments, getNamedAccounts, ethers } = require('hardhat');

async function main() {
    if (!process.env.HUNT_RECIPIENT) {
        console.error(
            'Run the command with: HUNT_RECIPIENT=0xaddress npx hardhat run scripts/safeMintForArtists.js --network yourNetwork',
        );

        return;
    }
    [deployer] = await ethers.getSigners();

    const Editions = await deployments.get('EditionsRegistry');

    editions = await ethers.getContractAt(
        'EditionsRegistry',
        Editions.address,
        deployer,
    );

    allData = [
        // list of artists
        [
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B1'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B2'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B3'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B4'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B5'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B6'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B7'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B8'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429B9'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429C0'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429C1'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x8275981744983C4a3Eec03f5e386771dcB5429C2'.toLocaleLowerCase(),
            ),
        ],
        // list of ids
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        // list of amounts
        [2, 2, 1, 2, 2, 2, 1, 2, 2, 1, 2, 1],
        // recipient
        process.env.HUNT_RECIPIENT,
        [],
    ];

    // verify that recipient has one of each
    const balances = await editions.balanceOfBatch(
        Array(allData[0].length).fill(allData[3]),
        allData[1],
    );

    console.log(balances.map((a) => a.toNumber()));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
