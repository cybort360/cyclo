// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISubscriptionManager} from "../interfaces/ISubscriptionManager.sol";
import {IUSDC} from "../interfaces/IUSDC.sol";
import {SubscriptionLib} from "../libraries/SubscriptionLib.sol";

/// @dev Minimal interface for the soulbound NFT contract.
///      Used by SubscriptionManager to mint/burn tokens on subscribe/cancel.
interface ISubscriptionNFT {
    function mint(address subscriber, uint256 planId) external;
    function burn(address subscriber, uint256 planId) external;
    function isSubscribed(address subscriber, uint256 planId) external view returns (bool);
}

contract SubscriptionManager is ISubscriptionManager, ReentrancyGuard, Ownable {

    address private immutable _usdcAddress;
    address private _feeRecipient;

    // 1% of every charge or pay() amount goes to _feeRecipient.
    uint256 private constant FEE_DENOMINATOR = 100;

    // Plan IDs start at 1; 0 is used as a sentinel for "does not exist".
    uint256 private _nextPlanId = 1;

    /// @notice Address of the soulbound NFT contract. Zero until set via setSubscriptionNFT().
    address public subscriptionNFT;

    mapping(uint256 => SubscriptionLib.Plan) private _plans;
    mapping(uint256 => mapping(address => SubscriptionLib.Subscription)) private _subscriptions;

    constructor(address usdcAddress, address feeRecipient) Ownable(msg.sender) {
        _usdcAddress = usdcAddress;
        _feeRecipient = feeRecipient;
    }

    // ── NFT integration events & errors ───────────────────────────────────────

    /// @notice Emitted when the NFT contract address is configured.
    event SubscriptionNFTSet(address indexed nft);

    /// @notice Emitted when the NFT mint call fails during subscribe().
    ///         The subscription itself still succeeds.
    event NFTMintFailed(address indexed subscriber, uint256 indexed planId);

    /// @notice Emitted when the NFT burn call fails during cancelSubscription().
    ///         The cancellation itself still succeeds.
    event NFTBurnFailed(address indexed subscriber, uint256 indexed planId);

    /// @notice Thrown when setSubscriptionNFT() is called after an address is already set.
    error NFTAlreadySet();

    // -------------------------------------------------------------------------
    // Merchant actions
    // -------------------------------------------------------------------------

    /// @notice Creates a new subscription plan. Any address may act as a merchant.
    /// @param price USDC amount per billing cycle, in 6-decimal units (1 USDC = 1_000_000)
    /// @param interval Seconds between each charge
    /// @param trialDuration Seconds of free trial before the first charge; 0 means charge immediately
    /// @return planId The ID assigned to the new plan
    function createPlan(uint256 price, uint256 interval, uint48 trialDuration) external returns (uint256 planId) {
        if (price == 0) revert InvalidPrice();
        if (interval == 0) revert InvalidInterval();

        planId = _nextPlanId++;
        _plans[planId] = SubscriptionLib.Plan({
            merchant:      msg.sender,
            active:        true,
            trialDuration: trialDuration,
            price:         price,
            interval:      interval
        });

        emit PlanCreated(planId, msg.sender, price, interval);
    }

    /// @notice Deactivates a plan, blocking new subscriptions and stopping further charges.
    /// Existing subscription records are preserved but charge() will revert for this plan.
    /// @param planId The plan to deactivate
    function deactivatePlan(uint256 planId) external {
        SubscriptionLib.Plan storage plan = _plans[planId];
        if (plan.price == 0) revert PlanNotFound(planId);
        if (msg.sender != plan.merchant) revert Unauthorized(msg.sender);
        if (!plan.active) revert PlanInactive(planId);

        plan.active = false;

        emit PlanDeactivated(planId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Subscriber actions
    // -------------------------------------------------------------------------

    /// @notice Subscribes the caller to a plan. The caller must have pre-approved
    /// the contract for at least the plan price in USDC before calling this.
    /// The first payment becomes due immediately and is settled by the next charge() call.
    /// @param planId The plan to subscribe to
    function subscribe(uint256 planId) external {
        SubscriptionLib.Plan storage plan = _plans[planId];
        if (plan.price == 0) revert PlanNotFound(planId);
        if (!plan.active) revert PlanInactive(planId);
        if (_subscriptions[planId][msg.sender].active) revert AlreadySubscribed(planId, msg.sender);

        uint256 allowance = IUSDC(_usdcAddress).allowance(msg.sender, address(this));
        if (allowance < plan.price) revert InsufficientAllowance(msg.sender, plan.price, allowance);

        uint48 chargeStart = plan.trialDuration > 0
            ? uint48(block.timestamp) + plan.trialDuration
            : uint48(block.timestamp);

        _subscriptions[planId][msg.sender] = SubscriptionLib.Subscription({
            nextChargeTimestamp: chargeStart,
            active: true
        });

        emit SubscriptionCreated(planId, msg.sender, chargeStart);

        if (subscriptionNFT != address(0)) {
            try ISubscriptionNFT(subscriptionNFT).mint(msg.sender, planId) {} catch {
                emit NFTMintFailed(msg.sender, planId);
            }
        }
    }

    /// @notice Cancels the caller's subscription to a plan. No refunds are issued.
    /// The subscription record is retained with active set to false.
    /// @param planId The plan to cancel
    function cancelSubscription(uint256 planId) external {
        SubscriptionLib.Subscription storage sub = _subscriptions[planId][msg.sender];
        if (!sub.active) revert SubscriptionInactive(planId, msg.sender);

        sub.active = false;

        emit SubscriptionCancelled(planId, msg.sender);

        if (subscriptionNFT != address(0)) {
            try ISubscriptionNFT(subscriptionNFT).burn(msg.sender, planId) {} catch {
                emit NFTBurnFailed(msg.sender, planId);
            }
        }
    }

    /// @notice Atomically cancels the caller's current plan and subscribes to a new one.
    /// The new plan's trial period applies. No proration is performed.
    /// The caller must have sufficient USDC allowance for the new plan price.
    /// @param currentPlanId The plan to migrate away from
    /// @param newPlanId The plan to migrate to; must be active and different from currentPlanId
    function migratePlan(uint256 currentPlanId, uint256 newPlanId) external {
        if (currentPlanId == newPlanId) revert SamePlan(currentPlanId);

        SubscriptionLib.Subscription storage currentSub = _subscriptions[currentPlanId][msg.sender];
        if (!currentSub.active) revert SubscriptionInactive(currentPlanId, msg.sender);

        SubscriptionLib.Plan storage newPlan = _plans[newPlanId];
        if (newPlan.price == 0) revert PlanNotFound(newPlanId);
        if (!newPlan.active) revert PlanInactive(newPlanId);
        if (_subscriptions[newPlanId][msg.sender].active) revert AlreadySubscribed(newPlanId, msg.sender);

        uint256 allowance = IUSDC(_usdcAddress).allowance(msg.sender, address(this));
        if (allowance < newPlan.price) revert InsufficientAllowance(msg.sender, newPlan.price, allowance);

        uint48 chargeStart = newPlan.trialDuration > 0
            ? uint48(block.timestamp) + newPlan.trialDuration
            : uint48(block.timestamp);

        currentSub.active = false;
        _subscriptions[newPlanId][msg.sender] = SubscriptionLib.Subscription({
            nextChargeTimestamp: chargeStart,
            active: true
        });

        emit SubscriptionCancelled(currentPlanId, msg.sender);
        emit SubscriptionCreated(newPlanId, msg.sender, chargeStart);
        emit PlanMigrated(currentPlanId, newPlanId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Keeper / public actions
    // -------------------------------------------------------------------------

    /// @notice Transfers a due payment from a subscriber to the plan's merchant.
    /// Callable by anyone — designed to be driven by the keeper bot.
    /// Follows checks-effects-interactions: timestamp is advanced before the transfer
    /// so a reentrant call cannot double-charge within the same transaction.
    /// @param planId The plan the subscriber is on
    /// @param subscriber The address to charge
    function charge(uint256 planId, address subscriber) external nonReentrant {
        SubscriptionLib.Subscription storage sub = _subscriptions[planId][subscriber];
        if (!sub.active) revert SubscriptionInactive(planId, subscriber);

        SubscriptionLib.Plan storage plan = _plans[planId];
        if (!plan.active) revert PlanInactive(planId);
        // Timestamp manipulation risk is acceptable for billing: validators can shift by
        // seconds, not enough to meaningfully affect daily or monthly billing cycles.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < sub.nextChargeTimestamp) {
            revert PaymentNotDue(planId, subscriber, sub.nextChargeTimestamp);
        }

        uint256 fee            = plan.price / FEE_DENOMINATOR;
        uint256 merchantAmount = plan.price - fee;
        uint256 newNextChargeTimestamp = uint256(sub.nextChargeTimestamp) + plan.interval;
        // casting to 'uint48' is safe — max uint48 (281474976710655)
        // exceeds Unix timestamp for year 8921930, far beyond any realistic use
        // forge-lint: disable-next-line(unsafe-typecast)
        sub.nextChargeTimestamp = uint48(newNextChargeTimestamp);

        bool s1 = IUSDC(_usdcAddress).transferFrom(subscriber, plan.merchant, merchantAmount);
        if (!s1) revert TransferFailed(subscriber, plan.merchant, merchantAmount);

        bool s2 = IUSDC(_usdcAddress).transferFrom(subscriber, _feeRecipient, fee);
        if (!s2) revert TransferFailed(subscriber, _feeRecipient, fee);

        emit PaymentCharged(planId, subscriber, plan.merchant, plan.price, newNextChargeTimestamp);
        emit FeeCollected(planId, subscriber, fee);
    }

    /// @notice Transfers USDC from the caller to a recipient, deducting a 1% protocol fee.
    /// The caller must have pre-approved this contract for at least `amount` USDC.
    /// @param recipient Address to receive the payment (minus fee); must not be the zero address
    /// @param amount Total USDC amount in 6-decimal units; must be greater than zero
    function pay(address recipient, uint256 amount) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 fee             = amount / FEE_DENOMINATOR;
        uint256 recipientAmount = amount - fee;

        bool s1 = IUSDC(_usdcAddress).transferFrom(msg.sender, recipient, recipientAmount);
        if (!s1) revert TransferFailed(msg.sender, recipient, recipientAmount);

        bool s2 = IUSDC(_usdcAddress).transferFrom(msg.sender, _feeRecipient, fee);
        if (!s2) revert TransferFailed(msg.sender, _feeRecipient, fee);

        emit PaymentSent(msg.sender, recipient, amount, fee);
    }

    /// @notice Charges multiple subscriptions in one call.
    /// Individual failures are skipped; the batch continues without reverting.
    /// Emits PaymentCharged and FeeCollected for each successful charge.
    /// @param planIds Ordered list of plan IDs to charge
    /// @param subscribers Ordered list of subscriber addresses corresponding to planIds
    /// @return successCount Number of subscriptions successfully charged
    function batchCharge(
        uint256[] calldata planIds,
        address[] calldata subscribers
    ) external nonReentrant returns (uint256 successCount) {
        if (planIds.length != subscribers.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < planIds.length; i++) {
            if (_chargeOne(planIds[i], subscribers[i])) {
                successCount++;
            }
        }
    }

    /// @dev Attempts a single charge inline. Returns false on any failure instead of reverting,
    /// so batchCharge can continue to the next pair. Does not call this.charge() to avoid
    /// adding an extra external call depth, which breaks the USDC precompile on Arc.
    function _chargeOne(uint256 planId, address subscriber) private returns (bool) {
        SubscriptionLib.Subscription storage sub = _subscriptions[planId][subscriber];
        SubscriptionLib.Plan storage plan = _plans[planId];

        if (!sub.active || !plan.active) return false;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < sub.nextChargeTimestamp) return false;

        uint256 fee            = plan.price / FEE_DENOMINATOR;
        uint256 merchantAmount = plan.price - fee;
        uint256 newNextCharge  = uint256(sub.nextChargeTimestamp) + plan.interval;
        // forge-lint: disable-next-line(unsafe-typecast)
        sub.nextChargeTimestamp = uint48(newNextCharge);

        if (!IUSDC(_usdcAddress).transferFrom(subscriber, plan.merchant, merchantAmount)) {
            // forge-lint: disable-next-line(unsafe-typecast)
            sub.nextChargeTimestamp = uint48(uint256(sub.nextChargeTimestamp) - plan.interval);
            return false;
        }
        if (!IUSDC(_usdcAddress).transferFrom(subscriber, _feeRecipient, fee)) {
            // forge-lint: disable-next-line(unsafe-typecast)
            sub.nextChargeTimestamp = uint48(uint256(sub.nextChargeTimestamp) - plan.interval);
            return false;
        }

        emit PaymentCharged(planId, subscriber, plan.merchant, plan.price, newNextCharge);
        emit FeeCollected(planId, subscriber, fee);
        return true;
    }

    /// @notice Sets the soulbound NFT contract address. Can only be called once.
    ///         After this is set, subscribe() and cancelSubscription() will attempt
    ///         to mint/burn NFTs around the core subscription logic.
    /// @param nft Address of the deployed SubscriptionNFT contract
    function setSubscriptionNFT(address nft) external onlyOwner {
        if (subscriptionNFT != address(0)) revert NFTAlreadySet();
        subscriptionNFT = nft;
        emit SubscriptionNFTSet(nft);
    }

    /// @notice Updates the address that receives protocol fees. Only callable by the owner.
    /// @param newFeeRecipient The new fee recipient; must not be the zero address
    function updateFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert ZeroAddress();
        _feeRecipient = newFeeRecipient;
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Returns the plan details for a given plan ID.
    /// @param planId The plan ID to look up
    /// @return The Plan struct
    function getPlan(uint256 planId) external view returns (SubscriptionLib.Plan memory) {
        if (_plans[planId].price == 0) revert PlanNotFound(planId);
        return _plans[planId];
    }

    /// @notice Returns the subscription record for a subscriber on a plan.
    /// Returns a zeroed struct (active == false) if no subscription exists.
    /// @param planId The plan ID
    /// @param subscriber The subscriber address
    /// @return The Subscription struct
    function getSubscription(
        uint256 planId,
        address subscriber
    ) external view returns (SubscriptionLib.Subscription memory) {
        return _subscriptions[planId][subscriber];
    }

    /// @notice Returns true if a charge is currently due for the given subscription.
    /// The keeper uses this to filter subscriptions before submitting charge() transactions.
    /// @param planId The plan ID
    /// @param subscriber The subscriber address
    /// @return True if the subscription is active and the next charge timestamp has passed
    function isChargeDue(uint256 planId, address subscriber) external view returns (bool) {
        return SubscriptionLib.isPaymentDue(_subscriptions[planId][subscriber], block.timestamp);
    }

    /// @notice Returns true if `subscriber` currently holds an NFT for `planId`.
    ///         Delegates to the NFT contract. Returns false if no NFT contract is set.
    /// @param subscriber The wallet to check
    /// @param planId     The plan to check
    /// @return True when the NFT contract confirms an active token for this subscriber+planId
    function isSubscribed(address subscriber, uint256 planId) external view returns (bool) {
        if (subscriptionNFT == address(0)) return false;
        return ISubscriptionNFT(subscriptionNFT).isSubscribed(subscriber, planId);
    }

    /// @notice Off-chain pre-flight check. Zero gas (eth_call only).
    /// Returns whether a subscription is ready to charge and a reason code if not.
    /// Reason codes: 0 = ready, 1 = not due, 2 = low balance, 3 = low allowance, 4 = inactive
    function checkPreFlight(uint256 planId, address subscriber)
        external
        view
        returns (bool readyToCharge, uint8 reasonCode)
    {
        SubscriptionLib.Subscription storage sub = _subscriptions[planId][subscriber];
        SubscriptionLib.Plan storage plan = _plans[planId];

        if (!sub.active) return (false, 4);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < sub.nextChargeTimestamp) return (false, 1);
        if (IUSDC(_usdcAddress).balanceOf(subscriber) < plan.price) return (false, 2);
        if (IUSDC(_usdcAddress).allowance(subscriber, address(this)) < plan.price) return (false, 3);

        return (true, 0);
    }
}
