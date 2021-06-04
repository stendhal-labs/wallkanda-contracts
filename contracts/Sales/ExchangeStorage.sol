// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import '../Proxys/Transfer/ITransferProxy.sol';
import '../Tokens/ERC2981/IERC2981Royalties.sol';

contract ExchangeStorage {
    event Buy(
        uint256 indexed orderNonce,
        address indexed token,
        uint256 indexed tokenId,
        uint256 amount,
        address maker,
        address buyer,
        uint256 value,
        uint256 serviceFee
    );

    event CloseOrder(
        uint256 orderNonce,
        address indexed token,
        uint256 indexed tokenId,
        address maker
    );

    // orderId => completed amount
    mapping(bytes32 => uint256) public completed;

    struct OrderData {
        /* token type, erc721 or erc1155 */
        TokenType tokenType;
        /* Exchange address - should be current contract */
        address exchange;
        /* maker of the order */
        address maker;
        /* taker of the order */
        address taker;
        /* Token contract  */
        address token;
        /* TokenId */
        uint256 tokenId;
        /* Quantity for this order */
        uint256 quantity;
        /* Max items by each buy. Allow to create one big order, but to limit how many can be bought at once */
        uint256 maxPerBuy;
        /* OrderNonce so we can have different order for the same tokenId */
        uint256 orderNonce;
        /* Buy token */
        address buyToken; /* address(0) for current chain native token */
        /* Unit price */
        uint256 unitPrice;
    }

    struct OrderTransfers {
        /* total order value */
        uint256 total;
        /* total value for seller (total - sellerServiceFees - royalties) */
        uint256 sellerEndValue;
        /* total transaction */
        uint256 totalTransaction;
        /* all service fees */
        uint256 serviceFees;
        /* royalties amount to transfer */
        uint256 royaltiesAmount;
        /* royalties recipient */
        address royaltiesRecipient;
    }
}
