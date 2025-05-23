# SamuraiLoan Protocol on Solana

A decentralized lending and borrowing protocol built on Solana using Anchor. Users can deposit collateral and borrow supported tokens against over-collateralized positions with specific token-to-token pairs.

## Overview

SamuraiLoan Protocol enables:

- Depositing supported SPL tokens as collateral
- Borrowing other supported tokens with over-collateralization
- Managing positions with real-time health factors
- Liquidating undercollateralized positions
- Incentivizing liquidators
- Secure pricing via oracle integrations

## Key Features

- **Token-Specific Collateralization**: Each token pair has specific collateralization requirements
- **Dynamic Interest Rate**: 3% APR
- **Liquidation Threshold**: 80% LTV
- **Oracle Integration**: Chainlink Solana price feeds
- **Price Staleness Timeout**: 3 hours
- **Liquidator Bonus**: 10% of seized collateral
- **Per-Second Interest Accrual**: Interest is calculated and accrued every second
- **Overcollateralized Loans Only**: All positions must maintain sufficient collateral

## Supported Tokens

- **WETH** (Wrapped Ether - SPL Version)
- **WBTC** (Wrapped Bitcoin - SPL Version)
- **DAI** (Stablecoin - SPL Version)

## Technical Details

### Protocol Parameters

- Interest Rate: 300 basis points (3.00%)
- Liquidation Threshold: 8000 basis points (80.00%)
- Price Stale Threshold: 10800 seconds (3 hours)

### Smart Contract Architecture

- Built using Anchor Framework
- PDA-based account structure
- Oracle price feed integration
- Automated liquidation system

## Development

### Prerequisites

- Rust
- Solana Tool Suite
- Anchor Framework
- Node.js and npm

### Building

```bash
anchor build
```

### Testing

```bash
anchor test
```

### Deployment

```bash
anchor deploy
```

## Security

- All positions are over-collateralized
- Price feeds from Chainlink ensure accurate valuations
- Automated liquidation system protects protocol solvency
- Regular security audits
- Emergency pause functionality

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
