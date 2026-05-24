// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library SubscriptionLib {
    /// @notice Represents a billing plan created by a merchant.
    /// Storage layout: merchant (20) + active (1) + trialDuration (6) = 27 bytes in slot 0.
    /// price and interval each occupy a full slot.
    struct Plan {
        address merchant;
        bool    active;
        uint48  trialDuration; // seconds; 0 means no trial
        uint256 price;
        uint256 interval;
    }

    /// @notice Tracks a single subscriber's state for a plan.
    /// Storage layout: nextChargeTimestamp (uint48, 6 bytes) + active (bool, 1 byte)
    /// packed into one 32-byte slot.
    struct Subscription {
        uint48 nextChargeTimestamp;
        bool active;
    }

    /// @notice Returns true when a subscription is active and a charge is overdue.
    /// @param sub The subscription to evaluate
    /// @param currentTimestamp The current block timestamp
    /// @return True if a charge can legally proceed
    function isPaymentDue(
        Subscription memory sub,
        uint256 currentTimestamp
    ) internal pure returns (bool) {
        return sub.active && currentTimestamp >= sub.nextChargeTimestamp;
    }
}
