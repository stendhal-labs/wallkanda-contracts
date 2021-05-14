const hre = require('hardhat');
// scripts/create-box.js
const { ethers, upgrades } = require('hardhat');

const {
    constants, // Common constants, like the zero address and largest integers
} = require('@openzeppelin/test-helpers');

function expectEvent(receipt, event) {
    const found = (receipt.events || []).find((log) => log.event === event);

    if (!found) {
        throw new Error(`Event ${event} not found`);
    }

    return found;
}

async function main() {
    let saleContract;
    let transferProxy;
    let erc721;
    let erc1155;

    let addr2;
    let addr3;

    let typeERC721;
    let typeERC1155;

    let order721_OK;
    let order721_OK_TAKER;

    let order721_KO;

    let order1155_OK;
    let order1155_KO;

    let orderId;

    let serviceFee;

    function toBN(value) {
        return ethers.BigNumber.from(value);
    }

    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // We get the contract to deploy
    const SimpleSale = await ethers.getContractFactory('SimpleSale');
    const TransferProxy = await ethers.getContractFactory('TransferProxy');

    // mocks
    const ERC721Dummy = await ethers.getContractFactory('Dummy721');
    const ERC1155Dummy = await ethers.getContractFactory('Dummy1155');
    // Deploy transferProxy, this will set caller as the Owner
    transferProxy = await upgrades.deployProxy(TransferProxy, []);
    await transferProxy.deployed();

    // deploy SimpleSale contract
    saleContract = await upgrades.deployProxy(SimpleSale, [
        addr3.address,
        transferProxy.address,
        250,
    ]);

    await saleContract.deployed();
    console.log('SimpleSale:', saleContract.address);

    // add contract as operators on the TransferProxy
    await transferProxy.grantRole(
        await transferProxy.OPERATOR_ROLE(),
        saleContract.address,
    );

    serviceFee = await saleContract.buyerFee();

    erc721 = await ERC721Dummy.connect(addr2).deploy();
    await erc721.deployed();
    console.log('ERC721:', erc721.address);

    erc1155 = await ERC1155Dummy.connect(addr2).deploy();
    await erc1155.deployed();
    console.log('ERC1155:', erc1155.address);

    typeERC1155 = 0;
    typeERC721 = 1;

    await erc721.connect(addr2).setApprovalForAll(transferProxy.address, true);
    await erc1155.connect(addr2).setApprovalForAll(transferProxy.address, true);

    let erc721TokenId = 10;
    let erc1155TokenId = 10;
    let orderNonce = 0;

    const erc721Ids = [];
    const erc1155Ids = [];
    // sign message with account
    async function signMessage(message, account = owner) {
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

    function getOrderValue(order, buying = 1) {
        let total = toBN(buying).mul(toBN(order.unitPrice));
        let fees = total.mul(serviceFee).div(toBN(10000));

        return {
            total,
            fees,
            value: total.add(fees),
        };
    }
    async function doERC721() {
        erc721TokenId++;
        // create item
        await erc721.connect(addr2).mint(erc721TokenId);
        erc721Ids.push(erc721TokenId);

        // create order for item
        const orderData = {
            tokenType: typeERC721,
            exchange: saleContract.address,
            owner: addr2.address,
            token: erc721.address,
            tokenId: erc721TokenId,
            quantity: 1,
            orderNonce: orderNonce++,
            unitPrice: ethers.utils.parseEther('0.01'),
            total: 0,
            endValue: 0,
            taker: constants.ZERO_ADDRESS,
            buyToken: constants.ZERO_ADDRESS,
            maxByBuy: 0,
        };

        const orderMessage = await saleContract
            .connect(addr2)
            .prepareOrderMessage(orderData);

        const orderSignature = await signMessage(orderMessage, addr2);

        // fulfill order
        const value = getOrderValue(orderData);
        console.log(value.value.valueOf());
        await saleContract.connect(addr4).buy(orderData, orderSignature, 1, {
            value: value.value,
        });
    }

    async function doERC1155() {
        erc1155TokenId++;

        // create item
        await erc1155.connect(addr2).mint(erc1155TokenId);
        erc1155Ids.push(erc1155TokenId);

        // create order for item
        const orderData = {
            tokenType: typeERC1155,
            exchange: saleContract.address,
            owner: addr2.address,
            token: erc1155.address,
            tokenId: erc1155TokenId,
            quantity: 5,
            orderNonce: orderNonce++,
            unitPrice: ethers.utils.parseEther('0.01'),
            total: 0,
            endValue: 0,
            taker: constants.ZERO_ADDRESS,
            buyToken: constants.ZERO_ADDRESS,
            maxByBuy: 0,
        };

        const orderMessage = await saleContract
            .connect(addr2)
            .prepareOrderMessage(orderData);

        const orderSignature = await signMessage(orderMessage, addr2);

        // fulfill order
        const value = getOrderValue(orderData);
        await saleContract.connect(addr4).buy(orderData, orderSignature, 1, {
            value: value.value,
        });

        const value2 = getOrderValue(orderData, orderData.quantity - 1);
        await saleContract
            .connect(addr4)
            .buy(orderData, orderSignature, orderData.quantity - 1, {
                value: value2.value,
            });
    }

    // create all ids
    for (let i = 0; i < 5; i++) {
        await doERC721();
        await doERC1155();
    }
    // do some transfers
    await erc721
        .connect(addr2)
        ['safeTransferFrom(address,address,uint256)'](
            await addr2.getAddress(),
            await addr3.getAddress(),
            erc721Ids[0],
        );

    await erc721
        .connect(addr2)
        ['safeTransferFrom(address,address,uint256)'](
            await addr2.getAddress(),
            await addr4.getAddress(),
            erc721Ids[1],
        );

    await erc1155
        .connect(addr2)
        .safeTransferFrom(
            await addr2.getAddress(),
            await addr3.getAddress(),
            erc1155Ids[0],
            3,
            [],
        );

    await erc1155
        .connect(addr2)
        .safeTransferFrom(
            await addr2.getAddress(),
            await addr4.getAddress(),
            erc1155Ids[1],
            3,
            [],
        );

    // do some burns
    await erc721.connect(addr2).burn(erc721Ids[2]);

    await erc721.connect(addr2).burn(erc721Ids[3]);

    await erc1155.connect(addr2).burn(erc1155Ids[1], 3);

    await erc1155.connect(addr2).burn(erc1155Ids[2], 3);

    await erc1155.connect(addr2).burn(erc1155Ids[3], 10);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
