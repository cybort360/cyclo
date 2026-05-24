// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal ERC-20 interface scoped to the USDC operations Cyclo requires.
/// All amounts are in 6-decimal units (1 USDC = 1_000_000).
interface IUSDC {
    /// @notice Transfers tokens from the caller to a recipient.
    /// @param to Recipient address
    /// @param amount Amount in 6-decimal USDC units
    /// @return True on success
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Transfers tokens from an approved spender on behalf of an owner.
    /// @param from Token owner address
    /// @param to Recipient address
    /// @param amount Amount in 6-decimal USDC units
    /// @return True on success
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /// @notice Approves a spender to transfer up to amount on the caller's behalf.
    /// @param spender Address being approved
    /// @param amount Maximum transferable amount in 6-decimal USDC units
    /// @return True on success
    function approve(address spender, uint256 amount) external returns (bool);

    /// @notice Returns the remaining allowance a spender has from an owner.
    /// @param owner Token owner address
    /// @param spender Approved spender address
    /// @return Remaining allowance in 6-decimal USDC units
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Returns the USDC balance of an account.
    /// @param account The address to query
    /// @return Balance in 6-decimal USDC units
    function balanceOf(address account) external view returns (uint256);
}
