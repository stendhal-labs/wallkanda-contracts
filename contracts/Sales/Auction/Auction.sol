// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../BaseExchange.sol';
import './AuctionStorage.sol';

/// @title An Auction contract
/// @author Simon Fremaux
/// @notice Only uses native currency for bidding
/// @dev Creating an auction is made by signing a message off-chain
/// @dev most calls have therefore to add the auction params and the signature of the auction maker
contract Auction is BaseExchange, AuctionStorage {
    /// @notice Upgradeable contracts constructor
    /// @param _beneficiary - the address that gets the service fees
    /// @param _transferProxy - the contract used to transfer the NFTs (and others)
    /// @param sellerServiceFee_ - amount of fees on seller
    function initialize(
        address payable _beneficiary,
        address _transferProxy,
        uint256 sellerServiceFee_
    ) public initializer {
        __BaseExchange_init(_beneficiary, _transferProxy);
        if (sellerServiceFee_ > 0) {
            setSellerServiceFee(sellerServiceFee_);
        }
    }

    /// @notice Allows to set service fees for seller
    /// @param sellerServiceFee_ the seller fee
    function setSellerServiceFee(uint256 sellerServiceFee_)
        public
        virtual
        onlyOwner
    {
        sellerServiceFee = sellerServiceFee_;
    }

    /// @notice Place a bid on an auction
    /// @param auctionParams - the parameters defining the auction
    /// @param signature - the signature by the auction creator
    function placeBid(
        AuctionParams memory auctionParams,
        Signature memory signature,
        uint256 amount
    ) external payable {
        bytes32 auctionId = verifyAuctionSignature(auctionParams, signature);
        AuctionDetails storage auction = auctions[auctionId];

        // verify is opened
        require(auction.closed == false, 'Auction: auction closed');

        // verify is not timed OR is not out of time
        if (auctionParams.duration > 0) {
            // if the counter is already on in the contract
            if (auction.endDate > 0) {
                require(block.timestamp < auction.endDate, 'Auction: ended');
            } else if (auctionParams.startDate > 0) {
                // else according to the auction params
                require(
                    block.timestamp <
                        (auctionParams.startDate + auctionParams.duration),
                    'Auction: ended'
                );
            }
        }

        // current highest bid
        uint256 current = auctionsBids[auctionId][auction.highestBidder];
        // newBid
        uint256 newBid = auctionsBids[auctionId][msg.sender] + msg.value;

        // this ensure that we only add the difference to what was already bid
        require(newBid == amount, 'Auction: amount error');

        // verify bid is > current bid & more than minBid
        require(
            newBid >= auctionParams.minBid && newBid > current,
            'Auction: too low'
        );

        uint256 difference = newBid - current;
        // current bid is:
        // - at least 0.1eth higher than last
        // - OR at least 5% higher than last one or
        // this prevents "low balls bids" making auctions go indefinitely
        require(
            difference > 10**17 || difference >= (current * 5) / 100,
            'Auction: increase bid'
        );

        // set new bid for currentUser
        auctionsBids[auctionId][msg.sender] = newBid;
        // set new highestBidder
        auction.highestBidder = msg.sender;

        // if it's a timed auction
        if (auctionParams.duration > 0) {
            // the endDate still not set so we might need to do that
            if (auction.endDate == 0) {
                if (auctionParams.startDate > 0) {
                    auction.endDate =
                        auctionParams.startDate +
                        auctionParams.duration;
                } else if (newBid >= auctionParams.amountTrigger) {
                    auction.endDate = block.timestamp + auctionParams.duration;
                }
            }

            // if we have an endDate and NOW is less than 10 minutes before the end of the auction
            // add 10 minutes
            if (
                auction.endDate > 0 &&
                auction.endDate - block.timestamp < 10 * 60
            ) {
                auction.endDate = block.timestamp + 10 * 60;
            }
        }

        emit Bid(auctionId, msg.sender, newBid);
    }

    /// @notice Accepts the bid from a given bidder
    /// @param auctionParams - the parameters defining the auction
    /// @param bidder - the address of the bidder we accept bid from
    function acceptBid(AuctionParams memory auctionParams, address bidder)
        public
    {
        // verifies sender is auction maker
        require(
            auctionParams.maker == msg.sender,
            'Auction: not auction maker'
        );

        bytes32 auctionId = prepareAuction(auctionParams);
        AuctionDetails storage auction = auctions[auctionId];

        // verify that auction wasn't already closed
        require(auction.closed == false, 'Auction: already closed');

        // verifies there were bids - if no bids call cancelAuction
        require(auction.highestBidder != address(0), 'Auction: no bids');

        // verifies bidder address
        if (bidder == address(0)) {
            bidder = auction.highestBidder;
        }
        require(bidder != address(0), 'Auction: invalid bidder');

        // verify that it's not a timed auction currently running
        require(
            auction.endDate == 0 || block.timestamp >= auction.endDate,
            'Auction: auction not ended'
        );

        _closeAuction(auctionId, auction, auctionParams, bidder);
    }

    /// @notice Allows a bidder to claim the win of an ended timed auction
    /// @dev We do not verify signature here, because any previous action creating a bid will alredy verify it
    /// @dev So a long as it's not closed and has a highestBidder, we can consider it's valid
    /// @notice This is use so  they don't have to wait for the auctioner to do an action
    /// @param auctionParams - the parameters defining the auction
    function claimResult(AuctionParams memory auctionParams) external {
        bytes32 auctionId = prepareAuction(auctionParams);
        AuctionDetails storage auction = auctions[auctionId];

        // verify that auction wasn't already closed
        require(auction.closed == false, 'Auction: already closed');

        // verify that it is a timed auction AND that it is block.timestamp finished
        require(
            auction.endDate > 0 && block.timestamp > auction.endDate,
            'Auction: auction not ended'
        );

        // verify that msg.sender is the highest bidder
        require(
            auction.highestBidder != msg.sender,
            'Auction: not highest bidder'
        );

        _closeAuction(auctionId, auction, auctionParams, msg.sender);
    }

    /// @notice Cancel an auction
    /// @param auctionParams - the parameters defining the auction
    function cancelAuction(AuctionParams memory auctionParams) public {
        require(
            auctionParams.maker == msg.sender,
            'Auction: not auction maker'
        );

        bytes32 auctionId = prepareAuction(auctionParams);
        AuctionDetails storage auction = auctions[auctionId];

        require(
            auction.highestBidder == address(0),
            'Auction: can not cancel an auction with valid bid'
        );

        require(auction.closed == false, 'Auction: already closed');

        auction.closed = true;
        emit CancelAuction(auctionId);
    }

    /// @notice Allows a user to cancel their bid on an auction, only if it's not the highest bid
    /// @dev Must be provided auctionParams and creator signature
    /// @param auctionParams - the parameters defining the auction
    /// @param signature - the signature by the auction creator
    function cancelBid(
        AuctionParams memory auctionParams,
        Signature memory signature
    ) external {
        bytes32 auctionId = verifyAuctionSignature(auctionParams, signature);
        AuctionDetails storage auction = auctions[auctionId];

        // verify it's not the higgest bid - can't cancel a highest bid
        require(
            auction.closed || msg.sender != auction.highestBidder,
            'Auction: can not cancel highest bid'
        );

        uint256 value = auctionsBids[auctionId][msg.sender];
        require(value > 0, 'Auction: No current bid for user');

        // set to 0
        delete auctionsBids[auctionId][msg.sender];
        payable(msg.sender).transfer(value);
        emit CancelBid(auctionId, msg.sender, value);
    }

    /// @notice Hashes the auction parameters to create an unique identifier from it
    /// @param auctionParams - the parameters defining the auction
    /// @return bytes32 the identifier of the auction and also the message signed by the maker
    function prepareAuction(AuctionParams memory auctionParams)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(auctionParams));
    }

    /// @notice Verifies an auction signature
    /// @param auctionParams - the parameters defining the auction
    /// @param signature - the signature by the auction creator
    /// @return auctionId - the identifier of the auction and also the message signed by the maker
    function verifyAuctionSignature(
        AuctionParams memory auctionParams,
        Signature memory signature
    ) public pure returns (bytes32 auctionId) {
        // verifies if signature is valid and has been signed by auctionParams.maker
        auctionId = prepareAuction(auctionParams);
        require(
            auctionParams.maker ==
                recoverMessageSignature(auctionId, signature),
            'Signature missmatch'
        );
    }

    /// @notice compute the values (total tx, service fees, royalties, ...) according to the current exchange
    /// @dev orderTransfers will contain all values needed to transfer dues to royaltiesRecipient and platform
    /// @param auctionParams the auction parameters
    /// @return orderTransfers an object with all needed values
    function computeValues(AuctionParams memory auctionParams)
        public
        view
        returns (OrderTransfers memory orderTransfers)
    {
        return
            _computeValues(
                auctionParams.quantity,
                auctionParams.token,
                auctionParams.tokenId,
                1,
                0, // buyerServiceFee can only be 0 on auctions
                sellerServiceFee,
                address(0),
                0
            );
    }

    /// @notice Will finish an auction by sending token to bidder and bid to auctionParams.maker
    /// @param auctionId - the auction identifier
    /// @param auction - the auction in storage
    /// @param auctionParams - the parameters defining the auction
    /// @param bidder - the bidder that was chosen
    function _closeAuction(
        bytes32 auctionId,
        AuctionDetails storage auction,
        AuctionParams memory auctionParams,
        address bidder
    ) internal {
        // close auction
        auction.closed = true;

        uint256 value = auctionsBids[auctionId][bidder];
        delete auctionsBids[auctionId][bidder];

        OrderTransfers memory orderTransfers = computeValues(auctionParams);

        // transfer platform fees
        if (orderTransfers.serviceFees > 0) {
            beneficiary.transfer(orderTransfers.serviceFees);
        }

        // transfer royalties
        if (orderTransfers.royaltiesAmount > 0) {
            payable(orderTransfers.royaltiesRecipient).transfer(
                orderTransfers.royaltiesAmount
            );
        }

        // transfer end value to msg sender
        payable(auctionParams.maker).transfer(orderTransfers.sellerEndValue);

        // transfer NFT to bidder
        if (auctionParams.tokenType == TokenType.ERC1155) {
            transferProxy.erc1155SafeTransferFrom(
                auctionParams.token,
                auctionParams.maker,
                bidder,
                auctionParams.tokenId,
                auctionParams.quantity,
                ''
            );
        } else if (auctionParams.tokenType == TokenType.ERC721) {
            transferProxy.erc721SafeTransferFrom(
                auctionParams.token,
                auctionParams.maker,
                bidder,
                auctionParams.tokenId,
                ''
            );
        }

        emit CloseAuction(auctionId, bidder, value, msg.sender);
    }
}
