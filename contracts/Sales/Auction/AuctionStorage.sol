// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title An Auction contract
/// @author Simon Fremaux
/// @notice Only uses native currency for bidding
/// @dev Creating an auction is made by signing a message off-chain
/// @dev all calls have therefore to add the auction params and the signature of the auction maker
abstract contract AuctionStorage {
    enum TokenType {
        ETH,
        ERC20,
        ERC1155,
        ERC721
    }

    /// @notice emitted when a new high Bid takes place
    /// @param auctionId bytes32 - the auction Id
    /// @param bidder address - the bidder
    /// @param value uint256 - value of the bid
    event Bid(bytes32 indexed auctionId, address indexed bidder, uint256 value);
    /// @notice emitted when an auction is canceled
    /// @param auctionId bytes32 - the auction Id
    event CancelAuction(bytes32 indexed auctionId);
    event CancelBid(
        bytes32 indexed auctionId,
        address indexed bidder,
        uint256 value
    );
    event CloseAuction(
        bytes32 indexed auctionId,
        address indexed bidder,
        uint256 value,
        address operator
    );

    struct AuctionParams {
        // a nonce as to not reuse the same auctionId
        // if auctionning several time the same token
        uint256 nonce;
        // address of the auction maker
        address maker;
        // token type (erc1155 or erc721)
        TokenType tokenType;
        // contract
        address token;
        // the token auctioned
        uint256 tokenId;
        // how many are auctioned, unused for ERC721
        uint256 quantity;
        // minimum bid accepted
        uint256 minBid;
        // duration in seconds
        uint256 duration;
        // a bid that will trigger the timed auction
        uint256 amountTrigger;
        //
        uint256 startDate;
    }

    struct AuctionDetails {
        // highest bidder address
        address highestBidder;
        // if closed
        bool closed;
        // when the timed auction ends
        uint256 endDate;
    }

    uint256 public sellerServiceFee;
    mapping(bytes32 => AuctionDetails) public auctions;
    mapping(bytes32 => mapping(address => uint256)) public auctionsBids;
}
