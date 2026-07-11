import { ListingStatus } from '@sbf/contracts';

export async function relistListing(listing) {
  if (!listing) return;
  if (listing.status === ListingStatus.SOLD) {
    await listing.update({ status: ListingStatus.ACTIVE, soldAt: null });
  } else if (listing.status === ListingStatus.ACTIVE) {
    await listing.increment('quantity');
  }
}
