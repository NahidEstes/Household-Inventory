export type EssentialStatus =
  | 'In Stock'
  | 'Buy Soon'
  | 'Low Stock'
  | 'Out of Stock';

export function essentialStatus(
  stock: number,
  minimum: number,
): EssentialStatus {
  if (stock <= 0) return 'Out of Stock';
  if (stock < minimum) return 'Low Stock';
  if (stock === minimum) return 'Buy Soon';
  return 'In Stock';
}

export function essentialShoppingQuantity(stock: number, minimum: number) {
  return stock < minimum ? Number((minimum - stock).toFixed(3)) : 1;
}

export function aggregateEssentialStock(
  product: { normalizedName: string; normalizedBrand: string; unit: string },
  batches: Array<{
    normalizedName: string | null;
    normalizedBrand: string | null;
    name: string;
    brand: string | null;
    unit: string;
    quantity: number;
    category: string;
    location: string;
  }>,
  normalize: (name: string) => string,
) {
  const matching = batches.filter(
    (batch) =>
      (batch.normalizedName ?? normalize(batch.name)) ===
        product.normalizedName &&
      (batch.normalizedBrand ?? normalize(batch.brand ?? '')) ===
        product.normalizedBrand &&
      batch.unit.toLowerCase() === product.unit.toLowerCase(),
  );
  return {
    matching,
    currentStock: Number(
      matching.reduce((sum, batch) => sum + batch.quantity, 0).toFixed(3),
    ),
  };
}
