// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title  SubscriptionNFT
 * @notice Soulbound ERC-721 representing an active Cyclo subscription.
 *         Each token is non-transferable. Only the contract owner (intended to
 *         be SubscriptionManager) may mint or burn tokens.
 *
 * @dev    Soulbound enforcement: `_update` reverts with `Soulbound()` whenever
 *         both `from` and `to` are non-zero addresses. Mints (from == address(0))
 *         and burns (to == address(0)) are still permitted.
 *
 *         Token IDs start at 1. ID 0 is the sentinel for "no subscription".
 */
contract SubscriptionNFT is ERC721 {

    // ── Custom errors ─────────────────────────────────────────────────────────

    /// @notice Subscriber has no active token for the given plan.
    error NotSubscribed();

    /// @notice Subscriber already holds a token for the given plan.
    error AlreadySubscribed();

    /// @notice Token transfers are blocked; tokens are soulbound to their minted address.
    error Soulbound();

    /// @notice Caller is not the contract owner.
    error Unauthorized();

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a subscription token is minted.
    event Minted(address indexed subscriber, uint256 indexed planId, uint256 tokenId);

    /// @notice Emitted when a subscription token is burned.
    event Burned(address indexed subscriber, uint256 indexed planId, uint256 tokenId);

    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice Address authorised to mint and burn tokens. Set to msg.sender on deploy.
    address public owner;

    uint256 private _nextTokenId = 1;

    mapping(uint256 tokenId  => address subscriber)                       private _subscriberOf;
    mapping(address subscriber => mapping(uint256 planId => uint256 tokenId)) private _tokenOf;
    mapping(uint256 tokenId  => uint256 planId)                           private _planOf;

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @notice Deploys the contract and sets `msg.sender` as the sole owner.
    /// @param name   ERC-721 token name (e.g. "Cyclo Subscription")
    /// @param symbol ERC-721 token symbol (e.g. "CYCLO-SUB")
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        owner = msg.sender;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ── Soulbound override ────────────────────────────────────────────────────

    /// @dev Blocks all token transfers while permitting mints and burns.
    ///      Called by ERC721 for every ownership change.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // ── External functions ────────────────────────────────────────────────────

    /// @notice Mints a soulbound subscription token to `subscriber` for `planId`.
    ///         Reverts if the subscriber already holds a token for this plan.
    /// @param subscriber Wallet that will own the token.
    /// @param planId     Plan the subscriber enrolled in.
    function mint(address subscriber, uint256 planId) external onlyOwner {
        if (_tokenOf[subscriber][planId] != 0) revert AlreadySubscribed();

        uint256 tokenId = _nextTokenId++;

        _subscriberOf[tokenId]           = subscriber;
        _tokenOf[subscriber][planId]     = tokenId;
        _planOf[tokenId]                 = planId;

        _mint(subscriber, tokenId);
        emit Minted(subscriber, planId, tokenId);
    }

    /// @notice Burns the subscription token for `subscriber`+`planId` and clears all mappings.
    ///         Reverts if no token exists for the given subscriber+planId pair.
    /// @param subscriber Wallet whose token is being burned.
    /// @param planId     Plan the subscriber is leaving.
    function burn(address subscriber, uint256 planId) external onlyOwner {
        uint256 tokenId = _tokenOf[subscriber][planId];
        if (tokenId == 0) revert NotSubscribed();

        // Checks-Effects: clear state before the external burn call.
        delete _tokenOf[subscriber][planId];
        delete _subscriberOf[tokenId];
        delete _planOf[tokenId];

        _burn(tokenId);
        emit Burned(subscriber, planId, tokenId);
    }

    /// @notice Returns true if `subscriber` holds an active token for `planId`.
    /// @param subscriber Wallet to check.
    /// @param planId     Plan to check.
    /// @return True when a token exists for this subscriber+planId pair.
    function isSubscribed(address subscriber, uint256 planId) external view returns (bool) {
        return _tokenOf[subscriber][planId] != 0;
    }

    /// @notice Returns the tokenId held by `subscriber` for `planId`.
    /// @param subscriber Wallet to look up.
    /// @param planId     Plan to look up.
    /// @return tokenId The token ID.
    function tokenOfSubscriber(address subscriber, uint256 planId) external view returns (uint256) {
        uint256 tokenId = _tokenOf[subscriber][planId];
        if (tokenId == 0) revert NotSubscribed();
        return tokenId;
    }

    /// @notice Returns a base64-encoded inline JSON metadata URI for `tokenId`.
    ///         Format: `data:application/json;base64,<encoded>`.
    ///         JSON fields: `name` ("Cyclo Subscription #<id>"),
    ///                      `description` ("Active Cyclo subscription for plan <planId>").
    /// @param tokenId Token to query. Reverts if the token does not exist.
    /// @return Data URI string containing the token's JSON metadata.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        uint256 planId = _planOf[tokenId];
        string memory json = string.concat(
            '{"name":"Cyclo Subscription #',
            Strings.toString(tokenId),
            '","description":"Active Cyclo subscription for plan ',
            Strings.toString(planId),
            '"}'
        );

        return string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        );
    }
}
