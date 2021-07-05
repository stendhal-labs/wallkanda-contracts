const { expect } = require('chai');

const { deployments, ethers } = require('hardhat');
const { constants } = require('ethers');

const toBN = ethers.BigNumber.from;

describe('Exchange ERC1155', function () {
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

    const SELLING_AMOUNT = 8;

    let saleContract;
    let erc1155;
    let order;
    let signature;
    let values;
    let msgValue;
    let signer;

    const serviceFeeRecipient = process.env.SERVICE_FEE_BENEFICIARY;

    beforeEach(async function () {
        [owner, signer, addr2, addr3, addr4, OWNER, BUYER] =
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

        const ERC1155Dummy = await ethers.getContractFactory('Dummy1155');
        erc1155 = await ERC1155Dummy.connect(OWNER).deploy();

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
            expiration: (await getTimestamp()) + 24 * 60 * 60,
        };

        signature = await signOrder(order);
        /*
        values = await getOrderValue(order);
        msgValue = values.totalTransaction;

        valuesForMore = await getOrderValue(order, SELLING_AMOUNT - 1);
        msgValueForMore = valuesForMore.totalTransaction;
        */
    });

    async function getTimestamp() {
        const block = await ethers.provider.getBlockNumber();
        const { timestamp } = await ethers.provider.getBlock(block);
        return timestamp;
    }

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

    // sign sale meta
    async function getSignedSaleMeta(
        orderSign,
        buyer,
        sellerFee,
        buyerFee,
        isExpired = false,
    ) {
        const timestamp = await getTimestamp();

        // isExpired will create an expired  order, for tests purpose
        const expiration = isExpired
            ? timestamp - 10
            : timestamp + 24 * 60 * 60;

        const saleMeta = {
            buyer,
            sellerFee,
            buyerFee,
            expiration,
            nonce: Date.now(),
        };

        // hash order
        const message = await saleContract.prepareOrderMetaMessage(
            orderSign,
            saleMeta,
        );

        // sign message
        return {
            saleMeta,
            saleMetaSignature: await signMessage(message, signer),
        };
    }

    async function getOrderValue(order, saleMeta, buying = 1) {
        return await saleContract.computeValues(order, buying, saleMeta);
    }

    it('Should transfer ERC1155 and close order', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        let quantity = 1;
        await expect(
            saleContract
                .connect(BUYER)
                .buy(order, signature, quantity, saleMeta, saleMetaSignature, {
                    value: msgValue,
                }),
        ).to.emit(saleContract, 'Buy');

        const balanceOf = await erc1155.balanceOf(
            BUYER.address,
            order.outAsset.tokenId,
        );
        expect(balanceOf.valueOf()).to.be.equal(
            quantity,
            "ERC1155 didn't go to BUYER",
        );

        {
            const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
                signature,
                BUYER.address,
                process.env.SELLER_FEE,
                process.env.BUYER_FEE,
            );
            quantity = SELLING_AMOUNT - 1;
            valuesForMore = await getOrderValue(order, saleMeta, quantity);
            msgValueForMore = valuesForMore.totalTransaction;

            await expect(
                saleContract
                    .connect(BUYER)
                    .buy(
                        order,
                        signature,
                        quantity,
                        saleMeta,
                        saleMetaSignature,
                        {
                            value: msgValueForMore,
                        },
                    ),
            )
                .to.emit(saleContract, 'Buy')
                .to.emit(saleContract, 'CloseOrder');
        }
    });

    it('Should change balances after Transfer', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        let tx = await saleContract
            .connect(BUYER)
            .buy(order, signature, 1, saleMeta, saleMetaSignature, {
                value: msgValue,
            });

        const serviceFeeRecipientAccount = new ethers.VoidSigner(
            serviceFeeRecipient,
            OWNER.provider,
        );

        await expect(tx).to.changeEtherBalances(
            [OWNER, BUYER, serviceFeeRecipientAccount],
            [values.sellerEndValue, msgValue.mul(toBN(-1)), values.serviceFees],
        );

        {
            const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
                signature,
                BUYER.address,
                process.env.SELLER_FEE,
                process.env.BUYER_FEE,
            );

            quantity = SELLING_AMOUNT - 1;
            valuesForMore = await getOrderValue(order, saleMeta, quantity);
            msgValueForMore = valuesForMore.totalTransaction;

            tx = await saleContract
                .connect(BUYER)
                .buy(
                    order,
                    signature,
                    SELLING_AMOUNT - 1,
                    saleMeta,
                    saleMetaSignature,
                    {
                        value: msgValueForMore,
                    },
                );

            await expect(tx).to.changeEtherBalances(
                [OWNER, BUYER, serviceFeeRecipientAccount],
                [
                    valuesForMore.sellerEndValue,
                    msgValueForMore.mul(toBN(-1)),
                    valuesForMore.serviceFees,
                ],
            );
        }
    });
});
