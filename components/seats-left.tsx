type SeatsLeftProps = {
  seatsLeft: number;
};

/** The seat count on every ride card (F-C3). */
export function SeatsLeft({ seatsLeft }: SeatsLeftProps) {
  if (seatsLeft <= 0) {
    return (
      <span className="font-medium whitespace-nowrap text-red-600">Full</span>
    );
  }
  const noun = seatsLeft === 1 ? "seat" : "seats";
  return (
    <span className="font-medium whitespace-nowrap">{`${seatsLeft} ${noun} left`}</span>
  );
}
