// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SubscriptionManager} from "../contracts/core/SubscriptionManager.sol";
import {ISubscriptionManager} from "../contracts/interfaces/ISubscriptionManager.sol";
import {SubscriptionLib} from "../contracts/libraries/SubscriptionLib.sol";
import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";

contract SubscriptionManagerTest is Test {

    // Solidity 0.8.20 does not support `emit IFoo.Event(...)` syntax (added in 0.8.21).
    // These declarations mirror ISubscriptionManager exactly so vm.expectEmit can match.
    event PlanCreated(uint256 indexed planId, address indexed merchant, uint256 price, uint256 interval);
    event PlanDeactivated(uint256 indexed planId, address indexed merchant);
    event SubscriptionCreated(uint256 indexed planId, address indexed subscriber, uint256 nextChargeTimestamp);
    event SubscriptionCancelled(uint256 indexed planId, address indexed subscriber);
    event PaymentCharged(uint256 indexed planId, address indexed subscriber, address indexed merchant, uint256 amount, uint256 nextChargeTimestamp);
    event FeeCollected(uint256 indexed planId, address indexed subscriber, uint256 feeAmount);
    event PaymentSent(address indexed sender, address indexed recipient, uint256 amount, uint256 fee);

    SubscriptionManager internal manager;
    MockUSDC           internal usdc;

    address internal merchant      = makeAddr("merchant");
    address internal subscriber    = makeAddr("subscriber");
    address internal keeper        = makeAddr("keeper");
    address internal stranger      = makeAddr("stranger");
    address internal feeRecipient  = makeAddr("feeRecipient");

    uint256 internal constant PRICE    = 10_000_000; // 10 USDC (6 decimals)
    uint256 internal constant INTERVAL = 30 days;
    uint256 internal constant T0       = 1000;       // fixed warp timestamp for predictability

    function setUp() public {
        usdc    = new MockUSDC();
        manager = new SubscriptionManager(address(usdc), feeRecipient);
        usdc.mint(subscriber, 100_000_000); // 100 USDC
        vm.warp(T0);
    }

    // Subscribe as subscriber with unlimited approval — used by multiple tests.
    function _createPlan() internal returns (uint256) {
        vm.prank(merchant);
        return manager.createPlan(PRICE, INTERVAL, 0);
    }

    function _subscribe(uint256 planId) internal {
        vm.startPrank(subscriber);
        usdc.approve(address(manager), type(uint256).max);
        manager.subscribe(planId);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // createPlan
    // -------------------------------------------------------------------------

    function test_createPlan_success() public {
        vm.expectEmit(true, true, false, true);
        emit PlanCreated(1, merchant, PRICE, INTERVAL);
        vm.prank(merchant);
        uint256 planId = manager.createPlan(PRICE, INTERVAL, 0);

        assertEq(planId, 1);
        SubscriptionLib.Plan memory plan = manager.getPlan(planId);
        assertEq(plan.merchant, merchant);
        assertEq(plan.price, PRICE);
        assertEq(plan.interval, INTERVAL);
        assertEq(plan.trialDuration, 0);
        assertTrue(plan.active);

        // planId increments on subsequent calls
        vm.prank(merchant);
        assertEq(manager.createPlan(PRICE, INTERVAL, 0), 2);
    }

    function test_createPlan_revert_zeroPrice() public {
        vm.prank(merchant);
        vm.expectRevert(ISubscriptionManager.InvalidPrice.selector);
        manager.createPlan(0, INTERVAL, 0);
    }

    function test_createPlan_revert_zeroInterval() public {
        vm.prank(merchant);
        vm.expectRevert(ISubscriptionManager.InvalidInterval.selector);
        manager.createPlan(PRICE, 0, 0);
    }

    // -------------------------------------------------------------------------
    // subscribe
    // -------------------------------------------------------------------------

    function test_subscribe_success() public {
        uint256 planId = _createPlan();
        vm.startPrank(subscriber);
        usdc.approve(address(manager), PRICE);
        vm.expectEmit(true, true, false, true);
        emit SubscriptionCreated(planId, subscriber, T0);
        manager.subscribe(planId);
        vm.stopPrank();

        SubscriptionLib.Subscription memory sub = manager.getSubscription(planId, subscriber);
        assertTrue(sub.active);
        assertEq(sub.nextChargeTimestamp, T0);
    }

    function test_subscribe_revert_planNotFound() public {
        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.PlanNotFound.selector, 999));
        manager.subscribe(999);
    }

    function test_subscribe_revert_planInactive() public {
        uint256 planId = _createPlan();
        vm.prank(merchant);
        manager.deactivatePlan(planId);

        vm.startPrank(subscriber);
        usdc.approve(address(manager), PRICE);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.PlanInactive.selector, planId));
        manager.subscribe(planId);
        vm.stopPrank();
    }

    function test_subscribe_revert_alreadySubscribed() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.AlreadySubscribed.selector, planId, subscriber));
        manager.subscribe(planId);
    }

    function test_subscribe_revert_insufficientAllowance() public {
        uint256 planId = _createPlan();
        // subscriber has zero allowance — no approve call made
        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.InsufficientAllowance.selector, subscriber, PRICE, 0));
        manager.subscribe(planId);
    }

    // -------------------------------------------------------------------------
    // charge
    // -------------------------------------------------------------------------

    function test_charge_success() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        uint256 merchantBefore   = usdc.balanceOf(merchant);
        uint256 subscriberBefore = usdc.balanceOf(subscriber);
        uint256 expectedNext     = T0 + INTERVAL;
        uint256 fee              = PRICE * 3 / 100;

        vm.expectEmit(true, true, true, true);
        emit PaymentCharged(planId, subscriber, merchant, PRICE, expectedNext);
        vm.prank(keeper);
        manager.charge(planId, subscriber);

        assertEq(usdc.balanceOf(merchant), merchantBefore + PRICE - fee);
        assertEq(usdc.balanceOf(subscriber), subscriberBefore - PRICE);
        assertEq(manager.getSubscription(planId, subscriber).nextChargeTimestamp, expectedNext);
    }

    function test_charge_revert_subscriptionNotActive() public {
        uint256 planId = _createPlan();
        // subscriber never called subscribe()
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.SubscriptionInactive.selector, planId, subscriber));
        manager.charge(planId, subscriber);
    }

    function test_charge_revert_planNotActive() public {
        uint256 planId = _createPlan();
        _subscribe(planId);
        vm.prank(merchant);
        manager.deactivatePlan(planId);

        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.PlanInactive.selector, planId));
        manager.charge(planId, subscriber);
    }

    function test_charge_revert_paymentNotDue() public {
        uint256 planId = _createPlan();
        _subscribe(planId);
        manager.charge(planId, subscriber); // first charge succeeds; nextChargeTimestamp = T0 + INTERVAL

        vm.expectRevert(abi.encodeWithSelector(
            ISubscriptionManager.PaymentNotDue.selector,
            planId,
            subscriber,
            uint256(T0 + INTERVAL)
        ));
        manager.charge(planId, subscriber); // second charge immediately after is not yet due
    }

    function test_charge_revert_transferFromFails() public {
        uint256 planId = _createPlan();
        _subscribe(planId);
        vm.prank(subscriber);
        usdc.approve(address(manager), 0); // revoke allowance — MockUSDC.transferFrom returns false

        uint256 merchantAmount = PRICE - PRICE * 3 / 100;
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.TransferFailed.selector, subscriber, merchant, merchantAmount));
        manager.charge(planId, subscriber);
    }

    // -------------------------------------------------------------------------
    // cancelSubscription
    // -------------------------------------------------------------------------

    function test_cancelSubscription_success() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        vm.expectEmit(true, true, false, false);
        emit SubscriptionCancelled(planId, subscriber);
        vm.prank(subscriber);
        manager.cancelSubscription(planId);

        assertFalse(manager.getSubscription(planId, subscriber).active);
    }

    function test_cancelSubscription_revert_callerNotSubscriber() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        // stranger has no subscription — SubscriptionInactive covers "not the subscriber"
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.SubscriptionInactive.selector, planId, stranger));
        manager.cancelSubscription(planId);
    }

    function test_cancelSubscription_revert_alreadyInactive() public {
        uint256 planId = _createPlan();
        _subscribe(planId);
        vm.prank(subscriber);
        manager.cancelSubscription(planId);

        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.SubscriptionInactive.selector, planId, subscriber));
        manager.cancelSubscription(planId);
    }

    // -------------------------------------------------------------------------
    // deactivatePlan
    // -------------------------------------------------------------------------

    function test_deactivatePlan_success() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        vm.expectEmit(true, true, false, false);
        emit PlanDeactivated(planId, merchant);
        vm.prank(merchant);
        manager.deactivatePlan(planId);

        assertFalse(manager.getPlan(planId).active);
        assertTrue(manager.getSubscription(planId, subscriber).active); // subscription record unaffected
    }

    function test_deactivatePlan_revert_notMerchant() public {
        uint256 planId = _createPlan();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.Unauthorized.selector, stranger));
        manager.deactivatePlan(planId);
    }

    function test_deactivatePlan_revert_alreadyInactive() public {
        uint256 planId = _createPlan();
        vm.prank(merchant);
        manager.deactivatePlan(planId);

        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.PlanInactive.selector, planId));
        manager.deactivatePlan(planId);
    }

    // -------------------------------------------------------------------------
    // isChargeDue
    // -------------------------------------------------------------------------

    function test_isChargeDue_trueWhenDue() public {
        uint256 planId = _createPlan();
        _subscribe(planId); // nextChargeTimestamp = T0 = block.timestamp
        assertTrue(manager.isChargeDue(planId, subscriber));
    }

    function test_isChargeDue_falseWhenNotYetDue() public {
        uint256 planId = _createPlan();
        _subscribe(planId);
        manager.charge(planId, subscriber); // nextChargeTimestamp advances to T0 + INTERVAL
        assertFalse(manager.isChargeDue(planId, subscriber));
    }

    function test_isChargeDue_falseWhenInactive() public {
        uint256 planId = _createPlan();
        _subscribe(planId);
        vm.prank(subscriber);
        manager.cancelSubscription(planId);
        assertFalse(manager.isChargeDue(planId, subscriber));
    }
}
