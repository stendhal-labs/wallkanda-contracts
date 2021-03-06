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
        address exchangeSigner_
    ) public initializer {
        __BaseExchange_init(beneficiary_, transferProxy_);

        __ReentrancyGuard_init_unchained();

        setExchangeSigner(exchangeSigner_);
    }

    /// @dev Allows owner to set the address used to sign the sales Metadata
    /// @param exchangeSigner_ address of the signer
    function setExchangeSigner(address exchangeSigner_) public onlyOwner {
        require(exchangeSigner_ != address(0), 'Exchange signer must be valid');
        exchangeSigner = exchangeSigner_;
    }

    function prepareOrderMessage(OrderData memory order)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(order));
    }

    function prepareOrderV2Message(OrderDataV2 memory order)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(order));
    }

    function prepareOrderMetaMessage(
        Signature memory orderSig,
        OrderMeta memory saleMeta
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(orderSig, saleMeta));
    }

    /**
     * @dev this function computes all the values that we need for the exchange.
     * this can be called off-chain before buying so all values can be computed easily
     *
     * It will also help when we introduce tokens for payment
     */
    function computeValues(
        OrderDataV2 memory order,
        uint256 amount,
        OrderMeta memory saleMeta
    ) public view returns (OrderTransfers memory orderTransfers) {
        return
            _computeValues(
                order.orderData.inAsset.quantity,
                order.orderData.outAsset.token,
                order.orderData.outAsset.tokenId,
                amount,
                saleMeta.buyerFee,
                saleMeta.sellerFee,
                order.donationRecipient,
                order.donationPercentage
            );
    }

    function buyV2(
        OrderDataV2 memory order,
        Signature memory sig,
        uint256 amount, // quantity to buy
        OrderMeta memory saleMeta,
        Signature memory saleMetaSignature
    ) external payable nonReentrant {
        _verifyOrderData(order.orderData, amount);

        // verify exchange meta for buy
        _verifyOrderMeta(sig, saleMeta, saleMetaSignature);

        // verify order signature
        _validateOrderV2Sig(order, sig);

        _buy(order, amount, saleMeta);
    }

    function buy(
        OrderData memory order,
        Signature memory sig,
        uint256 amount, // quantity to buy
        OrderMeta memory saleMeta,
        Signature memory saleMetaSignature
    ) external payable nonReentrant {
        _verifyOrderData(order, amount);

        // verify exchange meta for buy
        _verifyOrderMeta(sig, saleMeta, saleMetaSignature);

        // verify order signature
        _validateOrderSig(order, sig);

        // create an orderV2 out of old order
        OrderDataV2 memory orderV2;
        orderV2.orderData = order;

        _buy(orderV2, amount, saleMeta);
    }

    function cancelOrder(
        address token,
        uint256 tokenId,
        uint256 quantity,
        uint256 orderNonce
    ) public {
        bytes32 orderId = _getOrderId(
            token,
            tokenId,
            quantity,
            msg.sender,
            orderNonce
        );
        completed[orderId] = quantity;
        emit CloseOrder(orderNonce, token, tokenId, msg.sender);
    }

    function _validateOrderSig(OrderData memory order, Signature memory sig)
        public
        pure
    {
        require(
            recoverMessageSignature(prepareOrderMessage(order), sig) ==
                order.maker,
            'Sale: Incorrect order signature'
        );
    }

    function _validateOrderV2Sig(OrderDataV2 memory order, Signature memory sig)
        public
        pure
    {
        require(
            recoverMessageSignature(prepareOrderV2Message(order), sig) ==
                order.orderData.maker,
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

    function _verifyOrderData(OrderData memory order, uint256 amount) internal {
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
    }

    function _verifyOpenAndModifyState(
        OrderData memory order,
        uint256 buyingAmount
    ) internal returns (bool) {
        bytes32 orderId = _getOrderId(
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

    /// @dev This function verifies meta for an order
    ///      We use meta to have buyerFee and sellerFee per transaction instead of global
    ///      this also allows to not have open ended orders that could be reused months after it was made
    /// @param orderSig the signature of the order
    /// @param saleMeta the meta for this sale
    /// @param saleSig signature for this sale
    function _verifyOrderMeta(
        Signature memory orderSig,
        OrderMeta memory saleMeta,
        Signature memory saleSig
    ) internal {
        require(
            saleMeta.expiration == 0 || saleMeta.expiration >= block.timestamp,
            'Sale: Buy Order expired'
        );

        require(saleMeta.buyer == msg.sender, 'Sale Metadata not for operator');

        // verifies that saleSig is right
        bytes32 message = prepareOrderMetaMessage(orderSig, saleMeta);
        require(
            recoverMessageSignature(message, saleSig) == exchangeSigner,
            'Sale: Incorrect order meta signature'
        );

        require(usedSaleMeta[message] == false, 'Sale Metadata already used');

        usedSaleMeta[message] = true;
    }

    function _doTransfers(
        OrderDataV2 memory order,
        uint256 amount,
        OrderMeta memory saleMeta
    ) internal returns (OrderTransfers memory orderTransfers) {
        // get all values into a struct
        // it will help later when we introduce token payments
        orderTransfers = computeValues(order, amount, saleMeta);

        // this here is because we're not using tokens
        // verify that msg.value is right
        require(
            // total = (unitPrice * amount) + buyerFee
            msg.value == orderTransfers.totalTransaction,
            'Sale: Sent value is incorrect'
        );

        // transfer ethereum
        if (orderTransfers.totalTransaction > 0) {
            // send service fees (buyerFee + sellerFees) to beneficiary
            if (orderTransfers.serviceFees > 0) {
                beneficiary.transfer(orderTransfers.serviceFees);
            }

            if (orderTransfers.royaltiesAmount > 0) {
                payable(orderTransfers.royaltiesRecipient).transfer(
                    orderTransfers.royaltiesAmount
                );
            }

            if (orderTransfers.donationValue > 0) {
                payable(orderTransfers.donationRecipient).transfer(
                    orderTransfers.donationValue
                );
            }

            // send what is left to seller
            if (orderTransfers.sellerEndValue > 0) {
                payable(
                    order.revenueRecipient != address(0)
                        ? order.revenueRecipient
                        : order.orderData.maker
                ).transfer(orderTransfers.sellerEndValue);
            }
        }

        // send token to buyer
        if (order.orderData.outAsset.tokenType == TokenType.ERC1155) {
            transferProxy.erc1155SafeTransferFrom(
                order.orderData.outAsset.token,
                order.orderData.maker,
                msg.sender,
                order.orderData.outAsset.tokenId,
                amount,
                ''
            );
        } else {
            transferProxy.erc721SafeTransferFrom(
                order.orderData.outAsset.token,
                order.orderData.maker,
                msg.sender,
                order.orderData.outAsset.tokenId,
                ''
            );
        }
    }

    function _buy(
        OrderDataV2 memory orderV2,
        uint256 amount, // quantity to buy
        OrderMeta memory saleMeta
    ) internal {
        // update order state
        bool closed = _verifyOpenAndModifyState(orderV2.orderData, amount);

        // transfer everything
        OrderTransfers memory orderTransfers = _doTransfers(
            orderV2,
            amount,
            saleMeta
        );

        // emit buy
        emit Buy(
            orderV2.orderData.orderNonce,
            orderV2.orderData.outAsset.token,
            orderV2.orderData.outAsset.tokenId,
            amount,
            orderV2.orderData.maker,
            orderV2.orderData.inAsset.token,
            orderV2.orderData.inAsset.tokenId,
            orderV2.orderData.inAsset.quantity,
            msg.sender,
            orderTransfers.total,
            orderTransfers.serviceFees
        );

        // if orderV2.orderData is closed, emit close.
        if (closed) {
            emit CloseOrder(
                orderV2.orderData.orderNonce,
                orderV2.orderData.outAsset.token,
                orderV2.orderData.outAsset.tokenId,
                orderV2.orderData.maker
            );
        }
    }
}
