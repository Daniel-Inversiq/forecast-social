export type WalletIdentityFields = {
  username: string;
  ens_name?: string | null;
  wallet_address?: string | null;
  wallet_address_short?: string | null;
  wallet_chain?: string | null;
  wallet_chain_label?: string | null;
  wallet_verified?: boolean;
};

export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function walletDisplayLabel(identity: WalletIdentityFields): string | null {
  if (identity.ens_name) return identity.ens_name;
  if (identity.wallet_address_short) return identity.wallet_address_short;
  if (identity.wallet_address) return shortenAddress(identity.wallet_address);
  return null;
}

export function hasVerifiedWallet(identity: Pick<WalletIdentityFields, "wallet_verified" | "wallet_address">): boolean {
  return Boolean(identity.wallet_verified && identity.wallet_address);
}

export function walletPrimaryName(identity: WalletIdentityFields): string {
  return walletDisplayLabel(identity) ?? `@${identity.username}`;
}

export function walletSecondaryLabel(identity: WalletIdentityFields): string | null {
  if (identity.ens_name && identity.wallet_address_short) {
    return identity.wallet_address_short;
  }
  if (hasVerifiedWallet(identity) && identity.wallet_chain_label) {
    return identity.wallet_chain_label;
  }
  return null;
}
