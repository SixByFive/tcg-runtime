export async function relistListing(listing) {
  if (!listing) return;
  if (listing.status === 'SOLD') {
    await listing.update({ status: 'ACTIVE', soldAt: null });
  } else if (listing.status === 'ACTIVE') {
    await listing.increment('quantity');
  }
}
