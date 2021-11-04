const { expect } = require('chai');
const { deployments, ethers } = require('hardhat');
const { constants } = require('ethers');

const toBN = ethers.BigNumber.from;

describe('Exchange 721', function () {
    // preparation
    // create ERC721
    // mint 1 erc721 for user1
    // user1 approves saleContract to transfer erc721

    // user1 creates an order for 1 erc721;
    // user1 sign this order

    // user2 buys 1 erc721

    // user3 send the exact same transaction as user2, setting buyer as user2
    let OWNER;
    let BUYER;
    let PRICE = ethers.utils.parseEther('0.01');
    let ID_ERC721 = 1;

    let saleContract;
    let erc721;
    let order;
    let signature;
    let values;
    let msgValue;
    let signer;

    const serviceFeeRecipient = process.env.SERVICE_FEE_BENEFICIARY;

    beforeEach(async function () {
        [owner, signer, addr2, addr3, addr4, OWNER, BUYER, CURATION] =
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

        // mocks
        const ERC721Dummy = await ethers.getContractFactory('Dummy721');
        erc721 = await ERC721Dummy.connect(OWNER).deploy();

        await erc721
            .connect(OWNER)
            .setApprovalForAll(transferProxy.address, true);

        // creation order
        order = {
            orderData: {
                exchange: saleContract.address,
                maker: await OWNER.getAddress(),
                taker: ethers.constants.AddressZero,
                outAsset: {
                    tokenType: 3,
                    token: erc721.address,
                    tokenId: ID_ERC721,
                    quantity: 1,
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
            },
            revenueRecipient: ethers.constants.AddressZero,
            donationRecipient: await CURATION.getAddress(),
            donationPercentage: 150, // 1.50%
        };

        signature = await signOrder(order);
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
        const message = await saleContract.prepareOrderV2Message(order);

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

    it('Should fail because signature is not the one expected', async () => {
        let fakeSignature = {
            ...signature,
            v: '0x10',
        };
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            fakeSignature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        await expect(
            saleContract
                .connect(BUYER)
                .buyV2(order, fakeSignature, 1, saleMeta, saleMetaSignature, {
                    value: values.totalTransaction.div(toBN(2)).toString(),
                }),
        ).to.be.revertedWith('Sale: Incorrect order signature');
    });

    it('Should fail because value is not the one expected', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        await expect(
            saleContract
                .connect(BUYER)
                .buyV2(order, signature, 1, saleMeta, saleMetaSignature, {
                    value: values.totalTransaction.div(toBN(2)).toString(),
                }),
        ).to.be.revertedWith('Sale: Sent value is incorrect');
    });

    it('Should fail because saleMeta signature is not valid', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        await expect(
            saleContract.connect(BUYER).buyV2(
                order,
                signature,
                1,
                saleMeta,
                {
                    ...saleMetaSignature,
                    v: '0x10',
                },
                {
                    value: msgValue,
                },
            ),
        ).to.be.revertedWith('Sale: Incorrect order meta signature');
    });

    it('Should fail because saleMeta is expired', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
            true,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        await expect(
            saleContract
                .connect(BUYER)
                .buyV2(order, signature, 1, saleMeta, saleMetaSignature, {
                    value: msgValue,
                }),
        ).to.be.revertedWith('Sale: Buy Order expired');
    });

    it('Should fail because saleMeta is not for this user', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            addr3.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        await expect(
            saleContract
                .connect(BUYER)
                .buyV2(order, signature, 1, saleMeta, saleMetaSignature, {
                    value: msgValue,
                }),
        ).to.be.revertedWith('Sale Metadata not for operator');
    });

    it('Should transfer ERC721', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        await expect(
            saleContract
                .connect(BUYER)
                .buyV2(order, signature, 1, saleMeta, saleMetaSignature, {
                    value: msgValue,
                }),
        )
            .to.emit(saleContract, 'Buy')
            .to.emit(saleContract, 'CloseOrder');

        // NEW NFT OWNER.address SHOULD BE BUYER.address
        const ownerOf = await erc721.ownerOf(order.orderData.outAsset.tokenId);
        expect(ownerOf.toString()).to.be.equal(
            BUYER.address,
            "ERC721 didn't go to BUYER.address",
        );
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

        const tx = await saleContract
            .connect(BUYER)
            .buyV2(order, signature, 1, saleMeta, saleMetaSignature, {
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

        const donationRecipient = new ethers.VoidSigner(
            order.donationRecipient,
            OWNER.provider,
        );

        await expect(tx).to.changeEtherBalances(
            [
                OWNER,
                BUYER,
                serviceFeeRecipientAccount,
                royaltiesRecipient,
                donationRecipient,
            ],
            [
                values.sellerEndValue,
                msgValue.mul(toBN(-1)),
                values.serviceFees,
                values.royaltiesAmount,
                values.donationValue,
            ],
        );
    });

    it('Should fail because same sale order with same nonce already closed on sale order', async () => {
        const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
            signature,
            BUYER.address,
            process.env.SELLER_FEE,
            process.env.BUYER_FEE,
        );

        values = await getOrderValue(order, saleMeta);
        msgValue = values.totalTransaction;

        // buy once
        await saleContract
            .connect(BUYER)
            .buyV2(order, signature, 1, saleMeta, saleMetaSignature, {
                value: msgValue,
            });

        {
            const { saleMeta, saleMetaSignature } = await getSignedSaleMeta(
                signature,
                BUYER.address,
                process.env.SELLER_FEE,
                process.env.BUYER_FEE,
            );

            // try to buy again
            await expect(
                saleContract
                    .connect(BUYER)
                    .buyV2(order, signature, 1, saleMeta, saleMetaSignature, {
                        value: msgValue,
                    }),
            ).to.be.revertedWith(
                'Sale: Order already closed or quantity too high',
            );
        }
    });
});
