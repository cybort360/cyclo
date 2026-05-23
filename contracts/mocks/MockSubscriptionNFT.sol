// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Test-only mock of SubscriptionNFT.
 *      Tracks mint/burn calls and can be configured to revert on demand.
 */
contract MockSubscriptionNFT {

    /// @notice Recorded mint calls: (subscriber, planId)
    address[] public mintSubscribers;
    uint256[] public mintPlanIds;

    /// @notice Recorded burn calls: (subscriber, planId)
    address[] public burnSubscribers;
    uint256[] public burnPlanIds;

    /// @notice When true, mint() reverts.
    bool public shouldRevertMint;

    /// @notice When true, burn() reverts.
    bool public shouldRevertBurn;

    mapping(address subscriber => mapping(uint256 planId => bool)) private _subscribed;

    // ── Configuration ─────────────────────────────────────────────────────────

    function setRevertMint(bool value) external { shouldRevertMint = value; }
    function setRevertBurn(bool value) external { shouldRevertBurn = value; }

    // ── ISubscriptionNFT ──────────────────────────────────────────────────────

    function mint(address subscriber, uint256 planId) external {
        if (shouldRevertMint) revert("MockSubscriptionNFT: mint reverted");
        mintSubscribers.push(subscriber);
        mintPlanIds.push(planId);
        _subscribed[subscriber][planId] = true;
    }

    function burn(address subscriber, uint256 planId) external {
        if (shouldRevertBurn) revert("MockSubscriptionNFT: burn reverted");
        burnSubscribers.push(subscriber);
        burnPlanIds.push(planId);
        _subscribed[subscriber][planId] = false;
    }

    function isSubscribed(address subscriber, uint256 planId) external view returns (bool) {
        return _subscribed[subscriber][planId];
    }

    // ── Test helpers ──────────────────────────────────────────────────────────

    function mintCallCount() external view returns (uint256) { return mintSubscribers.length; }
    function burnCallCount() external view returns (uint256) { return burnSubscribers.length; }
}
