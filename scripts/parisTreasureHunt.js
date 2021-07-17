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

    // wallkanda bdx hunt: HUNT_RECIPIENT=0x5C3D384Fef0ed7468a09bFf44168E87d4B891610 npx hardhat run scripts/safeMintForArtists.js --network mainnet',
    const { deployer } = await getNamedAccounts();

    allData = [
        // list of artists
        [
            ethers.utils.getAddress(
                '0x1263f5FDE95E47d3B47C17D25270701dd64E9465'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0xbAFb09Dd3Fcd8e7AD2125467D3793108535f22f9'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x58B93070fCf84AAa8fA8990eDf561807B39FB8d2'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x70A9e06C9e7f0B2EdED5FAf1FEd8919Fc60beecF'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x2584Ce7501338dF402A5825BC277275090624087'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x54973244bA0D7c3412d902a66fe4135f5076b95B'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0xd5998bB3De000297Eb5bfB51988cF2C3826Bba52'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x1bCb80f119e1b5173431547163CBff83183A16f6'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x641474DD750C545723408d2722642B210bb503a3'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0xA2Ba4d5057636d79C3646f54672b0F8202E74CF3'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x1365cda23C75F2991f08C5171EB8b2dfE35DFCb5'.toLocaleLowerCase(),
            ),
            ethers.utils.getAddress(
                '0x276E3CD32ca38cD8dC92b74c41Dd7D3f19d7AEdD'.toLocaleLowerCase(),
            ),
        ],
        // list of ids
        [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400],
        // list of amounts
        [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
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
