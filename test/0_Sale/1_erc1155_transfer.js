const { expect } = require('chai');

const toBN = ethers.BigNumber.from;

describe('WallkandaSale ERC1155', function () {
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
        const WallkandaSale = await ethers.getContractFactory('WallkandaSale');
        const TransferProxy = await ethers.getContractFactory('TransferProxy');

        // mocks
        const ERC1155Dummy = await ethers.getContractFactory('Dummy1155');

        // Deploy transferProxy, this will set caller as the Owner
        transferProxy = await upgrades.deployProxy(TransferProxy, []);
        await transferProxy.deployed();

        // deploy WallkandaSale contract
        saleContract = await upgrades.deployProxy(WallkandaSale, [
            addr3.address,
            transferProxy.address,
            250,
            250,
        ]);

        await saleContract.deployed();

        // add contract as operators on the TransferProxy
        await transferProxy.addOperators([saleContract.address]);

        erc1155 = await ERC1155Dummy.connect(OWNER).deploy();

        await erc1155
            .connect(OWNER)
            .setApprovalForAll(transferProxy.address, true);

        // creation order
        order = {
            tokenType: 0,
            exchange: saleContract.address,
            maker: await OWNER.getAddress(),
            token: erc1155.address,
            tokenId: ID_ERC1155,
            quantity: SELLING_AMOUNT,
            orderNonce: 1337,
            unitPrice: PRICE,
            taker: '0x0000000000000000000000000000000000000000',
            buyToken: '0x0000000000000000000000000000000000000000',
            maxPerBuy: 0,
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
                    value: values.total.div(toBN(2)).toString(),
                },
            ),
        ).to.be.revertedWith('Sale: Incorrect order signature');
    });

    it('Should fail because value is not the one expected', async () => {
        await expect(
            saleContract.connect(BUYER).buy(order, signature, 1, {
                value: values.total.div(toBN(2)).toString(),
            }),
        ).to.be.revertedWith('Sale: Sent value is incorrect');
    });

    it('Should transfer ERC1155 and close order', async () => {
        let quantity = 1;
        await expect(
            saleContract.connect(BUYER).buy(order, signature, quantity, {
                value: msgValue,
            }),
        ).to.emit(saleContract, 'Buy');

        const balanceOf = await erc1155.balanceOf(BUYER.address, order.tokenId);
        expect(balanceOf.valueOf()).to.be.equal(
            quantity,
            "ERC1155 didn't go to BUYER",
        );

        quantity = SELLING_AMOUNT - 1;
        await expect(
            saleContract.connect(BUYER).buy(order, signature, quantity, {
                value: msgValueForMore,
            }),
        )
            .to.emit(saleContract, 'Buy')
            .to.emit(saleContract, 'CloseOrder');
    });

    it('Should change balances after Transfer', async () => {
        let tx = await saleContract.connect(BUYER).buy(order, signature, 1, {
            value: msgValue,
        });

        await expect(tx).to.changeEtherBalances(
            [OWNER, BUYER, addr3],
            [values.sellerEndValue, msgValue.mul(toBN(-1)), values.serviceFees],
        );

        tx = await saleContract
            .connect(BUYER)
            .buy(order, signature, SELLING_AMOUNT - 1, {
                value: msgValueForMore,
            });

        await expect(tx).to.changeEtherBalances(
            [OWNER, BUYER, addr3],
            [
                valuesForMore.sellerEndValue,
                msgValueForMore.mul(toBN(-1)),
                valuesForMore.serviceFees,
            ],
        );
    });
});
