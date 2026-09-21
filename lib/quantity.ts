const QUANTITY_SCALE = 1000;
const QUANTITY_TOLERANCE = 1e-9;

export function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * QUANTITY_SCALE) / QUANTITY_SCALE;
}

export function isValidQuantity(value: number, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0))
    return false;
  const scaled = value * QUANTITY_SCALE;
  return Math.abs(scaled - Math.round(scaled)) <= QUANTITY_TOLERANCE;
}

export function addQuantities(left: number, right: number) {
  return roundQuantity(left + right);
}

export function subtractQuantities(left: number, right: number) {
  return roundQuantity(left - right);
}

export function formatQuantity(value: number) {
  return roundQuantity(value).toLocaleString('en-US', {
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

export function planPurchaseQuantityAdjustment(input: {
  currentBatchQuantity: number;
  currentPurchaseQuantity: number;
  newPurchaseQuantity: number;
  identityChanged: boolean;
}) {
  const currentBatchQuantity = roundQuantity(input.currentBatchQuantity);
  const currentPurchaseQuantity = roundQuantity(input.currentPurchaseQuantity);
  const newPurchaseQuantity = roundQuantity(input.newPurchaseQuantity);

  if (input.identityChanged) {
    if (currentBatchQuantity < currentPurchaseQuantity)
      return { allowed: false as const };
    return {
      allowed: true as const,
      currentBatchAfter: subtractQuantities(
        currentBatchQuantity,
        currentPurchaseQuantity,
      ),
      currentBatchChange: -currentPurchaseQuantity,
      targetQuantityToAdd: newPurchaseQuantity,
    };
  }

  const currentBatchChange = subtractQuantities(
    newPurchaseQuantity,
    currentPurchaseQuantity,
  );
  if (
    currentBatchChange < 0 &&
    currentBatchQuantity < Math.abs(currentBatchChange)
  )
    return { allowed: false as const };
  return {
    allowed: true as const,
    currentBatchAfter: addQuantities(currentBatchQuantity, currentBatchChange),
    currentBatchChange,
    targetQuantityToAdd: 0,
  };
}
