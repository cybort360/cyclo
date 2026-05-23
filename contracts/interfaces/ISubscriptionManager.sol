// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SubscriptionLib} from "../libraries/SubscriptionLib.sol";

interface ISubscriptionManager {

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a merchant creates a new billing plan.
    event PlanCreated(
        uint256 indexed planId,
        address indexed merchant,
        uint256 price,
        uint256 interval
    );

    /// @notice Emitted when a merchant deactivates a plan.
    event PlanDeactivated(uint256 indexed planId, address indexed merchant);

    /// @notice Emitted when a user subscribes to a plan.
    event SubscriptionCreated(
        uint256 indexed planId,
        address indexed subscriber,
        uint256 nextChargeTimestamp
    );

    /// @notice Emitted when a subscriber cancels their subscription.
    event SubscriptionCancelled(uint256 indexed planId, address indexed subscriber);

    /// @notice Emitted when a subscriber atomically moves from one plan to another.
    event PlanMigrated(uint256 indexed fromPlanId, uint256 indexed toPlanId, address indexed subscriber);

    /// @notice Emitted when a payment is successfully collected.
    event PaymentCharged(
        uint256 indexed planId,
        address indexed subscriber,
        address indexed merchant,
        uint256 amount,
        uint256 nextChargeTimestamp
    );

    /// @notice Emitted alongside PaymentCharged to record the protocol fee taken.
    event FeeCollected(uint256 indexed planId, address indexed subscriber, uint256 feeAmount);

    /// @notice Emitted when pay() settles a one-off USDC transfer with a protocol fee.
    event PaymentSent(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 fee
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Thrown when a planId has no associated plan (price == 0).
    error PlanNotFound(uint256 planId);

    /// @notice Thrown when an operation requires an active plan but the plan is inactive.
    error PlanInactive(uint256 planId);

    /// @notice Thrown when a subscriber attempts to subscribe to a plan they are already on.
    error AlreadySubscribed(uint256 planId, address subscriber);

    /// @notice Thrown when an operation requires an active subscription but none exists.
    error SubscriptionInactive(uint256 planId, address subscriber);

    /// @notice Thrown when charge() is called before the next charge timestamp.
    error PaymentNotDue(uint256 planId, address subscriber, uint256 nextChargeTimestamp);

    /// @notice Thrown when the subscriber's USDC allowance is below the plan price.
    error InsufficientAllowance(address subscriber, uint256 required, uint256 actual);

    /// @notice Thrown when a USDC transferFrom call returns false.
    error TransferFailed(address from, address to, uint256 amount);

    /// @notice Thrown when msg.sender is not authorised to perform an action.
    error Unauthorized(address caller);

    /// @notice Thrown when createPlan is called with a zero price.
    error InvalidPrice();

    /// @notice Thrown when createPlan is called with a zero interval.
    error InvalidInterval();

    /// @notice Thrown when pay() is called with a zero amount.
    error InvalidAmount();

    /// @notice Thrown when pay() or updateFeeRecipient() receives a zero address.
    error ZeroAddress();

    /// @notice Thrown when batchCharge() receives arrays of different lengths.
    error ArrayLengthMismatch();

    /// @notice Thrown when migratePlan() is called with identical plan IDs.
    error SamePlan(uint256 planId);

    // -------------------------------------------------------------------------
    // Functions
    // -------------------------------------------------------------------------

    /// @notice Creates a new subscription plan.
    /// @param price USDC amount per billing cycle, in 6-decimal units
    /// @param interval Seconds between each charge
    /// @param trialDuration Seconds of free trial before first charge; 0 means charge immediately
    /// @return planId The ID assigned to the new plan
    function createPlan(uint256 price, uint256 interval, uint48 trialDuration) external returns (uint256 planId);

    /// @notice Subscribes the caller to a plan.
    /// @param planId The plan to subscribe to
    function subscribe(uint256 planId) external;

    /// @notice Transfers a due payment from subscriber to merchant.
    /// @param planId The plan the subscriber is on
    /// @param subscriber The address to charge
    function charge(uint256 planId, address subscriber) external;

    /// @notice Cancels the caller's subscription to a plan.
    /// @param planId The plan to cancel
    function cancelSubscription(uint256 planId) external;

    /// @notice Atomically cancels the caller's current subscription and subscribes to a new plan.
    /// The new plan's trial period applies. The caller must have sufficient USDC allowance for the new plan price.
    /// @param currentPlanId The plan to migrate away from
    /// @param newPlanId The plan to migrate to
    function migratePlan(uint256 currentPlanId, uint256 newPlanId) external;

    /// @notice Deactivates a plan, blocking new subscriptions and further charges.
    /// @param planId The plan to deactivate
    function deactivatePlan(uint256 planId) external;

    /// @notice Returns the plan details for a given plan ID.
    /// @param planId The plan ID to look up
    /// @return The Plan struct
    function getPlan(uint256 planId) external view returns (SubscriptionLib.Plan memory);

    /// @notice Returns the subscription record for a subscriber on a plan.
    /// @param planId The plan ID
    /// @param subscriber The subscriber address
    /// @return The Subscription struct; active will be false if no subscription exists
    function getSubscription(
        uint256 planId,
        address subscriber
    ) external view returns (SubscriptionLib.Subscription memory);

    /// @notice Returns true if a charge is currently due for the given subscription.
    /// @param planId The plan ID
    /// @param subscriber The subscriber address
    /// @return True if the subscription is active and the next charge timestamp has passed
    function isChargeDue(uint256 planId, address subscriber) external view returns (bool);

    /// @notice Transfers USDC from the caller to a recipient, deducting a 3% protocol fee.
    /// @param recipient Address to receive the payment (minus fee)
    /// @param amount Total USDC amount in 6-decimal units; must be greater than zero
    function pay(address recipient, uint256 amount) external;

    /// @notice Charges multiple subscriptions in one call; skips failing pairs without reverting.
    /// @param planIds Ordered list of plan IDs to charge
    /// @param subscribers Ordered list of subscriber addresses corresponding to planIds
    /// @return successCount Number of subscriptions successfully charged
    function batchCharge(
        uint256[] calldata planIds,
        address[] calldata subscribers
    ) external returns (uint256 successCount);

    /// @notice Updates the address that receives protocol fees. Only callable by the owner.
    /// @param newFeeRecipient The new fee recipient address; must not be the zero address
    function updateFeeRecipient(address newFeeRecipient) external;

    /// @notice Pre-flight check for keeper. Use via eth_call — no gas cost.
    function checkPreFlight(uint256 planId, address subscriber)
        external
        view
        returns (bool readyToCharge, uint8 reasonCode);
}
