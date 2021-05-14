const { expect } = require('chai');
const { constants } = require('ethers');
const { deployments, ethers } = require('hardhat');

describe('EditionsRegistry - Minting', async () => {
    let contract;
    let DEPLOYER;
    let MINTER;
    let owner;
    let EditionsRegistry;
    const BYTES = ethers.utils.toUtf8Bytes('012345-133456');

    before(async function () {
        [DEPLOYER, MINTER, owner] = await ethers.getSigners();
        process.env.MINTER_ADDRESS = await MINTER.getAddress();

        await deployments.fixture();

        EditionsRegistry = await deployments.get('EditionsRegistry');
        contract = await ethers.getContractAt(
            'EditionsRegistry',
            EditionsRegistry.address,
            DEPLOYER,
        );
    });

    async function prepareMintingMessage(address, data) {
        return await contract.prepareMessage(address, data);
    }

    // sign message with account
    async function signMessage(message, account = MINTER) {
        const signature = await account.signMessage(
            ethers.utils.arrayify(message),
        );

        // return signature
        let v = parseInt(signature.slice(130, 132), 16);
        if (v < 27) {
            v += 27;
        }
        return {
            r: signature.slice(0, 66),
            s: '0x' + signature.slice(66, 130),
            v: '0x' + v.toString(16).padStart(0, 2),
        };
    }

    it('It should deploy', async () => {
        const URL = process.env.CONTRACT_URI;
        const minter = MINTER.address;

        const contractURI = await contract.contractURI();
        expect(contractURI.toString()).to.equal(URL);

        const contractOwner = await contract.owner();
        expect(contractOwner.toString()).to.equal(DEPLOYER.address);

        const isMinter = await contract.isOperator(minter);
        expect(isMinter).to.be.true;
    });

    it('It should not allow minting with bad signature', async () => {
        const OWNER = owner.address;
        const SUPPLY = 5;
        const ROYALTIES = 500;
        const RECIPIENT = OWNER;

        const message = await prepareMintingMessage(OWNER, BYTES);
        let { v, r, s } = await signMessage(message, MINTER);

        r = r.slice(0, -2) + 'ff';

        await expect(
            contract
                .connect(owner)
                .mint(SUPPLY, ROYALTIES, RECIPIENT, BYTES, v, r, s),
        ).to.revertedWith('Wrong Signature');
    });

    it('It should allow minting', async () => {
        const OWNER = owner.address;
        const SUPPLY = 5;
        const ROYALTIES = 500;
        const RECIPIENT = OWNER;

        const message = await prepareMintingMessage(OWNER, BYTES);
        const { v, r, s } = await signMessage(message, MINTER);

        await expect(
            contract
                .connect(owner)
                .mint(SUPPLY, ROYALTIES, RECIPIENT, BYTES, v, r, s),
        ).to.emit(contract, 'TransferSingle');
    });

    it('It should fail because ID already minted', async () => {
        const OWNER = owner.address;
        const SUPPLY = 5;
        const ROYALTIES = 500;
        const RECIPIENT = OWNER;

        const message = await prepareMintingMessage(OWNER, BYTES);
        const { v, r, s } = await signMessage(message, MINTER);

        await expect(
            contract
                .connect(owner)
                .mint(SUPPLY, ROYALTIES, RECIPIENT, BYTES, v, r, s),
        ).to.revertedWith('ERC1155: Already minted');
    });
});
