// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test}            from "forge-std/Test.sol";
import {Base64}          from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings}         from "@openzeppelin/contracts/utils/Strings.sol";
import {SubscriptionNFT} from "../contracts/src/SubscriptionNFT.sol";

contract SubscriptionNFTTest is Test {

    // Solidity 0.8.20 does not support `emit IFoo.Event(...)` syntax (added in 0.8.21).
    // Mirror the contract's events here so vm.expectEmit can match.
    event Minted(address indexed subscriber, uint256 indexed planId, uint256 tokenId);
    event Burned(address indexed subscriber, uint256 indexed planId, uint256 tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    SubscriptionNFT internal nft;

    address internal nftOwner   = makeAddr("nftOwner");
    address internal subscriber = makeAddr("subscriber");
    address internal stranger   = makeAddr("stranger");

    uint256 internal constant PLAN_A = 1;
    uint256 internal constant PLAN_B = 2;

    function setUp() public {
        vm.prank(nftOwner);
        nft = new SubscriptionNFT("Cyclo Subscription", "CYCLO-SUB");
    }

    // ── constructor ───────────────────────────────────────────────────────────

    function test_constructor_setsOwner() public view {
        assertEq(nft.owner(), nftOwner);
    }

    function test_constructor_name() public view {
        assertEq(nft.name(), "Cyclo Subscription");
    }

    function test_constructor_symbol() public view {
        assertEq(nft.symbol(), "CYCLO-SUB");
    }

    // ── mint ──────────────────────────────────────────────────────────────────

    function test_mint_success() public {
        vm.expectEmit(true, true, false, true);
        emit Minted(subscriber, PLAN_A, 1);

        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        assertEq(nft.ownerOf(1), subscriber);
        assertTrue(nft.isSubscribed(subscriber, PLAN_A));
        assertEq(nft.tokenOfSubscriber(subscriber, PLAN_A), 1);
    }

    function test_mint_tokenIdStartsAtOne() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        assertEq(nft.tokenOfSubscriber(subscriber, PLAN_A), 1);
    }

    function test_mint_tokenIdIncrements() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_B);

        assertEq(nft.tokenOfSubscriber(subscriber, PLAN_A), 1);
        assertEq(nft.tokenOfSubscriber(subscriber, PLAN_B), 2);
    }

    function test_mint_revert_alreadySubscribed() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.expectRevert(SubscriptionNFT.AlreadySubscribed.selector);
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);
    }

    function test_mint_revert_onlyOwner() public {
        vm.expectRevert(SubscriptionNFT.Unauthorized.selector);
        vm.prank(stranger);
        nft.mint(subscriber, PLAN_A);
    }

    function test_mint_differentSubscribersSamePlan() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.prank(nftOwner);
        nft.mint(stranger, PLAN_A);

        assertEq(nft.ownerOf(1), subscriber);
        assertEq(nft.ownerOf(2), stranger);
    }

    // ── burn ──────────────────────────────────────────────────────────────────

    function test_burn_success() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.expectEmit(true, true, false, true);
        emit Burned(subscriber, PLAN_A, 1);

        vm.prank(nftOwner);
        nft.burn(subscriber, PLAN_A);

        assertFalse(nft.isSubscribed(subscriber, PLAN_A));
    }

    function test_burn_clearsMappings() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.prank(nftOwner);
        nft.burn(subscriber, PLAN_A);

        vm.expectRevert(SubscriptionNFT.NotSubscribed.selector);
        nft.tokenOfSubscriber(subscriber, PLAN_A);
    }

    function test_burn_tokenNoLongerOwned() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.prank(nftOwner);
        nft.burn(subscriber, PLAN_A);

        // ownerOf reverts for a burned token (ERC721NonexistentToken)
        vm.expectRevert();
        nft.ownerOf(1);
    }

    function test_burn_revert_notSubscribed() public {
        vm.expectRevert(SubscriptionNFT.NotSubscribed.selector);
        vm.prank(nftOwner);
        nft.burn(subscriber, PLAN_A);
    }

    function test_burn_revert_onlyOwner() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.expectRevert(SubscriptionNFT.Unauthorized.selector);
        vm.prank(stranger);
        nft.burn(subscriber, PLAN_A);
    }

    function test_burn_thenRemint_assignsNewTokenId() public {
        // Token IDs are never recycled — _nextTokenId only increments.
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);  // tokenId = 1

        vm.prank(nftOwner);
        nft.burn(subscriber, PLAN_A);

        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);  // tokenId = 2

        assertEq(nft.tokenOfSubscriber(subscriber, PLAN_A), 2);
    }

    // ── soulbound ─────────────────────────────────────────────────────────────

    function test_soulbound_transferFrom_reverts() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.expectRevert(SubscriptionNFT.Soulbound.selector);
        vm.prank(subscriber);
        nft.transferFrom(subscriber, stranger, 1);
    }

    function test_soulbound_safeTransferFrom_reverts() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.expectRevert(SubscriptionNFT.Soulbound.selector);
        vm.prank(subscriber);
        nft.safeTransferFrom(subscriber, stranger, 1);
    }

    function test_soulbound_approvedTransfer_reverts() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.prank(subscriber);
        nft.approve(stranger, 1);

        vm.expectRevert(SubscriptionNFT.Soulbound.selector);
        vm.prank(stranger);
        nft.transferFrom(subscriber, stranger, 1);
    }

    // ── isSubscribed ──────────────────────────────────────────────────────────

    function test_isSubscribed_falseBeforeMint() public view {
        assertFalse(nft.isSubscribed(subscriber, PLAN_A));
    }

    function test_isSubscribed_trueAfterMint() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        assertTrue(nft.isSubscribed(subscriber, PLAN_A));
    }

    function test_isSubscribed_falseAfterBurn() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.prank(nftOwner);
        nft.burn(subscriber, PLAN_A);

        assertFalse(nft.isSubscribed(subscriber, PLAN_A));
    }

    function test_isSubscribed_independentPerPlan() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        assertTrue(nft.isSubscribed(subscriber, PLAN_A));
        assertFalse(nft.isSubscribed(subscriber, PLAN_B));
    }

    // ── tokenOfSubscriber ─────────────────────────────────────────────────────

    function test_tokenOfSubscriber_revert_notSubscribed() public {
        vm.expectRevert(SubscriptionNFT.NotSubscribed.selector);
        nft.tokenOfSubscriber(subscriber, PLAN_A);
    }

    function test_tokenOfSubscriber_revert_afterBurn() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        vm.prank(nftOwner);
        nft.burn(subscriber, PLAN_A);

        vm.expectRevert(SubscriptionNFT.NotSubscribed.selector);
        nft.tokenOfSubscriber(subscriber, PLAN_A);
    }

    // ── tokenURI ──────────────────────────────────────────────────────────────

    function test_tokenURI_matchesExpected() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        // Build the expected URI using the same encoding logic.
        string memory expectedJson =
            '{"name":"Cyclo Subscription #1","description":"Active Cyclo subscription for plan 1"}';
        string memory expectedUri = string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(expectedJson))
        );

        assertEq(nft.tokenURI(1), expectedUri);
    }

    function test_tokenURI_decodesCorrectJson() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_A);

        string memory uri    = nft.tokenURI(1);
        // Strip the data URI prefix (29 bytes: "data:application/json;base64,")
        bytes memory uriBytes = bytes(uri);
        bytes memory b64      = new bytes(uriBytes.length - 29);
        for (uint256 i = 0; i < b64.length; i++) {
            b64[i] = uriBytes[i + 29];
        }

        string memory decoded = string(Base64.decode(string(b64)));
        assertEq(
            decoded,
            '{"name":"Cyclo Subscription #1","description":"Active Cyclo subscription for plan 1"}'
        );
    }

    function test_tokenURI_planIdInDescription() public {
        vm.prank(nftOwner);
        nft.mint(subscriber, PLAN_B);  // planId = 2, tokenId = 1

        string memory expectedJson =
            '{"name":"Cyclo Subscription #1","description":"Active Cyclo subscription for plan 2"}';
        string memory expectedUri = string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(expectedJson))
        );

        assertEq(nft.tokenURI(1), expectedUri);
    }

    function test_tokenURI_revert_nonexistentToken() public {
        // ERC721 reverts with ERC721NonexistentToken for tokens that don't exist.
        vm.expectRevert();
        nft.tokenURI(99);
    }

    // ── transferOwnership ─────────────────────────────────────────────────────

    function test_transferOwnership_success() public {
        address newOwner = makeAddr("newOwner");

        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(nftOwner, newOwner);

        vm.prank(nftOwner);
        nft.transferOwnership(newOwner);

        assertEq(nft.owner(), newOwner);
    }

    function test_transferOwnership_newOwnerCanMint() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(nftOwner);
        nft.transferOwnership(newOwner);

        vm.prank(newOwner);
        nft.mint(subscriber, PLAN_A);

        assertTrue(nft.isSubscribed(subscriber, PLAN_A));
    }

    function test_transferOwnership_previousOwnerCanNoLongerMint() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(nftOwner);
        nft.transferOwnership(newOwner);

        vm.prank(nftOwner);
        vm.expectRevert(SubscriptionNFT.Unauthorized.selector);
        nft.mint(subscriber, PLAN_A);
    }

    function test_transferOwnership_revert_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(SubscriptionNFT.Unauthorized.selector);
        nft.transferOwnership(stranger);
    }

    function test_transferOwnership_revert_zeroAddress() public {
        vm.prank(nftOwner);
        vm.expectRevert(SubscriptionNFT.Unauthorized.selector);
        nft.transferOwnership(address(0));
    }
}
