export type InventoryStack = Readonly<{
  key: string;
  quantity: bigint;
}>;

export type InventoryAddition = Readonly<{
  key: string;
  quantity: bigint;
}>;

function slotsFor(quantity: bigint, stackLimit: bigint): bigint {
  if (quantity < 0n) throw new Error("INVENTORY_QUANTITY_NEGATIVE");
  if (stackLimit <= 0n) throw new Error("STACK_LIMIT_INVALID");
  if (quantity === 0n) return 0n;
  return (quantity + stackLimit - 1n) / stackLimit;
}

export function inventorySlotsUsed(
  stacks: readonly InventoryStack[],
  stackLimit: number
): number {
  if (!Number.isSafeInteger(stackLimit) || stackLimit <= 0) {
    throw new Error("STACK_LIMIT_INVALID");
  }

  const limit = BigInt(stackLimit);
  let total = 0n;

  for (const stack of stacks) {
    total += slotsFor(stack.quantity, limit);
  }

  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("INVENTORY_SLOT_COUNT_TOO_LARGE");
  }

  return Number(total);
}

export function canFitInventory(input: Readonly<{
  stacks: readonly InventoryStack[];
  additions: readonly InventoryAddition[];
  stackLimit: number;
  inventorySlots: number;
}>): boolean {
  const { stacks, additions, stackLimit, inventorySlots } = input;

  if (!Number.isSafeInteger(inventorySlots) || inventorySlots < 0) {
    throw new Error("INVENTORY_SLOT_LIMIT_INVALID");
  }

  const quantities = new Map<string, bigint>();

  for (const stack of stacks) {
    if (stack.quantity < 0n) throw new Error("INVENTORY_QUANTITY_NEGATIVE");
    quantities.set(
      stack.key,
      (quantities.get(stack.key) ?? 0n) + stack.quantity
    );
  }

  for (const addition of additions) {
    if (addition.quantity <= 0n) {
      throw new Error("INVENTORY_ADDITION_MUST_BE_POSITIVE");
    }
    quantities.set(
      addition.key,
      (quantities.get(addition.key) ?? 0n) + addition.quantity
    );
  }

  const projected = [...quantities.entries()].map(([key, quantity]) => ({
    key,
    quantity
  }));

  return inventorySlotsUsed(projected, stackLimit) <= inventorySlots;
}
