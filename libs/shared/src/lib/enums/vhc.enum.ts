export enum VhcRating {
  GREEN = 'GREEN',
  AMBER = 'AMBER',
  RED = 'RED',
}

export const VHC_RATING_COLOURS: Record<VhcRating, string> = {
  [VhcRating.GREEN]: '#2E7D32',
  [VhcRating.AMBER]: '#EF6C00',
  [VhcRating.RED]: '#C62828',
};
