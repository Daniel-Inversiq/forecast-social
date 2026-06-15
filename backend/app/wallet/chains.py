"""Supported chain configuration — future-ready for USDC balances and staking."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ChainConfig:
    key: str
    name: str
    chain_id: int
    native_symbol: str
    usdc_address: str | None = None


SUPPORTED_CHAINS: dict[str, ChainConfig] = {
    "base": ChainConfig(
        key="base",
        name="Base",
        chain_id=8453,
        native_symbol="ETH",
        usdc_address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ),
    "polygon": ChainConfig(
        key="polygon",
        name="Polygon",
        chain_id=137,
        native_symbol="MATIC",
        usdc_address="0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    ),
}


def normalize_chain(chain: str) -> str:
    key = chain.strip().lower()
    if key not in SUPPORTED_CHAINS:
        raise ValueError(f"Unsupported chain: {chain}")
    return key


def chain_label(chain: str) -> str:
    return SUPPORTED_CHAINS[normalize_chain(chain)].name


def is_supported_chain(chain: str) -> bool:
    try:
        normalize_chain(chain)
        return True
    except ValueError:
        return False
