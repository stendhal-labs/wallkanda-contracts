const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');

describe('EditionsRegistry - Minting Batch', async () => {
    let deployer;
    let recipient;
    let random2;

    let allData;

    before(async function () {
        await deployments.fixture();
        [deployer, recipient] = await ethers.getSigners();

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
            ],
            // list of ids
            [1, 2, 3, 4, 5, 6, 7, 8],
            // list of amounts
            [2, 2, 1, 2, 2, 2, 1, 2],
            // recipient
            await recipient.getAddress(),
            [],
        ];
    });

    it('It should mint all the NFTs and transfer to the recipient', async () => {
        await editions.safeMintBatchForArtistsAndTransfer(...allData);

        // verify that recipient has one of each
        const balances = await editions.balanceOfBatch(
            Array(allData[0].length).fill(allData[3]),
            allData[1],
        );

        expect(balances.map((a) => a.toNumber())).to.deep.equal(
            Array(allData[1].length).fill(1),
        );
    });

    it('It should fail because already used', async () => {
        await expect(
            editions.safeMintBatchForArtistsAndTransfer(...allData),
        ).to.be.revertedWith('Already used.');
    });
});
