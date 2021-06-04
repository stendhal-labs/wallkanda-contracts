const { expect } = require('chai');

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

    beforeEach(async function () {
        [
            owner,
            addr1,
            addr2,
            addr3,
            addr4,
            OWNER,
            BUYER,
        ] = await ethers.getSigners();

        // We get the contract to deploy
        const Exchange = await ethers.getContractFactory('Exchange');
        const TransferProxy = await ethers.getContractFactory('TransferProxy');

        // mocks
        const ERC721Dummy = await ethers.getContractFactory('Dummy721');

        // Deploy transferProxy, this will set caller as the Owner
        transferProxy = await upgrades.deployProxy(TransferProxy, []);
        await transferProxy.deployed();

        // deploy Exchange contract
        saleContract = await upgrades.deployProxy(Exchange, [
            addr3.address,
            transferProxy.address,
            250,
            250,
        ]);

        await saleContract.deployed();

        // add contract as operators on the TransferProxy
        await transferProxy.addOperators([saleContract.address]);

        erc721 = await ERC721Dummy.connect(OWNER).deploy();

        await erc721
            .connect(OWNER)
            .setApprovalForAll(transferProxy.address, true);

        // creation order
        order = {
            tokenType: 1,
            exchange: saleContract.address,
            maker: await OWNER.getAddress(),
            token: erc721.address,
            tokenId: ID_ERC721,
            quantity: 1,
            orderNonce: 1337,
            unitPrice: PRICE,
            taker: '0x0000000000000000000000000000000000000000',
            buyToken: '0x0000000000000000000000000000000000000000',
            maxPerBuy: 0,
        };

        signature = await signOrder(order);
        values = await getOrderValue(order);
        msgValue = values.totalTransaction;
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

    it('Should fail because signature is not the one expected', async () => {
        await expect(
            saleContract.connect(BUYER).buy(
                order,
                {
                    ...signature,
                    v: '0x10',
                },
                1,
                {
                    value: values.totalTransaction.div(toBN(2)).toString(),
                },
            ),
        ).to.be.revertedWith('Sale: Incorrect order signature');
    });

    it('Should fail because value is not the one expected', async () => {
        await expect(
            saleContract.connect(BUYER).buy(order, signature, 1, {
                value: values.totalTransaction.div(toBN(2)).toString(),
            }),
        ).to.be.revertedWith('Sale: Sent value is incorrect');
    });

    it('Should transfer ERC721', async () => {
        await expect(
            saleContract.connect(BUYER).buy(order, signature, 1, {
                value: msgValue,
            }),
        )
            .to.emit(saleContract, 'Buy')
            .to.emit(saleContract, 'CloseOrder');

        // NEW NFT OWNER.address SHOULD BE BUYER.address
        const ownerOf = await erc721.ownerOf(order.tokenId);
        expect(ownerOf.toString()).to.be.equal(
            BUYER.address,
            "ERC721 didn't go to BUYER.address",
        );
    });

    it('Should change balances after Transfer', async () => {
        const tx = await saleContract.connect(BUYER).buy(order, signature, 1, {
            value: msgValue,
        });

        const royaltiesRecipient = new ethers.VoidSigner(
            values.royaltiesRecipient,
            OWNER.provider,
        );

        await expect(tx).to.changeEtherBalances(
            [OWNER, BUYER, addr3, royaltiesRecipient],
            [
                values.sellerEndValue,
                msgValue.mul(toBN(-1)),
                values.serviceFees,
                values.royaltiesAmount,
            ],
        );
    });

    it('Should fail because same sale order with same nonce already closed on sale order', async () => {
        // buy once
        await saleContract.connect(BUYER).buy(order, signature, 1, {
            value: msgValue,
        });

        // try to buy again
        await expect(
            saleContract.connect(BUYER).buy(order, signature, 1, {
                value: msgValue,
            }),
        ).to.be.revertedWith('Sale: Order already closed or quantity too high');
    });
});
