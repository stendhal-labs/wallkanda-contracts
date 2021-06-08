// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import '../Proxys/Transfer/ITransferProxy.sol';
import '../Tokens/ERC2981/IERC2981Royalties.sol';

contract ExchangeStorage {
    enum TokenType {ETH, ERC20, ERC1155, ERC721}

    event Buy(
        uint256 indexed orderNonce,
        address indexed token,
        uint256 indexed tokenId,
        uint256 amount,
        address maker,
        address buyToken,
        uint256 buyTokenId,
        uint256 buyAmount,
        address buyer,
        uint256 total,
        uint256 serviceFee
    );

    event CloseOrder(
        uint256 orderNonce,
        address indexed token,
        uint256 indexed tokenId,
        address maker
    );

    struct Asset {
        /* asset type, erc721 or erc1155 */
        TokenType tokenType;
        /* asset contract  */
        address token;
        /* asset id */
        uint256 tokenId;
        /* asset quantity */
        uint256 quantity;
    }

    struct OrderData {
        /* Exchange address - should be current contract */
        address exchange;
        /* maker of the order */
        address maker;
        /* taker of the order */
        address taker;
        /* out asset */
        Asset outAsset;
        /* in asset: this is the UNIT PRICE; which means amount bought must be multiplicated by quantity here */
        Asset inAsset;
        /* Max items by each buy. Allow to create one big order, but to limit how many can be bought at once */
        uint256 maxPerBuy;
        /* OrderNonce so we can have different order for the same tokenId */
        uint256 orderNonce;
    }

    // orderId => completed amount
    mapping(bytes32 => uint256) public completed;
}
