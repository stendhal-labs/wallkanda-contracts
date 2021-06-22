// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import '../Proxys/Transfer/ITransferProxy.sol';

import './BaseExchange.sol';
import './ExchangeStorage.sol';

contract Exchange is BaseExchange, ReentrancyGuardUpgradeable, ExchangeStorage {
    function initialize(
        address payable beneficiary_,
        address transferProxy_,
        uint256 buyerServiceFee_,
        uint256 sellerServiceFee_
    ) public initializer {
        __BaseExchange_init(
            beneficiary_,
            transferProxy_,
            buyerServiceFee_,
            sellerServiceFee_
        );

        __ReentrancyGuard_init_unchained();
    }

    function prepareOrderMessage(OrderData memory order)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(order));
    }

    /**
     * @dev this function computes all the values that we need for the exchange.
     * this can be called off-chain before buying so all values can be computed easily
     *
     * It will also help when we introduce tokens for payment
     */
    function computeValues(OrderData memory order, uint256 amount)
        public
        view
        returns (OrderTransfers memory orderTransfers)
    {
        return
            _computeValues(
                order.inAsset.quantity,
                order.outAsset.token,
                order.outAsset.tokenId,
                amount
            );
    }

    function buy(
        OrderData memory order,
        Signature calldata sig,
        uint256 amount // quantity to buy
    ) external payable nonReentrant {
        // verify that order is for this contract
        require(order.exchange == address(this), 'Sale: Wrong exchange.');

        // verify if this order is for a specific address
        if (order.taker != address(0)) {
            require(msg.sender == order.taker, 'Sale: Wrong user.');
        }

        require(
            // amount must be > 0
            (amount > 0) &&
                // and amount must be <= at maxPerBuy
                (order.maxPerBuy == 0 || amount <= order.maxPerBuy),
            'Sale: Wrong amount.'
        );

        // verify order signature
        _validateOrderSig(order, sig);

        // update order state
        bool closed = _verifyOpenAndModifyState(order, amount);

        // transfer everything
        OrderTransfers memory orderTransfers = _doTransfers(order, amount);

        // emit buy
        emit Buy(
            order.orderNonce,
            order.outAsset.token,
            order.outAsset.tokenId,
            amount,
            order.maker,
            order.inAsset.token,
            order.inAsset.tokenId,
            order.inAsset.quantity,
            msg.sender,
            orderTransfers.total,
            orderTransfers.serviceFees
        );

        // if order is closed, emit close.
        if (closed) {
            emit CloseOrder(
                order.orderNonce,
                order.outAsset.token,
                order.outAsset.tokenId,
                order.maker
            );
        }
    }

    function cancelOrder(
        address token,
        uint256 tokenId,
        uint256 quantity,
        uint256 orderNonce
    ) public {
        bytes32 orderId =
            _getOrderId(token, tokenId, quantity, msg.sender, orderNonce);
        completed[orderId] = quantity;
        emit CloseOrder(orderNonce, token, tokenId, msg.sender);
    }

    function _validateOrderSig(OrderData memory order, Signature calldata sig)
        public
        pure
    {
        require(
            recoverMessageSignature(prepareOrderMessage(order), sig) ==
                order.maker,
            'Sale: Incorrect order signature'
        );
    }

    // returns orderId for completion
    function _getOrderId(
        address token,
        uint256 tokenId,
        uint256 quantity,
        address maker,
        uint256 orderNonce
    ) internal pure returns (bytes32) {
        return
            keccak256(abi.encode(token, tokenId, quantity, maker, orderNonce));
    }

    function _verifyOpenAndModifyState(
        OrderData memory order,
        uint256 buyingAmount
    ) internal returns (bool) {
        bytes32 orderId =
            _getOrderId(
                order.outAsset.token,
                order.outAsset.tokenId,
                order.outAsset.quantity,
                order.maker,
                order.orderNonce
            );
        uint256 comp = completed[orderId] + buyingAmount;

        // makes sure order is not already closed
        require(
            comp <= order.outAsset.quantity,
            'Sale: Order already closed or quantity too high'
        );

        // update order completion amount
        completed[orderId] = comp;

        // returns if order is closed or not
        return comp == order.outAsset.quantity;
    }

    function _doTransfers(OrderData memory order, uint256 amount)
        internal
        returns (OrderTransfers memory orderTransfers)
    {
        // get all values into a struct
        // it will help later when we introduce token payments
        orderTransfers = computeValues(order, amount);

        // this here is because we're not using tokens
        // verify that msg.value is right
        require(
            // total = (unitPrice * amount) + buyerFee
            msg.value == orderTransfers.totalTransaction,
            'Sale: Sent value is incorrect'
        );

        // transfer ethereum
        if (orderTransfers.total > 0) {
            // send service fees (buyerFee + sellerFees) to beneficiary
            if (orderTransfers.serviceFees > 0) {
                beneficiary.transfer(orderTransfers.serviceFees);
            }

            if (orderTransfers.royaltiesAmount > 0) {
                payable(orderTransfers.royaltiesRecipient).transfer(
                    orderTransfers.royaltiesAmount
                );
            }

            // send what is left to seller
            if (orderTransfers.sellerEndValue > 0) {
                payable(order.maker).transfer(orderTransfers.sellerEndValue);
            }
        }

        // send token to buyer
        if (order.outAsset.tokenType == TokenType.ERC1155) {
            transferProxy.erc1155SafeTransferFrom(
                order.outAsset.token,
                order.maker,
                msg.sender,
                order.outAsset.tokenId,
                amount,
                ''
            );
        } else {
            transferProxy.erc721SafeTransferFrom(
                order.outAsset.token,
                order.maker,
                msg.sender,
                order.outAsset.tokenId,
                ''
            );
        }
    }
}