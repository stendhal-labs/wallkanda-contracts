const { expect } = require('chai');

const toBN = ethers.BigNumber.from;

describe('Exchange ERC1155 With royalties', function () {
    // preparation
    // create ERC1155
    // mint 1 erc1155 for user1
    // user1 approves saleContract to transfer erc1155

    // user1 creates an order for 1 erc1155;
    // user1 sign this order

    // user2 buys 1 erc1155

    // user3 send the exact same transaction as user2, setting buyer as user2
    let OWNER;
    let BUYER;
    let PRICE = ethers.utils.parseEther('0.01');
    let ID_ERC1155 = 1;
    let ROYALTIES_RECIPIENT;
    const SELLING_AMOUNT = 8;
    const ROYALTIES_VALUE = 250;

    let saleContract;
    let erc1155;
    let order;
    let signature;
    let values;
    let msgValue;

    const serviceFeeRecipient = process.env.SERVICE_FEE_BENEFICIARY;

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, addr4, OWNER, BUYER, ROYALTIES_RECIPIENT] =
            await ethers.getSigners();

        await deployments.fixture();

        Exchange = await deployments.get('Exchange');
        saleContract = await ethers.getContractAt(
            'Exchange',
            Exchange.address,
            owner,
        );

        TransferProxy = await deployments.get('TransferProxy');
        transferProxy = await ethers.getContractAt(
            'TransferProxy',
            TransferProxy.address,
            owner,
        );

        const ERC1155Dummy = await ethers.getContractFactory(
            'Dummy1155WithFees',
        );

        erc1155 = await ERC1155Dummy.connect(OWNER).deploy(
            OWNER.address,
            ID_ERC1155,
            10,
            ROYALTIES_RECIPIENT.address,
            ROYALTIES_VALUE,
        );

        await erc1155
            .connect(OWNER)
            .setApprovalForAll(transferProxy.address, true);

        // creation order
        order = {
            exchange: saleContract.address,
            maker: await OWNER.getAddress(),
            taker: ethers.constants.AddressZero,
            outAsset: {
                tokenType: 2,
                token: erc1155.address,
                tokenId: ID_ERC1155,
                quantity: SELLING_AMOUNT,
            },
            inAsset: {
                tokenType: 0,
                token: ethers.constants.AddressZero,
                tokenId: 0,
                quantity: PRICE,
            },
            maxPerBuy: 0,
            orderNonce: 1337,
        };

        signature = await signOrder(order);
        values = await getOrderValue(order);
        msgValue = values.totalTransaction;

        valuesForMore = await getOrderValue(order, SELLING_AMOUNT - 1);
        msgValueForMore = valuesForMore.totalTransaction;
    });

    // sign message with account
    async function signMessage(message, account = OWNER) {
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

    // sign order
    async function signOrder(order) {
        // hash order
        const message = await saleContract.prepareOrderMessage(order);
        // sign message
        return await signMessage(message);
    }

    async function getOrderValue(order, buying = 1) {
        return await saleContract.computeValues(order, buying);
    }

    // only check if balances of all actors (buyer, seller, royalties recipient, servicefee recipient) match
    it('Should change balances after Transfer', async () => {
        let tx = await saleContract.connect(BUYER).buy(order, signature, 1, {
            value: msgValue,
        });

        const royaltiesRecipient = new ethers.VoidSigner(
            values.royaltiesRecipient,
            OWNER.provider,
        );

        const serviceFeeRecipientAccount = new ethers.VoidSigner(
            serviceFeeRecipient,
            OWNER.provider,
        );

        await expect(tx).to.changeEtherBalances(
            [OWNER, BUYER, serviceFeeRecipientAccount, royaltiesRecipient],
            [
                values.sellerEndValue,
                msgValue.mul(toBN(-1)),
                values.serviceFees,
                values.royaltiesAmount,
            ],
        );

        tx = await saleContract
            .connect(BUYER)
            .buy(order, signature, SELLING_AMOUNT - 1, {
                value: msgValueForMore,
            });

        await expect(tx).to.changeEtherBalances(
            [OWNER, BUYER, serviceFeeRecipientAccount, royaltiesRecipient],
            [
                valuesForMore.sellerEndValue,
                msgValueForMore.mul(toBN(-1)),
                valuesForMore.serviceFees,
                valuesForMore.royaltiesAmount,
            ],
        );
    });
});
